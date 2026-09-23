/**
 * Centralized Currency and Number Formatting Utility
 * 
 * Guarantees consistent Indian Rupee (₹) presentation across the application
 * using the standard en-IN locale format (e.g. ₹3,000, ₹24,500, ₹1,25,000).
 * Prevents character corruption, broken '?' symbols, NaN, null, and undefined values.
 */

export interface CurrencyFormatOptions {
  /**
   * Fallback string displayed when amount is null, undefined, NaN, or non-numeric.
   * Default is '₹0' if showSymbol is true, otherwise '0'.
   */
  fallback?: string;
  /**
   * Number of decimal places to include (default: 0).
   */
  decimals?: number;
  /**
   * Whether to include the ₹ symbol (default: true).
   */
  showSymbol?: boolean;
}

/**
 * Formats any numeric value or string amount into Indian Rupee representation.
 *
 * Examples:
 *   formatCurrency(3000)       => "₹3,000"
 *   formatCurrency(24500)      => "₹24,500"
 *   formatCurrency(125000)     => "₹1,25,000"
 *   formatCurrency(0)          => "₹0"
 *   formatCurrency(-500)       => "-₹500"
 *   formatCurrency(null)       => "₹0" (or fallback)
 *   formatCurrency(undefined)  => "₹0" (or fallback)
 *   formatCurrency(NaN)        => "₹0" (or fallback)
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: CurrencyFormatOptions = {}
): string {
  const { decimals = 0, showSymbol = true } = options;
  const defaultFallback = showSymbol ? '₹0' : '0';
  const fallback = options.fallback !== undefined ? options.fallback : defaultFallback;

  if (amount === null || amount === undefined || amount === '') {
    return fallback;
  }

  const numericValue = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;

  if (typeof numericValue !== 'number' || isNaN(numericValue) || !isFinite(numericValue)) {
    return fallback;
  }

  const isNegative = numericValue < 0;
  const absValue = Math.abs(numericValue);

  const formattedNumber = absValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const symbol = showSymbol ? '₹' : '';
  const sign = isNegative ? '-' : '';

  return `${sign}${symbol}${formattedNumber}`;
}

/**
 * Formats a raw number using the standard Indian comma-separation numbering system (e.g. 1,25,000).
 */
export function formatNumber(
  value: number | string | null | undefined,
  fallback: string = '0'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;

  if (typeof numericValue !== 'number' || isNaN(numericValue) || !isFinite(numericValue)) {
    return fallback;
  }

  return numericValue.toLocaleString('en-IN');
}
