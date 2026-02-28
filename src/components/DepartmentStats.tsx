import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { X, BarChart2, ArrowLeft, Pencil, AlertCircle, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { updateAdminRecord } from '../lib/supabase';

const ROOMS = ['대강의장', '중강의장1', '중강의장2'];

interface DepartmentStatsProps {
  events: CalendarEvent[];
  onClose: () => void;
  onDataChange?: () => void;
}

const CANCELLED_STATUSES = ['취소', '자동종료', '자동취소'];

// 일별 최대 8시간 캡 적용한 사용시간 계산
function calcCappedHours(start: Date, end: Date): number {
  const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (totalHours <= 0) return 0;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const numDays = Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1;
  return Math.min(totalHours, numDays * 8);
}

export const DepartmentStats: React.FC<DepartmentStatsProps> = ({ events, onClose, onDataChange }) => {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // ── Edit state ──
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editForm, setEditForm] = useState({
    room: '대강의장', title: '', department: '', user_name: '',
    start_date: '', start_time: '', end_date: '', end_time: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (event: CalendarEvent) => {
    const s = event.originalData.start;
    const e = event.originalData.end;
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditForm({
      room: event.originalData.room || '대강의장',
      title: event.originalData.title || '',
      department: event.originalData.department || '',
      user_name: event.originalData.userName || '',
      start_date: `${s.getFullYear()}-${pad(s.getMonth()+1)}-${pad(s.getDate())}`,
      start_time: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      end_date: `${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}`,
      end_time: `${pad(e.getHours())}:${pad(e.getMinutes())}`,
    });
    setEditingEvent(event);
    setEditError(null);
  };

  const handleEditSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editingEvent) return;
    const recordId = editingEvent.id.replace(/^admin-/, '').replace(/-day\d+$/, '');
    setEditSaving(true);
    setEditError(null);
    try {
      await updateAdminRecord(recordId, {
        room: editForm.room,
        title: editForm.title,
        department: editForm.department,
        user_name: editForm.user_name,
        start_time: `${editForm.start_date}T${editForm.start_time}:00`,
        end_time: `${editForm.end_date}T${editForm.end_time}:00`,
        status: editingEvent.originalData.status || '사용완료',
      });
      setEditingEvent(null);
      onDataChange?.();
    } catch {
      setEditError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setEditSaving(false);
    }
  };
  const [viewMode, setViewMode] = useState<'yearly' | 'monthly'>('yearly');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // 취소 건 제외
  const activeEvents = useMemo(
    () => events.filter(e => !CANCELLED_STATUSES.includes(e.originalData.status || '')),
    [events]
  );

  // 연도 목록 (데이터에 있는 연도들)
  const availableYears = useMemo(() => {
    const years = new Set(activeEvents.map(e => e.start.getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [activeEvents]);

  // 선택된 기간으로 필터링
  const filteredEvents = useMemo(() => {
    return activeEvents.filter(e => {
      const year = e.start.getFullYear();
      const month = e.start.getMonth() + 1;
      if (viewMode === 'yearly') return year === selectedYear;
      return year === selectedYear && month === selectedMonth;
    });
  }, [activeEvents, viewMode, selectedYear, selectedMonth]);

  // 통계 계산
  const stats = useMemo(() => {
    const deptStats: Record<string, { count: number; hours: number }> = {};
    filteredEvents.forEach(event => {
      const dept = event.originalData.department || '미지정';
      if (!deptStats[dept]) deptStats[dept] = { count: 0, hours: 0 };
      deptStats[dept].count += 1;
      deptStats[dept].hours += calcCappedHours(event.start, event.end);
    });
    return Object.entries(deptStats).sort((a, b) => b[1].count - a[1].count);
  }, [filteredEvents]);

  // 선택 부서 상세 이벤트
  const deptEvents = useMemo(() => {
    if (!selectedDept) return [];
    return filteredEvents
      .filter(e => (e.originalData.department || '미지정') === selectedDept)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [filteredEvents, selectedDept]);

  const totalHours = stats.reduce((sum, [, d]) => sum + d.hours, 0);
  const totalCount = stats.reduce((sum, [, d]) => sum + d.count, 0);

  // ── 수정 모달 ──
  if (editingEvent) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
          <div className="flex justify-between items-center px-6 py-4 border-b">
            <h2 className="text-base font-bold text-gray-900">예약 이력 수정</h2>
            <button onClick={() => setEditingEvent(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleEditSave} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">강의장 *</label>
                <select value={editForm.room} onChange={e => setEditForm(p => ({ ...p, room: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">시작 날짜 *</label>
                <input type="date" value={editForm.start_date} onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">시작 시간 *</label>
                <input type="time" value={editForm.start_time} onChange={e => setEditForm(p => ({ ...p, start_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">종료 날짜 *</label>
                <input type="date" value={editForm.end_date} onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">종료 시간 *</label>
                <input type="time" value={editForm.end_time} onChange={e => setEditForm(p => ({ ...p, end_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">제목 *</label>
                <input type="text" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
                <input type="text" value={editForm.department} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">담당자</label>
                <input type="text" value={editForm.user_name} onChange={e => setEditForm(p => ({ ...p, user_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {editError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {editError}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditingEvent(null)}
                className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button type="submit" disabled={editSaving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {editSaving ? <><Loader className="w-4 h-4 animate-spin" /> 저장 중...</> : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            {selectedDept ? (
              <>
                <button
                  onClick={() => setSelectedDept(null)}
                  className="mr-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {selectedDept} 예약 내역
              </>
            ) : (
              <>
                <BarChart2 className="w-5 h-5 mr-2" />
                부서별 예약 통계
              </>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 필터 바 (상세 보기가 아닐 때만 표시) */}
        {!selectedDept && (
          <div className="px-3 sm:px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-2 sm:gap-3">
            {/* 연간/월별 탭 */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs sm:text-sm font-medium">
              <button
                onClick={() => setViewMode('yearly')}
                className={`px-3 sm:px-4 py-1.5 transition-colors ${
                  viewMode === 'yearly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                연간
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 sm:px-4 py-1.5 border-l border-gray-300 transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                월별
              </button>
            </div>

            {/* 연도 선택 */}
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableYears.length > 0 ? (
                availableYears.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))
              ) : (
                <option value={currentYear}>{currentYear}년</option>
              )}
            </select>

            {/* 월 선택 (월별 모드일 때만) */}
            {viewMode === 'monthly' && (
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            )}

            {/* 요약 */}
            <span className="ml-auto text-xs text-gray-500">
              총 {totalCount}건 · {totalHours.toFixed(1)}시간
            </span>
          </div>
        )}

        <div className="px-2 sm:px-6 py-4 overflow-y-auto flex-1">
          {selectedDept ? (
            /* 부서 상세 */
            <div className="space-y-4">
              {deptEvents.length > 0 ? (
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">일자</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">사용시간</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">강의장</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">내용</th>
                      <th className="px-4 py-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {deptEvents.map((event, idx) => {
                      const rawHours = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
                      const hours = calcCappedHours(event.start, event.end);
                      const isAbnormal = rawHours > 24;
                      const isSameDay = format(event.start, 'yyyy-MM-dd') === format(event.end, 'yyyy-MM-dd');
                      const isAdmin = event.id.startsWith('admin-');
                      return (
                        <tr key={idx} className={isAbnormal ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {format(event.originalData.start, 'yyyy-MM-dd (eee)', { locale: ko })}
                            {!isSameDay && (
                              <span className="text-gray-400"> ~ {format(event.originalData.end, 'MM-dd')}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {format(event.originalData.start, 'HH:mm')} ~ {format(event.originalData.end, 'HH:mm')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                            <span className={isAbnormal ? 'text-amber-600 font-semibold' : 'text-gray-500'}>
                              {hours.toFixed(1)}h
                              {isAbnormal && ' ⚠'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {event.originalData.room}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {event.originalData.title}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {isAdmin && (
                              <button onClick={() => openEdit(event)}
                                className="text-gray-300 hover:text-blue-500 transition-colors" title="수정">
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">예약 내역이 없습니다.</p>
              )}
            </div>
          ) : (
            /* 통계 목록 */
            <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">부서명</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">예약 건수</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">총 사용 시간</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.length > 0 ? (
                  stats.map(([dept, data]) => (
                    <tr
                      key={dept}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedDept(dept)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">{dept}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{data.count}건</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{data.hours.toFixed(1)}시간</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      해당 기간에 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
