import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { X, BarChart2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DepartmentStatsProps {
  events: CalendarEvent[];
  onClose: () => void;
}

const CANCELLED_STATUSES = ['취소', '자동종료', '자동취소'];

export const DepartmentStats: React.FC<DepartmentStatsProps> = ({ events, onClose }) => {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
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
      deptStats[dept].hours += (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
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
          <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
            {/* 연간/월별 탭 */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
              <button
                onClick={() => setViewMode('yearly')}
                className={`px-4 py-1.5 transition-colors ${
                  viewMode === 'yearly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                연간
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-1.5 border-l border-gray-300 transition-colors ${
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
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        <div className="p-6 overflow-y-auto flex-1">
          {selectedDept ? (
            /* 부서 상세 */
            <div className="space-y-4">
              {deptEvents.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">일자</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">사용시간</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">강의장</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">내용</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {deptEvents.map((event, idx) => {
                      const hours = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
                      const isAbnormal = hours > 24;
                      const isSameDay = format(event.start, 'yyyy-MM-dd') === format(event.end, 'yyyy-MM-dd');
                      return (
                        <tr key={idx} className={isAbnormal ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {format(event.start, 'yyyy-MM-dd (eee)', { locale: ko })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {format(event.start, 'HH:mm')} ~{' '}
                            {!isSameDay && (
                              <span className="text-amber-600 font-medium">
                                {format(event.end, 'MM-dd ')}{' '}
                              </span>
                            )}
                            {format(event.end, 'HH:mm')}
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
                            {event.title}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500 py-4">예약 내역이 없습니다.</p>
              )}
            </div>
          ) : (
            /* 통계 목록 */
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
