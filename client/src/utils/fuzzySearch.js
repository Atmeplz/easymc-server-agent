export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isSubsequence(needle, haystack) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

export function levenshteinDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j += 1) {
      current[j + 1] = Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        previous[j] + (left[i] === right[j] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function matchesFuzzyQuery(query, fields) {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const normalizedFields = fields.map(normalizeSearchText).filter(Boolean);
  const haystack = normalizedFields.join(' ');
  const compactHaystack = haystack.replace(/\s+/g, '');
  const words = haystack.split(/\s+/).filter(Boolean);

  return tokens.every(token => {
    if (haystack.includes(token) || isSubsequence(token, compactHaystack)) return true;
    const maxDistance = token.length > 5 ? 2 : 1;
    return words.some(word => Math.abs(word.length - token.length) <= maxDistance && levenshteinDistance(token, word) <= maxDistance);
  });
}
