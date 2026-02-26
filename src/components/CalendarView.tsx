import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ko'; // Import Korean locale for moment
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEvent } from '../types';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// Setup moment localizer
moment.locale('ko');
const localizer = momentLocalizer(moment);

interface CalendarViewProps {
  events: CalendarEvent[];
}

const resources = [
  { id: '대강의장', title: '대강의장' },
  { id: '중강의장1', title: '중강의장1' },
  { id: '중강의장2', title: '중강의장2' },
];

// 여러 날에 걸친 예약을 날짜별로 분리 (달력 표시용)
function expandMultiDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  for (const event of events) {
    const startDay = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate());
    const endDay   = new Date(event.end.getFullYear(),   event.end.getMonth(),   event.end.getDate());
    if (startDay.getTime() === endDay.getTime()) {
      result.push(event);
      continue;
    }
    let current = new Date(startDay);
    let idx = 0;
    while (current <= endDay) {
      const isFirst = idx === 0;
      const isLast  = current.getTime() === endDay.getTime();
      const dayStart = new Date(current);
      const dayEnd   = new Date(current);
      dayStart.setHours(isFirst ? event.start.getHours() : 9,  isFirst ? event.start.getMinutes() : 0,  0, 0);
      dayEnd.setHours(  isLast  ? event.end.getHours()   : 18, isLast  ? event.end.getMinutes()   : 0,  0, 0);
      if (dayEnd > dayStart) {
        result.push({ ...event, id: `${event.id}-day${idx}`, start: dayStart, end: dayEnd });
      }
      current = new Date(current);
      current.setDate(current.getDate() + 1);
      idx++;
    }
  }
  return result;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ events }) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [date, setDate] = useState(new Date(2026, 1, 25)); // Default to Feb 25, 2026
  const [view, setView] = useState(Views.MONTH); // Default to Month view

  const onNavigate = useCallback((newDate: Date) => setDate(newDate), [setDate]);
  const onView = useCallback((newView: any) => setView(newView), [setView]);

  // 다일 이벤트 날짜별 확장
  const expandedEvents = useMemo(() => expandMultiDayEvents(events), [events]);

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  // Custom event component for Month view to handle "Spacer" events and custom rendering
  const MonthEvent = ({ event }: any) => {
    if (event.resourceId === 'spacer') {
      return <div style={{ height: '20px' }}></div>; // Invisible spacer
    }
    return (
      <div className="rbc-event-content" title={event.title}>
        {event.title}
      </div>
    );
  };

  // Transform events for Month view to ensure order and spacing
  const getMonthEvents = useCallback(() => {
    if (view !== Views.MONTH) return expandedEvents;

    const monthEvents: CalendarEvent[] = [];
    const eventsByDate: Record<string, CalendarEvent[]> = {};

    // Group events by date
    expandedEvents.forEach(event => {
      const dateKey = format(event.start, 'yyyy-MM-dd');
      if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
      eventsByDate[dateKey].push(event);
    });

    // Process each date
    Object.keys(eventsByDate).forEach(dateKey => {
      const dayEvents = eventsByDate[dateKey];
      
      // Sort internal events by time first
      const sortByTime = (a: CalendarEvent, b: CalendarEvent) => a.start.getTime() - b.start.getTime();

      const mainHall = dayEvents.filter(e => e.originalData.room?.includes('대강의장')).sort(sortByTime);
      const medium1 = dayEvents.filter(e => e.originalData.room?.includes('중강의장1')).sort(sortByTime);
      const medium2 = dayEvents.filter(e => e.originalData.room?.includes('중강의장2')).sort(sortByTime);

      // Create a base date for this day at 00:00:00
      // We use the start date of the first event to get the correct day object, then reset time
      const baseDate = new Date(dayEvents[0].start);
      baseDate.setHours(0, 0, 0, 0);

      // Helper to create a date with specific milliseconds to force sort order
      // React-Big-Calendar sorts by start time. By adding small ms offsets, we force the order:
      // Main (0ms) -> Spacer (0ms) -> Med1 (100ms) -> Med2 (200ms)
      // We also overwrite 'end' to be the same as 'start' to ensure they are treated as point-in-time for sorting
      
      // Add Main Hall events (or spacer)
      if (mainHall.length > 0) {
        mainHall.forEach((e, idx) => {
          const sortDate = new Date(baseDate);
          sortDate.setMilliseconds(idx); // Keep internal time order within Main Hall
          
          monthEvents.push({ 
            ...e, 
            title: `[대] ${format(e.start, 'HH:mm')} ${e.title}`, 
            allDay: true, 
            resourceId: '1_main',
            start: sortDate,
            end: sortDate
          });
        });
      } else if (medium1.length > 0 || medium2.length > 0) {
        // Add spacer only if there are other events on this day
        const sortDate = new Date(baseDate);
        sortDate.setMilliseconds(0);
        
        monthEvents.push({
          id: `spacer-${dateKey}`,
          title: '',
          start: sortDate,
          end: sortDate,
          resourceId: 'spacer',
          allDay: true,
          originalData: { room: 'spacer' } as any
        });
      }

      // Add Medium Hall 1 events (or spacer)
      if (medium1.length > 0) {
        medium1.forEach((e, idx) => {
          const sortDate = new Date(baseDate);
          sortDate.setMilliseconds(100 + idx); // Offset by 100ms to ensure they come after Main/Spacer
          
          monthEvents.push({ 
            ...e, 
            title: `[중1] ${format(e.start, 'HH:mm')} ${e.title}`, 
            allDay: true, 
            resourceId: '2_med1',
            start: sortDate,
            end: sortDate
          });
        });
      } else if (medium2.length > 0) {
        // Add spacer for Medium 1 if Medium 2 exists
        const sortDate = new Date(baseDate);
        sortDate.setMilliseconds(100);
        
        monthEvents.push({
          id: `spacer-med1-${dateKey}`,
          title: '',
          start: sortDate,
          end: sortDate,
          resourceId: 'spacer',
          allDay: true,
          originalData: { room: 'spacer' } as any
        });
      }

      // Add Medium Hall 2 events
      medium2.forEach((e, idx) => {
        const sortDate = new Date(baseDate);
        sortDate.setMilliseconds(200 + idx); // Offset by 200ms to ensure they come after Med1
        
        monthEvents.push({ 
          ...e, 
          title: `[중2] ${format(e.start, 'HH:mm')} ${e.title}`, 
          allDay: true, 
          resourceId: '3_med2',
          start: sortDate,
          end: sortDate
        });
      });
    });

    return monthEvents;
  }, [expandedEvents, view]);

  const eventStyleGetter = (event: CalendarEvent) => {
    if (event.resourceId === 'spacer') {
      return {
        style: {
          backgroundColor: 'transparent',
          color: 'transparent',
          border: 'none',
          height: '20px',
          pointerEvents: 'none',
        }
      };
    }

    // Color code based on room
    let backgroundColor = '#3174ad';
    const room = event.originalData.room || '';
    
    if (room.includes('대강의장')) {
      backgroundColor = '#3b82f6'; // Blue for Main Hall
    } else if (room.includes('중강의장1')) {
      backgroundColor = '#10b981'; // Green for Medium Hall 1
    } else if (room.includes('중강의장2')) {
      backgroundColor = '#f59e0b'; // Amber/Orange for Medium Hall 2
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '13px', // Increased font size
        padding: '2px 6px',
        fontWeight: '500',
        marginBottom: '2px',
      },
    };
  };

  const getTodayLabel = () => {
    switch (view) {
      case Views.MONTH: return '이번달';
      case Views.WEEK: return '이번주';
      case Views.DAY: return '오늘';
      default: return '오늘';
    }
  };

  return (
    <div className="h-[1000px] bg-white p-4 rounded-lg shadow-sm flex flex-col">
      <style>{`
        .rbc-allday-cell {
          display: none !important;
        }
        /* Agenda View Alignment */
        .rbc-agenda-view table.rbc-agenda-table {
          border-collapse: collapse;
          width: 100%;
        }
        .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
          padding: 12px;
          border-bottom: 2px solid #e5e7eb;
          text-align: left;
        }
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
          padding: 12px;
          vertical-align: middle;
          border-bottom: 1px solid #e5e7eb;
        }
        .rbc-agenda-date-cell {
          white-space: nowrap;
          font-weight: 500;
          color: #374151;
        }
        .rbc-agenda-time-cell {
          white-space: nowrap;
          color: #6b7280;
          font-size: 0.9em;
        }
        .rbc-agenda-event-cell {
          color: #111827;
        }
      `}</style>
      <div className="flex items-center justify-end space-x-4 mb-4">
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          <span className="text-sm text-gray-600">대강의장</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span className="text-sm text-gray-600">중강의장1</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span className="text-sm text-gray-600">중강의장2</span>
        </div>
      </div>

      <Calendar
        localizer={localizer}
        events={view === Views.MONTH ? getMonthEvents() : expandedEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%', minWidth: '800px' }} // Ensure minimum width for Day view columns
        onSelectEvent={(e) => e.resourceId !== 'spacer' && handleSelectEvent(e)}
        eventPropGetter={eventStyleGetter}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        view={view}
        date={date}
        onNavigate={onNavigate}
        onView={onView}
        culture="ko"
        popup={true} // Enable popup for overflow events
        min={new Date(0, 0, 0, 6, 0, 0)} // Start at 6:00 AM
        max={new Date(0, 0, 0, 22, 0, 0)} // End at 10:00 PM
        resources={view === Views.DAY ? resources : undefined}
        resourceIdAccessor="id"
        resourceTitleAccessor="title"
        components={{
          month: {
            event: MonthEvent,
          },
        }}
        formats={{
          dayFormat: (date: Date, culture: any, localizer: any) =>
            localizer.format(date, 'MM.DD (ddd)', culture),
        }}
        messages={{
          next: "다음",
          previous: "이전",
          today: getTodayLabel(),
          month: "월",
          week: "주",
          day: "일",
          agenda: "일정",
          date: "날짜",
          time: "시간",
          event: "이벤트",
          noEventsInRange: "이 기간에 예약된 일정이 없습니다.",
        }}
      />

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedEvent.title}
              </h3>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">회의실</p>
                  <p className="font-medium">{selectedEvent.originalData.room}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">건물/층</p>
                  <p className="font-medium">
                    {selectedEvent.originalData.building} {selectedEvent.originalData.floor}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">사용자</p>
                  <p className="font-medium">{selectedEvent.originalData.userName}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">부서</p>
                  <p className="font-medium">{selectedEvent.originalData.department}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 mb-1">시간</p>
                  <p className="font-medium">
                    {format(selectedEvent.originalData.start, 'yyyy-MM-dd HH:mm', { locale: ko })} ~ {format(selectedEvent.originalData.end, 'MM-dd HH:mm', { locale: ko })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 mb-1">상태</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedEvent.originalData.status === '취소' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {selectedEvent.originalData.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
