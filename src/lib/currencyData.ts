/**
 * Static metadata (display name, region, flag) for world currencies.
 * The live rates themselves come from /api/currency — this file only
 * decorates whatever codes that endpoint returns, and supplies a sensible
 * fallback (just the code) for anything not listed here.
 */

export type CurrencyRegion =
  | "South Asia"
  | "East Asia"
  | "Southeast Asia"
  | "Middle East"
  | "Europe"
  | "Africa"
  | "North America"
  | "South America"
  | "Oceania"
  | "Central Asia";

export interface CurrencyMeta {
  name: string;
  region: CurrencyRegion;
  flag: string;
}

export const CURRENCY_META: Record<string, CurrencyMeta> = {
  // South Asia
  PKR: { name: "Pakistani Rupee", region: "South Asia", flag: "🇵🇰" },
  INR: { name: "Indian Rupee", region: "South Asia", flag: "🇮🇳" },
  BDT: { name: "Bangladeshi Taka", region: "South Asia", flag: "🇧🇩" },
  LKR: { name: "Sri Lankan Rupee", region: "South Asia", flag: "🇱🇰" },
  NPR: { name: "Nepalese Rupee", region: "South Asia", flag: "🇳🇵" },
  BTN: { name: "Bhutanese Ngultrum", region: "South Asia", flag: "🇧🇹" },
  MVR: { name: "Maldivian Rufiyaa", region: "South Asia", flag: "🇲🇻" },
  AFN: { name: "Afghan Afghani", region: "South Asia", flag: "🇦🇫" },

  // East Asia
  CNY: { name: "Chinese Yuan", region: "East Asia", flag: "🇨🇳" },
  JPY: { name: "Japanese Yen", region: "East Asia", flag: "🇯🇵" },
  KRW: { name: "South Korean Won", region: "East Asia", flag: "🇰🇷" },
  HKD: { name: "Hong Kong Dollar", region: "East Asia", flag: "🇭🇰" },
  TWD: { name: "New Taiwan Dollar", region: "East Asia", flag: "🇹🇼" },
  MNT: { name: "Mongolian Tögrög", region: "East Asia", flag: "🇲🇳" },
  MOP: { name: "Macanese Pataca", region: "East Asia", flag: "🇲🇴" },

  // Southeast Asia
  SGD: { name: "Singapore Dollar", region: "Southeast Asia", flag: "🇸🇬" },
  MYR: { name: "Malaysian Ringgit", region: "Southeast Asia", flag: "🇲🇾" },
  THB: { name: "Thai Baht", region: "Southeast Asia", flag: "🇹🇭" },
  IDR: { name: "Indonesian Rupiah", region: "Southeast Asia", flag: "🇮🇩" },
  PHP: { name: "Philippine Peso", region: "Southeast Asia", flag: "🇵🇭" },
  VND: { name: "Vietnamese Đồng", region: "Southeast Asia", flag: "🇻🇳" },
  MMK: { name: "Myanmar Kyat", region: "Southeast Asia", flag: "🇲🇲" },
  KHR: { name: "Cambodian Riel", region: "Southeast Asia", flag: "🇰🇭" },
  LAK: { name: "Lao Kip", region: "Southeast Asia", flag: "🇱🇦" },
  BND: { name: "Brunei Dollar", region: "Southeast Asia", flag: "🇧🇳" },

  // Middle East
  AED: { name: "UAE Dirham", region: "Middle East", flag: "🇦🇪" },
  SAR: { name: "Saudi Riyal", region: "Middle East", flag: "🇸🇦" },
  QAR: { name: "Qatari Riyal", region: "Middle East", flag: "🇶🇦" },
  KWD: { name: "Kuwaiti Dinar", region: "Middle East", flag: "🇰🇼" },
  BHD: { name: "Bahraini Dinar", region: "Middle East", flag: "🇧🇭" },
  OMR: { name: "Omani Rial", region: "Middle East", flag: "🇴🇲" },
  JOD: { name: "Jordanian Dinar", region: "Middle East", flag: "🇯🇴" },
  ILS: { name: "Israeli Shekel", region: "Middle East", flag: "🇮🇱" },
  IQD: { name: "Iraqi Dinar", region: "Middle East", flag: "🇮🇶" },
  IRR: { name: "Iranian Rial", region: "Middle East", flag: "🇮🇷" },
  LBP: { name: "Lebanese Pound", region: "Middle East", flag: "🇱🇧" },
  SYP: { name: "Syrian Pound", region: "Middle East", flag: "🇸🇾" },
  YER: { name: "Yemeni Rial", region: "Middle East", flag: "🇾🇪" },
  TRY: { name: "Turkish Lira", region: "Middle East", flag: "🇹🇷" },

  // Central Asia
  KZT: { name: "Kazakhstani Tenge", region: "Central Asia", flag: "🇰🇿" },
  UZS: { name: "Uzbekistani Som", region: "Central Asia", flag: "🇺🇿" },
  TJS: { name: "Tajikistani Somoni", region: "Central Asia", flag: "🇹🇯" },
  KGS: { name: "Kyrgyzstani Som", region: "Central Asia", flag: "🇰🇬" },
  TMT: { name: "Turkmenistani Manat", region: "Central Asia", flag: "🇹🇲" },
  AZN: { name: "Azerbaijani Manat", region: "Central Asia", flag: "🇦🇿" },
  GEL: { name: "Georgian Lari", region: "Central Asia", flag: "🇬🇪" },
  AMD: { name: "Armenian Dram", region: "Central Asia", flag: "🇦🇲" },

  // Europe
  EUR: { name: "Euro", region: "Europe", flag: "🇪🇺" },
  GBP: { name: "British Pound", region: "Europe", flag: "🇬🇧" },
  CHF: { name: "Swiss Franc", region: "Europe", flag: "🇨🇭" },
  SEK: { name: "Swedish Krona", region: "Europe", flag: "🇸🇪" },
  NOK: { name: "Norwegian Krone", region: "Europe", flag: "🇳🇴" },
  DKK: { name: "Danish Krone", region: "Europe", flag: "🇩🇰" },
  PLN: { name: "Polish Złoty", region: "Europe", flag: "🇵🇱" },
  CZK: { name: "Czech Koruna", region: "Europe", flag: "🇨🇿" },
  HUF: { name: "Hungarian Forint", region: "Europe", flag: "🇭🇺" },
  RON: { name: "Romanian Leu", region: "Europe", flag: "🇷🇴" },
  BGN: { name: "Bulgarian Lev", region: "Europe", flag: "🇧🇬" },
  HRK: { name: "Croatian Kuna", region: "Europe", flag: "🇭🇷" },
  ISK: { name: "Icelandic Króna", region: "Europe", flag: "🇮🇸" },
  UAH: { name: "Ukrainian Hryvnia", region: "Europe", flag: "🇺🇦" },
  RSD: { name: "Serbian Dinar", region: "Europe", flag: "🇷🇸" },
  RUB: { name: "Russian Ruble", region: "Europe", flag: "🇷🇺" },
  ALL: { name: "Albanian Lek", region: "Europe", flag: "🇦🇱" },
  BAM: { name: "Bosnia-Herzegovina Mark", region: "Europe", flag: "🇧🇦" },
  MKD: { name: "Macedonian Denar", region: "Europe", flag: "🇲🇰" },
  MDL: { name: "Moldovan Leu", region: "Europe", flag: "🇲🇩" },

  // Africa
  ZAR: { name: "South African Rand", region: "Africa", flag: "🇿🇦" },
  EGP: { name: "Egyptian Pound", region: "Africa", flag: "🇪🇬" },
  NGN: { name: "Nigerian Naira", region: "Africa", flag: "🇳🇬" },
  KES: { name: "Kenyan Shilling", region: "Africa", flag: "🇰🇪" },
  GHS: { name: "Ghanaian Cedi", region: "Africa", flag: "🇬🇭" },
  MAD: { name: "Moroccan Dirham", region: "Africa", flag: "🇲🇦" },
  DZD: { name: "Algerian Dinar", region: "Africa", flag: "🇩🇿" },
  TND: { name: "Tunisian Dinar", region: "Africa", flag: "🇹🇳" },
  ETB: { name: "Ethiopian Birr", region: "Africa", flag: "🇪🇹" },
  UGX: { name: "Ugandan Shilling", region: "Africa", flag: "🇺🇬" },
  TZS: { name: "Tanzanian Shilling", region: "Africa", flag: "🇹🇿" },
  XOF: { name: "West African CFA Franc", region: "Africa", flag: "🌍" },
  XAF: { name: "Central African CFA Franc", region: "Africa", flag: "🌍" },
  ZMW: { name: "Zambian Kwacha", region: "Africa", flag: "🇿🇲" },
  BWP: { name: "Botswanan Pula", region: "Africa", flag: "🇧🇼" },
  NAD: { name: "Namibian Dollar", region: "Africa", flag: "🇳🇦" },
  MUR: { name: "Mauritian Rupee", region: "Africa", flag: "🇲🇺" },
  RWF: { name: "Rwandan Franc", region: "Africa", flag: "🇷🇼" },
  SDG: { name: "Sudanese Pound", region: "Africa", flag: "🇸🇩" },
  LYD: { name: "Libyan Dinar", region: "Africa", flag: "🇱🇾" },

  // North America
  USD: { name: "US Dollar", region: "North America", flag: "🇺🇸" },
  CAD: { name: "Canadian Dollar", region: "North America", flag: "🇨🇦" },
  MXN: { name: "Mexican Peso", region: "North America", flag: "🇲🇽" },
  GTQ: { name: "Guatemalan Quetzal", region: "North America", flag: "🇬🇹" },
  DOP: { name: "Dominican Peso", region: "North America", flag: "🇩🇴" },
  JMD: { name: "Jamaican Dollar", region: "North America", flag: "🇯🇲" },
  CRC: { name: "Costa Rican Colón", region: "North America", flag: "🇨🇷" },
  PAB: { name: "Panamanian Balboa", region: "North America", flag: "🇵🇦" },
  BZD: { name: "Belize Dollar", region: "North America", flag: "🇧🇿" },
  HTG: { name: "Haitian Gourde", region: "North America", flag: "🇭🇹" },
  BSD: { name: "Bahamian Dollar", region: "North America", flag: "🇧🇸" },

  // South America
  BRL: { name: "Brazilian Real", region: "South America", flag: "🇧🇷" },
  ARS: { name: "Argentine Peso", region: "South America", flag: "🇦🇷" },
  CLP: { name: "Chilean Peso", region: "South America", flag: "🇨🇱" },
  COP: { name: "Colombian Peso", region: "South America", flag: "🇨🇴" },
  PEN: { name: "Peruvian Sol", region: "South America", flag: "🇵🇪" },
  UYU: { name: "Uruguayan Peso", region: "South America", flag: "🇺🇾" },
  BOB: { name: "Bolivian Boliviano", region: "South America", flag: "🇧🇴" },
  PYG: { name: "Paraguayan Guaraní", region: "South America", flag: "🇵🇾" },
  VES: { name: "Venezuelan Bolívar", region: "South America", flag: "🇻🇪" },
  GYD: { name: "Guyanese Dollar", region: "South America", flag: "🇬🇾" },

  // Oceania
  AUD: { name: "Australian Dollar", region: "Oceania", flag: "🇦🇺" },
  NZD: { name: "New Zealand Dollar", region: "Oceania", flag: "🇳🇿" },
  FJD: { name: "Fijian Dollar", region: "Oceania", flag: "🇫🇯" },
  PGK: { name: "Papua New Guinean Kina", region: "Oceania", flag: "🇵🇬" },
  WST: { name: "Samoan Tālā", region: "Oceania", flag: "🇼🇸" },
  TOP: { name: "Tongan Paʻanga", region: "Oceania", flag: "🇹🇴" },
};

export const REGION_ORDER: CurrencyRegion[] = [
  "South Asia",
  "East Asia",
  "Southeast Asia",
  "Middle East",
  "Central Asia",
  "Europe",
  "Africa",
  "North America",
  "South America",
  "Oceania",
];

/** Popular/pinned codes shown at the top of the picker (above regions). */
export const PINNED_CODES = ["USD", "PKR", "EUR", "GBP", "INR", "SAR", "AED", "CNY"];

export function metaFor(code: string): CurrencyMeta {
  return CURRENCY_META[code] ?? { name: code, region: "Europe", flag: "🏳️" };
}

export function currencyDisplayName(code: string): string {
  const m = CURRENCY_META[code];
  return m ? `${code} · ${m.name}` : code;
}
