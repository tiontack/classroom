import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle, Loader, Upload, Lock, Pencil, Search, BarChart2 } from 'lucide-react';
import { AdminRecord, fetchAdminRecords, insertAdminRecord, insertAdminRecords, deleteAdminRecord, updateAdminRecord } from '../lib/supabase';
import { parseExcelFile } from '../utils/excelParser';
import { CalendarEvent } from '../types';

interface AdminPageProps {
  onClose: () => void;
  onDataChange: () => void;
}

const ROOMS = ['대강의장', '중강의장1', '중강의장2'];
const ADMIN_PASSWORD = '1234';

const BLANK_FORM = {
  room: '대강의장',
  title: '',
  department: '',
  user_name: '',
  start_date: new Date().toISOString().slice(0, 10),
  start_time: '09:00',
  end_date: new Date().toISOString().slice(0, 10),
  end_time: '18:00',
  status: '사용완료',
};

function filterAndNormalize(events: CalendarEvent[]): CalendarEvent[] {
  const TARGET_ROOMS = ['대강의장', '중강의장1', '중강의장2'];
  return events
    .filter(event => {
      const floor = event.originalData.floor || '';
      const room = event.originalData.room || '';
      return (
        floor.includes('5') &&
        TARGET_ROOMS.some(t => room.includes(t)) &&
        event.originalData.status !== '취소' &&
        event.originalData.status !== '자동종료' &&
        event.originalData.status !== '자동취소'
      );
    })
    .map(event => {
      const room = event.originalData.room || '';
      let normalizedId = room;
      if (room.includes('대강의장')) normalizedId = '대강의장';
      else if (room.includes('중강의장1')) normalizedId = '중강의장1';
      else if (room.includes('중강의장2')) normalizedId = '중강의장2';
      return { ...event, resourceId: normalizedId };
    });
}

// ── 공통 폼 필드 ────────────────────────────────────────────────
type FormState = typeof BLANK_FORM;

interface RecordFormProps {
  form: FormState;
  onChange: (next: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  title: string;
  submitLabel: string;
  submitColor?: string;
}

const RecordFormModal: React.FC<RecordFormProps> = ({
  form, onChange, onSubmit, onCancel, saving, error, title, submitLabel, submitColor = 'bg-blue-600 hover:bg-blue-700',
}) => {
  const f = (field: keyof FormState) => (
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...form, [field]: e.target.value })
  );

  return (
    <div className="fixed inset-0 z-[60] bg-gray-500 bg-opacity-75 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* 강의장 */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">강의장 *</label>
              <select value={form.room} onChange={f('room')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* 시작일 + 시작 시간 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시작일 *</label>
              <input type="date" value={form.start_date} onChange={f('start_date')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시작 시간 *</label>
              <input type="time" value={form.start_time} onChange={f('start_time')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* 종료일 + 종료 시간 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">종료일 *</label>
              <input type="date" value={form.end_date} onChange={f('end_date')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">종료 시간 *</label>
              <input type="time" value={form.end_time} onChange={f('end_time')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* 제목 */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">제목 *</label>
              <input type="text" value={form.title} onChange={f('title')} placeholder="예: 신입사원 교육"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
              <input type="text" value={form.department} onChange={f('department')} placeholder="예: HR팀"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">담당자</label>
              <input type="text" value={form.user_name} onChange={f('user_name')} placeholder="예: 홍길동"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${submitColor}`}>
              {saving ? <><Loader className="w-4 h-4 animate-spin" /> 저장 중...</> : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── 삭제 확인 인라인 컴포넌트 ──────────────────────────────────
interface DeleteConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}
const DeleteConfirm: React.FC<DeleteConfirmProps> = ({ onConfirm, onCancel }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-red-600 font-medium">삭제할까요?</span>
    <button onClick={onConfirm}
      className="px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600">예</button>
    <button onClick={onCancel}
      className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">아니오</button>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 가동률 계산 헬퍼
// ═══════════════════════════════════════════════════════════════
const BUSINESS_START = 9;   // 09:00
const BUSINESS_END   = 18;  // 18:00
const CANCELLED_STATUS = ['취소', '자동종료', '자동취소'];

/** 주어진 기간의 평일(월~금) 목록 반환 */
function getWeekdays(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** 일 기준 가동률: 예약이 하나라도 있는 평일 / 전체 평일 */
function calcDayUtil(records: AdminRecord[], weekdays: Date[], room: string): number {
  if (!weekdays.length) return 0;
  // 빠른 룩업을 위해 키 생성: "YYYY-M-D"
  const weekdayKeys = new Set(
    weekdays.map(d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  );
  const bookedDays = new Set<string>();

  for (const rec of records) {
    if (room !== '전체' && rec.room !== room) continue;
    const s = new Date(rec.start_time);
    const e = new Date(rec.end_time);
    const cur = new Date(s);
    cur.setHours(0, 0, 0, 0);
    const endDay = new Date(e);
    endDay.setHours(0, 0, 0, 0);
    while (cur <= endDay) {
      const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      if (weekdayKeys.has(key)) bookedDays.add(key);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return (bookedDays.size / weekdays.length) * 100;
}

/** 시간 기준 가동률: 업무시간(09~18) 중 예약이 덮은 분 / 전체 업무 분 */
function calcHourUtil(records: AdminRecord[], weekdays: Date[], room: string): number {
  if (!weekdays.length) return 0;
  const totalMin = weekdays.length * (BUSINESS_END - BUSINESS_START) * 60;
  let bookedMin = 0;

  for (const day of weekdays) {
    const winS = new Date(day); winS.setHours(BUSINESS_START, 0, 0, 0);
    const winE = new Date(day); winE.setHours(BUSINESS_END,   0, 0, 0);

    // 당일 업무시간과 겹치는 예약 구간 수집
    const segs: [number, number][] = [];
    for (const rec of records) {
      if (room !== '전체' && rec.room !== room) continue;
      const s = Math.max(new Date(rec.start_time).getTime(), winS.getTime());
      const e = Math.min(new Date(rec.end_time).getTime(),   winE.getTime());
      if (s < e) segs.push([s, e]);
    }

    // 겹치는 구간 병합 후 합산
    segs.sort((a, b) => a[0] - b[0]);
    let cur: [number, number] | null = null;
    for (const [s, e] of segs) {
      if (!cur) { cur = [s, e]; continue; }
      if (s <= cur[1]) cur[1] = Math.max(cur[1], e);
      else { bookedMin += (cur[1] - cur[0]) / 60000; cur = [s, e]; }
    }
    if (cur) bookedMin += (cur[1] - cur[0]) / 60000;
  }

  return (bookedMin / totalMin) * 100;
}

// ── 가동률 카드 ─────────────────────────────────────────────────
interface UtilCardProps {
  label: string;
  badgeClass: string;
  dayPct: number;
  hourPct: number;
  isAvg?: boolean;
}

const UtilCard: React.FC<UtilCardProps> = ({ label, badgeClass, dayPct, hourPct, isAvg }) => {
  const pctColor = (p: number) =>
    p >= 70 ? 'text-emerald-600' : p >= 40 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className={`flex-1 min-w-[140px] sm:min-w-[150px] border rounded-xl p-3 sm:p-4 space-y-3 ${isAvg ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'}`}>
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${badgeClass}`}>{label}</span>

      {/* 일 기준 */}
      <div className="space-y-1">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-500">일 기준</span>
          <span className={`text-xl font-bold tabular-nums ${pctColor(dayPct)}`}>{dayPct.toFixed(1)}<span className="text-sm font-medium">%</span></span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(dayPct, 100)}%` }} />
        </div>
        <p className="text-[10px] text-gray-400">예약있는 평일 비율</p>
      </div>

      {/* 시간 기준 */}
      <div className="space-y-1">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-500">시간 기준</span>
          <span className={`text-xl font-bold tabular-nums ${pctColor(hourPct)}`}>{hourPct.toFixed(1)}<span className="text-sm font-medium">%</span></span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(hourPct, 100)}%` }} />
        </div>
        <p className="text-[10px] text-gray-400">업무시간(09~18시) 점유율</p>
      </div>
    </div>
  );
};

// ── 가동률 섹션 ─────────────────────────────────────────────────
interface UtilizationSectionProps { records: AdminRecord[]; }

const ROOM_BADGE_UTIL: Record<string, string> = {
  '대강의장':  'bg-blue-100 text-blue-700',
  '중강의장1': 'bg-emerald-100 text-emerald-700',
  '중강의장2': 'bg-amber-100 text-amber-700',
};

const UtilizationSection: React.FC<UtilizationSectionProps> = ({ records }) => {
  const now = new Date();
  const [period,   setPeriod]   = useState<'year' | 'month'>('year');
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selRoom,  setSelRoom]  = useState('전체');

  // 데이터에 포함된 연도 목록
  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    for (const r of records) set.add(new Date(r.start_time).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [records]);  // eslint-disable-line

  // 분석 기간 범위
  const { from, to } = useMemo(() => {
    if (period === 'year') {
      return { from: new Date(selYear, 0, 1), to: new Date(selYear, 11, 31) };
    }
    return { from: new Date(selYear, selMonth - 1, 1), to: new Date(selYear, selMonth, 0) };
  }, [period, selYear, selMonth]);

  const weekdays = useMemo(() => getWeekdays(from, to), [from, to]);

  // 취소 제외 레코드
  const validRecords = useMemo(
    () => records.filter(r => !CANCELLED_STATUS.includes(r.status)),
    [records]
  );

  const roomsToShow = selRoom === '전체' ? ROOMS : [selRoom];

  const stats = useMemo(
    () => roomsToShow.map(room => ({
      room,
      day:  calcDayUtil(validRecords,  weekdays, room),
      hour: calcHourUtil(validRecords, weekdays, room),
    })),
    [validRecords, weekdays, selRoom]  // eslint-disable-line
  );

  const avgDay  = stats.reduce((s, r) => s + r.day,  0) / (stats.length || 1);
  const avgHour = stats.reduce((s, r) => s + r.hour, 0) / (stats.length || 1);

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      {/* 헤더 + 필터 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-600" /> 강의장 가동률
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 연간 / 월별 토글 */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden text-xs">
            {(['year', 'month'] as const).map((p, i) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 font-medium transition-colors ${i > 0 ? 'border-l border-gray-300' : ''} ${period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {p === 'year' ? '연간' : '월별'}
              </button>
            ))}
          </div>

          {/* 연도 선택 */}
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>

          {/* 월 선택 */}
          {period === 'month' && (
            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          )}

          {/* 강의장 선택 */}
          <select value={selRoom} onChange={e => setSelRoom(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
            <option value="전체">전체</option>
            {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* 기간 요약 */}
      <p className="text-xs text-gray-400">
        {period === 'year' ? `${selYear}년` : `${selYear}년 ${selMonth}월`} 기준
        {' · '}평일 <span className="font-medium text-gray-600">{weekdays.length}일</span>
        {' · '}총 업무시간 <span className="font-medium text-gray-600">{weekdays.length * (BUSINESS_END - BUSINESS_START)}시간</span>
      </p>

      {/* 가동률 카드 */}
      {weekdays.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">해당 기간에 평일이 없습니다.</p>
      ) : (
        <div className="flex gap-3 flex-wrap">
          {stats.map(s => (
            <UtilCard key={s.room} label={s.room}
              badgeClass={ROOM_BADGE_UTIL[s.room] ?? 'bg-gray-100 text-gray-700'}
              dayPct={s.day} hourPct={s.hour} />
          ))}
          {selRoom === '전체' && (
            <UtilCard label="전체 평균" badgeClass="bg-gray-100 text-gray-700"
              dayPct={avgDay} hourPct={avgHour} isAvg />
          )}
        </div>
      )}

      {/* 범례 */}
      <div className="flex flex-wrap gap-2 sm:gap-4 text-[11px] text-gray-400 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5 rounded-full bg-blue-500" />
          일 기준: 예약있는 평일 ÷ 전체 평일
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5 rounded-full bg-violet-500" />
          시간 기준: 예약된 업무시간(09~18시) ÷ 전체 업무시간
        </span>
      </div>
    </div>
  );
};

// ── 메인 컴포넌트 ───────────────────────────────────────────────
export const AdminPage: React.FC<AdminPageProps> = ({ onClose, onDataChange }) => {
  // --- Password gate ---
  const [authenticated, setAuthenticated] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === ADMIN_PASSWORD) { setAuthenticated(true); setPwError(false); }
    else { setPwError(true); setPwInput(''); }
  };

  // --- Records ---
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // --- Add modal ---
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormState>({ ...BLANK_FORM });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // --- Edit modal ---
  const [editingRecord, setEditingRecord] = useState<AdminRecord | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ ...BLANK_FORM });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // --- Delete inline confirm ---
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- Search ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- Excel upload ---
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await fetchAdminRecords();
      setRecords(data);
    } catch {
      setListError('데이터를 불러오는데 실패했습니다. Supabase 설정을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authenticated) loadRecords(); }, [authenticated, loadRecords]);

  // ── 추가 ────────────────────────────────────────────────────
  const openAdd = () => {
    const today = new Date().toISOString().slice(0, 10);
    setAddForm({ ...BLANK_FORM, start_date: today, end_date: today });
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleAddSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title.trim()) { setAddError('제목을 입력해주세요.'); return; }
    setAddSaving(true);
    setAddError(null);
    try {
      await insertAdminRecord({
        room: addForm.room,
        title: addForm.title,
        department: addForm.department,
        user_name: addForm.user_name,
        // 로컬 시간 → UTC ISO 변환 (Supabase timestamptz 대응)
        start_time: new Date(`${addForm.start_date}T${addForm.start_time}:00`).toISOString(),
        end_time: new Date(`${addForm.end_date}T${addForm.end_time}:00`).toISOString(),
        status: addForm.status,
      });
      setIsAddOpen(false);
      setAddSuccess('추가되었습니다.');
      setTimeout(() => setAddSuccess(null), 3000);
      await loadRecords();
      onDataChange();
    } catch {
      setAddError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setAddSaving(false);
    }
  };

  // ── 수정 ────────────────────────────────────────────────────
  const openEdit = (rec: AdminRecord) => {
    // new Date() 로컬 시간 메서드 사용 → UTC 저장값을 KST로 정확히 변환
    const start = new Date(rec.start_time);
    const end = new Date(rec.end_time);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditForm({
      room: rec.room,
      title: rec.title,
      department: rec.department || '',
      user_name: rec.user_name || '',
      start_date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      end_date: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
      end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      status: rec.status,
    });
    setEditingRecord(rec);
    setEditError(null);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord?.id) return;
    if (!editForm.title.trim()) { setEditError('제목을 입력해주세요.'); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      await updateAdminRecord(editingRecord.id, {
        room: editForm.room,
        title: editForm.title,
        department: editForm.department,
        user_name: editForm.user_name,
        // 로컬 시간 → UTC ISO 변환 (Supabase timestamptz 대응)
        start_time: new Date(`${editForm.start_date}T${editForm.start_time}:00`).toISOString(),
        end_time: new Date(`${editForm.end_date}T${editForm.end_time}:00`).toISOString(),
        status: editForm.status,
        upload_batch: editingRecord.upload_batch,
      });
      setEditingRecord(null);
      await loadRecords();
      onDataChange();
    } catch {
      setEditError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── 삭제 ────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await deleteAdminRecord(id);
      setDeletingId(null);
      await loadRecords();
      onDataChange();
    } catch {
      setListError('삭제에 실패했습니다.');
    }
  };

  // ── Excel 업로드 ─────────────────────────────────────────────
  const handleExcelUpload = async (file: File) => {
    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const parsed = await parseExcelFile(file);
      const filtered = filterAndNormalize(parsed);
      if (filtered.length === 0 && parsed.length > 0) {
        setUploadError('5층 강의장(대강의장, 중강의장1, 중강의장2) 데이터를 찾을 수 없습니다.');
        return;
      }
      if (filtered.length === 0) { setUploadError('파일에서 유효한 데이터를 찾을 수 없습니다.'); return; }

      await insertAdminRecords(filtered.map(e => ({
        room: e.resourceId || e.originalData.room,
        title: e.originalData.title,
        department: e.originalData.department || '',
        user_name: e.originalData.userName || '',
        start_time: e.start.toISOString(),
        end_time: e.end.toISOString(),
        status: e.originalData.status || '사용완료',
      })));
      setUploadSuccess(`${filtered.length}건이 등록되었습니다.`);
      setTimeout(() => setUploadSuccess(null), 4000);
      await loadRecords();
      onDataChange();
    } catch {
      setUploadError('업로드에 실패했습니다. 파일 형식을 확인해주세요.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleExcelUpload(file);
  };

  const formatDateTimeKo = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}월${pad(d.getDate())}일 ${pad(d.getHours())}시${pad(d.getMinutes())}분`;
  };

  // ── 비밀번호 화면 ──────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
          <div className="flex justify-between items-center px-6 py-4 border-b">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-500" /> 관리자 인증
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password" autoFocus value={pwInput}
                onChange={e => { setPwInput(e.target.value); setPwError(false); }}
                placeholder="비밀번호 입력"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${pwError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {pwError && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> 비밀번호가 올바르지 않습니다.
                </p>
              )}
            </div>
            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              확인
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── 필터링 ────────────────────────────────────────────────────
  const CANCELLED = ['취소', '자동종료', '자동취소'];
  const visibleRecords = records.filter(r => !CANCELLED.includes(r.status));
  const q = searchQuery.trim().toLowerCase();
  const filteredRecords = q
    ? visibleRecords.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.user_name || '').toLowerCase().includes(q) ||
        r.room.toLowerCase().includes(q)
      )
    : visibleRecords;

  // 관리자 페이지에서 등록한 고정 데이터(upload_batch 없는 건)의 마지막 예약 종료일
  const lastRecordDate = (() => {
    const timestamps = visibleRecords
      .filter(r => !r.upload_batch)   // 메인 페이지 파일 업로드 건 제외
      .map(r => new Date(r.end_time).getTime())
      .filter(t => !isNaN(t));
    if (!timestamps.length) return null;
    const last = new Date(Math.max(...timestamps));
    return `${last.getFullYear()}년 ${last.getMonth() + 1}월 ${last.getDate()}일`;
  })();

  return (
    <>
      {/* ── 추가 모달 ── */}
      {isAddOpen && (
        <RecordFormModal
          title="과정 추가"
          form={addForm}
          onChange={setAddForm}
          onSubmit={handleAddSave}
          onCancel={() => setIsAddOpen(false)}
          saving={addSaving}
          error={addError}
          submitLabel="추가"
          submitColor="bg-emerald-600 hover:bg-emerald-700"
        />
      )}

      {/* ── 수정 모달 ── */}
      {editingRecord && (
        <RecordFormModal
          title="과정 수정"
          form={editForm}
          onChange={setEditForm}
          onSubmit={handleEditSave}
          onCancel={() => setEditingRecord(null)}
          saving={editSaving}
          error={editError}
          submitLabel="저장"
          submitColor="bg-blue-600 hover:bg-blue-700"
        />
      )}

      {/* ── 관리 페이지 본문 ── */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75">
        <div className="flex items-start justify-center min-h-screen p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-4 sm:my-8">
            {/* Header */}
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">관리 페이지</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">

              {/* ── 가동률 ── */}
              <UtilizationSection records={records} />

              {/* ── Excel 일괄 업로드 ── */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> 엑셀 일괄 업로드
                  </h3>
                  {lastRecordDate && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {lastRecordDate} 예약 건까지 반영 완료
                    </span>
                  )}
                </div>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                  onDrop={handleFileDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => document.getElementById('adminFileInput')?.click()}
                >
                  <input id="adminFileInput" type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleExcelUpload(e.target.files[0]); e.target.value = ''; }}
                  />
                  {uploadLoading ? (
                    <div className="flex justify-center items-center gap-2 text-blue-600">
                      <Loader className="w-5 h-5 animate-spin" /><span className="text-sm">처리 중...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">클릭하거나 파일을 드래그하세요</p>
                      <p className="text-xs text-gray-400 mt-1">Excel 파일 (.xlsx, .xls)</p>
                    </>
                  )}
                </div>
                {uploadError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {uploadError}
                  </div>
                )}
                {uploadSuccess && (
                  <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" /> {uploadSuccess}
                  </div>
                )}
              </div>

              {/* ── 등록된 이력 ── */}
              <div className="border border-gray-200 rounded-lg p-4">
                {/* 헤더 행: 제목 + 검색 + 추가 버튼 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                  <h3 className="font-semibold text-gray-700 flex-shrink-0">
                    등록된 이력{' '}
                    <span className="text-gray-500 font-normal text-sm">
                      ({q ? `${filteredRecords.length} / ${visibleRecords.length}` : `${visibleRecords.length}`}건)
                    </span>
                  </h3>

                  {/* 검색 */}
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="제목, 강의장, 부서, 담당자 검색..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 추가 버튼 */}
                  <button
                    onClick={openAdd}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> 추가
                  </button>
                </div>

                {/* 추가 성공 알림 */}
                {addSuccess && (
                  <div className="mb-3 flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" /> {addSuccess}
                  </div>
                )}

                {/* 오류 알림 */}
                {listError && (
                  <div className="mb-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {listError}
                  </div>
                )}

                {/* 목록 */}
                {loading ? (
                  <div className="flex justify-center py-10 text-gray-400">
                    <Loader className="w-6 h-6 animate-spin" />
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    {q ? '검색 결과가 없습니다.' : (
                      <span>
                        등록된 이력이 없습니다.{' '}
                        <button onClick={openAdd} className="text-emerald-600 hover:underline font-medium">
                          + 과정을 추가해보세요
                        </button>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[45vh] sm:max-h-80 overflow-y-auto pr-1">
                    {filteredRecords.map(rec => (
                      <div key={rec.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg text-sm hover:border-gray-300 transition-colors">
                        {/* 정보 */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                            rec.room === '대강의장'  ? 'bg-blue-100 text-blue-700' :
                            rec.room === '중강의장1' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{rec.room}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm">{rec.title}</p>
                            <p className="text-gray-500 text-xs truncate">
                              {formatDateTimeKo(rec.start_time)} ~ {formatDateTimeKo(rec.end_time)}
                            </p>
                            {(rec.department || rec.user_name) && (
                              <p className="text-gray-400 text-xs truncate">
                                {[rec.department, rec.user_name].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex-shrink-0 ml-2 flex items-center gap-1">
                          {deletingId === rec.id ? (
                            <DeleteConfirm
                              onConfirm={() => handleDelete(rec.id!)}
                              onCancel={() => setDeletingId(null)}
                            />
                          ) : (
                            <>
                              <button
                                onClick={() => openEdit(rec)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="수정"
                              >
                                <Pencil className="w-3.5 h-3.5" /> 수정
                              </button>
                              <button
                                onClick={() => setDeletingId(rec.id!)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> 삭제
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
};
