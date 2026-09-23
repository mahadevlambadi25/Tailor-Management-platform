export type ReportDatePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'CUSTOM';

export interface ParsedDateRange {
  startDate: Date;
  endDate: Date;
  preset: ReportDatePreset;
}

export interface DateRangeParseResult {
  valid: boolean;
  data?: ParsedDateRange;
  error?: string;
  code?: string;
}

export class ReportDateUtils {
  private static MAX_WINDOW_DAYS = 366; // Maximum 1 year reporting window

  /**
   * Parse and validate report date range from request query parameters.
   * Guarantees strict boundary hours (00:00:00.000 to 23:59:59.999), valid ISO inputs,
   * startDate <= endDate, and maximum 1-year query restriction.
   */
  static parseDateRange(query: {
    range?: string;
    startDate?: string;
    endDate?: string;
  }): DateRangeParseResult {
    const rawPreset = (query.range || 'THIS_MONTH').toUpperCase() as ReportDatePreset;

    const validPresets: ReportDatePreset[] = [
      'TODAY',
      'YESTERDAY',
      'THIS_WEEK',
      'THIS_MONTH',
      'LAST_MONTH',
      'CUSTOM'
    ];

    if (!validPresets.includes(rawPreset)) {
      return {
        valid: false,
        error: `Invalid date range preset "${query.range}". Allowed presets: ${validPresets.join(', ')}.`,
        code: 'INVALID_DATE_PRESET'
      };
    }

    const now = new Date();

    if (rawPreset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { valid: true, data: { startDate: start, endDate: end, preset: 'TODAY' } };
    }

    if (rawPreset === 'YESTERDAY') {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { valid: true, data: { startDate: start, endDate: end, preset: 'YESTERDAY' } };
    }

    if (rawPreset === 'THIS_WEEK') {
      // Monday of current week
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      const monday = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { valid: true, data: { startDate: monday, endDate: end, preset: 'THIS_WEEK' } };
    }

    if (rawPreset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { valid: true, data: { startDate: start, endDate: end, preset: 'THIS_MONTH' } };
    }

    if (rawPreset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { valid: true, data: { startDate: start, endDate: end, preset: 'LAST_MONTH' } };
    }

    // CUSTOM range
    if (rawPreset === 'CUSTOM') {
      if (!query.startDate || !query.endDate) {
        return {
          valid: false,
          error: 'startDate and endDate are mandatory when using CUSTOM date range.',
          code: 'MISSING_CUSTOM_DATES'
        };
      }

      const start = new Date(query.startDate);
      const end = new Date(query.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          valid: false,
          error: 'Invalid date format for startDate or endDate. Use YYYY-MM-DD or ISO 8601.',
          code: 'INVALID_DATE_FORMAT'
        };
      }

      // Ensure start has 00:00:00.000 and end has 23:59:59.999
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      if (start.getTime() > end.getTime()) {
        return {
          valid: false,
          error: 'startDate cannot be later than endDate.',
          code: 'INVALID_DATE_SEQUENCE'
        };
      }

      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > this.MAX_WINDOW_DAYS) {
        return {
          valid: false,
          error: `Reporting window cannot exceed ${this.MAX_WINDOW_DAYS} days (1 year). Selected range is ${diffDays} days.`,
          code: 'DATE_WINDOW_EXCEEDED'
        };
      }

      return { valid: true, data: { startDate: start, endDate: end, preset: 'CUSTOM' } };
    }

    // Fallback default
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { valid: true, data: { startDate: start, endDate: end, preset: 'THIS_MONTH' } };
  }
}
