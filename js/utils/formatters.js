/* ============================================
   MenuForge — Formatters
   Currency, price, date, and text formatting
   ============================================ */

/**
 * Currency configuration
 */
const CURRENCY_CONFIG = {
  USD: { symbol: '$', position: 'prefix', decimals: 2, locale: 'en-US' },
  EUR: { symbol: '€', position: 'prefix', decimals: 2, locale: 'de-DE' },
  GBP: { symbol: '£', position: 'prefix', decimals: 2, locale: 'en-GB' },
  AED: { symbol: 'د.إ', position: 'suffix', decimals: 2, locale: 'ar-AE' },
  SAR: { symbol: 'ر.س', position: 'suffix', decimals: 2, locale: 'ar-SA' },
  INR: { symbol: '₹', position: 'prefix', decimals: 0, locale: 'en-IN' },
  JPY: { symbol: '¥', position: 'prefix', decimals: 0, locale: 'ja-JP' },
  CNY: { symbol: '¥', position: 'prefix', decimals: 2, locale: 'zh-CN' },
  CHF: { symbol: 'CHF', position: 'prefix', decimals: 2, locale: 'de-CH' },
  BRL: { symbol: 'R$', position: 'prefix', decimals: 2, locale: 'pt-BR' },
  MXN: { symbol: '$', position: 'prefix', decimals: 2, locale: 'es-MX' },
  THB: { symbol: '฿', position: 'prefix', decimals: 0, locale: 'th-TH' },
  TRY: { symbol: '₺', position: 'prefix', decimals: 2, locale: 'tr-TR' }
};

/**
 * Format a price with currency
 */
export function formatPrice(value, currencyCode = 'USD', options = {}) {
  if (value === null || value === undefined || value === '') return '';
  if (value === 'MP') return 'M.P.';

  const num = parseFloat(value);
  if (isNaN(num)) return String(value);

  const config = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.USD;
  const decimals = options.decimals ?? config.decimals;

  const formatted = num.toLocaleString(config.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  const symbol = options.symbol || config.symbol;
  const position = options.position || config.position;

  if (position === 'suffix') {
    return `${formatted} ${symbol}`;
  }
  return `${symbol}${formatted}`;
}

/**
 * Format a price range
 */
export function formatPriceRange(min, max, currencyCode = 'USD') {
  return `${formatPrice(min, currencyCode)} – ${formatPrice(max, currencyCode)}`;
}

/**
 * Format size variant prices
 */
export function formatVariants(variants, currencyCode = 'USD') {
  return variants
    .map(v => `${v.label}: ${formatPrice(v.price, currencyCode)}`)
    .join(' / ');
}

/**
 * Get currency config
 */
export function getCurrencyConfig(code) {
  return CURRENCY_CONFIG[code] || CURRENCY_CONFIG.USD;
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies() {
  return Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
    code,
    symbol: config.symbol,
    label: `${code} (${config.symbol})`
  }));
}

/**
 * Format a date
 */
export function formatDate(timestamp, format = 'medium') {
  if (!timestamp) return '';
  const date = new Date(timestamp);

  const options = {
    short: { month: 'short', day: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  };

  return date.toLocaleDateString('en-US', options[format] || options.medium);
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return '1 week ago';
  if (weeks < 4) return `${weeks} weeks ago`;
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  return formatDate(timestamp, 'medium');
}

/**
 * Format a number with locale separators
 */
export function formatNumber(num, locale = 'en-US') {
  return num.toLocaleString(locale);
}

/**
 * Format calorie count
 */
export function formatCalories(cal) {
  if (!cal && cal !== 0) return '';
  return `${cal} kcal`;
}

/**
 * Format serving size
 */
export function formatServing(size) {
  if (!size) return '';
  return `(${size})`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength).trim() + '…';
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Title case a string
 */
export function titleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
