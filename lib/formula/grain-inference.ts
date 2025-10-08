import { differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import type { Grain } from '@/types';

/**
 * Infers the grain (day/month/quarter/year) from a sequence of dates
 * by analyzing the differences between consecutive dates
 */
export function inferGrainFromDates(dates: Date[]): Grain {
  if (dates.length < 2) {
    return 'month'; // Default to month if not enough data
  }

  // Calculate differences between consecutive dates
  const diffs: number[] = [];

  for (let i = 1; i < dates.length; i++) {
    const daysDiff = Math.abs(differenceInDays(dates[i], dates[i - 1]));
    diffs.push(daysDiff);
  }

  // Calculate average difference
  const avgDiff = diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length;

  // Determine grain based on average difference
  // Allow some tolerance for month-end variations
  if (avgDiff <= 1) {
    return 'day';
  } else if (avgDiff >= 25 && avgDiff <= 35) {
    // ~28-31 days = monthly
    return 'month';
  } else if (avgDiff >= 85 && avgDiff <= 95) {
    // ~90 days = quarterly
    return 'quarter';
  } else if (avgDiff >= 360 && avgDiff <= 370) {
    // ~365 days = yearly
    return 'year';
  }

  // Default to month if we can't determine
  return 'month';
}

/**
 * Parses a header string to extract a date
 * Supports formats like:
 * - "2024-01" (month)
 * - "2024-Q1" (quarter)
 * - "2024" (year)
 * - "Jan 2024" (month)
 * - "Q1 2024" (quarter)
 */
export function parseHeaderDate(header: string): Date | null {
  const trimmed = header.trim();

  // ISO format: 2024-01 or 2024-01-15
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, day ? parseInt(day) : 1);
  }

  // Quarter format: 2024-Q1 or Q1 2024
  const quarterMatch = trimmed.match(/^(?:(\d{4})-?Q(\d)|Q(\d)\s+(\d{4}))$/i);
  if (quarterMatch) {
    const year = quarterMatch[1] || quarterMatch[4];
    const quarter = quarterMatch[2] || quarterMatch[3];
    const month = (parseInt(quarter) - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
    return new Date(parseInt(year), month, 1);
  }

  // Year only: 2024
  const yearMatch = trimmed.match(/^(\d{4})$/);
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1]), 0, 1);
  }

  // Month name format: Jan 2024, January 2024
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthMatch = trimmed.match(/^([a-z]+)\s+(\d{4})$/i);
  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase().slice(0, 3);
    const monthIndex = monthNames.indexOf(monthName);
    if (monthIndex >= 0) {
      return new Date(parseInt(monthMatch[2]), monthIndex, 1);
    }
  }

  return null;
}

/**
 * Extracts dates from a range of header cells
 */
export function extractDatesFromHeaders(headers: string[]): Date[] {
  const dates: Date[] = [];

  for (const header of headers) {
    const date = parseHeaderDate(header);
    if (date) {
      dates.push(date);
    }
  }

  return dates;
}

/**
 * Infers grain from header strings
 */
export function inferGrainFromHeaders(headers: string[]): Grain {
  const dates = extractDatesFromHeaders(headers);
  return inferGrainFromDates(dates);
}

/**
 * Formats a date according to the specified grain
 */
export function formatDateForGrain(date: Date, grain: Grain): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  switch (grain) {
    case 'day':
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'month':
      return `${year}-${String(month).padStart(2, '0')}`;
    case 'quarter': {
      const quarter = Math.floor(month / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    case 'year':
      return `${year}`;
  }
}

/**
 * Gets the start date for a given grain period
 */
export function getGrainStart(date: Date, grain: Grain): Date {
  const year = date.getFullYear();
  const month = date.getMonth();

  switch (grain) {
    case 'day':
      return new Date(year, month, date.getDate());
    case 'month':
      return new Date(year, month, 1);
    case 'quarter': {
      const quarterMonth = Math.floor(month / 3) * 3;
      return new Date(year, quarterMonth, 1);
    }
    case 'year':
      return new Date(year, 0, 1);
  }
}

/**
 * Gets the end date for a given grain period
 */
export function getGrainEnd(date: Date, grain: Grain): Date {
  const year = date.getFullYear();
  const month = date.getMonth();

  switch (grain) {
    case 'day':
      return new Date(year, month, date.getDate(), 23, 59, 59, 999);
    case 'month':
      return new Date(year, month + 1, 0, 23, 59, 59, 999);
    case 'quarter': {
      const quarterMonth = Math.floor(month / 3) * 3;
      return new Date(year, quarterMonth + 3, 0, 23, 59, 59, 999);
    }
    case 'year':
      return new Date(year, 11, 31, 23, 59, 59, 999);
  }
}
