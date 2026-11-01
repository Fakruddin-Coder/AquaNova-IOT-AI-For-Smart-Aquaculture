/**
 * AquaNova — Time & Schedule Utilities
 * Handles conversion between 12-hour AM/PM and 24-hour formats,
 * schedule display formatting, and schedule matching.
 */

export interface NormalizedScheduleTime {
  hours: number;     // 0-23
  minutes: number;   // 0-59
  time24: string;    // "HH:mm" (e.g. "14:30")
  display12: string; // "hh:mm AM/PM" (e.g. "02:30 PM")
  period: 'AM' | 'PM';
  hour12: number;    // 1-12
}

/**
 * Normalizes any time string ("14:30", "02:30 PM", "2:30 pm", "8:00")
 * into both 24h and 12h AM/PM representations.
 */
export function normalizeScheduleTime(timeInput: string | null | undefined): NormalizedScheduleTime {
  if (!timeInput || typeof timeInput !== 'string') {
    return {
      hours: 12,
      minutes: 0,
      time24: '12:00',
      display12: '12:00 PM',
      period: 'PM',
      hour12: 12,
    };
  }

  const upper = timeInput.trim().toUpperCase();
  const hasPM = upper.includes('PM');
  const hasAM = upper.includes('AM');

  // Extract digits and colon
  const cleaned = upper.replace(/[^\d:]/g, '');
  const [hStr = '12', mStr = '0'] = cleaned.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);

  if (isNaN(h)) h = 12;
  if (isNaN(m)) m = 0;

  // Handle 12-hour AM/PM conversion
  if (hasPM && h < 12) {
    h += 12;
  } else if (hasAM && h === 12) {
    h = 0;
  }

  const hours = Math.max(0, Math.min(23, h));
  const minutes = Math.max(0, Math.min(59, m));

  const pad = (n: number) => n.toString().padStart(2, '0');
  const time24 = `${pad(hours)}:${pad(minutes)}`;

  const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
  let hour12 = hours % 12;
  if (hour12 === 0) hour12 = 12;

  const display12 = `${pad(hour12)}:${pad(minutes)} ${period}`;

  return {
    hours,
    minutes,
    time24,
    display12,
    period,
    hour12,
  };
}

/**
 * Converts 12-hour inputs to a 24-hour "HH:mm" string.
 */
export function toTime24h(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(minute)}`;
}

/**
 * Returns true if a given schedule's time matches the current local time (same hour and minute).
 */
export function isScheduleDueNow(scheduleTime: string, now: Date = new Date()): boolean {
  const norm = normalizeScheduleTime(scheduleTime);
  return norm.hours === now.getHours() && norm.minutes === now.getMinutes();
}
