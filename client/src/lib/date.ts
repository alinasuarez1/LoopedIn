import { format } from "date-fns";

export function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not available';

  try {
    const date = new Date(dateStr);
    if (!isValidDate(date)) {
      return 'Invalid date';
    }
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not available';

  try {
    const date = new Date(dateStr);
    if (!isValidDate(date)) {
      return 'Invalid date';
    }
    return format(date, 'MMM d, yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}