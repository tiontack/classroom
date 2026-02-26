import * as XLSX from 'xlsx';
import { CalendarEvent } from '../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { ko } from 'date-fns/locale';

function getRoomLabel(room: string): string {
  if (room.includes('대강의장')) return '[대]';
  if (room.includes('중강의장1')) return '[중1]';
  if (room.includes('중강의장2')) return '[중2]';
  return '';
}

// ──────────────────────────────────────────────
// 달력형 엑셀 다운로드
// ──────────────────────────────────────────────
export function downloadCalendarExcel(events: CalendarEvent[], filename = '강의장_예약현황_달력형') {
  const wb = XLSX.utils.book_new();

  // 월별로 이벤트 그룹화
  const eventsByMonth: Record<string, CalendarEvent[]> = {};
  events.forEach(event => {
    const key = format(event.start, 'yyyy-MM');
    if (!eventsByMonth[key]) eventsByMonth[key] = [];
    eventsByMonth[key].push(event);
  });

  const months = Object.keys(eventsByMonth).sort();
  if (months.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['데이터가 없습니다.']]);
    XLSX.utils.book_append_sheet(wb, ws, '달력형');
  } else {
    months.forEach(monthKey => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const ws = buildCalendarSheet(monthDate, eventsByMonth[monthKey]);
      const sheetName = `${year}년 ${String(month).padStart(2, '0')}월`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function buildCalendarSheet(monthDate: Date, events: CalendarEvent[]): XLSX.WorkSheet {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  // 날짜별 이벤트 그룹화 (시간순 정렬)
  const byDate: Record<string, CalendarEvent[]> = {};
  events.forEach(ev => {
    const key = format(ev.start, 'yyyy-MM-dd');
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(ev);
  });
  Object.values(byDate).forEach(arr => arr.sort((a, b) => a.start.getTime() - b.start.getTime()));

  const aoa: any[][] = [];
  const merges: XLSX.Range[] = [];

  // ── 제목 행 ──
  const title = `${year}년 ${month + 1}월 수송스퀘어 5층 강의장 예약 현황`;
  aoa.push([title, '', '', '', '', '', '']);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });

  // 범례 행
  aoa.push(['※ [대]=대강의장   [중1]=중강의장1   [중2]=중강의장2', '', '', '', '', '', '']);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } });

  // ── 요일 헤더 ──
  aoa.push(['일', '월', '화', '수', '목', '금', '토']);

  // ── 주간 캘린더 ──
  const firstDay = startOfMonth(new Date(year, month, 1));
  const lastDay = endOfMonth(new Date(year, month, 1));
  const calStart = startOfWeek(firstDay, { weekStartsOn: 0 });
  const calEnd = endOfWeek(lastDay, { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  for (let w = 0; w < allDays.length; w += 7) {
    const week = allDays.slice(w, w + 7);

    // 날짜 숫자 행
    const dateRow = week.map(day => (day.getMonth() === month ? day.getDate() : ''));
    aoa.push(dateRow);

    // 해당 주의 각 요일별 이벤트 텍스트 수집
    const weekEventLines: string[][] = week.map(day => {
      if (day.getMonth() !== month) return [];
      const key = format(day, 'yyyy-MM-dd');
      return (byDate[key] || []).map(ev => {
        const label = getRoomLabel(ev.originalData.room || '');
        const time = `${format(ev.start, 'HH:mm')}-${format(ev.end, 'HH:mm')}`;
        const dept = ev.originalData.department ? ` [${ev.originalData.department}]` : '';
        return `${label} ${time} ${ev.originalData.title}${dept}`;
      });
    });

    const maxLines = Math.max(...weekEventLines.map(l => l.length), 1);
    for (let i = 0; i < maxLines; i++) {
      aoa.push(weekEventLines.map(lines => lines[i] ?? ''));
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = Array(7).fill({ wch: 26 });

  // 행 높이 설정 (날짜 행은 높게)
  ws['!rows'] = aoa.map((_, i) => (i < 3 ? { hpt: 20 } : { hpt: 16 }));

  return ws;
}

// ──────────────────────────────────────────────
// 리스트형 엑셀 다운로드
// ──────────────────────────────────────────────
export function downloadListExcel(events: CalendarEvent[], filename = '강의장_예약현황_리스트형') {
  const wb = XLSX.utils.book_new();

  const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const headers = ['번호', '날짜', '요일', '강의장', '제목', '부서', '담당자', '시작시간', '종료시간', '이용시간(분)'];

  const dataRows = sortedEvents.map((ev, idx) => {
    const dayOfWeek = DAYS[ev.start.getDay()];
    const durationMin = Math.round((ev.end.getTime() - ev.start.getTime()) / 60000);
    return [
      idx + 1,
      format(ev.start, 'yyyy-MM-dd'),
      dayOfWeek,
      ev.originalData.room,
      ev.originalData.title,
      ev.originalData.department || '',
      ev.originalData.userName || '',
      format(ev.start, 'HH:mm'),
      format(ev.end, 'HH:mm'),
      durationMin,
    ];
  });

  const aoa: any[][] = [
    ['수송스퀘어 5층 강의장 예약 현황', '', '', '', '', '', '', '', '', ''],
    [`총 ${sortedEvents.length}건`, '', '', '', '', '', '', '', '', ''],
    headers,
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];

  ws['!cols'] = [
    { wch: 6 },  // 번호
    { wch: 14 }, // 날짜
    { wch: 6 },  // 요일
    { wch: 14 }, // 강의장
    { wch: 32 }, // 제목
    { wch: 20 }, // 부서
    { wch: 14 }, // 담당자
    { wch: 10 }, // 시작시간
    { wch: 10 }, // 종료시간
    { wch: 12 }, // 이용시간
  ];

  XLSX.utils.book_append_sheet(wb, ws, '리스트형');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
