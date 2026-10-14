/**
 * Comprehensive country, state, and city data for Super Job Agent profiles.
 * Covers all UN-recognized countries + India states/UTs with major cities.
 */

export interface CountryDef {
  name: string;
  code: string; // ISO 3166-1 alpha-2
  phoneCode: string; // international dialing code
  currency: string; // ISO 4217 currency code
  locale: "IN" | "US" | "UK" | "EU" | "GLOBAL";
}

export const COUNTRIES: CountryDef[] = [
  // ── South Asia ──
  { name: "India", code: "IN", phoneCode: "+91", currency: "INR", locale: "IN" },
  { name: "Pakistan", code: "PK", phoneCode: "+92", currency: "PKR", locale: "GLOBAL" },
  { name: "Bangladesh", code: "BD", phoneCode: "+880", currency: "BDT", locale: "GLOBAL" },
  { name: "Sri Lanka", code: "LK", phoneCode: "+94", currency: "LKR", locale: "GLOBAL" },
  { name: "Nepal", code: "NP", phoneCode: "+977", currency: "NPR", locale: "GLOBAL" },
  { name: "Bhutan", code: "BT", phoneCode: "+975", currency: "BTN", locale: "GLOBAL" },
  { name: "Maldives", code: "MV", phoneCode: "+960", currency: "MVR", locale: "GLOBAL" },
  { name: "Afghanistan", code: "AF", phoneCode: "+93", currency: "AFN", locale: "GLOBAL" },
  // ── North America ──
  { name: "United States", code: "US", phoneCode: "+1", currency: "USD", locale: "US" },
  { name: "Canada", code: "CA", phoneCode: "+1", currency: "CAD", locale: "US" },
  { name: "Mexico", code: "MX", phoneCode: "+52", currency: "MXN", locale: "GLOBAL" },
  // ── Caribbean ──
  { name: "Cuba", code: "CU", phoneCode: "+53", currency: "CUP", locale: "GLOBAL" },
  { name: "Jamaica", code: "JM", phoneCode: "+1-876", currency: "JMD", locale: "GLOBAL" },
  { name: "Haiti", code: "HT", phoneCode: "+509", currency: "HTG", locale: "GLOBAL" },
  { name: "Dominican Republic", code: "DO", phoneCode: "+1-809", currency: "DOP", locale: "GLOBAL" },
  { name: "Trinidad and Tobago", code: "TT", phoneCode: "+1-868", currency: "TTD", locale: "GLOBAL" },
  { name: "Bahamas", code: "BS", phoneCode: "+1-242", currency: "BSD", locale: "GLOBAL" },
  { name: "Barbados", code: "BB", phoneCode: "+1-246", currency: "BBD", locale: "GLOBAL" },
  // ── South America ──
  { name: "Brazil", code: "BR", phoneCode: "+55", currency: "BRL", locale: "GLOBAL" },
  { name: "Argentina", code: "AR", phoneCode: "+54", currency: "ARS", locale: "GLOBAL" },
  { name: "Chile", code: "CL", phoneCode: "+56", currency: "CLP", locale: "GLOBAL" },
  { name: "Colombia", code: "CO", phoneCode: "+57", currency: "COP", locale: "GLOBAL" },
  { name: "Peru", code: "PE", phoneCode: "+51", currency: "PEN", locale: "GLOBAL" },
  { name: "Venezuela", code: "VE", phoneCode: "+58", currency: "VES", locale: "GLOBAL" },
  { name: "Ecuador", code: "EC", phoneCode: "+593", currency: "USD", locale: "GLOBAL" },
  { name: "Bolivia", code: "BO", phoneCode: "+591", currency: "BOB", locale: "GLOBAL" },
  { name: "Paraguay", code: "PY", phoneCode: "+595", currency: "PYG", locale: "GLOBAL" },
  { name: "Uruguay", code: "UY", phoneCode: "+598", currency: "UYU", locale: "GLOBAL" },
  { name: "Guyana", code: "GY", phoneCode: "+592", currency: "GYD", locale: "GLOBAL" },
  { name: "Suriname", code: "SR", phoneCode: "+597", currency: "SRD", locale: "GLOBAL" },
  // ── Europe ──
  { name: "United Kingdom", code: "GB", phoneCode: "+44", currency: "GBP", locale: "UK" },
  { name: "Germany", code: "DE", phoneCode: "+49", currency: "EUR", locale: "EU" },
  { name: "France", code: "FR", phoneCode: "+33", currency: "EUR", locale: "EU" },
  { name: "Italy", code: "IT", phoneCode: "+39", currency: "EUR", locale: "EU" },
  { name: "Spain", code: "ES", phoneCode: "+34", currency: "EUR", locale: "EU" },
  { name: "Netherlands", code: "NL", phoneCode: "+31", currency: "EUR", locale: "EU" },
  { name: "Belgium", code: "BE", phoneCode: "+32", currency: "EUR", locale: "EU" },
  { name: "Switzerland", code: "CH", phoneCode: "+41", currency: "CHF", locale: "EU" },
  { name: "Austria", code: "AT", phoneCode: "+43", currency: "EUR", locale: "EU" },
  { name: "Sweden", code: "SE", phoneCode: "+46", currency: "SEK", locale: "EU" },
  { name: "Norway", code: "NO", phoneCode: "+47", currency: "NOK", locale: "EU" },
  { name: "Denmark", code: "DK", phoneCode: "+45", currency: "DKK", locale: "EU" },
  { name: "Finland", code: "FI", phoneCode: "+358", currency: "EUR", locale: "EU" },
  { name: "Ireland", code: "IE", phoneCode: "+353", currency: "EUR", locale: "EU" },
  { name: "Portugal", code: "PT", phoneCode: "+351", currency: "EUR", locale: "EU" },
  { name: "Poland", code: "PL", phoneCode: "+48", currency: "PLN", locale: "EU" },
  { name: "Czech Republic", code: "CZ", phoneCode: "+420", currency: "CZK", locale: "EU" },
  { name: "Hungary", code: "HU", phoneCode: "+36", currency: "HUF", locale: "EU" },
  { name: "Romania", code: "RO", phoneCode: "+40", currency: "RON", locale: "EU" },
  { name: "Greece", code: "GR", phoneCode: "+30", currency: "EUR", locale: "EU" },
  { name: "Turkey", code: "TR", phoneCode: "+90", currency: "TRY", locale: "GLOBAL" },
  { name: "Russia", code: "RU", phoneCode: "+7", currency: "RUB", locale: "GLOBAL" },
  { name: "Ukraine", code: "UA", phoneCode: "+380", currency: "UAH", locale: "GLOBAL" },
  { name: "Belarus", code: "BY", phoneCode: "+375", currency: "BYN", locale: "GLOBAL" },
  { name: "Croatia", code: "HR", phoneCode: "+385", currency: "EUR", locale: "EU" },
  { name: "Serbia", code: "RS", phoneCode: "+381", currency: "RSD", locale: "GLOBAL" },
  { name: "Bulgaria", code: "BG", phoneCode: "+359", currency: "BGN", locale: "EU" },
  { name: "Slovakia", code: "SK", phoneCode: "+421", currency: "EUR", locale: "EU" },
  { name: "Slovenia", code: "SI", phoneCode: "+386", currency: "EUR", locale: "EU" },
  { name: "Lithuania", code: "LT", phoneCode: "+370", currency: "EUR", locale: "EU" },
  { name: "Latvia", code: "LV", phoneCode: "+371", currency: "EUR", locale: "EU" },
  { name: "Estonia", code: "EE", phoneCode: "+372", currency: "EUR", locale: "EU" },
  { name: "Iceland", code: "IS", phoneCode: "+354", currency: "ISK", locale: "EU" },
  { name: "Luxembourg", code: "LU", phoneCode: "+352", currency: "EUR", locale: "EU" },
  { name: "Malta", code: "MT", phoneCode: "+356", currency: "EUR", locale: "EU" },
  { name: "Cyprus", code: "CY", phoneCode: "+357", currency: "EUR", locale: "EU" },
  { name: "Georgia", code: "GE", phoneCode: "+995", currency: "GEL", locale: "GLOBAL" },
  { name: "Armenia", code: "AM", phoneCode: "+374", currency: "AMD", locale: "GLOBAL" },
  { name: "Azerbaijan", code: "AZ", phoneCode: "+994", currency: "AZN", locale: "GLOBAL" },
  { name: "Kazakhstan", code: "KZ", phoneCode: "+7", currency: "KZT", locale: "GLOBAL" },
  { name: "Uzbekistan", code: "UZ", phoneCode: "+998", currency: "UZS", locale: "GLOBAL" },
  // ── Middle East ──
  { name: "United Arab Emirates", code: "AE", phoneCode: "+971", currency: "AED", locale: "GLOBAL" },
  { name: "Saudi Arabia", code: "SA", phoneCode: "+966", currency: "SAR", locale: "GLOBAL" },
  { name: "Qatar", code: "QA", phoneCode: "+974", currency: "QAR", locale: "GLOBAL" },
  { name: "Kuwait", code: "KW", phoneCode: "+965", currency: "KWD", locale: "GLOBAL" },
  { name: "Bahrain", code: "BH", phoneCode: "+973", currency: "BHD", locale: "GLOBAL" },
  { name: "Oman", code: "OM", phoneCode: "+968", currency: "OMR", locale: "GLOBAL" },
  { name: "Israel", code: "IL", phoneCode: "+972", currency: "ILS", locale: "GLOBAL" },
  { name: "Jordan", code: "JO", phoneCode: "+962", currency: "JOD", locale: "GLOBAL" },
  { name: "Lebanon", code: "LB", phoneCode: "+961", currency: "LBP", locale: "GLOBAL" },
  { name: "Iraq", code: "IQ", phoneCode: "+964", currency: "IQD", locale: "GLOBAL" },
  { name: "Iran", code: "IR", phoneCode: "+98", currency: "IRR", locale: "GLOBAL" },
  { name: "Egypt", code: "EG", phoneCode: "+20", currency: "EGP", locale: "GLOBAL" },
  { name: "Yemen", code: "YE", phoneCode: "+967", currency: "YER", locale: "GLOBAL" },
  // ── East Asia ──
  { name: "China", code: "CN", phoneCode: "+86", currency: "CNY", locale: "GLOBAL" },
  { name: "Japan", code: "JP", phoneCode: "+81", currency: "JPY", locale: "GLOBAL" },
  { name: "South Korea", code: "KR", phoneCode: "+82", currency: "KRW", locale: "GLOBAL" },
  { name: "Taiwan", code: "TW", phoneCode: "+886", currency: "TWD", locale: "GLOBAL" },
  { name: "Hong Kong", code: "HK", phoneCode: "+852", currency: "HKD", locale: "GLOBAL" },
  { name: "Macau", code: "MO", phoneCode: "+853", currency: "MOP", locale: "GLOBAL" },
  { name: "Mongolia", code: "MN", phoneCode: "+976", currency: "MNT", locale: "GLOBAL" },
  // ── Southeast Asia ──
  { name: "Singapore", code: "SG", phoneCode: "+65", currency: "SGD", locale: "GLOBAL" },
  { name: "Malaysia", code: "MY", phoneCode: "+60", currency: "MYR", locale: "GLOBAL" },
  { name: "Indonesia", code: "ID", phoneCode: "+62", currency: "IDR", locale: "GLOBAL" },
  { name: "Thailand", code: "TH", phoneCode: "+66", currency: "THB", locale: "GLOBAL" },
  { name: "Vietnam", code: "VN", phoneCode: "+84", currency: "VND", locale: "GLOBAL" },
  { name: "Philippines", code: "PH", phoneCode: "+63", currency: "PHP", locale: "GLOBAL" },
  { name: "Myanmar", code: "MM", phoneCode: "+95", currency: "MMK", locale: "GLOBAL" },
  { name: "Cambodia", code: "KH", phoneCode: "+855", currency: "KHR", locale: "GLOBAL" },
  { name: "Laos", code: "LA", phoneCode: "+856", currency: "LAK", locale: "GLOBAL" },
  { name: "Brunei", code: "BN", phoneCode: "+673", currency: "BND", locale: "GLOBAL" },
  // ── Oceania ──
  { name: "Australia", code: "AU", phoneCode: "+61", currency: "AUD", locale: "GLOBAL" },
  { name: "New Zealand", code: "NZ", phoneCode: "+64", currency: "NZD", locale: "GLOBAL" },
  { name: "Fiji", code: "FJ", phoneCode: "+679", currency: "FJD", locale: "GLOBAL" },
  { name: "Papua New Guinea", code: "PG", phoneCode: "+675", currency: "PGK", locale: "GLOBAL" },
  { name: "Samoa", code: "WS", phoneCode: "+685", currency: "WST", locale: "GLOBAL" },
  { name: "Tonga", code: "TO", phoneCode: "+676", currency: "TOP", locale: "GLOBAL" },
  // ── Africa ──
  { name: "South Africa", code: "ZA", phoneCode: "+27", currency: "ZAR", locale: "GLOBAL" },
  { name: "Nigeria", code: "NG", phoneCode: "+234", currency: "NGN", locale: "GLOBAL" },
  { name: "Kenya", code: "KE", phoneCode: "+254", currency: "KES", locale: "GLOBAL" },
  { name: "Ghana", code: "GH", phoneCode: "+233", currency: "GHS", locale: "GLOBAL" },
  { name: "Tanzania", code: "TZ", phoneCode: "+255", currency: "TZS", locale: "GLOBAL" },
  { name: "Ethiopia", code: "ET", phoneCode: "+251", currency: "ETB", locale: "GLOBAL" },
  { name: "Uganda", code: "UG", phoneCode: "+256", currency: "UGX", locale: "GLOBAL" },
  { name: "Rwanda", code: "RW", phoneCode: "+250", currency: "RWF", locale: "GLOBAL" },
  { name: "Morocco", code: "MA", phoneCode: "+212", currency: "MAD", locale: "GLOBAL" },
  { name: "Algeria", code: "DZ", phoneCode: "+213", currency: "DZD", locale: "GLOBAL" },
  { name: "Tunisia", code: "TN", phoneCode: "+216", currency: "TND", locale: "GLOBAL" },
  { name: "Libya", code: "LY", phoneCode: "+218", currency: "LYD", locale: "GLOBAL" },
  { name: "Senegal", code: "SN", phoneCode: "+221", currency: "XOF", locale: "GLOBAL" },
  { name: "Cameroon", code: "CM", phoneCode: "+237", currency: "XAF", locale: "GLOBAL" },
  { name: "Ivory Coast", code: "CI", phoneCode: "+225", currency: "XOF", locale: "GLOBAL" },
  { name: "Mauritius", code: "MU", phoneCode: "+230", currency: "MUR", locale: "GLOBAL" },
  { name: "Zimbabwe", code: "ZW", phoneCode: "+263", currency: "ZWL", locale: "GLOBAL" },
  { name: "Botswana", code: "BW", phoneCode: "+267", currency: "BWP", locale: "GLOBAL" },
  { name: "Namibia", code: "NA", phoneCode: "+264", currency: "NAD", locale: "GLOBAL" },
  { name: "Zambia", code: "ZM", phoneCode: "+260", currency: "ZMW", locale: "GLOBAL" },
  { name: "Mozambique", code: "MZ", phoneCode: "+258", currency: "MZN", locale: "GLOBAL" },
  { name: "Angola", code: "AO", phoneCode: "+244", currency: "AOA", locale: "GLOBAL" },
  { name: "Democratic Republic of the Congo", code: "CD", phoneCode: "+243", currency: "CDF", locale: "GLOBAL" },
  { name: "Sudan", code: "SD", phoneCode: "+249", currency: "SDG", locale: "GLOBAL" },
];

/** Lookup country by ISO code */
export function getCountryByCode(code: string): CountryDef | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** Lookup country by name (case-insensitive) */
export function getCountryByName(name: string): CountryDef | undefined {
  const lower = name.toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === lower);
}

/** Get phone code for a country code */
export function getPhoneCode(countryCode: string): string {
  return getCountryByCode(countryCode)?.phoneCode ?? "+1";
}

/** Get currency for a country code */
export function getCurrency(countryCode: string): string {
  return getCountryByCode(countryCode)?.currency ?? "USD";
}

// ── India: States & Union Territories ──

export interface IndiaStateDef {
  name: string;
  code: string; // ISO 3166-2:IN
  type: "state" | "union_territory";
  majorCities: string[];
}

export const INDIA_STATES: IndiaStateDef[] = [
  { name: "Andhra Pradesh", code: "AP", type: "state", majorCities: ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Tirupati"] },
  { name: "Arunachal Pradesh", code: "AR", type: "state", majorCities: ["Itanagar", "Naharlagun", "Pasighat"] },
  { name: "Assam", code: "AS", type: "state", majorCities: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat"] },
  { name: "Bihar", code: "BR", type: "state", majorCities: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur"] },
  { name: "Chhattisgarh", code: "CG", type: "state", majorCities: ["Raipur", "Bhilai", "Bilaspur", "Korba"] },
  { name: "Goa", code: "GA", type: "state", majorCities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa"] },
  { name: "Gujarat", code: "GJ", type: "state", majorCities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"] },
  { name: "Haryana", code: "HR", type: "state", majorCities: ["Chandigarh", "Faridabad", "Gurugram", "Panipat", "Ambala"] },
  { name: "Himachal Pradesh", code: "HP", type: "state", majorCities: ["Shimla", "Mandi", "Dharamshala", "Kangra"] },
  { name: "Jharkhand", code: "JH", type: "state", majorCities: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"] },
  { name: "Karnataka", code: "KA", type: "state", majorCities: ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi"] },
  { name: "Kerala", code: "KL", type: "state", majorCities: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur"] },
  { name: "Madhya Pradesh", code: "MP", type: "state", majorCities: ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain"] },
  { name: "Maharashtra", code: "MH", type: "state", majorCities: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad"] },
  { name: "Manipur", code: "MN", type: "state", majorCities: ["Imphal", "Thoubal", "Bishnupur"] },
  { name: "Meghalaya", code: "ML", type: "state", majorCities: ["Shillong", "Tura", "Jowai"] },
  { name: "Mizoram", code: "MZ", type: "state", majorCities: ["Aizawl", "Lunglei", "Champhai"] },
  { name: "Nagaland", code: "NL", type: "state", majorCities: ["Kohima", "Dimapur", "Mokokchung"] },
  { name: "Odisha", code: "OD", type: "state", majorCities: ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur"] },
  { name: "Punjab", code: "PB", type: "state", majorCities: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Mohali"] },
  { name: "Rajasthan", code: "RJ", type: "state", majorCities: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer"] },
  { name: "Sikkim", code: "SK", type: "state", majorCities: ["Gangtok", "Namchi", "Mangan"] },
  { name: "Tamil Nadu", code: "TN", type: "state", majorCities: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"] },
  { name: "Telangana", code: "TS", type: "state", majorCities: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar"] },
  { name: "Tripura", code: "TR", type: "state", majorCities: ["Agartala", "Udaipur", "Dharmanagar"] },
  { name: "Uttar Pradesh", code: "UP", type: "state", majorCities: ["Lucknow", "Noida", "Kanpur", "Agra", "Varanasi", "Prayagraj"] },
  { name: "Uttarakhand", code: "UK", type: "state", majorCities: ["Dehradun", "Haridwar", "Roorkee", "Haldwani"] },
  { name: "West Bengal", code: "WB", type: "state", majorCities: ["Kolkata", "Howrah", "Durgapur", "Siliguri", "Asansol"] },
  // Union Territories
  { name: "Delhi (NCT)", code: "DL", type: "union_territory", majorCities: ["New Delhi", "Dwarka", "Rohini", "Noida", "Gurugram"] },
  { name: "Jammu and Kashmir", code: "JK", type: "union_territory", majorCities: ["Srinagar", "Jammu", "Anantnag", "Baramulla"] },
  { name: "Ladakh", code: "LA", type: "union_territory", majorCities: ["Leh", "Kargil"] },
  { name: "Puducherry", code: "PY", type: "union_territory", majorCities: ["Puducherry", "Karaikal"] },
  { name: "Andaman and Nicobar Islands", code: "AN", type: "union_territory", majorCities: ["Port Blair"] },
  { name: "Chandigarh", code: "CH", type: "union_territory", majorCities: ["Chandigarh"] },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "DN", type: "union_territory", majorCities: ["Silvassa", "Daman", "Diu"] },
  { name: "Lakshadweep", code: "LD", type: "union_territory", majorCities: ["Kavaratti"] },
];

/** Lookup India state by name (case-insensitive) */
export function getIndiaStateByName(name: string): IndiaStateDef | undefined {
  const lower = name.toLowerCase();
  return INDIA_STATES.find((s) => s.name.toLowerCase() === lower);
}

/** Lookup India state by code */
export function getIndiaStateByCode(code: string): IndiaStateDef | undefined {
  return INDIA_STATES.find((s) => s.code === code);
}

/** Get all major Indian cities (for autocomplete) */
export function getIndiaMajorCities(): string[] {
  const cities = new Set<string>();
  for (const state of INDIA_STATES) {
    for (const city of state.majorCities) {
      cities.add(city);
    }
  }
  return Array.from(cities).sort();
}

// ── US States (abbreviated for autofill) ──

export interface USStateDef {
  name: string;
  code: string; // 2-letter abbreviation
  majorCities: string[];
}

export const US_STATES: USStateDef[] = [
  { name: "Alabama", code: "AL", majorCities: ["Birmingham", "Montgomery", "Huntsville", "Mobile"] },
  { name: "Alaska", code: "AK", majorCities: ["Anchorage", "Fairbanks", "Juneau"] },
  { name: "Arizona", code: "AZ", majorCities: ["Phoenix", "Tucson", "Mesa", "Scottsdale", "Tempe"] },
  { name: "Arkansas", code: "AR", majorCities: ["Little Rock", "Fayetteville", "Fort Smith"] },
  { name: "California", code: "CA", majorCities: ["San Francisco", "Los Angeles", "San Jose", "San Diego", "Sacramento", "Oakland", "Palo Alto", "Mountain View", "Sunnyvale", "Santa Clara", "Irvine", "Fremont"] },
  { name: "Colorado", code: "CO", majorCities: ["Denver", "Boulder", "Colorado Springs", "Fort Collins", "Aurora"] },
  { name: "Connecticut", code: "CT", majorCities: ["Hartford", "New Haven", "Stamford", "Greenwich"] },
  { name: "Delaware", code: "DE", majorCities: ["Wilmington", "Dover", "Newark"] },
  { name: "Florida", code: "FL", majorCities: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale", "Boca Raton"] },
  { name: "Georgia", code: "GA", majorCities: ["Atlanta", "Savannah", "Augusta", "Marietta"] },
  { name: "Hawaii", code: "HI", majorCities: ["Honolulu", "Hilo", "Kailua"] },
  { name: "Idaho", code: "ID", majorCities: ["Boise", "Meridian", "Nampa"] },
  { name: "Illinois", code: "IL", majorCities: ["Chicago", "Springfield", "Naperville", "Evanston"] },
  { name: "Indiana", code: "IN", majorCities: ["Indianapolis", "Carmel", "Fishers", "Bloomington"] },
  { name: "Iowa", code: "IA", majorCities: ["Des Moines", "Cedar Rapids", "Davenport"] },
  { name: "Kansas", code: "KS", majorCities: ["Wichita", "Overland Park", "Kansas City", "Topeka"] },
  { name: "Kentucky", code: "KY", majorCities: ["Louisville", "Lexington", "Bowling Green"] },
  { name: "Louisiana", code: "LA", majorCities: ["New Orleans", "Baton Rouge", "Shreveport"] },
  { name: "Maine", code: "ME", majorCities: ["Portland", "Lewiston", "Bangor"] },
  { name: "Maryland", code: "MD", majorCities: ["Baltimore", "Rockville", "Bethesda", "Annapolis", "Columbia"] },
  { name: "Massachusetts", code: "MA", majorCities: ["Boston", "Cambridge", "Worcester", "Somerville", "Springfield"] },
  { name: "Michigan", code: "MI", majorCities: ["Detroit", "Ann Arbor", "Grand Rapids", "Lansing"] },
  { name: "Minnesota", code: "MN", majorCities: ["Minneapolis", "Saint Paul", "Rochester", "Bloomington"] },
  { name: "Mississippi", code: "MS", majorCities: ["Jackson", "Gulfport", "Hattiesburg"] },
  { name: "Missouri", code: "MO", majorCities: ["Kansas City", "St. Louis", "Springfield", "Columbia"] },
  { name: "Montana", code: "MT", majorCities: ["Billings", "Missoula", "Bozeman"] },
  { name: "Nebraska", code: "NE", majorCities: ["Omaha", "Lincoln", "Bellevue"] },
  { name: "Nevada", code: "NV", majorCities: ["Las Vegas", "Reno", "Henderson"] },
  { name: "New Hampshire", code: "NH", majorCities: ["Manchester", "Nashua", "Concord"] },
  { name: "New Jersey", code: "NJ", majorCities: ["Newark", "Jersey City", "Princeton", "Trenton", "Edison"] },
  { name: "New Mexico", code: "NM", majorCities: ["Albuquerque", "Santa Fe", "Las Cruces"] },
  { name: "New York", code: "NY", majorCities: ["New York City", "Brooklyn", "Buffalo", "Rochester", "Albany", "Syracuse"] },
  { name: "North Carolina", code: "NC", majorCities: ["Charlotte", "Raleigh", "Durham", "Greensboro", "Chapel Hill"] },
  { name: "North Dakota", code: "ND", majorCities: ["Fargo", "Bismarck", "Grand Forks"] },
  { name: "Ohio", code: "OH", majorCities: ["Columbus", "Cleveland", "Cincinnati", "Dayton", "Toledo"] },
  { name: "Oklahoma", code: "OK", majorCities: ["Oklahoma City", "Tulsa", "Norman"] },
  { name: "Oregon", code: "OR", majorCities: ["Portland", "Eugene", "Salem", "Bend"] },
  { name: "Pennsylvania", code: "PA", majorCities: ["Philadelphia", "Pittsburgh", "Harrisburg", "Allentown"] },
  { name: "Rhode Island", code: "RI", majorCities: ["Providence", "Warwick", "Cranston"] },
  { name: "South Carolina", code: "SC", majorCities: ["Charleston", "Columbia", "Greenville"] },
  { name: "South Dakota", code: "SD", majorCities: ["Sioux Falls", "Rapid City", "Pierre"] },
  { name: "Tennessee", code: "TN", majorCities: ["Nashville", "Memphis", "Knoxville", "Chattanooga"] },
  { name: "Texas", code: "TX", majorCities: ["Austin", "Houston", "Dallas", "San Antonio", "Fort Worth", "El Paso", "Plano", "Irving"] },
  { name: "Utah", code: "UT", majorCities: ["Salt Lake City", "Provo", "Orem", "Park City"] },
  { name: "Vermont", code: "VT", majorCities: ["Burlington", "Montpelier", "Rutland"] },
  { name: "Virginia", code: "VA", majorCities: ["Arlington", "Richmond", "Virginia Beach", "Alexandria", "McLean", "Reston"] },
  { name: "Washington", code: "WA", majorCities: ["Seattle", "Bellevue", "Tacoma", "Redmond", "Spokane", "Kirkland"] },
  { name: "West Virginia", code: "WV", majorCities: ["Charleston", "Huntington", "Morgantown"] },
  { name: "Wisconsin", code: "WI", majorCities: ["Milwaukee", "Madison", "Green Bay", "Eau Claire"] },
  { name: "Wyoming", code: "WY", majorCities: ["Cheyenne", "Casper", "Laramie"] },
  { name: "District of Columbia", code: "DC", majorCities: ["Washington"] },
];

/** Lookup US state by name (case-insensitive) */
export function getUSStateByName(name: string): USStateDef | undefined {
  const lower = name.toLowerCase();
  return US_STATES.find((s) => s.name.toLowerCase() === lower);
}

/** Lookup US state by code */
export function getUSStateByCode(code: string): USStateDef | undefined {
  return US_STATES.find((s) => s.code === code);
}

/** Get all US major cities */
export function getUSMajorCities(): string[] {
  const cities = new Set<string>();
  for (const state of US_STATES) {
    for (const city of state.majorCities) {
      cities.add(city);
    }
  }
  return Array.from(cities).sort();
}

// ── Common EEOC / Diversity options ──

export const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;

export const PRONOUN_OPTIONS = ["He/Him", "She/Her", "They/Them", "Prefer not to say"] as const;

export const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"] as const;

export const ETHNICITY_OPTIONS = [
  "Asian", "Black or African American", "Hispanic or Latino",
  "Native American or Alaska Native", "Native Hawaiian or Pacific Islander",
  "White", "Two or More Races", "Other", "Prefer not to say",
] as const;

export const RACE_OPTIONS = [
  "American Indian or Alaska Native", "Asian", "Black or African American",
  "Hispanic or Latino", "Native Hawaiian or Pacific Islander",
  "White", "Two or More Races", "Prefer not to say",
] as const;

export const HISPANIC_LATINO_OPTIONS = ["Yes", "No", "Prefer not to say"] as const;

export const VETERAN_STATUS_OPTIONS = [
  "Not a protected veteran",
  "Disabled veteran",
  "Recently separated veteran",
  "Active duty wartime or campaign badge veteran",
  "Armed forces service medal veteran",
  "Not a veteran",
  "Prefer not to say",
] as const;

export const DISABILITY_STATUS_OPTIONS = [
  "Yes, I have a disability",
  "No, I don't have a disability",
  "I don't wish to answer",
] as const;

export const VISA_TYPES = [
  "H-1B", "H-1B1", "H-4", "L-1", "L-2", "F-1", "F-1 OPT", "F-1 STEM OPT",
  "J-1", "J-2", "M-1", "O-1", "O-3", "P-1", "P-2", "P-3",
  "TN", "E-1", "E-2", "E-3", "B-1", "B-2",
  "H-1B Cap Exempt", "Optional Practical Training (OPT)",
  "Employment Authorization Document (EAD)",
  "Green Card / Permanent Resident", "US Citizen",
  "Indian Citizen (No visa required)",
  "Other",
] as const;

export const SALARY_CURRENCIES = [
  "USD", "INR", "GBP", "EUR", "CAD", "AUD", "SGD", "AED", "JPY", "CNY", "CHF",
] as const;

export const NOTICE_PERIOD_OPTIONS = [
  "Immediate", "15 days", "30 days", "60 days", "90 days",
  "Serving notice", "Negotiable", "Prefer not to say",
] as const;

export const WORK_AUTHORIZATION_US_OPTIONS = [
  "US Citizen", "Permanent Resident (Green Card)",
  "H-1B Visa", "L-2 Visa", "F-1 OPT", "H-4 EAD",
  "TN Visa", "O-1 Visa", "E-3 Visa",
  "Other work authorization",
  "Requires sponsorship",
] as const;

export const WORK_AUTHORIZATION_INDIA_OPTIONS = [
  "Indian Citizen", "OCI Cardholder",
  "Authorized to work in India",
  "Requires sponsorship",
] as const;
