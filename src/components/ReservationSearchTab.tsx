import React, { useState, useMemo } from 'react';
import { Search, RotateCcw, Download } from 'lucide-react';
import { AdminRecord } from '../lib/supabase';
import { downloadAdminRecordsExcel } from '../utils/excelExport';

const ROOMS = ['대강의장', '중강의장1', '중강의장2'];

const ROOM_BADGE: Record<string, string> = {
  '대강의장':  'bg-blue-100 text-blue-700',
  '중강의장1': 'bg-emerald-100 text-emerald-700',
  '중강의장2': 'bg-amber-100 text-amber-700',
};

const CANCELLED_SET = new Set(['취소', '자동종료', '자동취소']);

interface ReservationSearchTabProps { records: AdminRecord[]; }

export const ReservationSearchTab: React.FC<ReservationSearchTabProps> = ({ records }) => {
  const [filterRoom,  setFilterRoom]  = useState('전체');
  const [filterTitle, setFilterTitle] = useState('');
  const [filterDept,  setFilterDept]  = useState('');
  const [filterUser,  setFilterUser]  = useState('');
  const [filterFrom,  setFilterFrom]  = useState('');
  const [filterTo,    setFilterTo]    = useState('');

  const results = useMemo(() => {
    const q = (s: string) => s.toLowerCase();
    return records
      .filter(r => !CANCELLED_SET.has(r.status))
      .filter(r => filterRoom === '전체' || r.room === filterRoom)
      .filter(r => !filterTitle || r.title.toLowerCase().includes(q(filterTitle)))
      .filter(r => !filterDept  || (r.department || '').toLowerCase().includes(q(filterDept)))
      .filter(r => !filterUser  || (r.user_name  || '').toLowerCase().includes(q(filterUser)))
      .filter(r => !filterFrom  || r.start_time.slice(0, 10) >= filterFrom)
      .filter(r => !filterTo    || r.start_time.slice(0, 10) <= filterTo)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [records, filterRoom, filterTitle, filterDept, filterUser, filterFrom, filterTo]);

  const handleReset = () => {
    setFilterRoom('전체'); setFilterTitle(''); setFilterDept('');
    setFilterUser(''); setFilterFrom(''); setFilterTo('');
  };

  const handleDownload = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    downloadAdminRecordsExcel(
      results,
      `예약현황조회_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    );
  };

  const fmtDT = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="space-y-4">
      {/* 조회 조건 */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-600" /> 조회 조건
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* 강의장 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">강의장</label>
            <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="전체">전체</option>
              {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {/* 제목 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">제목</label>
            <input type="text" value={filterTitle} onChange={e => setFilterTitle(e.target.value)}
              placeholder="제목 검색"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* 팀/부서 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">팀/부서</label>
            <input type="text" value={filterDept} onChange={e => setFilterDept(e.target.value)}
              placeholder="팀/부서 검색"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* 예약자 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">예약자</label>
            <input type="text" value={filterUser} onChange={e => setFilterUser(e.target.value)}
              placeholder="예약자 검색"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* 시작일 From */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작일 (이후)</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* 시작일 To */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작일 (이전)</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> 초기화
          </button>
        </div>
      </div>

      {/* 조회 결과 */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">
            조회 결과 <span className="text-blue-600 font-bold">{results.length}건</span>
          </span>
          <button onClick={handleDownload} disabled={results.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Download className="w-4 h-4" /> 엑셀 다운로드
          </button>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">조회된 예약 건이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm border-collapse min-w-[600px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 text-xs text-gray-600">
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-semibold whitespace-nowrap">강의장</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-semibold">제목</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-semibold whitespace-nowrap">팀/부서</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-semibold whitespace-nowrap">예약자</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-semibold whitespace-nowrap">시작일시</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-semibold whitespace-nowrap">종료일시</th>
                </tr>
              </thead>
              <tbody>
                {results.map((rec, idx) => (
                  <tr key={rec.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="px-3 py-2 border-b border-gray-100">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ROOM_BADGE[rec.room] ?? 'bg-gray-100 text-gray-700'}`}>
                        {rec.room}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100 font-medium text-gray-900 max-w-[220px]">
                      <span className="block truncate">{rec.title}</span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-600 whitespace-nowrap">{rec.department || '-'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-600 whitespace-nowrap">{rec.user_name || '-'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">{fmtDT(rec.start_time)}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">{fmtDT(rec.end_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
