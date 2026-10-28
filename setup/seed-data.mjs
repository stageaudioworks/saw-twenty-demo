// Demo records. Accounts marked existing: true are SAW case-study clients and are linked to the
// mock B1 business partners by card code. Accounts ending in "(demo)" are invented prospects.
// Every person, email, deal, amount and date here is invented for the demo.
const day = (n) => new Date(Date.now() + n * 864e5).toISOString();
const date = (n) => day(n).slice(0, 10);

export const COMPANIES = [
  { key: 'suncity', existing: true, name: 'Sun City Resort (Superbowl)', city: 'Sun City', country: 'South Africa', sapCardCode: 'C00012',
    customerType: 'END_CLIENT', market: 'THEATRES_AND_LIVE_VENUES', region: 'NORTH_WEST', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'mosaiek', existing: true, name: 'Mosaiek Church', city: 'Roodepoort', country: 'South Africa', sapCardCode: 'C00031',
    customerType: 'END_CLIENT', market: 'HOUSE_OF_WORSHIP', region: 'GAUTENG', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'ksb', existing: true, name: 'KwaSizabantu Mission', city: 'Kranskop', country: 'South Africa', sapCardCode: 'C00047',
    customerType: 'END_CLIENT', market: 'HOUSE_OF_WORSHIP', region: 'KWAZULU_NATAL', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'guild', existing: true, name: 'Guild Theatre East London', city: 'East London', country: 'South Africa', sapCardCode: 'C00058',
    customerType: 'END_CLIENT', market: 'THEATRES_AND_LIVE_VENUES', region: 'EASTERN_CAPE', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'caudan', existing: true, name: 'The Caudan Arts Centre', city: 'Port Louis', country: 'Mauritius', sapCardCode: 'C00063',
    customerType: 'END_CLIENT', market: 'THEATRES_AND_LIVE_VENUES', region: 'MAURITIUS', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'baps', existing: true, name: 'BAPS Swaminarayan Sanstha', city: 'Northriding', country: 'South Africa', sapCardCode: 'C00071',
    customerType: 'END_CLIENT', market: 'HOUSE_OF_WORSHIP', region: 'GAUTENG', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'cfc', existing: true, name: 'Christian Family Church', city: 'Alberton', country: 'South Africa', sapCardCode: 'C00084',
    customerType: 'END_CLIENT', market: 'HOUSE_OF_WORSHIP', region: 'GAUTENG', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'rivers', existing: true, name: 'Rivers Church', city: 'Durban', country: 'South Africa', sapCardCode: 'C00090',
    customerType: 'END_CLIENT', market: 'HOUSE_OF_WORSHIP', region: 'KWAZULU_NATAL', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'fathers', existing: true, name: "Father's House Church Gqeberha", city: 'Gqeberha', country: 'South Africa', sapCardCode: 'C00102',
    customerType: 'END_CLIENT', market: 'HOUSE_OF_WORSHIP', region: 'EASTERN_CAPE', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'hyatt', existing: true, name: 'Park Hyatt Johannesburg', city: 'Rosebank', country: 'South Africa', sapCardCode: 'C00115',
    customerType: 'END_CLIENT', market: 'HOSPITALITY', region: 'GAUTENG', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'gearworx', existing: true, name: 'Gearworx (reseller)', city: 'Cape Town', country: 'South Africa', sapCardCode: 'D00007',
    customerType: 'RESELLER_DEALER', market: 'GENERAL_INTEGRATION', region: 'WESTERN_CAPE', branch: 'CAPE_TOWN', priceList: 'DEALER', tradeAccount: true },
  // Invented prospects, not yet in B1
  { key: 'northgate', name: 'Northgate Community Church (demo)', city: 'Randburg', country: 'South Africa',
    customerType: 'END_CLIENT', market: 'HOUSE_OF_WORSHIP', region: 'GAUTENG', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'harbourside', name: 'Harbourside Conference Centre (demo)', city: 'Durban', country: 'South Africa',
    customerType: 'GOVERNMENT_PARASTATAL', market: 'GOVERNMENT', region: 'KWAZULU_NATAL', branch: 'MIDRAND', priceList: 'PROJECTS', bbbeeLevel: 'LEVEL_1' },
  { key: 'highveld', name: 'Highveld Rental & Staging (demo)', city: 'Midrand', country: 'South Africa',
    customerType: 'RENTAL_AND_STAGING_COMPANY', market: 'RENTAL_AND_STAGING', region: 'GAUTENG', branch: 'MIDRAND', priceList: 'RENTAL', tradeAccount: true },
  { key: 'kalahari', name: 'Kalahari Convention Centre (demo)', city: 'Windhoek', country: 'Namibia',
    customerType: 'END_CLIENT', market: 'CORPORATE', region: 'NAMIBIA', branch: 'WINDHOEK', priceList: 'PROJECTS' },
  { key: 'riverside', name: 'Riverside Academy (demo)', city: 'Pretoria', country: 'South Africa',
    customerType: 'END_CLIENT', market: 'EDUCATION', region: 'GAUTENG', branch: 'MIDRAND', priceList: 'PROJECTS' },
  { key: 'acoustic', name: 'Acoustic Design Partners (demo)', city: 'Johannesburg', country: 'South Africa',
    customerType: 'CONSULTANT_SPECIFIER', market: 'GENERAL_INTEGRATION', region: 'GAUTENG', branch: 'MIDRAND' },
];

export const PEOPLE = [
  ['suncity', 'Thabo', 'Mokoena', 'Technical manager, Superbowl', 'TECHNICAL_DIRECTOR', 'DECISION_MAKER'],
  ['suncity', 'Annelie', 'du Plessis', 'Procurement', 'PROCUREMENT', 'FINANCE_PROCUREMENT'],
  ['mosaiek', 'Ruan', 'Venter', 'Production manager', 'PRODUCTION_MANAGER', 'TECHNICAL_EVALUATOR'],
  ['ksb', 'Sipho', 'Ngcobo', 'Sound team lead', 'FOH_AUDIO_ENGINEER', 'TECHNICAL_EVALUATOR'],
  ['guild', 'Lindiwe', 'Mahlangu', 'Theatre manager', 'FACILITIES_MANAGER', 'DECISION_MAKER'],
  ['caudan', 'Priya', 'Ramgoolam', 'Technical director', 'TECHNICAL_DIRECTOR', 'DECISION_MAKER'],
  ['baps', 'Kiran', 'Patel', 'Facilities and AV', 'FACILITIES_MANAGER', 'INFLUENCER'],
  ['cfc', 'Johan', 'Botha', 'Media director', 'VIDEO_BROADCAST_LEAD', 'DECISION_MAKER'],
  ['cfc', 'Zanele', 'Dlamini', 'Operations', 'PROCUREMENT', 'FINANCE_PROCUREMENT'],
  ['rivers', 'Grant', 'Naidoo', 'Head of production', 'PRODUCTION_MANAGER', 'DECISION_MAKER'],
  ['fathers', 'Mark', 'Jacobs', 'Senior pastor', 'SENIOR_PASTOR', 'DECISION_MAKER'],
  ['hyatt', 'Claire', 'Steyn', 'Engineering manager', 'FACILITIES_MANAGER', 'DECISION_MAKER'],
  ['gearworx', 'Wesley', 'Adams', 'Owner', 'OWNER_MD', 'DECISION_MAKER'],
  ['northgate', 'Daniel', 'Kruger', 'Executive pastor', 'SENIOR_PASTOR', 'DECISION_MAKER'],
  ['northgate', 'Tumi', 'Sithole', 'Tech volunteer lead', 'TECHNICAL_DIRECTOR', 'TECHNICAL_EVALUATOR'],
  ['harbourside', 'Nomvula', 'Zulu', 'Supply chain manager', 'PROCUREMENT', 'FINANCE_PROCUREMENT'],
  ['highveld', 'Pieter-Jan', 'Smit', 'MD', 'OWNER_MD', 'DECISION_MAKER'],
  ['kalahari', 'Ndapewa', 'Shilongo', 'Venue manager', 'FACILITIES_MANAGER', 'DECISION_MAKER'],
  ['riverside', 'Fatima', 'Essop', 'IT manager', 'IT_MANAGER', 'DECISION_MAKER'],
  ['acoustic', 'Neil', 'Fourie', 'Acoustic consultant', 'CONSULTANT', 'INFLUENCER'],
];

export const OPPORTUNITIES = [
  { company: 'suncity', contact: 'Thabo', name: 'Superbowl main PA renewal (J-Series to KSL)', stage: 'DESIGN_AND_BOQ', amount: 6800000,
    dealType: 'PROJECT_SUPPLY_AND_INSTALL', serviceLines: ['DESIGN_AND_CONSULTING', 'INTEGRATION'], brands: ['D_AND_B_AUDIOTECHNIK'],
    market: 'THEATRES_AND_LIVE_VENUES', venue: 'Superbowl', close: 75, install: 150, margin: 24, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'harbourside', contact: 'Nomvula', name: 'Plenary hall audio and conferencing tender', stage: 'PROPOSAL_SENT', amount: 2900000,
    dealType: 'TENDER', serviceLines: ['DESIGN_AND_CONSULTING', 'INTEGRATION', 'TRAINING'], brands: ['D_AND_B_AUDIOTECHNIK', 'YAMAHA', 'CRESTRON'],
    market: 'GOVERNMENT', venue: 'Plenary hall', close: 40, install: 120, margin: 18, entity: 'MITECH_DIRECT',
    tenderReference: 'HCC/AV/2026/014 (demo)', tenderClosing: 18 },
  { company: 'highveld', contact: 'Pieter-Jan', name: 'KSL rental inventory, 24 boxes + subs', stage: 'NEGOTIATION', amount: 5400000,
    dealType: 'RENTAL_AND_STAGING_SALE', serviceLines: ['SUPPLY_AND_DISTRIBUTION', 'TRAINING'], brands: ['D_AND_B_AUDIOTECHNIK'],
    market: 'RENTAL_AND_STAGING', close: 21, margin: 15, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'cfc', contact: 'Johan', name: 'Campus streaming and camera upgrade', stage: 'NEGOTIATION', amount: 980000,
    dealType: 'PROJECT_SUPPLY_AND_INSTALL', serviceLines: ['INTEGRATION'], brands: ['BLACKMAGIC_DESIGN'],
    market: 'HOUSE_OF_WORSHIP', venue: 'Alberton campus', close: 14, install: 45, margin: 22, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'caudan', contact: 'Priya', name: 'Annual service contract and DM7 operator training', stage: 'PROPOSAL_SENT', amount: 145000,
    dealType: 'SERVICE_AND_MAINTENANCE', serviceLines: ['SUPPORT', 'TRAINING'], brands: ['YAMAHA', 'D_AND_B_AUDIOTECHNIK'],
    market: 'THEATRES_AND_LIVE_VENUES', close: 10, margin: 45, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'rivers', contact: 'Grant', name: 'Cornubia phase 2 main auditorium', stage: 'QUALIFIED', amount: 4200000,
    dealType: 'PROJECT_SUPPLY_AND_INSTALL', serviceLines: ['DESIGN_AND_CONSULTING', 'INTEGRATION'], brands: ['D_AND_B_AUDIOTECHNIK', 'YAMAHA', 'PIXEL_PLUS', 'PLUS_LIGHTING'],
    market: 'HOUSE_OF_WORSHIP', venue: 'Cornubia campus', close: 120, install: 240, margin: 23, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'northgate', contact: 'Daniel', name: 'New 1,200-seat auditorium: audio, video, lighting', stage: 'SITE_SURVEY', amount: 3500000,
    dealType: 'PROJECT_SUPPLY_AND_INSTALL', serviceLines: ['DESIGN_AND_CONSULTING', 'INTEGRATION', 'MANUFACTURING_STAGE_PLUS'], brands: ['D_AND_B_AUDIOTECHNIK', 'WAVES_LIVE', 'PIXEL_PLUS', 'STAGE_PLUS'],
    market: 'HOUSE_OF_WORSHIP', venue: 'Main auditorium (new build)', close: 90, install: 200, margin: 25, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'kalahari', contact: 'Ndapewa', name: 'Conference hall PA and LED screen', stage: 'LEAD', amount: 1200000,
    dealType: 'PROJECT_SUPPLY_AND_INSTALL', serviceLines: ['INTEGRATION'], brands: ['PLUS_AUDIO', 'PIXEL_PLUS'],
    market: 'CORPORATE', close: 150, margin: 22, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'riverside', contact: 'Fatima', name: 'Lecture hall conferencing, 4 rooms', stage: 'QUALIFIED', amount: 420000,
    dealType: 'PROJECT_SUPPLY_AND_INSTALL', serviceLines: ['INTEGRATION'], brands: ['LOGITECH', 'AUDAC'],
    market: 'EDUCATION', close: 60, margin: 20, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'hyatt', contact: 'Claire', name: 'Background music extension to spa level', stage: 'LEAD', amount: 180000,
    dealType: 'PROJECT_SUPPLY_AND_INSTALL', serviceLines: ['INTEGRATION'], brands: ['AUDAC'],
    market: 'HOSPITALITY', close: 45, margin: 28, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'gearworx', contact: 'Wesley', name: 'Plus Audio MPS stock order', stage: 'PROPOSAL_SENT', amount: 310000,
    dealType: 'SUPPLY_ONLY', serviceLines: ['SUPPLY_AND_DISTRIBUTION'], brands: ['PLUS_AUDIO'],
    market: 'GENERAL_INTEGRATION', close: 7, margin: 18, entity: 'STAGE_AUDIO_WORKS' },
  { company: 'mosaiek', contact: 'Ruan', name: 'Foyer and kids church audio', stage: 'LOST', amount: 650000, lossReason: 'PRICE',
    dealType: 'PROJECT_SUPPLY_AND_INSTALL', serviceLines: ['INTEGRATION'], brands: ['PLUS_AUDIO'],
    market: 'HOUSE_OF_WORSHIP', close: -20, margin: 21, entity: 'STAGE_AUDIO_WORKS' },
];

// Installed base. Systems, brands and years come from SAW's published case studies;
// models are given only where the case study names them, and serials are blank.
export const INSTALLED = [
  { key: 'suncity-j', company: 'suncity', name: 'Superbowl main PA — d&b J-Series', category: 'PA_LINE_ARRAY', brand: 'D_AND_B_AUDIOTECHNIK', model: 'J-Series line array (installed 2010)' },
  { key: 'suncity-led', company: 'suncity', name: 'Superbowl LED screens (2 × 7 m by 4 m)', category: 'LED_VIDEO', brand: 'OTHER', model: 'Unilumin Utile (installed 2018)' },
  { key: 'mosaiek-j', company: 'mosaiek', name: 'Main auditorium — d&b J-Series', category: 'PA_LINE_ARRAY', brand: 'D_AND_B_AUDIOTECHNIK', model: 'J-Series line array' },
  { key: 'mosaiek-led', company: 'mosaiek', name: 'Main auditorium — Pixel Plus Xcell LED', category: 'LED_VIDEO', brand: 'PIXEL_PLUS', model: 'Xcell' },
  { key: 'ksb-t', company: 'ksb', name: '8,000-seat auditorium — d&b T-Series', category: 'PA_LINE_ARRAY', brand: 'D_AND_B_AUDIOTECHNIK', model: 'T-Series on Dante network' },
  { key: 'guild-pa', company: 'guild', name: 'Auditorium — d&b point sources, fills, monitors', category: 'POINT_SOURCE_AND_FILLS', brand: 'D_AND_B_AUDIOTECHNIK' },
  { key: 'caudan-dm7', company: 'caudan', name: 'FOH console — Yamaha DM7', category: 'MIXING', brand: 'YAMAHA', model: 'DM7 (supplied 2025)' },
  { key: 'baps-ss', company: 'baps', name: 'Assembly hall — d&b Soundscape', category: 'PA_LINE_ARRAY', brand: 'D_AND_B_AUDIOTECHNIK', model: 'Soundscape, distributed system over Dante', installDate: '2025-02-01', warrantyExpiry: '2027-02-01' },
  { key: 'fathers-pa', company: 'fathers', name: 'Sanctuary — Plus Audio distributed system', category: 'POINT_SOURCE_AND_FILLS', brand: 'PLUS_AUDIO' },
  { key: 'rivers-ctrl', company: 'rivers', name: 'Cornubia 600-seat auditorium — AV and control', category: 'CONTROL', brand: 'OTHER', installDate: '2026-03-01', warrantyExpiry: '2028-03-01' },
  { key: 'hyatt-bgm', company: 'hyatt', name: 'Courtyard soundscape — background music system', category: 'BACKGROUND_MUSIC', brand: 'OTHER' },
];

export const SUPPORT = [
  { company: 'suncity', system: 'suncity-j', name: 'Amplifier channel fault, stage left hang', caseType: 'REPAIR', status: 'IN_PROGRESS', priority: 'HIGH', branch: 'MIDRAND',
    details: 'Demo case: one amplifier channel dropping out during shows. Unit collected for bench test.' },
  { company: 'caudan', system: 'caudan-dm7', name: 'DM7 firmware update and scene backup', caseType: 'TECHNICAL_SUPPORT', status: 'RESOLVED', priority: 'NORMAL', branch: 'MIDRAND',
    details: 'Demo case: remote session to update firmware and back up show files.' },
  { company: 'ksb', system: 'ksb-t', name: 'Dante clock warnings after network change', caseType: 'SITE_CALL_OUT', status: 'WAITING_ON_CLIENT', priority: 'NORMAL', branch: 'MIDRAND',
    details: 'Demo case: switch replaced by client IT; QoS settings to be confirmed on site.' },
];

export const PROJECTS = [
  { company: 'rivers', name: 'Rivers Church Cornubia campus fit-out', status: 'CLOSED', sowStatus: 'SIGNED', handoverDate: '2026-03-01', systems: ['rivers-ctrl'] },
];

export const helpers = { day, date };
