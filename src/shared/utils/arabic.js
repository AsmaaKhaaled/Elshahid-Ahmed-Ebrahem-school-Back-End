/**
 * Alphabetical order key for Arabic names: hamza & taa marbuta variants are folded,
 * so "أحمد" and "احمد" sort together and lists read from أ to ي.
 * @param {string} name
 */
export const arabicSortKey = (name) =>
  (name || '')
    .replace(/[ً-ْـ]/g, '') // tashkeel & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

export const compareArabic = (a, b) => arabicSortKey(a).localeCompare(arabicSortKey(b), 'ar');
