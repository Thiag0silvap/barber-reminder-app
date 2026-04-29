export type Client = {
  id: number;
  name: string;
  phone: string;
  lastVisit: string | null;
  recurrenceDays: number | null;
  nextVisit: string | null;
  notes?: string;
  createdAt: string;
};