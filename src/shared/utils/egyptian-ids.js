/**
 * Egyptian national ID & mobile number: cleaning and validation.
 * Used by manual registration and by the Excel import, so both follow the same rules.
 */

// Governorate codes (digits 8-9 of the national ID); 88 = born outside Egypt
const GOVERNORATE_CODES = new Set([
  '01', '02', '03', '04',
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '31', '32', '33', '34', '35',
  '88',
]);

const EGYPTIAN_MOBILE = /^01[0125]\d{8}$/;

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits -> 0-9 */
export const toLatinDigits = (value) =>
  String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** Latin digits, with spaces, dashes, dots and invisible characters removed */
const stripSeparators = (value) =>
  toLatinDigits(value).replace(/[\s\-.​-\u200F\u202A-\u202E\u2066-\u2069﻿]/g, '');

export const normalizeNationalId = (value) => stripSeparators(value);

/**
 * Cleans a phone number into the local 11-digit form:
 * '+20 101 234 5678' / '00201012345678' / '1012345678' -> '01012345678'
 */
export const normalizePhone = (value) => {
  let phone = stripSeparators(value).replace(/^\+/, '');
  if (/^0020\d{10}$/.test(phone)) phone = `0${phone.slice(4)}`;
  else if (/^20\d{10}$/.test(phone)) phone = `0${phone.slice(2)}`;
  else if (/^1\d{9}$/.test(phone)) phone = `0${phone}`;
  return phone;
};

/**
 * Why a national ID is not a valid Egyptian one (expects a normalized value).
 * @returns the error message in Arabic, or null when the ID is valid
 */
export const nationalIdError = (nationalId) => {
  const nid = String(nationalId ?? '');
  if (!nid) return 'الرقم القومي مطلوب';
  if (!/^\d+$/.test(nid)) return `الرقم القومي "${nid}" يجب أن يحتوي على أرقام فقط`;
  if (nid.length !== 14) return `الرقم القومي "${nid}" يجب أن يتكون من 14 رقماً (المدخل ${nid.length} رقماً)`;
  if (nid[0] !== '2' && nid[0] !== '3') return `الرقم القومي "${nid}" يجب أن يبدأ بالرقم 2 أو 3`;

  const year = Number((nid[0] === '2' ? '19' : '20') + nid.slice(1, 3));
  const month = Number(nid.slice(3, 5));
  const day = Number(nid.slice(5, 7));
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    birthDate.getUTCFullYear() === year && birthDate.getUTCMonth() === month - 1 && birthDate.getUTCDate() === day;
  if (!isRealDate || birthDate > new Date()) {
    return `تاريخ الميلاد داخل الرقم القومي "${nid}" غير صحيح`;
  }

  if (!GOVERNORATE_CODES.has(nid.slice(7, 9))) {
    return `كود المحافظة داخل الرقم القومي "${nid}" غير صحيح`;
  }
  return null;
};

export const isValidNationalId = (nationalId) => nationalIdError(nationalId) === null;

export const isValidEgyptianMobile = (phone) => EGYPTIAN_MOBILE.test(String(phone ?? ''));

/** Error message for a phone that is not an Egyptian mobile number (expects a normalized value) */
export const phoneError = (phone) =>
  isValidEgyptianMobile(phone)
    ? null
    : `رقم الهاتف "${phone}" غير صحيح. يجب أن يكون رقم موبايل مصري من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015`;
