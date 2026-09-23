// BD division / district whitelist. Used by both routes and tests.
const BD_DIVISIONS = [
  'Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh',
];

const DISTRICTS_BY_DIVISION = {
  Dhaka: ['Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'],
  Chattogram: ['Bandarban', 'Brahmanbaria', 'Chandpur', 'Chattogram', 'Comilla', "Cox's Bazar", 'Feni', 'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati'],
  Rajshahi: ['Bogura', 'Chapai Nawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'],
  Khulna: ['Bagerhat', 'Chuadanga', 'Jashore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'],
  Barishal: ['Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
  Sylhet: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
  Rangpur: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
  Mymensingh: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
};

const FIELD_LABELS = {
  name: 'Name',
  phone: 'Mobile',
  email: 'Email',
  house: 'House / Street / Area',
  district: 'District',
  division: 'Division',
  postcode: 'Postcode',
};

const REQUIRED_FIELDS = Object.keys(FIELD_LABELS);

function normalizeBDPhone(raw) {
  if (raw == null) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('880')) digits = '0' + digits.slice(3);
  return digits;
}

function validateAndNormalizeCustomer(body) {
  const errors = {};
  const normalized = {};
  for (const field of REQUIRED_FIELDS) {
    const raw = body[field];
    const value = raw == null ? '' : String(raw).trim();
    if (value === '') { errors[field] = `${FIELD_LABELS[field]} is required`; continue; }
    normalized[field] = value;
  }
  if (normalized.division && normalized.district &&
      !(DISTRICTS_BY_DIVISION[normalized.division] || []).includes(normalized.district)) {
    errors.district = `${normalized.district} is not a district of ${normalized.division}`;
  }
  if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (normalized.phone) {
    const phoneDigits = normalizeBDPhone(normalized.phone);
    if (!/^01\d{9}$/.test(phoneDigits)) errors.phone = 'Enter a valid Bangladeshi mobile (e.g., 01712345678)';
    else normalized.phone = phoneDigits;
  }
  if (normalized.postcode && !/^\d{4}$/.test(normalized.postcode)) {
    errors.postcode = 'Postcode must be 4 digits';
  }
  if (Object.keys(errors).length > 0) return { errors, customer: null };
  return {
    errors: {},
    customer: {
      name: normalized.name,
      phone: normalized.phone,
      email: normalized.email.toLowerCase(),
      house: normalized.house,
      district: normalized.district,
      division: normalized.division,
      postcode: normalized.postcode,
    },
  };
}

// Order numbers are TSM-YYYYMMDD-XXXXX — keep query params strict.
const ORDER_NUMBER_RE = /^TSM-\d{8}-\d{5}$/;

module.exports = {
  BD_DIVISIONS,
  DISTRICTS_BY_DIVISION,
  FIELD_LABELS,
  REQUIRED_FIELDS,
  ORDER_NUMBER_RE,
  normalizeBDPhone,
  validateAndNormalizeCustomer,
};
