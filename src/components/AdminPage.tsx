import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle, Loader, Upload, Lock } from 'lucide-react';
import { AdminRecord, fetchAdminRecords, insertAdminRecord, insertAdminRecords, deleteAdminRecord } from '../lib/supabase';
import { parseExcelFile } from '../utils/excelParser';
import { CalendarEvent } from '../types';

interface AdminPageProps {
  onClose: () => void;
  onDataChange: () => void;
}

const ROOMS = ['대강의장', '중강의장1', '중강의장2'];
const ADMIN_PASSWORD = '1234';

// 메인 화면과 동일한 필터 로직
function filterAndNormalize(events: CalendarEvent[]): CalendarEvent[] {
  const TARGET_ROOMS = ['대강의장', '중강의장1', '중강의장2'];
  return events
    .filter(event => {
      const floor = event.originalData.floor || '';
      const room = event.originalData.room || '';
      return floor.includes('5') && TARGET_ROOMS.some(t => room.includes(t)) && event.originalData.status !== '취소' && event.originalData.status !== '자동종료' && event.originalData.status !== '자동취소';
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

export const AdminPage: React.FC<AdminPageProps> = ({ onClose, onDataChange }) => {
  // --- Password gate ---
  const [authenticated, setAuthenticated] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPwInput('');
    }
  };

  // --- Admin data ---
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Manual form ---
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    room: '대강의장',
    title: '',
    department: '',
    user_name: '',
    date: today,
    start_time: '09:00',
    end_time: '18:00',
    status: '사용완료',
  });

  // --- Excel upload ---
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminRecords();
      setRecords(data);
    } catch {
      setError('데이터를 불러오는데 실패했습니다. Supabase 설정을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) loadRecords();
  }, [authenticated, loadRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('제목을 입력해주세요.'); return; }
    setSaving(true);
    setError(null);
    try {
      await insertAdminRecord({
        room: form.room,
        title: form.title,
        department: form.department,
        user_name: form.user_name,
        start_time: `${form.date}T${form.start_time}:00`,
        end_time: `${form.date}T${form.end_time}:00`,
        status: form.status,
      });
      setSuccess('저장되었습니다.');
      setTimeout(() => setSuccess(null), 3000);
      setForm(prev => ({ ...prev, title: '', department: '', user_name: '' }));
      await loadRecords();
      onDataChange();
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteAdminRecord(id);
      await loadRecords();
      onDataChange();
    } catch {
      setError('삭제에 실패했습니다.');
    }
  };

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
      if (filtered.length === 0) {
        setUploadError('파일에서 유효한 데이터를 찾을 수 없습니다.');
        return;
      }

      const toInsert = filtered.map(e => ({
        room: e.resourceId || e.originalData.room,
        title: e.originalData.title,
        department: e.originalData.department || '',
        user_name: e.originalData.userName || '',
        start_time: e.start.toISOString(),
        end_time: e.end.toISOString(),
        status: e.originalData.status || '사용완료',
      }));

      await insertAdminRecords(toInsert);
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

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                autoFocus
                value={pwInput}
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
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              확인
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── 관리 페이지 본문 ────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75">
      <div className="flex items-start justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b">
            <h2 className="text-lg font-bold text-gray-900">관리 페이지 — 사용 이력 등록</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">

            {/* ── Excel 일괄 업로드 ── */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Upload className="w-4 h-4" /> 엑셀 일괄 업로드
                <span className="text-xs font-normal text-gray-400 ml-1">(Reset해도 유지됨)</span>
              </h3>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onDrop={handleFileDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => document.getElementById('adminFileInput')?.click()}
              >
                <input
                  id="adminFileInput"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleExcelUpload(e.target.files[0]); e.target.value = ''; }}
                />
                {uploadLoading ? (
                  <div className="flex justify-center items-center gap-2 text-blue-600">
                    <Loader className="w-5 h-5 animate-spin" />
                    <span className="text-sm">처리 중...</span>
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

            {/* ── 직접 입력 ── */}
            <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Plus className="w-4 h-4" /> 직접 입력
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">강의장 *</label>
                  <select
                    value={form.room}
                    onChange={e => setForm(p => ({ ...p, room: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">날짜 *</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">시작 시간 *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">종료 시간 *</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">제목 *</label>
                  <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="예: 신입사원 교육"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
                  <input type="text" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                    placeholder="예: HR팀"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">담당자</label>
                  <input type="text" value={form.user_name} onChange={e => setForm(p => ({ ...p, user_name: e.target.value }))}
                    placeholder="예: 홍길동"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
                </div>
              )}

              <button type="submit" disabled={saving}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Loader className="w-4 h-4 animate-spin" /> 저장 중...</> : <><Plus className="w-4 h-4" /> 저장</>}
              </button>
            </form>

            {/* ── 등록 목록 ── */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">등록된 이력 ({records.length}건)</h3>
              {loading ? (
                <div className="flex justify-center py-8 text-gray-400"><Loader className="w-6 h-6 animate-spin" /></div>
              ) : records.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">등록된 이력이 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {records.map(rec => (
                    <div key={rec.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                          rec.room === '대강의장' ? 'bg-blue-100 text-blue-700' :
                          rec.room === '중강의장1' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{rec.room}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{rec.title}</p>
                          <p className="text-gray-500 text-xs">
                            {formatDateTime(rec.start_time)} ~ {new Date(rec.end_time).toTimeString().slice(0,5)}
                            {rec.department && ` · ${rec.department}`}
                            {rec.user_name && ` · ${rec.user_name}`}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(rec.id!)}
                        className="flex-shrink-0 ml-2 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
