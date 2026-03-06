/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { CalendarView } from './components/CalendarView';
import { AdminPage } from './components/AdminPage';
import { parseExcelFile } from './utils/excelParser';
import { getSampleEvents } from './utils/sampleData';
import { CalendarEvent, Reservation } from './types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, FileText, AlertCircle, Settings, Upload as UploadIcon, X, BarChart2, Download, MessageSquare, TableProperties } from 'lucide-react';
import { downloadCalendarExcel, downloadListExcel } from './utils/excelExport';
import { DepartmentStats } from './components/DepartmentStats';
import { BulletinBoard } from './components/BulletinBoard';
import { ReservationSearchTab } from './components/ReservationSearchTab';
import { fetchAdminRecords, insertAdminRecords, fetchUploadBatches, deleteUploadBatch, AdminRecord, UploadBatch } from './lib/supabase';

function adminRecordToCalendarEvent(rec: AdminRecord): CalendarEvent {
  const reservation: Reservation = {
    id: rec.id || '',
    building: '수송타워',
    floor: '5F',
    room: rec.room,
    roomType: '강의장',
    title: rec.title,
    department: rec.department || '',
    userName: rec.user_name || '',
    phone: '',
    start: new Date(rec.start_time),
    end: new Date(rec.end_time),
    created: rec.created_at ? new Date(rec.created_at) : new Date(),
    status: rec.status,
  };
  return {
    id: `admin-${rec.id}`,
    title: `${rec.title}${rec.user_name ? ` (${rec.user_name})` : ''}`,
    start: new Date(rec.start_time),
    end: new Date(rec.end_time),
    resourceId: rec.room,
    originalData: reservation,
  };
}

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<CalendarEvent[]>([]);
  const [adminRecords, setAdminRecords] = useState<AdminRecord[]>([]);
  const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isBulletinOpen, setIsBulletinOpen] = useState(false);
  const [mainTab, setMainTab] = useState<'calendar' | 'reservation'>('calendar');

  const allEvents = [...events, ...adminEvents];

  // Calculate date range
  const getDateRange = () => {
    if (allEvents.length === 0) return '';

    const startDates = allEvents.map(e => e.start.getTime());
    const endDates = allEvents.map(e => e.end.getTime());

    const minDate = new Date(Math.min(...startDates));
    const maxDate = new Date(Math.max(...endDates));

    return `${format(minDate, 'yyyy.MM.dd', { locale: ko })} ~ ${format(maxDate, 'yyyy.MM.dd', { locale: ko })}`;
  };

  // Filter events to only show 5th floor lecture halls and normalize resource IDs
  const filterEvents = (events: CalendarEvent[]) => {
    const TARGET_ROOMS = ['대강의장', '중강의장1', '중강의장2'];
    return events.filter(event => {
      const floor = event.originalData.floor || '';
      const room = event.originalData.room || '';
      
      // Check if floor is 5F (or similar)
      const isFifthFloor = floor.includes('5');
      
      // Check if room matches target rooms
      const isTargetRoom = TARGET_ROOMS.some(target => room.includes(target));
      
      // Check if status is not '취소'
      const isNotCancelled = event.originalData.status !== '취소' && event.originalData.status !== '자동종료' && event.originalData.status !== '자동취소';
      
      return isFifthFloor && isTargetRoom && isNotCancelled;
    }).map(event => {
      // Normalize resourceId for the calendar view
      const room = event.originalData.room || '';
      let normalizedId = room;
      if (room.includes('대강의장')) normalizedId = '대강의장';
      else if (room.includes('중강의장1')) normalizedId = '중강의장1';
      else if (room.includes('중강의장2')) normalizedId = '중강의장2';
      
      return { ...event, resourceId: normalizedId };
    });
  };

  const loadAdminEvents = useCallback(async () => {
    try {
      const records = await fetchAdminRecords();
      setAdminRecords(records);
      setAdminEvents(
        records
          .filter(rec => rec.status !== '취소' && rec.status !== '자동종료' && rec.status !== '자동취소')
          .map(adminRecordToCalendarEvent)
      );
    } catch {
      // Supabase 미설정 시 조용히 무시
    }
  }, []);

  const loadUploadBatches = useCallback(async () => {
    try {
      const batches = await fetchUploadBatches();
      setUploadBatches(batches);
    } catch {
      // Supabase 미설정 시 조용히 무시
    }
  }, []);

  const formatBatchLabel = (batch: UploadBatch): string => {
    // uploaded_at 또는 batch_id 앞 타임스탬프로 업로드 시각 추출
    let date: Date | null = null;
    if (batch.uploaded_at) {
      date = new Date(batch.uploaded_at);
    } else {
      const tsMatch = batch.batch_id.match(/^(\d{13})/);
      if (tsMatch) date = new Date(parseInt(tsMatch[1]));
    }
    if (date && !isNaN(date.getTime())) {
      const y = date.getFullYear();
      const mo = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const h = date.getHours();
      const mi = String(date.getMinutes()).padStart(2, '0');
      const ampm = h < 12 ? '오전' : '오후';
      const h12 = h % 12 || 12;
      return `${y}-${mo}-${d} ${ampm} ${h12}시 ${mi}분`;
    }
    // 폴백: 파일명에서 날짜 추출
    const m = batch.filename.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : batch.filename;
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('이 파일의 데이터를 삭제하시겠습니까?')) return;
    try {
      await deleteUploadBatch(batchId);
      await loadAdminEvents();
      await loadUploadBatches();
    } catch {
      setError('삭제에 실패했습니다.');
    }
  };

  // Load admin data on mount
  useEffect(() => {
    loadAdminEvents();
    loadUploadBatches();
  }, [loadAdminEvents, loadUploadBatches]);

  const handleFileUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const parsedEvents = await parseExcelFile(file);
      const filteredEvents = filterEvents(parsedEvents);

      if (filteredEvents.length === 0 && parsedEvents.length > 0) {
        setError('업로드된 파일에서 5층 강의장(대강의장, 중강의장1, 중강의장2) 예약 정보를 찾을 수 없습니다.');
        return;
      }
      if (filteredEvents.length === 0) {
        setError('파일에서 유효한 데이터를 찾을 수 없습니다.');
        return;
      }

      // Supabase에 저장 시도 (배치 ID = 타임스탬프_파일명)
      const batchId = `${Date.now()}_${file.name.replace(/\.[^.]+$/, '')}`;
      try {
        await insertAdminRecords(filteredEvents.map(e => ({
          room: e.resourceId || e.originalData.room,
          title: e.originalData.title,
          department: e.originalData.department || '',
          user_name: e.originalData.userName || '',
          start_time: e.start.toISOString(),
          end_time: e.end.toISOString(),
          status: e.originalData.status || '사용완료',
          upload_batch: batchId,
        })));
        await loadAdminEvents();
        await loadUploadBatches();
        setIsUploadModalOpen(false);
      } catch {
        // Supabase 미설정 or 실패 → 로컬 상태로 폴백
        setEvents(filteredEvents);
        setIsUploadModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      setError('Excel 파일을 분석하는데 실패했습니다. 파일 형식을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [loadAdminEvents, loadUploadBatches]);

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">수송스퀘어 5층 강의장 예약 현황</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-500 text-xs sm:text-sm">
                  {allEvents.length > 0
                    ? `총 ${allEvents.length}건의 예약이 표시되고 있습니다.`
                    : '예약된 일정이 없습니다.'}
                </p>
                {allEvents.length > 0 && (
                  <span className="hidden sm:inline text-sm text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                    {getDateRange()}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end">
              <button
                onClick={() => setIsBulletinOpen(true)}
                className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center"
              >
                <MessageSquare className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">게시판</span>
              </button>
              <button
                onClick={() => setIsAdminOpen(true)}
                className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center"
              >
                <Settings className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">관리</span>
              </button>
              <button
                onClick={() => setIsStatsModalOpen(true)}
                className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center"
              >
                <BarChart2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">통계</span>
              </button>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center"
              >
                <UploadIcon className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">새 파일 </span>업로드
              </button>
            </div>
            {uploadBatches.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {uploadBatches.map(batch => (
                  <span key={batch.batch_id}
                    className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-xs rounded-full px-2.5 py-0.5">
                    <UploadIcon className="w-3 h-3" />
                    {formatBatchLabel(batch)} 버전 ({batch.count}건)
                    <button onClick={() => handleDeleteBatch(batch.batch_id)}
                      className="ml-0.5 text-green-400 hover:text-red-500 transition-colors" title="파일 데이터 삭제">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Main Tab */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setMainTab('calendar')}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              mainTab === 'calendar'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarIcon className="w-4 h-4" /> 캘린더
          </button>
          <button
            onClick={() => setMainTab('reservation')}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              mainTab === 'reservation'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <TableProperties className="w-4 h-4" /> 예약 현황 조회
          </button>
        </div>

        {mainTab === 'calendar' ? (
          <>
            {/* Calendar View */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <CalendarView events={allEvents} />
            </div>

            {/* Download Buttons */}
            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pb-6 sm:pb-8">
              <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <Download className="w-4 h-4" />
                예약현황 다운로드
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => downloadCalendarExcel(allEvents)}
                  disabled={allEvents.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  달력형 (.xlsx)
                </button>
                <button
                  onClick={() => downloadListExcel(allEvents)}
                  disabled={allEvents.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4 h-4" />
                  리스트형 (.xlsx)
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            <ReservationSearchTab records={adminRecords} />
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsUploadModalOpen(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    예약 파일 업로드
                  </h3>
                  <button 
                    onClick={() => setIsUploadModalOpen(false)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                {error && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">오류 발생</h3>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                <div className="mt-2">
                  <FileUpload onFileUpload={handleFileUpload} />
                </div>

                {loading && (
                  <div className="mt-4 flex justify-center items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                    <span className="font-medium">데이터 처리중...</span>
                  </div>
                )}

                <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-gray-400" />
                    필수 데이터 형식
                  </h4>
                  <p className="text-xs text-gray-500 mb-2">
                    엑셀 파일은 다음 컬럼을 포함해야 합니다:
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono text-gray-600">
                    <div className="bg-white p-1 rounded border border-gray-200 text-center">회의실</div>
                    <div className="bg-white p-1 rounded border border-gray-200 text-center">제목</div>
                    <div className="bg-white p-1 rounded border border-gray-200 text-center">시작시간</div>
                    <div className="bg-white p-1 rounded border border-gray-200 text-center">종료시간</div>
                    <div className="bg-white p-1 rounded border border-gray-200 text-center">사용자명</div>
                    <div className="bg-white p-1 rounded border border-gray-200 text-center">부서</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {isStatsModalOpen && (
        <DepartmentStats
          events={allEvents}
          onClose={() => setIsStatsModalOpen(false)}
          onDataChange={loadAdminEvents}
        />
      )}

      {/* Bulletin Board Modal */}
      {isBulletinOpen && (
        <BulletinBoard onClose={() => setIsBulletinOpen(false)} />
      )}

      {/* Admin Modal */}
      {isAdminOpen && (
        <AdminPage
          onClose={() => setIsAdminOpen(false)}
          onDataChange={loadAdminEvents}
        />
      )}
    </div>
  );
}

