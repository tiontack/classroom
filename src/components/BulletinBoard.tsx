import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle, Loader, Lock, MessageSquare, Send, CornerDownRight, EyeOff } from 'lucide-react';
import {
  BoardPost, fetchBoardPosts, insertBoardPost, deleteBoardPost,
  BoardReply, fetchBoardReplies, insertBoardReply, deleteBoardReply,
} from '../lib/supabase';

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
  // ── 게시글 ────────────────────────────────────────────────────
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [filterRoom, setFilterRoom] = useState('전체');

  // ── 답글 ──────────────────────────────────────────────────────
  const [repliesMap, setRepliesMap] = useState<Record<string, BoardReply[]>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);

  // ── 글쓰기 ────────────────────────────────────────────────────
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [writeAuthor, setWriteAuthor] = useState('');
  const [writeRoom, setWriteRoom] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeIsSecret, setWriteIsSecret] = useState(false);
  const [writeSecretPw, setWriteSecretPw] = useState('');
  const [writeSaving, setWriteSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState(false);

  // ── 비밀글 잠금 해제 ──────────────────────────────────────────
  // 잠금 해제된 게시글 ID 목록
  const [unlockedPosts, setUnlockedPosts] = useState<Set<string>>(new Set());
  // 현재 비밀번호 입력 중인 게시글 ID
  const [unlockingPostId, setUnlockingPostId] = useState<string | null>(null);
  const [unlockInput, setUnlockInput] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const unlockRef = useRef<HTMLInputElement>(null);

  // ── 관리자 모드 ───────────────────────────────────────────────
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);

  // ── 게시글 삭제 확인 ──────────────────────────────────────────
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // ── 데이터 로드 ───────────────────────────────────────────────
  const loadReplies = useCallback(async () => {
    try {
      const all = await fetchBoardReplies();
      const map: Record<string, BoardReply[]> = {};
      for (const r of all) {
        if (!map[r.post_id]) map[r.post_id] = [];
        map[r.post_id].push(r);
      }
      setRepliesMap(map);
    } catch {
      // 답글 로드 실패는 조용히 무시
    }
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [data] = await Promise.all([fetchBoardPosts(), loadReplies()]);
      setPosts(data);
    } catch {
      setListError('게시글을 불러오는데 실패했습니다. Supabase 설정을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [loadReplies]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // 잠금 해제 input 자동 포커스
  useEffect(() => {
    if (unlockingPostId && unlockRef.current) unlockRef.current.focus();
  }, [unlockingPostId]);

  // ── 글쓰기 제출 ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writeAuthor.trim()) { setWriteError('작성자를 입력해주세요.'); return; }
    if (!writeContent.trim()) { setWriteError('내용을 입력해주세요.'); return; }
    if (writeIsSecret && !/^\d{4}$/.test(writeSecretPw)) {
      setWriteError('비밀번호는 숫자 4자리로 입력해주세요.'); return;
    }
    setWriteSaving(true);
    setWriteError(null);
    try {
      await insertBoardPost({
        author: writeAuthor.trim(),
        content: writeContent.trim(),
        room: writeRoom || undefined,
        is_secret: writeIsSecret,
        secret_password: writeIsSecret ? writeSecretPw : undefined,
      });
      setWriteAuthor('');
      setWriteRoom('');
      setWriteContent('');
      setWriteIsSecret(false);
      setWriteSecretPw('');
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
      setDeletingPostId(null);
      setDeletingReplyId(null);
      setReplyingToId(null);
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

  // ── 게시글 삭제 ───────────────────────────────────────────────
  const handleDeletePost = async (id: string) => {
    try {
      await deleteBoardPost(id);
      setDeletingPostId(null);
      await loadPosts();
    } catch {
      setListError('삭제에 실패했습니다.');
    }
  };

  // ── 비밀글 잠금 해제 ──────────────────────────────────────────
  const handleUnlock = (post: BoardPost) => {
    if (unlockInput === post.secret_password) {
      setUnlockedPosts(prev => new Set([...prev, post.id!]));
      setUnlockingPostId(null);
      setUnlockInput('');
      setUnlockError(false);
    } else {
      setUnlockError(true);
      setUnlockInput('');
    }
  };

  const openUnlock = (postId: string) => {
    setUnlockingPostId(postId);
    setUnlockInput('');
    setUnlockError(false);
  };

  // ── 답글 제출 ─────────────────────────────────────────────────
  const handleReplySubmit = async (postId: string) => {
    if (!replyContent.trim()) { setReplyError('내용을 입력해주세요.'); return; }
    setReplySaving(true);
    setReplyError(null);
    try {
      await insertBoardReply({ post_id: postId, content: replyContent.trim() });
      setReplyContent('');
      setReplyingToId(null);
      await loadReplies();
    } catch {
      setReplyError('답글 등록에 실패했습니다.');
    } finally {
      setReplySaving(false);
    }
  };

  // ── 답글 삭제 ─────────────────────────────────────────────────
  const handleDeleteReply = async (id: string) => {
    try {
      await deleteBoardReply(id);
      setDeletingReplyId(null);
      await loadReplies();
    } catch {
      setListError('답글 삭제에 실패했습니다.');
    }
  };

  // ── 표시 여부 판단 (비밀글) ───────────────────────────────────
  const isContentVisible = (post: BoardPost) => {
    if (!post.is_secret) return true;
    if (isAdminMode) return true;
    return unlockedPosts.has(post.id!);
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

              {/* ── 글쓰기 폼 ── */}
              {isWriteOpen && (
                <div className="border border-blue-200 rounded-xl bg-blue-50/60 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">새 글 작성</h3>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text" value={writeAuthor}
                        onChange={e => setWriteAuthor(e.target.value)}
                        placeholder="작성자 *"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <select
                        value={writeRoom}
                        onChange={e => setWriteRoom(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">강의장 선택 (선택)</option>
                        {ROOM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <textarea
                      value={writeContent}
                      onChange={e => setWriteContent(e.target.value)}
                      placeholder="내용을 입력하세요 *"
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />

                    {/* 비밀글 옵션 */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                        <input
                          type="checkbox"
                          checked={writeIsSecret}
                          onChange={e => { setWriteIsSecret(e.target.checked); setWriteSecretPw(''); }}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 flex items-center gap-1">
                          <EyeOff className="w-4 h-4 text-indigo-500" /> 비밀글로 작성
                        </span>
                      </label>

                      {writeIsSecret && (
                        <div className="flex items-center gap-2 pl-6">
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={writeSecretPw}
                            onChange={e => setWriteSecretPw(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="비밀번호 숫자 4자리 *"
                            className="w-48 border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white tracking-widest"
                          />
                          <span className="text-xs text-gray-400">작성자만 볼 수 있습니다</span>
                        </div>
                      )}
                    </div>

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

              {/* ── 게시글 목록 ── */}
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
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {filteredPosts.map(post => {
                    const postReplies = repliesMap[post.id!] ?? [];
                    const isReplyOpen = replyingToId === post.id;
                    const visible = isContentVisible(post);
                    const isUnlocking = unlockingPostId === post.id;

                    return (
                      <div
                        key={post.id}
                        className={`border rounded-xl overflow-hidden transition-colors ${
                          post.is_secret
                            ? 'border-indigo-200 bg-indigo-50/30'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {/* ── 게시글 헤더 ── */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{post.author}</span>
                              {post.room && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROOM_BADGE[post.room] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {post.room}
                                </span>
                              )}
                              {/* 비밀글 뱃지 */}
                              {post.is_secret && (
                                <span className="flex items-center gap-0.5 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded text-xs font-medium">
                                  <EyeOff className="w-3 h-3" /> 비밀글
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                {post.created_at ? formatDate(post.created_at) : ''}
                              </span>
                            </div>

                            {/* 관리자 액션 */}
                            {isAdminMode && (
                              <div className="flex-shrink-0 flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setReplyingToId(isReplyOpen ? null : post.id!);
                                    setReplyContent('');
                                    setReplyError(null);
                                  }}
                                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                                    isReplyOpen
                                      ? 'bg-indigo-100 text-indigo-600'
                                      : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50'
                                  }`}
                                >
                                  <CornerDownRight className="w-3.5 h-3.5" /> 답글
                                </button>
                                {deletingPostId === post.id ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-red-600 font-medium">삭제?</span>
                                    <button onClick={() => handleDeletePost(post.id!)} className="px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600">예</button>
                                    <button onClick={() => setDeletingPostId(null)} className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">아니오</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeletingPostId(post.id!)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> 삭제
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ── 본문 영역 ── */}
                          {visible ? (
                            /* 내용 보임 */
                            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {post.content}
                            </p>
                          ) : isUnlocking ? (
                            /* 비밀번호 입력 폼 */
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <Lock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                              <input
                                ref={unlockRef}
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                value={unlockInput}
                                onChange={e => { setUnlockInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setUnlockError(false); }}
                                onKeyDown={e => { if (e.key === 'Enter') handleUnlock(post); }}
                                placeholder="비밀번호 4자리"
                                className={`w-36 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 tracking-widest ${
                                  unlockError ? 'border-red-400 bg-red-50' : 'border-indigo-300'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleUnlock(post)}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                              >
                                확인
                              </button>
                              <button
                                type="button"
                                onClick={() => { setUnlockingPostId(null); setUnlockError(false); }}
                                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
                              >
                                취소
                              </button>
                              {unlockError && (
                                <span className="text-xs text-red-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> 비밀번호가 틀렸습니다.
                                </span>
                              )}
                            </div>
                          ) : (
                            /* 잠긴 상태 */
                            <button
                              type="button"
                              onClick={() => openUnlock(post.id!)}
                              className="mt-3 flex items-center gap-2 w-full text-left px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors group"
                            >
                              <Lock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                              <span className="text-sm text-indigo-500">비밀글입니다.</span>
                              <span className="ml-auto text-xs text-indigo-400 group-hover:text-indigo-600">비밀번호 입력 →</span>
                            </button>
                          )}
                        </div>

                        {/* ── 답글 목록 (내용이 보이는 경우에만) ── */}
                        {visible && postReplies.length > 0 && (
                          <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
                            {postReplies.map(reply => (
                              <div key={reply.id} className="flex items-start gap-2 px-4 py-3">
                                <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">관리자</span>
                                      <span className="text-xs text-gray-400">
                                        {reply.created_at ? formatDate(reply.created_at) : ''}
                                      </span>
                                    </div>
                                    {isAdminMode && (
                                      <div className="flex-shrink-0">
                                        {deletingReplyId === reply.id ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs text-red-600 font-medium">삭제?</span>
                                            <button onClick={() => handleDeleteReply(reply.id!)} className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600">예</button>
                                            <button onClick={() => setDeletingReplyId(null)} className="px-1.5 py-0.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">아니오</button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => setDeletingReplyId(reply.id!)}
                                            className="p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition-colors"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {reply.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── 답글 작성 폼 (관리자 모드) ── */}
                        {isAdminMode && isReplyOpen && (
                          <div className="border-t border-indigo-100 bg-indigo-50/50 p-3">
                            <div className="flex gap-2 items-start">
                              <CornerDownRight className="w-4 h-4 text-indigo-400 mt-2 flex-shrink-0" />
                              <div className="flex-1 space-y-2">
                                <textarea
                                  autoFocus
                                  value={replyContent}
                                  onChange={e => { setReplyContent(e.target.value); setReplyError(null); }}
                                  placeholder="관리자 답글을 입력하세요..."
                                  rows={2}
                                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
                                />
                                {replyError && (
                                  <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {replyError}
                                  </p>
                                )}
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => { setReplyingToId(null); setReplyContent(''); setReplyError(null); }}
                                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    disabled={replySaving}
                                    onClick={() => handleReplySubmit(post.id!)}
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {replySaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    답글 등록
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
