import { Appointment } from '../types/Appointment';
import { addDaysToIsoDate, diffIsoDatesInDays } from './dateUtils';

export function calculateAverageRecurrence(appointments: Appointment[]) {
  if (appointments.length < 2) {
    return null;
  }

  const orderedAppointments = [...appointments].sort((a, b) =>
    a.visitDate.localeCompare(b.visitDate)
  );

  const intervals: number[] = [];

  for (let i = 1; i < orderedAppointments.length; i++) {
    const diffInDays = diffIsoDatesInDays(
      orderedAppointments[i - 1].visitDate,
      orderedAppointments[i].visitDate
    );

    if (diffInDays > 0) {
      intervals.push(diffInDays);
    }
  }

  if (!intervals.length) {
    return null;
  }

  const total = intervals.reduce((sum, current) => sum + current, 0);

  return Math.round(total / intervals.length);
}

export function calculateNextSuggestedVisit(
  lastVisit: string,
  recurrenceDays: number | null
) {
  if (!recurrenceDays) {
    return null;
  }

  return addDaysToIsoDate(lastVisit, recurrenceDays);
}
