export interface Reservation {
  id: string;
  building: string;
  floor: string;
  room: string;
  roomType: string;
  title: string;
  department: string;
  userName: string;
  phone: string;
  start: Date;
  end: Date;
  created: Date;
  status: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId?: string;
  allDay?: boolean;
  desc?: string; // For tooltip or modal details
  originalData: Reservation;
}
