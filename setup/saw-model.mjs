// Stage Audio Works data model for Twenty.
// Edit this file to change fields; rerunning setup only adds what is missing
// (it never deletes fields or records).

export const MARKETS = [
  'House of worship', 'Theatres & live venues', 'Rental & staging', 'Corporate', 'Education',
  'Government', 'Hospitality', 'Museums & experiences', 'Broadcast', 'General integration',
];

export const BRANDS = [
  'd&b audiotechnik', 'Yamaha', 'Waves Live', 'Plus Audio', 'Pixel Plus', 'Plus Lighting', 'Stage Plus',
  'Blackmagic Design', 'Christie', 'Analog Way', 'NovaStar', 'Appotronics', 'Genelec', 'Audinate',
  'Crestron', 'Logitech', 'LG', 'High End Systems', 'Cameo', 'ACME', 'dBTechnologies', 'Audac',
  'Kiloview', 'Hollyland', 'Atlona', 'Other',
];

export const BRANCHES = ['Midrand', 'Windhoek', 'Cape Town'];

export const REGIONS = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga',
  'North West', 'Northern Cape', 'Namibia', 'Botswana', 'Mauritius', 'Kenya', 'Nigeria', 'Other Africa',
  'International',
];

export const SYNC_STATUS = [['Not linked', 'gray'], ['Pending push', 'yellow'], ['Linked', 'green'], ['Sync error', 'red']];

// SAW pipeline. Order matters: it is the kanban column order.
export const STAGES = [
  ['Lead', 'gray'], ['Qualified', 'sky'], ['Site survey', 'blue'], ['Design & BOQ', 'purple'],
  ['Proposal sent', 'yellow'], ['Negotiation', 'orange'], ['Won', 'green'], ['Lost', 'red'], ['On hold', 'pink'],
];

// Fields added to Twenty's standard objects.
export const STANDARD_FIELDS = {
  company: [
    { name: 'customerType', label: 'Customer type', type: 'SELECT', icon: 'IconTag', options: [
      'End client', 'Reseller / dealer', 'Integrator / contractor', 'Consultant / specifier',
      'Rental & staging company', 'Government / parastatal'] },
    { name: 'market', label: 'Market', type: 'SELECT', icon: 'IconBuildingChurch', options: MARKETS },
    { name: 'region', label: 'Region', type: 'SELECT', icon: 'IconMap', options: REGIONS },
    { name: 'branch', label: 'SAW branch', type: 'SELECT', icon: 'IconBuildingWarehouse', options: BRANCHES },
    { name: 'tradeAccount', label: 'Trade account', type: 'BOOLEAN', icon: 'IconId', defaultValue: false },
    { name: 'priceList', label: 'Price list', type: 'SELECT', icon: 'IconReceipt', options: ['Retail', 'Trade', 'Dealer', 'Rental', 'Projects'] },
    { name: 'bbbeeLevel', label: 'B-BBEE level', type: 'SELECT', icon: 'IconCertificate', options: [
      'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Non-compliant', 'Unknown'] },
    { name: 'vatNumber', label: 'VAT number', type: 'TEXT', icon: 'IconReceiptTax' },
    // Owned by SAP B1 — written by the sync service
    { name: 'sapCardCode', label: 'SAP card code', type: 'TEXT', icon: 'IconLink', isUnique: true },
    { name: 'sapSyncStatus', label: 'SAP sync status', type: 'SELECT', icon: 'IconRefresh', options: SYNC_STATUS, defaultValue: "'NOT_LINKED'" },
    { name: 'sapLastSync', label: 'SAP last synced', type: 'DATE_TIME', icon: 'IconClock' },
    { name: 'sapBalance', label: 'SAP balance (ZAR)', type: 'CURRENCY', icon: 'IconCash' },
    { name: 'sapCreditLimit', label: 'SAP credit limit (ZAR)', type: 'CURRENCY', icon: 'IconCreditCard' },
    { name: 'sapPaymentTerms', label: 'SAP payment terms', type: 'TEXT', icon: 'IconCalendarDollar' },
    { name: 'sapOpenInvoices', label: 'SAP open invoices', type: 'NUMBER', icon: 'IconFileInvoice' },
  ],
  person: [
    { name: 'jobRole', label: 'Role', type: 'SELECT', icon: 'IconUserCog', options: [
      'Owner / MD', 'Senior pastor', 'Technical director', 'Production manager', 'FOH / audio engineer',
      'Video / broadcast lead', 'IT manager', 'Facilities manager', 'Procurement', 'Consultant', 'Other'] },
    { name: 'decisionRole', label: 'Decision role', type: 'SELECT', icon: 'IconGavel', options: [
      'Decision maker', 'Influencer', 'Technical evaluator', 'User', 'Finance / procurement'] },
    { name: 'sapContactCode', label: 'SAP contact code', type: 'TEXT', icon: 'IconLink' },
  ],
  opportunity: [
    { name: 'dealType', label: 'Deal type', type: 'SELECT', icon: 'IconBriefcase', options: [
      'Project (supply & install)', 'Supply only', 'Tender', 'Rental & staging sale', 'Service & maintenance', 'Training'] },
    { name: 'serviceLines', label: 'Service lines', type: 'MULTI_SELECT', icon: 'IconTools', options: [
      'Design & consulting', 'Integration', 'Manufacturing (Stage Plus)', 'Supply & distribution', 'Support', 'Training'] },
    { name: 'brands', label: 'Brands', type: 'MULTI_SELECT', icon: 'IconSpeakerphone', options: BRANDS },
    { name: 'market', label: 'Market', type: 'SELECT', icon: 'IconBuildingChurch', options: MARKETS },
    { name: 'venue', label: 'Venue / site', type: 'TEXT', icon: 'IconMapPin' },
    { name: 'expectedInstallDate', label: 'Expected install', type: 'DATE', icon: 'IconCalendarEvent' },
    { name: 'marginPercent', label: 'Margin %', type: 'NUMBER', icon: 'IconPercentage' },
    { name: 'biddingEntity', label: 'Bidding entity', type: 'SELECT', icon: 'IconBuildingBank', options: [['Stage Audio Works', 'blue'], ['Mitech Direct', 'turquoise']] },
    { name: 'tenderReference', label: 'Tender reference', type: 'TEXT', icon: 'IconFileCertificate' },
    { name: 'tenderClosingDate', label: 'Tender closing', type: 'DATE_TIME', icon: 'IconAlarm' },
    { name: 'lossReason', label: 'Loss reason', type: 'SELECT', icon: 'IconThumbDown', options: [
      'Price', 'Competitor brand', 'Budget cut', 'Project cancelled', 'Timing', 'Specification changed'] },
    // Owned by SAP B1 — written by the sync service
    { name: 'sapQuotationNo', label: 'SAP quotation no.', type: 'TEXT', icon: 'IconFileText' },
    { name: 'sapSalesOrderNo', label: 'SAP sales order no.', type: 'TEXT', icon: 'IconFileCheck' },
    { name: 'sapOrderStatus', label: 'SAP order status', type: 'TEXT', icon: 'IconTruckDelivery' },
    { name: 'sapSyncStatus', label: 'SAP sync status', type: 'SELECT', icon: 'IconRefresh', options: SYNC_STATUS, defaultValue: "'NOT_LINKED'" },
  ],
};

// Custom objects. Relations are created after all objects exist.
export const CUSTOM_OBJECTS = [
  {
    nameSingular: 'project', namePlural: 'projects', labelSingular: 'Project', labelPlural: 'Projects',
    icon: 'IconHammer', description: 'Delivery of a won project, from procurement to handover',
    fields: [
      { name: 'status', label: 'Status', type: 'SELECT', icon: 'IconProgress', options: [
        ['Planning', 'gray'], ['Procurement', 'sky'], ['Manufacturing', 'purple'], ['Installation', 'blue'],
        ['Commissioning', 'orange'], ['Handover', 'yellow'], ['Closed', 'green']] },
      { name: 'contractValue', label: 'Contract value', type: 'CURRENCY', icon: 'IconCash' },
      { name: 'startDate', label: 'Start', type: 'DATE', icon: 'IconCalendar' },
      { name: 'handoverDate', label: 'Handover', type: 'DATE', icon: 'IconCalendarCheck' },
      { name: 'siteAddress', label: 'Site address', type: 'ADDRESS', icon: 'IconMapPin' },
      { name: 'sowStatus', label: 'SOW status', type: 'SELECT', icon: 'IconFileDescription', options: [['Draft', 'gray'], ['Sent', 'yellow'], ['Signed', 'green']] },
      { name: 'projectManager', label: 'Project manager', type: 'TEXT', icon: 'IconUser' },
      { name: 'sapProjectCode', label: 'SAP project code', type: 'TEXT', icon: 'IconLink' },
    ],
  },
  {
    nameSingular: 'installedSystem', namePlural: 'installedSystems', labelSingular: 'Installed system', labelPlural: 'Installed systems',
    icon: 'IconSpeakerphone', description: 'Equipment installed at a client site — the installed base',
    fields: [
      { name: 'category', label: 'Category', type: 'SELECT', icon: 'IconCategory', options: [
        'PA / line array', 'Point source & fills', 'Mixing', 'Wireless & RF', 'LED video', 'Projection',
        'Lighting', 'Control', 'Network', 'Broadcast', 'Conferencing', 'Background music'] },
      { name: 'brand', label: 'Brand', type: 'SELECT', icon: 'IconTag', options: BRANDS },
      { name: 'model', label: 'Model', type: 'TEXT', icon: 'IconBox' },
      { name: 'serialNumber', label: 'Serial no.', type: 'TEXT', icon: 'IconBarcode' },
      { name: 'installDate', label: 'Installed', type: 'DATE', icon: 'IconCalendar' },
      { name: 'warrantyExpiry', label: 'Warranty expiry', type: 'DATE', icon: 'IconShieldCheck' },
      { name: 'firmware', label: 'Firmware', type: 'TEXT', icon: 'IconCpu' },
      { name: 'sapItemCode', label: 'SAP item code', type: 'TEXT', icon: 'IconLink' },
    ],
  },
  {
    nameSingular: 'supportCase', namePlural: 'supportCases', labelSingular: 'Support case', labelPlural: 'Support cases',
    icon: 'IconLifebuoy', description: 'Repairs, warranty claims, call-outs and RMAs',
    fields: [
      { name: 'caseType', label: 'Type', type: 'SELECT', icon: 'IconTag', options: [
        'Repair', 'Warranty claim', 'Technical support', 'Site call-out', 'RMA'] },
      { name: 'status', label: 'Status', type: 'SELECT', icon: 'IconProgress', options: [
        ['New', 'gray'], ['In progress', 'blue'], ['Waiting on client', 'yellow'], ['Waiting on manufacturer', 'orange'], ['Resolved', 'green']] },
      { name: 'priority', label: 'Priority', type: 'SELECT', icon: 'IconFlag', options: [['Low', 'gray'], ['Normal', 'blue'], ['High', 'orange'], ['Show-stopper', 'red']] },
      { name: 'branch', label: 'Branch', type: 'SELECT', icon: 'IconBuildingWarehouse', options: BRANCHES },
      { name: 'serialNumber', label: 'Serial no.', type: 'TEXT', icon: 'IconBarcode' },
      { name: 'details', label: 'Details', type: 'TEXT', icon: 'IconNotes' },
      { name: 'sapServiceCallId', label: 'SAP service call ID', type: 'TEXT', icon: 'IconLink' },
    ],
  },
  {
    nameSingular: 'product', namePlural: 'products', labelSingular: 'Product', labelPlural: 'Products',
    icon: 'IconPackage', description: 'Read-only mirror of SAP B1 items and stock, refreshed by the sync service',
    fields: [
      { name: 'itemCode', label: 'Item code', type: 'TEXT', icon: 'IconBarcode', isUnique: true },
      { name: 'brand', label: 'Brand', type: 'SELECT', icon: 'IconTag', options: BRANDS },
      { name: 'itemGroup', label: 'Item group', type: 'TEXT', icon: 'IconCategory' },
      { name: 'listPrice', label: 'List price', type: 'CURRENCY', icon: 'IconCash' },
      { name: 'stockMidrand', label: 'Stock Midrand', type: 'NUMBER', icon: 'IconBuildingWarehouse' },
      { name: 'stockWindhoek', label: 'Stock Windhoek', type: 'NUMBER', icon: 'IconBuildingWarehouse' },
      { name: 'onOrder', label: 'On order', type: 'NUMBER', icon: 'IconTruck' },
      { name: 'sapLastSync', label: 'SAP last synced', type: 'DATE_TIME', icon: 'IconClock' },
    ],
  },
];

// MANY_TO_ONE relations: [sourceObject, fieldName, label, targetObject, inverseLabel, icon]
export const RELATIONS = [
  ['project', 'company', 'Company', 'company', 'Projects', 'IconBuildingSkyscraper'],
  ['project', 'opportunity', 'Opportunity', 'opportunity', 'Projects', 'IconTargetArrow'],
  ['installedSystem', 'company', 'Company', 'company', 'Installed systems', 'IconBuildingSkyscraper'],
  ['installedSystem', 'project', 'Project', 'project', 'Installed systems', 'IconHammer'],
  ['supportCase', 'company', 'Company', 'company', 'Support cases', 'IconBuildingSkyscraper'],
  ['supportCase', 'installedSystem', 'Installed system', 'installedSystem', 'Support cases', 'IconSpeakerphone'],
];
