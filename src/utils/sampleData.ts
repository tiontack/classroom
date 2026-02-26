import { CalendarEvent, Reservation } from '../types';

// Helper to create dates relative to "today" or fixed dates
// The PDF data is for 2026-02-25. We will use these fixed dates.

export const SAMPLE_RESERVATIONS: Reservation[] = [];

export const getSampleEvents = (): CalendarEvent[] => {
  return SAMPLE_RESERVATIONS.map(res => ({
    id: res.id,
    title: `${res.title} (${res.userName})`,
    start: res.start,
    end: res.end,
    resourceId: res.room,
    originalData: res
  }));
};
