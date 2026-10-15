function parseDay(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value) {
  const x = parseDay(value) || new Date(value);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(value) {
  const x = parseDay(value) || new Date(value);
  x.setHours(23, 59, 59, 999);
  return x;
}

module.exports = { parseDay, startOfDay, endOfDay };
