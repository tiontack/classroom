import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle, Loader, Lock, MessageSquare, Send } from 'lucide-react';
import { BoardPost, fetchBoardPosts, insertBoardPost, deleteBoardPost } from '../lib/supabase';

interface BulletinBoardProps {
  onClose: () => void;
}

const ROOM_OPTIONS = ['대강의장', '중강의장1', '중강의장2'];
const ROOM_FILTERS = ['전체', ...ROOM_OPTIONS];
const ADMIN_PASSWORD = '1234';

const ROOM_BADGE: Record<string, string> = {
  '대강의장':  'bg-blue-100 text-blue-700',
  '중강의장1': 'bg-emerald-100 text-emerald-700',
  '중강의장2': 'bg-amber-100 text-amber-700',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const BulletinBoard: React.FC<BulletinBoardProps> = ({ onClose }) => {
  // ── 목록 ──────────────────────────────────────────────────────
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [filterRoom, setFilterRoom] = useState('전체');

  // ── 글쓰기 ────────────────────────────────────────────────────
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [writeAuthor, setWriteAuthor] = useState('');
  const [writeRoom, setWriteRoom] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeSaving, setWriteSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState(false);

  // ── 관리자 모드 ───────────────────────────────────────────────
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);

  // ── 삭제 확인 ─────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── 데이터 로드 ───────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await fetchBoardPosts();
      setPosts(data);
    } catch {
      setListError('게시글을 불러오는데 실패했습니다. Supabase 설정을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // ── 글쓰기 제출 ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writeAuthor.trim()) { setWriteError('작성자를 입력해주세요.'); return; }
    if (!writeContent.trim()) { setWriteError('내용을 입력해주세요.'); return; }
    setWriteSaving(true);
    setWriteError(null);
    try {
      await insertBoardPost({
        author: writeAuthor.trim(),
        content: writeContent.trim(),
        room: writeRoom || undefined,
      });
      setWriteAuthor('');
      setWriteRoom('');
      setWriteContent('');
      setIsWriteOpen(false);
      setWriteSuccess(true);
      setTimeout(() => setWriteSuccess(false), 3000);
      await loadPosts();
    } catch {
      setWriteError('등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setWriteSaving(false);
    }
  };

  // ── 관리자 인증 ───────────────────────────────────────────────
  const handleAdminToggle = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      setDeletingId(null);
    } else {
      setPwInput('');
      setPwError(false);
      setShowPwModal(true);
    }
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === ADMIN_PASSWORD) {
      setIsAdminMode(true);
      setShowPwModal(false);
    } else {
      setPwError(true);
      setPwInput('');
    }
  };

  // ── 삭제 ─────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await deleteBoardPost(id);
      setDeletingId(null);
      await loadPosts();
    } catch {
      setListError('삭제에 실패했습니다.');
    }
  };

  const filteredPosts = filterRoom === '전체'
    ? posts
    : posts.filter(p => p.room === filterRoom);

  return (
    <>
      {/* ── 관리자 비밀번호 모달 ── */}
      {showPwModal && (
        <div className="fixed inset-0 z-[70] bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-500" /> 관리자 인증
              </h2>
              <button onClick={() => setShowPwModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePwSubmit} className="p-6 space-y-4">
              <input
                type="password" autoFocus value={pwInput}
                onChange={e => { setPwInput(e.target.value); setPwError(false); }}
                placeholder="비밀번호 입력"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${pwError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {pwError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> 비밀번호가 올바르지 않습니다.
                </p>
              )}
              <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                확인
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── 게시판 본문 ── */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75">
        <div className="flex items-start justify-center min-h-screen p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">

            {/* 헤더 */}
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                강의장 게시판
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdminToggle}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isAdminMode
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isAdminMode ? '관리자 ON' : '관리자'}
                </button>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">

              {/* 등록 성공 알림 */}
              {writeSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> 게시글이 등록되었습니다.
                </div>
              )}

              {/* 필터 + 글쓰기 버튼 */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1.5 flex-wrap">
                  {ROOM_FILTERS.map(r => (
                    <button
                      key={r}
                      onClick={() => setFilterRoom(r)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        filterRoom === r
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setIsWriteOpen(v => !v); setWriteError(null); }}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> 글쓰기
                </button>
              </div>

              {/* 글쓰기 폼 */}
              {isWriteOpen && (
                <div className="border border-blue-200 rounded-xl bg-blue-50/60 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">새 글 작성</h3>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          type="text" value={writeAuthor}
                          onChange={e => setWriteAuthor(e.target.value)}
                          placeholder="작성자 *"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <select
                          value={writeRoom}
                          onChange={e => setWriteRoom(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">강의장 선택 (선택)</option>
                          {ROOM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <textarea
                      value={writeContent}
                      onChange={e => setWriteContent(e.target.value)}
                      placeholder="내용을 입력하세요 *"
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />
                    {writeError && (
                      <div className="flex items-center gap-2 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" /> {writeError}
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button" onClick={() => setIsWriteOpen(false)}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                      >
                        취소
                      </button>
                      <button
                        type="submit" disabled={writeSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {writeSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        등록
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 오류 */}
              {listError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {listError}
                </div>
              )}

              {/* 게시글 목록 */}
              {loading ? (
                <div className="flex justify-center py-12 text-gray-400">
                  <Loader className="w-6 h-6 animate-spin" />
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  {filterRoom !== '전체'
                    ? `${filterRoom} 관련 게시글이 없습니다.`
                    : '아직 게시글이 없습니다. 첫 번째 글을 작성해보세요!'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {filteredPosts.map(post => (
                    <div key={post.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                      {/* 메타 정보 행 */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{post.author}</span>
                          {post.room && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROOM_BADGE[post.room] ?? 'bg-gray-100 text-gray-600'}`}>
                              {post.room}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {post.created_at ? formatDate(post.created_at) : ''}
                          </span>
                        </div>

                        {/* 관리자 삭제 버튼 */}
                        {isAdminMode && (
                          <div className="flex-shrink-0">
                            {deletingId === post.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-red-600 font-medium">삭제할까요?</span>
                                <button
                                  onClick={() => handleDelete(post.id!)}
                                  className="px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                                >예</button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                                >아니오</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(post.id!)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> 삭제
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 본문 */}
                      <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 게시글 수 */}
              {!loading && filteredPosts.length > 0 && (
                <p className="text-xs text-gray-400 text-right">
                  총 {filteredPosts.length}개의 게시글
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
