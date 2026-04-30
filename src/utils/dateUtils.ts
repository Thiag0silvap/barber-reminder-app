const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function getLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseIsoDateAsLocal(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysToIsoDate(value: string, days: number) {
  const date = parseIsoDateAsLocal(value);
  date.setDate(date.getDate() + days);

  return getLocalIsoDate(date);
}

export function diffIsoDatesInDays(startDate: string, endDate: string) {
  const start = parseIsoDateAsLocal(startDate).getTime();
  const end = parseIsoDateAsLocal(endDate).getTime();

  return Math.round((end - start) / MS_PER_DAY);
}
