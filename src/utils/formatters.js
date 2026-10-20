const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

export function formatUSD(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Unavailable';
  return usdFormatter.format(Number(value));
}

export function formatDateTime(value) {
  if (!value) return 'Date unavailable';
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return 'Date unavailable';
  return timestampFormatter.format(timestamp);
}

export function formatQuantity(value, maximumFractionDigits = 6) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Unavailable';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits });
}
