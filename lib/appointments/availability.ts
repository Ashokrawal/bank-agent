/**
 * lib/appointments/availability.ts
 *
 * Business rules for appointment slots. No real calendar/advisor scheduling
 * system exists behind this - just a fixed daily slot list and a check
 * against already-booked rows in the appointments table.
 */

import { getAppointments } from "@/lib/db/sqlite";

// Fixed bookable times per day - same list the old form offered.
export const SLOT_TIMES = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
] as const;

const BOOKING_WINDOW_DAYS = 90;

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function parseDate(dateStr: string): Date | null {
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isValidSlotTime(time: string): boolean {
  return (SLOT_TIMES as readonly string[]).includes(time);
}

// Validates the date is a real weekday between tomorrow and 90 days out.
export function validateBookingWindow(dateStr: string): {
  valid: boolean;
  reason?: string;
} {
  const date = parseDate(dateStr);
  if (!date) return { valid: false, reason: "not a recognisable date" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + BOOKING_WINDOW_DAYS);

  if (date < tomorrow) return { valid: false, reason: "date is in the past or today" };
  if (date > maxDate) return { valid: false, reason: "date is more than 3 months away" };
  if (!isWeekday(date)) return { valid: false, reason: "date falls on a weekend" };

  return { valid: true };
}

// True if this exact (date, time, advisorType) is already booked and not cancelled.
export async function isSlotTaken(
  advisorType: string,
  dateStr: string,
  time: string,
): Promise<boolean> {
  const rows = (await getAppointments()) as Array<Record<string, unknown>>;
  return rows.some(
    (r) =>
      r.advisor_type === advisorType &&
      r.preferred_date === dateStr &&
      r.preferred_time === time &&
      r.status !== "cancelled",
  );
}

// Finds up to `count` open slots near the requested date/time: remaining
// slots later the same day first, then the next few weekdays in full.
export async function findNearbySlots(
  advisorType: string,
  dateStr: string,
  time: string,
  count = 4,
): Promise<Array<{ date: string; time: string }>> {
  const rows = (await getAppointments()) as Array<Record<string, unknown>>;
  const taken = new Set(
    rows
      .filter((r) => r.advisor_type === advisorType && r.status !== "cancelled")
      .map((r) => `${r.preferred_date}|${r.preferred_time}`),
  );

  const results: Array<{ date: string; time: string }> = [];
  const requestedDate = parseDate(dateStr) ?? new Date();

  // Same day, later slots first
  const requestedIdx = SLOT_TIMES.indexOf(time as (typeof SLOT_TIMES)[number]);
  const sameDayTimes =
    requestedIdx >= 0 ? SLOT_TIMES.slice(requestedIdx + 1) : SLOT_TIMES;
  for (const t of sameDayTimes) {
    if (results.length >= count) break;
    if (!taken.has(`${dateStr}|${t}`)) results.push({ date: dateStr, time: t });
  }

  // Then walk forward day by day (skipping weekends) filling every slot
  for (let offset = 1; offset <= 21 && results.length < count; offset++) {
    const d = new Date(requestedDate);
    d.setDate(d.getDate() + offset);
    if (!isWeekday(d)) continue;
    const ds = d.toISOString().split("T")[0];
    for (const t of SLOT_TIMES) {
      if (results.length >= count) break;
      if (!taken.has(`${ds}|${t}`)) results.push({ date: ds, time: t });
    }
  }

  return results;
}
