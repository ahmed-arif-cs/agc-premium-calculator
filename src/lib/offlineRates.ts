/**
 * Static, baked-in approximate USD exchange rates for the currency
 * converter's last-resort offline fallback.
 *
 * These numbers are NOT live — they're rough snapshots meant only to keep
 * the converter usable (rather than fully broken) when both live sources
 * (open.er-api.com and frankfurter.app) are unreachable. Callers should
 * always surface this to the user as "offline / approximate" and never
 * present it as current-rate data.
 */

export const OFFLINE_RATES_DATE_LABEL = "offline snapshot — may be outdated";

/** Approximate value of 1 USD in each currency. */
export const OFFLINE_RATES: Record<string, number> = {
  // Major / pinned
  EUR: 0.92,
  GBP: 0.79,
  PKR: 279,
  INR: 86.5,
  SAR: 3.75,
  AED: 3.67,
  CNY: 7.25,

  // South Asia
  BDT: 122,
  LKR: 296,
  NPR: 134,
  BTN: 86.5,
  MVR: 15.4,
  AFN: 70,

  // East Asia
  JPY: 152,
  KRW: 1380,
  HKD: 7.8,
  TWD: 32.3,
  MNT: 3450,
  MOP: 8.03,

  // Southeast Asia
  SGD: 1.34,
  MYR: 4.45,
  THB: 34.2,
  IDR: 15900,
  PHP: 56.8,
  VND: 25400,
  MMK: 2100,
  KHR: 4080,
  LAK: 21700,
  BND: 1.34,

  // Middle East
  QAR: 3.64,
  KWD: 0.307,
  BHD: 0.376,
  OMR: 0.385,
  JOD: 0.709,
  ILS: 3.7,
  IQD: 1310,
  IRR: 42000,
  LBP: 89500,
  SYP: 13000,
  YER: 250,
  TRY: 35.5,

  // Central Asia
  KZT: 495,
  UZS: 12800,
  TJS: 10.9,
  KGS: 87.5,
  TMT: 3.5,
  AZN: 1.7,
  GEL: 2.72,
  AMD: 388,

  // Europe
  CHF: 0.88,
  SEK: 10.6,
  NOK: 10.9,
  DKK: 6.87,
  PLN: 4.02,
  CZK: 23.6,
  HUF: 375,
  RON: 4.58,
  BGN: 1.8,
  HRK: 6.93,
  ISK: 138,
  UAH: 41.5,
  RSD: 108,
  RUB: 92,
  ALL: 94,
  BAM: 1.8,
  MKD: 56.6,
  MDL: 17.9,

  // Africa
  ZAR: 18.2,
  EGP: 49.5,
  NGN: 1550,
  KES: 129,
  GHS: 15.2,
  MAD: 9.95,
  DZD: 134,
  TND: 3.1,
  ETB: 122,
  UGX: 3700,
  TZS: 2600,
  XOF: 605,
  XAF: 605,
  ZMW: 27,
  BWP: 13.6,
  NAD: 18.2,
  MUR: 46,
  RWF: 1330,
  SDG: 601,
  LYD: 4.85,

  // North America
  CAD: 1.38,
  MXN: 18.2,
  GTQ: 7.7,
  DOP: 60,
  JMD: 158,
  CRC: 505,
  PAB: 1,
  BZD: 2.02,
  HTG: 132,
  BSD: 1,

  // South America
  BRL: 5.7,
  ARS: 1050,
  CLP: 970,
  COP: 4150,
  PEN: 3.75,
  UYU: 42.5,
  BOB: 6.91,
  PYG: 7900,
  VES: 55,
  GYD: 209,

  // Oceania
  AUD: 1.52,
  NZD: 1.65,
  FJD: 2.28,
  PGK: 4.05,
  WST: 2.74,
  TOP: 2.36,
};
