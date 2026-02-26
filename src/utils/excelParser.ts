import * as XLSX from 'xlsx';
import { Reservation, CalendarEvent } from '../types';
import { parse, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';

// Helper to parse date strings like "2026-02-25 오전 9:30:00"
const parseKoreanDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();

  // Try standard ISO first
  let date = new Date(str);
  if (isValid(date)) return date;

  // Try parsing with date-fns using a few common formats with Korean locale
  // The PDF format "2026-02-25 오전 9:30:00" matches 'yyyy-MM-dd a h:mm:ss'
  const formats = [
    'yyyy-MM-dd a h:mm:ss',
    'yyyy-MM-dd a h:mm',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd',
  ];

  for (const fmt of formats) {
    date = parse(str, fmt, new Date(), { locale: ko });
    if (isValid(date)) return date;
  }

  // Try replacing Korean AM/PM for standard Date parsing
  // "2026-02-25 오전 9:30:00" -> "2026-02-25 9:30:00 AM" would be better for Date()
  // But let's try a simple replace first
  let normalizedStr = str
    .replace('오전', 'AM')
    .replace('오후', 'PM');
  
  // If the format is "2026-02-25 AM 9:30:00", Date() might not like it.
  // Let's try to rearrange if it matches that pattern
  // Regex for "YYYY-MM-DD AM/PM H:MM:SS"
  const amPmRegex = /^(\d{4}-\d{2}-\d{2})\s+(AM|PM)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/i;
  const match = normalizedStr.match(amPmRegex);
  if (match) {
    // Convert to "YYYY-MM-DD H:MM:SS AM/PM"
    normalizedStr = `${match[1]} ${match[3]} ${match[2]}`;
  }

  date = new Date(normalizedStr);
  if (isValid(date)) return date;

  return null;
};

export const parseExcelFile = async (file: File): Promise<CalendarEvent[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (jsonData.length < 2) {
          reject(new Error('Excel file is empty or invalid format'));
          return;
        }

        // Extract headers (first row)
        const headers = (jsonData[0] as string[]).map(h => h?.trim());
        
        // Map headers to our keys
        const headerMap: Record<string, number> = {};
        headers.forEach((h, i) => {
          if (h) headerMap[h] = i;
        });

        const events: CalendarEvent[] = [];

        // Process rows (skip header)
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          // Helper to get value by header name
          const getVal = (key: string) => {
            const idx = headerMap[key];
            return idx !== undefined ? row[idx] : undefined;
          };

          // Extract fields based on PDF columns
          const id = getVal('예약 아이디') || getVal('아이디') || `event-${i}`;
          const title = getVal('제목') || 'No Title';
          const room = getVal('회의실') || 'Unknown Room';
          const building = getVal('건물') || '';
          const floor = getVal('층') || '';
          const dept = getVal('부서') || '';
          const user = getVal('사용자명') || '';
          const status = getVal('상태') || '';

          // Date parsing
          // The PDF shows "시작시간" and "종료시간" containing full datetime
          // Or sometimes "시작일" + "시작시간"
          let startRaw = getVal('시작시간');
          let endRaw = getVal('종료시간');
          
          // If startRaw is just time, try to combine with start date
          const startDateRaw = getVal('시작일');
          
          let start: Date | null = null;
          let end: Date | null = null;

          if (startRaw) {
             // Check if it's an Excel serial date number
             if (typeof startRaw === 'number') {
                // Excel date to JS date
                // Subtract 25569 days (1970-1900) and multiply by ms in a day
                // But XLSX library might handle this if we use cellDates: true option in read?
                // Actually, let's try to parse it manually if it's a number
                // Excel base date is 1899-12-30 usually
                const excelEpoch = new Date(1899, 11, 30);
                start = new Date(excelEpoch.getTime() + startRaw * 86400000);
             } else {
                start = parseKoreanDate(String(startRaw));
             }
          }

          if (endRaw) {
             if (typeof endRaw === 'number') {
                const excelEpoch = new Date(1899, 11, 30);
                end = new Date(excelEpoch.getTime() + endRaw * 86400000);
             } else {
                end = parseKoreanDate(String(endRaw));
             }
          }

          // If we have a separate start date and start/end are just times (or failed to parse as full datetime)
          // This logic is complex without seeing the exact raw excel data, 
          // but based on PDF, "시작시간" looks like full datetime string "2026-02-25 ..."
          
          if (!start && startDateRaw) {
             // Try to combine
             const datePart = parseKoreanDate(String(startDateRaw));
             if (datePart) {
                // If startRaw is just time like "09:30:00"
                // ... implementation details for time-only parsing would go here
                // For now, assume the column has full datetime as per PDF visual
             }
          }

          if (start && end) {
            const reservation: Reservation = {
              id: String(id),
              building: String(building),
              floor: String(floor),
              room: String(room),
              roomType: String(getVal('회의실타입') || ''),
              title: String(title),
              department: String(dept),
              userName: String(user),
              phone: String(getVal('전화번호') || ''),
              start,
              end,
              created: new Date(), // Placeholder
              status: String(status),
            };

            events.push({
              id: String(id),
              title: `${title} (${user})`,
              start,
              end,
              resourceId: room,
              originalData: reservation,
            });
          }
        }

        resolve(events);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
