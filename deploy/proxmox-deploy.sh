#!/usr/bin/env bash
# Deploys the SAW Twenty CRM demo into a new Debian 12 LXC on this Proxmox host.
# Run as root in the PVE shell. Needs GH_TOKEN (read-only access to stageaudioworks/saw-twenty-demo).
#
# Overrides (environment variables):
#   CTID         container ID (default: next free)
#   CT_HOSTNAME  default saw-crm-test
#   STORAGE      default zfs1
#   BRIDGE       default vmbr0
#   CORES/MEMORY/DISK  default 4 / 8192 MB / 40 GB
#   PUBLIC_URL   default https://crm-test.stageaudioworks.com
set -euo pipefail

REPO="stageaudioworks/saw-twenty-demo"
CTID="${CTID:-}"
CT_HOSTNAME="${CT_HOSTNAME:-saw-crm-test}"
STORAGE="${STORAGE:-zfs1}"
BRIDGE="${BRIDGE:-vmbr0}"
CORES="${CORES:-4}"
MEMORY="${MEMORY:-8192}"
DISK="${DISK:-40}"
PUBLIC_URL="${PUBLIC_URL:-https://crm-test.stageaudioworks.com}"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || fail "Run as root on the Proxmox host."
command -v pct >/dev/null || fail "pct not found: run this on the Proxmox host, not inside a container."
if [ -z "${GH_TOKEN:-}" ]; then
  read -rsp "GitHub token (read-only, for ${REPO}): " GH_TOKEN </dev/tty; echo
fi
[ -n "$GH_TOKEN" ] || fail "No GitHub token given."

# ---------- checks ----------
say "Checking the host"
pvesm status -content rootdir 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$STORAGE" \
  || fail "Storage '$STORAGE' not found or cannot hold containers. Set STORAGE=<name>."
ip link show "$BRIDGE" >/dev/null 2>&1 || fail "Bridge '$BRIDGE' not found. Set BRIDGE=<name>."
if pvesm status 2>/dev/null | awk -v s="$STORAGE" '$1==s{print $2}' | grep -q zfspool; then
  ZFS_VER=$(zfs version 2>/dev/null | head -1 | sed -E 's/^zfs-([0-9]+\.[0-9]+).*/\1/')
  # Docker's overlay filesystem on a ZFS-backed container needs OpenZFS 2.2 or later (Proxmox 8.1+).
  if [ -n "$ZFS_VER" ] && [ "$(printf '%s\n2.2\n' "$ZFS_VER" | sort -V | head -1)" != "2.2" ]; then
    fail "OpenZFS $ZFS_VER is too old for Docker in an LXC on ZFS (needs 2.2+). Update Proxmox or use a VM."
  fi
fi
curl -fsS -o /dev/null -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/${REPO}" \
  || fail "GitHub token cannot read ${REPO}. Check its repository access and Contents: read permission."

CTID="${CTID:-$(pvesh get /cluster/nextid)}"
pct status "$CTID" >/dev/null 2>&1 && fail "Container $CTID already exists. Set CTID=<free id>."

# ---------- template ----------
say "Finding a Debian 12 template"
TSTORE=$(pvesm status -content vztmpl 2>/dev/null | awk 'NR>1{print $1; exit}')
[ -n "$TSTORE" ] || fail "No storage allows container templates (vztmpl)."
TEMPLATE=$(pveam list "$TSTORE" 2>/dev/null | awk '/debian-12-standard/{print $1}' | sort -V | tail -1)
if [ -z "$TEMPLATE" ]; then
  pveam update >/dev/null
  TNAME=$(pveam available --section system | awk '/debian-12-standard/{print $2}' | sort -V | tail -1)
  [ -n "$TNAME" ] || fail "Debian 12 template not available from pveam."
  pveam download "$TSTORE" "$TNAME"
  TEMPLATE="${TSTORE}:vztmpl/${TNAME}"
fi
echo "Template: $TEMPLATE"

# ---------- container ----------
say "Creating container $CTID ($CT_HOSTNAME) on $STORAGE"
pct create "$CTID" "$TEMPLATE" \
  --hostname "$CT_HOSTNAME" --cores "$CORES" --memory "$MEMORY" --swap 1024 \
  --rootfs "${STORAGE}:${DISK}" --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
  --features nesting=1,keyctl=1 --unprivileged 1 --onboot 1 \
  --description "SAW Twenty CRM demo (github.com/${REPO})"
pct start "$CTID"

say "Waiting for the container to get a DHCP address"
CT_IP=""
for _ in $(seq 1 60); do
  CT_IP=$(pct exec "$CTID" -- sh -c "hostname -I 2>/dev/null | awk '{print \$1}'" 2>/dev/null || true)
  [ -n "$CT_IP" ] && pct exec "$CTID" -- sh -c 'getent hosts deb.debian.org >/dev/null' 2>/dev/null && break
  sleep 2
done
[ -n "$CT_IP" ] || fail "Container $CTID did not get an IP address from DHCP."
echo "Container IP: $CT_IP"

# ---------- inside the container ----------
say "Installing git and Docker inside the container"
pct exec "$CTID" -- bash -c '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl git openssl >/dev/null
  curl -fsSL https://get.docker.com | sh >/dev/null
  systemctl enable --now docker >/dev/null
  docker info --format "Docker {{.ServerVersion}}, storage driver {{.Driver}}"
'

say "Cloning ${REPO}"
# The token is handed over in a root-only file and deleted straight after; it is not stored in git config.
TOKFILE=$(mktemp); chmod 600 "$TOKFILE"; printf '%s' "$GH_TOKEN" > "$TOKFILE"
pct push "$CTID" "$TOKFILE" /root/.gh-token --perms 600
rm -f "$TOKFILE"
pct exec "$CTID" -- bash -c "
  set -e
  AUTH=\$(printf 'x-access-token:%s' \"\$(cat /root/.gh-token)\" | base64 -w0)
  rm -f /root/.gh-token
  rm -rf /opt/saw-twenty-demo
  git -c credential.helper= -c \"http.extraHeader=Authorization: Basic \$AUTH\" \
    clone --depth 1 https://github.com/${REPO}.git /opt/saw-twenty-demo
"

say "Installing the demo (Twenty, mock SAP B1, sync service) — the first start takes a few minutes"
pct exec "$CTID" -- bash -c "cd /opt/saw-twenty-demo && chmod +x install.sh && ./install.sh '${PUBLIC_URL}'"

say "Finished"
cat <<EOF
  Container ........... $CTID ($CT_HOSTNAME), IP $CT_IP
  Twenty (LAN) ........ http://${CT_IP}:3000
  Public URL .......... ${PUBLIC_URL}
  Mock SAP B1 ......... http://${CT_IP}:50000/
  Sync status ......... http://${CT_IP}:8088/

  Cloudflare Tunnel: add a public hostname for ${PUBLIC_URL#https://}
  pointing to  http://${CT_IP}:3000  on your existing connector.
  Sign-in links use ${PUBLIC_URL}, so sign in there once the hostname is live.

  Admin login: shown above (also in /opt/saw-twenty-demo/.env inside the container):
    pct exec $CTID -- grep -E '^ADMIN_(EMAIL|PASSWORD)=' /opt/saw-twenty-demo/.env
EOF
