import { Appointment } from '../types/Appointment';

export function calculateAverageRecurrence(appointments: Appointment[]) {
  if (appointments.length < 2) {
    return null;
  }

  const orderedAppointments = [...appointments].sort((a, b) =>
    a.visitDate.localeCompare(b.visitDate)
  );

  const intervals: number[] = [];

  for (let i = 1; i < orderedAppointments.length; i++) {
    const previousDate = new Date(orderedAppointments[i - 1].visitDate);
    const currentDate = new Date(orderedAppointments[i].visitDate);

    const diffInMs = currentDate.getTime() - previousDate.getTime();
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

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

  const date = new Date(lastVisit);
  date.setDate(date.getDate() + recurrenceDays);

  return date.toISOString().split('T')[0];
}