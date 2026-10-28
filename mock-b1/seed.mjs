// Invented demo data for the mock SAP B1. Customer names come from SAW's public case studies;
// every code, balance, price and stock figure below is made up for the demo.
const today = new Date();
const d = (daysAgo) => new Date(today.getTime() - daysAgo * 864e5).toISOString().slice(0, 10);

const paymentTerms = [
  { GroupNumber: 1, PaymentTermsGroupName: 'COD' },
  { GroupNumber: 2, PaymentTermsGroupName: '30 days from statement' },
  { GroupNumber: 3, PaymentTermsGroupName: '50% deposit, balance on handover' },
  { GroupNumber: 4, PaymentTermsGroupName: '60 days' },
];

const bp = (CardCode, CardName, PayTermsGrpCode, CreditLimit, OpeningBalance, extra = {}) => ({
  CardCode, CardName, CardType: 'cCustomer', GroupCode: 100, FederalTaxID: null, EmailAddress: null, Phone1: null, Website: null,
  PayTermsGrpCode, PriceListNum: 1, CreditLimit, OpeningBalance, CurrentAccountBalance: OpeningBalance, OpenInvoicesCount: 0,
  Notes: 'DEMO DATA', U_CRM_ID: null, ContactEmployees: [], UpdateDate: d(30), UpdateTime: '09:00:00', CreateDate: d(900), ...extra,
});

const businessPartners = [
  bp('C00012', 'Sun City Resort (Superbowl)', 4, 2500000, 0),
  bp('C00031', 'Mosaiek Church', 2, 600000, 0),
  bp('C00047', 'KwaSizabantu Mission', 3, 1500000, 0),
  bp('C00058', 'Guild Theatre East London', 2, 400000, 0),
  bp('C00063', 'The Caudan Arts Centre', 2, 800000, 0),
  bp('C00071', 'BAPS Swaminarayan Sanstha', 3, 2000000, 0),
  bp('C00084', 'Christian Family Church', 3, 3000000, 0),
  bp('C00090', 'Rivers Church', 3, 2500000, 0),
  bp('C00102', "Father's House Church Gqeberha", 2, 350000, 0),
  bp('C00115', 'Park Hyatt Johannesburg', 4, 500000, 0),
  bp('D00007', 'Gearworx (reseller)', 2, 750000, 0, { GroupCode: 102, PriceListNum: 3 }),
];

const item = (ItemCode, ItemName, ItemsGroupCode, brand, price, midrand, windhoek, ordered = 0) => ({
  ItemCode, ItemName, ItemsGroupCode, U_Brand: brand, SalesUnit: 'ea', InventoryItem: ItemsGroupCode === 106 ? 'tNO' : 'tYES', SalesItem: 'tYES',
  ItemPrices: [{ PriceList: 1, Price: price, Currency: 'ZAR' }, { PriceList: 3, Price: +(price * 0.82).toFixed(2), Currency: 'ZAR' }],
  ItemWarehouseInfoCollection: [
    { WarehouseCode: 'MID01', InStock: midrand, Committed: 0, Ordered: ordered },
    { WarehouseCode: 'WHK01', InStock: windhoek, Committed: 0, Ordered: 0 },
  ],
  UpdateDate: d(2), UpdateTime: '07:30:00',
});

// Item groups: 101 Loudspeakers, 102 Amplification, 103 Mixing, 104 Video, 105 Networking, 106 Services
const items = [
  item('DB-KSL8', 'd&b KSL8 line array loudspeaker', 101, 'd&b audiotechnik', 268000, 8, 0, 12),
  item('DB-KSL-SUB', 'd&b KSL-SUB subwoofer', 101, 'd&b audiotechnik', 214000, 4, 0, 6),
  item('DB-Y10P', 'd&b Y10P point source loudspeaker', 101, 'd&b audiotechnik', 58500, 16, 2),
  item('DB-E8', 'd&b E8 loudspeaker', 101, 'd&b audiotechnik', 24900, 24, 4),
  item('DB-D80', 'd&b D80 4-channel amplifier', 102, 'd&b audiotechnik', 189000, 6, 1, 4),
  item('DB-DS10', 'd&b DS10 audio network bridge', 105, 'd&b audiotechnik', 41500, 5, 0),
  item('DB-SOUNDSCAPE', 'd&b Soundscape DS100 signal engine', 103, 'd&b audiotechnik', 392000, 1, 0, 1),
  item('YAM-DM7', 'Yamaha DM7 digital mixing console', 103, 'Yamaha', 398000, 2, 0, 2),
  item('YAM-CL5', 'Yamaha CL5 digital mixing console', 103, 'Yamaha', 455000, 1, 0),
  item('YAM-RIO3224', 'Yamaha Rio3224-D3 I/O rack', 105, 'Yamaha', 176000, 3, 0),
  item('WAV-LV1', 'Waves LV1 Classic live mixer bundle', 103, 'Waves Live', 96500, 4, 1),
  item('PA-MPS', 'Plus Audio MPS series loudspeaker', 101, 'Plus Audio', 18900, 40, 6),
  item('PXP-XCELL', 'Pixel Plus Xcell LED panel (per m²)', 104, 'Pixel Plus', 21500, 60, 0, 40),
  item('BMD-ATEM4ME', 'Blackmagic ATEM Constellation 4 M/E', 104, 'Blackmagic Design', 118000, 2, 0),
  item('GEN-8330A', 'Genelec 8330A studio monitor', 101, 'Genelec', 22400, 10, 2),
  item('SVC-COMM', 'Commissioning (per day)', 106, 'Other', 14500, 0, 0),
  item('SVC-DESIGN', 'System design & BOQ', 106, 'Other', 38000, 0, 0),
  item('SVC-TRAIN', 'Operator training (per day)', 106, 'Other', 12500, 0, 0),
  item('PRJ-LUMPSUM', 'Project per CRM proposal (lump sum)', 106, 'Other', 0, 0, 0),
];

// A few historical open invoices so balances are not all zero.
const invoice = (DocEntry, DocNum, CardCode, total, daysAgo, open = true) => {
  const b = businessPartners.find((x) => x.CardCode === CardCode);
  return { DocEntry, DocNum, DocType: 'dDocument_Items', DocDate: d(daysAgo), DocDueDate: d(daysAgo - 30), CardCode, CardName: b.CardName,
    NumAtCard: null, Comments: 'Demo history', DocCurrency: 'ZAR', DocTotal: total, VatSum: +(total - total / 1.15).toFixed(2),
    DocumentStatus: open ? 'bost_Open' : 'bost_Close', Cancelled: 'tNO', UpdateDate: d(daysAgo), UpdateTime: '10:00:00',
    DocumentLines: [{ LineNum: 0, ItemCode: 'SVC-COMM', ItemDescription: 'Service visit and parts', Quantity: 1, UnitPrice: +(total / 1.15).toFixed(2), LineTotal: +(total / 1.15).toFixed(2), BaseType: -1, BaseEntry: null, BaseLine: null, LineStatus: 'bost_Close' }],
    U_CRM_ID: null };
};
const invoices = [
  invoice(1, 200901, 'C00084', 184000, 20),
  invoice(2, 200902, 'C00063', 61200, 45),
  invoice(3, 200903, 'C00012', 92800, 70),
  invoice(4, 200904, 'D00007', 245300, 12),
  invoice(5, 200905, 'C00031', 18400, 120, false),
];

export function seed() {
  const db = { paymentTerms, businessPartners, items, quotations: [], orders: [], invoices,
    counters: { bp: 200, cnt: 500, QuotationsEntry: 0, QuotationsNum: 1000, OrdersEntry: 0, OrdersNum: 1000, InvoicesEntry: 10, InvoicesNum: 1000 } };
  for (const b of db.businessPartners) {
    const open = invoices.filter((i) => i.CardCode === b.CardCode && i.DocumentStatus === 'bost_Open');
    b.CurrentAccountBalance = +open.reduce((s, i) => s + i.DocTotal, 0).toFixed(2);
    b.OpenInvoicesCount = open.length;
  }
  return db;
}
