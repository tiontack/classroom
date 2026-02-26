import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { AdminRecord, fetchAdminRecords, insertAdminRecord, deleteAdminRecord } from '../lib/supabase';

interface AdminPageProps {
  onClose: () => void;
  onDataChange: () => void;
}

const ROOMS = ['대강의장', '중강의장1', '중강의장2'];

export const AdminPage: React.FC<AdminPageProps> = ({ onClose, onDataChange }) => {
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminRecords();
      setRecords(data);
    } catch (err: any) {
      setError('데이터를 불러오는데 실패했습니다. Supabase 설정을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
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
    } catch (err: any) {
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

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

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
            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Plus className="w-4 h-4" /> 새 사용 이력 추가
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
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">시작 시간 *</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">종료 시간 *</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">제목 *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="예: 신입사원 교육"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                    placeholder="예: HR팀"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">담당자</label>
                  <input
                    type="text"
                    value={form.user_name}
                    onChange={e => setForm(p => ({ ...p, user_name: e.target.value }))}
                    placeholder="예: 홍길동"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <><Loader className="w-4 h-4 animate-spin" /> 저장 중...</> : <><Plus className="w-4 h-4" /> 저장</>}
              </button>
            </form>

            {/* Records list */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">등록된 이력 ({records.length}건)</h3>
              {loading ? (
                <div className="flex justify-center py-8 text-gray-400">
                  <Loader className="w-6 h-6 animate-spin" />
                </div>
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
                      <button
                        onClick={() => handleDelete(rec.id!)}
                        className="flex-shrink-0 ml-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
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
