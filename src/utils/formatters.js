/**
 * WaterBoi Formatting Utilities
 */

// Format numbers as Philippine Peso (₱)
export function formatCurrency(amount) {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

// Format numbers with commas
export function formatNumber(num) {
  const val = Number(num) || 0;
  return new Intl.NumberFormat('en-PH').format(val);
}

// Format percentages (e.g. 0.27 -> 27%)
export function formatPercent(rate) {
  const val = Number(rate) || 0;
  return `${(val * 100).toFixed(0)}%`;
}

// Format timestamp or JS Date to readable string
export function formatDate(dateInput, includeTime = false) {
  if (!dateInput) return 'N/A';
  let date;
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return 'N/A';

  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' })
  };

  return new Intl.DateTimeFormat('en-PH', options).format(date);
}

// Get start and end dates for quick filter ranges (today, week, month, year)
export function getDateRange(rangeType) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (rangeType === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    start.setDate(diff);
  } else if (rangeType === 'month') {
    start.setDate(1);
  } else if (rangeType === 'year') {
    start.setMonth(0, 1);
  }

  return { start, end };
}
