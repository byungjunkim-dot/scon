import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Filter,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Project, User } from '../types';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured as hasSupabase } from '../lib/supabase';
import QuickMemoModal, {
  QuickMemo,
  QuickMemoCategory,
  QuickMemoSeverity,
  QuickMemoStatus,
} from './QuickMemoModal';

interface QuickMemoViewProps {
  project: Project | null;
  currentUser?: User | null;
  settings?: any;
  autoOpenModal?: boolean;
  onModalOpened?: () => void;
}

const CATEGORIES: QuickMemoCategory[] = [
  '안전',
  '품질',
  '공정',
  '설계',
  '자재',
  '장비',
  '민원',
  '기타',
];

const SEVERITIES: QuickMemoSeverity[] = ['낮음', '중간', '높음', '긴급'];

const STATUS_LABELS: Record<QuickMemoStatus, string> = {
  open: '미조치',
  reviewed: '검토중',
  resolved: '조치완료',
  dismissed: '제외',
};

const getToday = () => new Date().toISOString().split('T')[0];

const getLocalStorageKey = (projectId: string) => `cp_quick_memos_${projectId}`;

const getCategoryBadgeClass = (category: QuickMemoCategory) => {
  switch (category) {
    case '안전':
      return 'bg-red-50 text-red-700 border-red-200';
    case '품질':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case '공정':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case '설계':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case '자재':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case '장비':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case '민원':
      return 'bg-pink-50 text-pink-700 border-pink-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const getSeverityBadgeClass = (severity: QuickMemoSeverity) => {
  switch (severity) {
    case '긴급':
      return 'bg-red-600 text-white border-red-600';
    case '높음':
      return 'bg-red-50 text-red-700 border-red-200';
    case '중간':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    default:
      return 'bg-green-50 text-green-700 border-green-200';
  }
};

const getStatusBadgeClass = (status: QuickMemoStatus) => {
  switch (status) {
    case 'resolved':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'reviewed':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'dismissed':
      return 'bg-gray-50 text-gray-500 border-gray-200';
    default:
      return 'bg-red-50 text-red-700 border-red-200';
  }
};

function QuickMemoCard({
  memo,
  onStatusChange,
  onDelete,
}: {
  key?: any;
  memo: QuickMemo;
  onStatusChange: (memo: QuickMemo, nextStatus: QuickMemoStatus) => void | Promise<void>;
  onDelete: (memo: QuickMemo) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header - Always visible, Click to expand */}
      <div 
        className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getCategoryBadgeClass(memo.category)}`}>
              {memo.category}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getSeverityBadgeClass(memo.severity)}`}>
              {memo.severity}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(memo.status)}`}>
              {STATUS_LABELS[memo.status]}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <span>{memo.date}</span>
              {memo.createdAt && !isNaN(new Date(memo.createdAt).getTime()) && (
                <>
                  <span className="mx-0.5">·</span>
                  <span>{new Date(memo.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </span>
          </div>

          <h3 className="text-base sm:text-md font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
            {memo.aiTitle}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0 overflow-visible" onClick={(e) => e.stopPropagation()}>
          <select
            value={memo.status}
            onChange={(e) => onStatusChange(memo, e.target.value as QuickMemoStatus)}
            className="h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="open">미조치</option>
            <option value="reviewed">검토중</option>
            <option value="resolved">조치완료</option>
            <option value="dismissed">제외</option>
          </select>
          <button
            type="button"
            onClick={() => onDelete(memo)}
            className="h-9 w-9 md:w-auto md:px-3 rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold flex items-center justify-center gap-1 shrink-0"
            title="삭제"
          >
            <Trash2 size={14} />
            <span className="hidden md:inline">삭제</span>
          </button>
          <div className="h-9 w-9 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 flex items-center justify-center shrink-0 transition-colors">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 md:p-5 border-t border-gray-100 bg-gray-50/50">
          {memo.location && (
            <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
              <MapPin size={15} className="text-gray-400" />
              {memo.location}
            </div>
          )}

          <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">
            {memo.aiSummary}
          </p>

          {memo.recommendedAction && (
            <div className="mb-3 rounded-xl bg-blue-50/50 border border-blue-100 p-4">
              <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                권장 조치
              </p>
              <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">
                {memo.recommendedAction}
              </p>
            </div>
          )}

          {memo.designFeedback && (
            <div className="mb-3 rounded-xl bg-purple-50/50 border border-purple-100 p-4">
              <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1.5">
                <Sparkles size={14} />
                설계/제작 피드백
              </p>
              <p className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">
                {memo.designFeedback}
              </p>
            </div>
          )}

          {memo.dailyIssueText && (
            <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                <FileText size={14} />
                공사일보 특기사항용 문구
              </p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {memo.dailyIssueText}
              </p>
            </div>
          )}

          {memo.photos && memo.photos.length > 0 && (
            <div className="mt-2 pt-4 border-t border-gray-200 border-dashed">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mb-3">
                <ImageIcon size={14} />
                첨부 사진 {memo.photos.length}장
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {memo.photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(photo.url, '_blank');
                    }}
                    className="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-white hover:opacity-90 relative group shadow-sm transition-opacity"
                  >
                    <img
                      src={photo.url}
                      alt={photo.title || memo.aiTitle}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuickMemoView({
  project,
  currentUser,
  autoOpenModal = false,
  onModalOpened,
}: QuickMemoViewProps) {
  const [memos, setMemos] = useState<QuickMemo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(autoOpenModal);

  useEffect(() => {
    if (autoOpenModal) {
      setIsModalOpen(true);
      onModalOpened?.();
    }
  }, [autoOpenModal]);
  const [deleteTarget, setDeleteTarget] = useState<QuickMemo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getToday());
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'전체' | QuickMemoCategory>('전체');
  const [severityFilter, setSeverityFilter] = useState<'전체' | QuickMemoSeverity>('전체');

  const isSupabaseConfigured = hasSupabase;

  const loadMemos = async () => {
  if (!project) return;

  setLoading(true);

  try {
    /**
     * 핵심 1:
     * localStorage 데이터를 먼저 읽습니다.
     */
    const key = getLocalStorageKey(project.id);
    const saved = localStorage.getItem(key);
    const localMemos: QuickMemo[] = saved ? JSON.parse(saved) : [];

    let serverMemos: QuickMemo[] = [];

    /**
     * 핵심 2:
     * Supabase 함수가 있으면 추가로 가져옵니다.
     * 실패해도 localStorage 데이터는 유지합니다.
     */
    const service = supabaseService as any;

    if (isSupabaseConfigured && typeof service.getQuickMemos === 'function') {
      try {
        const data = await service.getQuickMemos(project.id);
        serverMemos = (data || []) as QuickMemo[];
      } catch (serverError) {
        console.warn(
          'Supabase 퀵 메모 불러오기 실패. localStorage 데이터를 사용합니다.',
          serverError
        );
      }
    }

    /**
     * 핵심 3:
     * localStorage + Supabase 데이터를 합칩니다.
     * 같은 id가 있으면 Supabase 데이터를 우선합니다.
     */
    const mergedMap = new Map<string, QuickMemo>();

    localMemos.forEach((memo) => {
  mergedMap.set(memo.id, memo);
});

serverMemos.forEach((serverMemo) => {
  const localMemo = mergedMap.get(serverMemo.id);

  const serverPhotos = Array.isArray(serverMemo.photos)
    ? serverMemo.photos
    : [];

  const localPhotos = Array.isArray(localMemo?.photos)
    ? localMemo.photos
    : [];

  mergedMap.set(serverMemo.id, {
    ...localMemo,
    ...serverMemo,

    /**
     * Supabase에 사진이 있으면 Supabase 사진 사용.
     * Supabase 사진이 비어 있고 localStorage에 사진이 있으면 localStorage 사진 보존.
     */
    photos: serverPhotos.length > 0 ? serverPhotos : localPhotos,
  });
});

    const mergedMemos = Array.from(mergedMap.values()).sort((a, b) => {
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    setMemos(mergedMemos);
  } catch (error) {
    console.error('Quick memo load failed:', error);

    try {
      const saved = localStorage.getItem(getLocalStorageKey(project.id));
      setMemos(saved ? JSON.parse(saved) : []);
    } catch {
      setMemos([]);
    }
  } finally {
    setLoading(false);
  }
  };

  useEffect(() => {
    loadMemos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const saveMemoRecord = async (memo: QuickMemo) => {
    if (!project) return;

    const service = supabaseService as any;

    if (isSupabaseConfigured && typeof service.saveQuickMemo === 'function') {
      await service.saveQuickMemo(memo);
    } else {
      const key = getLocalStorageKey(project.id);
      const saved = localStorage.getItem(key);
      const list: QuickMemo[] = saved ? JSON.parse(saved) : [];

      const index = list.findIndex((item) => item.id === memo.id);

      if (index >= 0) {
        list[index] = memo;
      } else {
        list.unshift(memo);
      }

      localStorage.setItem(key, JSON.stringify(list));
    }
  };

  const deleteMemoRecord = async () => {
  if (!project || !deleteTarget) return;

  const memoId = deleteTarget.id;
  const previousMemos = memos;

  setIsDeleting(true);

  let previousLocalValue: string | null = null;

  try {
    /**
     * 1. 화면에서 먼저 삭제
     */
    setMemos((prev) => prev.filter((item) => item.id !== memoId));

    /**
     * 2. localStorage에서도 삭제
     */
    const key = getLocalStorageKey(project.id);
    previousLocalValue = localStorage.getItem(key);

    const saved = localStorage.getItem(key);
    const list: QuickMemo[] = saved ? JSON.parse(saved) : [];

    const nextList = list.filter((item) => item.id !== memoId);
    localStorage.setItem(key, JSON.stringify(nextList));

    /**
     * 3. Supabase에서도 삭제
     */
    const service = supabaseService as any;

    if (isSupabaseConfigured && typeof service.deleteQuickMemo === 'function') {
      await service.deleteQuickMemo(memoId);
    } else {
      console.warn(
        'deleteQuickMemo 함수가 없어 Supabase 삭제는 실행되지 않았습니다. localStorage와 화면에서만 삭제되었습니다.'
      );
    }

    setDeleteTarget(null);
    alert('퀵 메모가 삭제되었습니다.');
  } catch (error: any) {
    console.error('Quick memo delete failed:', error);

    /**
     * 실패 시 화면과 localStorage 복구
     */
    setMemos(previousMemos);

    const key = getLocalStorageKey(project.id);

    if (previousLocalValue === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, previousLocalValue);
    }

    alert(`삭제 실패: ${error?.message || '알 수 없는 오류'}`);
  } finally {
    setIsDeleting(false);
  }
  };

  const handleStatusChange = async (
    memo: QuickMemo,
    nextStatus: QuickMemoStatus
  ) => {
    const updated: QuickMemo = {
      ...memo,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveMemoRecord(updated);

      setMemos((prev) =>
        prev.map((item) => (item.id === memo.id ? updated : item))
      );
    } catch (error: any) {
      console.error(error);
      alert(`상태 변경 실패: ${error?.message || '알 수 없는 오류'}`);
    }
  };

  const handleMemoSaved = (memo: QuickMemo) => {
  /**
   * 핵심 1:
   * 저장한 메모 날짜로 자동 이동합니다.
   * 다른 날짜를 보고 있어도 방금 저장한 메모가 바로 보입니다.
   */
  setSelectedDate(memo.date);

  /**
   * 핵심 2:
   * 부모 화면에서도 localStorage에 한 번 더 저장합니다.
   * Modal 저장이 실패하거나 누락되어도 여기서 보강됩니다.
   */
  if (project) {
    try {
      const key = getLocalStorageKey(project.id);
      const saved = localStorage.getItem(key);
      const list: QuickMemo[] = saved ? JSON.parse(saved) : [];

      const exists = list.some((item) => item.id === memo.id);

      const nextList = exists
        ? list.map((item) => (item.id === memo.id ? memo : item))
        : [memo, ...list];

      localStorage.setItem(key, JSON.stringify(nextList));
    } catch (error) {
      console.warn('Quick memo localStorage 저장 보강 실패:', error);
    }
  }

  /**
   * 핵심 3:
   * 화면 리스트에 즉시 반영합니다.
   */
  setMemos((prev) => {
    const exists = prev.some((item) => item.id === memo.id);

    if (exists) {
      return prev.map((item) => (item.id === memo.id ? memo : item));
    }

    return [memo, ...prev];
  });
  };

  const filteredMemos = useMemo(() => {
    const q = query.trim().toLowerCase();

    return memos
      .filter((memo) => memo.date === selectedDate)
      .filter((memo) => categoryFilter === '전체' || memo.category === categoryFilter)
      .filter((memo) => severityFilter === '전체' || memo.severity === severityFilter)
      .filter((memo) => {
        if (!q) return true;

        const target = [
          memo.rawText,
          memo.aiTitle,
          memo.aiSummary,
          memo.location,
          memo.recommendedAction,
          memo.designFeedback,
          memo.dailyIssueText,
          memo.category,
          memo.severity,
          memo.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return target.includes(q);
      })
      .sort((a, b) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
  }, [memos, selectedDate, categoryFilter, severityFilter, query]);

  const selectedDateStats = useMemo(() => {
    const targetMemos = memos.filter((memo) => memo.date === selectedDate);

    return {
      total: targetMemos.length,
      safety: targetMemos.filter((memo) => memo.category === '안전').length,
      quality: targetMemos.filter((memo) => memo.category === '품질').length,
      high: targetMemos.filter(
        (memo) => memo.severity === '높음' || memo.severity === '긴급'
      ).length,
      open: targetMemos.filter((memo) => memo.status === 'open').length,
    };
  }, [memos, selectedDate]);

  if (!project) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center max-w-md">
          <FileText size={40} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            프로젝트를 먼저 선택해 주세요.
          </h2>
          <p className="text-sm text-gray-500">
            AI 퀵 메모는 프로젝트별로 저장됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <div className="p-2 md:p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Sparkles size={20} className="text-blue-600" />
                </div>

                <div>
                  <h1 className="text-md md:text-md font-bold text-gray-900">
                    AI 퀵 메모
                  </h1>
                  <p className="text-xs text-gray-500 hidden md:block">
                    현장 이슈를 사진, 음성, 텍스트로 빠르게 기록합니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadMemos}
                disabled={loading}
                className="h-10 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hidden md:flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                새로고침
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white hidden md:flex items-center gap-2 text-sm font-bold shadow-sm"
              >
                <Plus size={18} />
                퀵 메모
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden lg:grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-gray-500">선택일 전체</p>
              <p className="text-xl font-bold text-gray-900">
                {selectedDateStats.total}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-red-500">안전</p>
              <p className="text-xl font-bold text-red-700">
                {selectedDateStats.safety}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-orange-500">품질</p>
              <p className="text-xl font-bold text-orange-700">
                {selectedDateStats.quality}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-yellow-600">높음/긴급</p>
              <p className="text-xl font-bold text-yellow-700">
                {selectedDateStats.high}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-blue-500">미조치</p>
              <p className="text-xl font-bold text-blue-700">
                {selectedDateStats.open}
              </p>
            </div>
          </div>

            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-12 gap-3 mt-2">
              <div className="col-span-1 md:col-span-3">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  날짜
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  검색
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="검색어 입력"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="hidden md:block col-span-3">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  구분
                </label>
                <div className="relative">
                  <Filter
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="전체">전체</option>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="hidden md:block col-span-3">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  위험도
                </label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="전체">전체</option>
                  {SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>
            </div>
        </div>

        {/* List */}
        <div className="space-y-3 pb-24 md:pb-0">
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">
              <Loader2
                size={24}
                className="animate-spin mx-auto mb-3 text-blue-500"
              />
              퀵 메모를 불러오는 중입니다.
            </div>
          ) : filteredMemos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <FileText size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="font-bold text-gray-800">
                선택한 날짜에 기록된 퀵 메모가 없습니다.
              </p>
              <p className="text-sm text-gray-500 mt-1">
                현장에서 발생한 안전, 품질, 설계, 공정 이슈를 빠르게 기록해 보세요.
              </p>

              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-5 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-2 text-sm font-bold"
              >
                <Plus size={18} />
                첫 퀵 메모 작성
              </button>
            </div>
          ) : (
            filteredMemos.map((memo) => (
              <QuickMemoCard 
                key={memo.id}
                memo={memo}
                onStatusChange={handleStatusChange}
                onDelete={setDeleteTarget}
              />
            ))
          )}
        </div>

        {/* Notice */}
        <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 flex gap-2">
          <AlertTriangle
            size={18}
            className="text-yellow-600 shrink-0 mt-0.5"
          />
          <p className="text-xs text-yellow-800 leading-relaxed">
            퀵 메모는 현장 기록을 빠르게 남기기 위한 기능입니다. 안전 관련 내용은
            AI 정리 결과와 별개로 담당자가 즉시 확인하고 조치해야 합니다.
          </p>
        </div>
      </div>
    </div>


{/* Delete Confirm Modal */}
{deleteTarget && (
  <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 size={20} className="text-red-600" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900">
              퀵 메모 삭제
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              이 퀵 메모를 삭제하시겠습니까?
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-xs font-bold text-gray-500 mb-1">
            삭제할 메모
          </p>
          <p className="text-sm font-bold text-gray-900 line-clamp-2">
            {deleteTarget.aiTitle}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {deleteTarget.date} · {deleteTarget.category} · {deleteTarget.severity}
          </p>
        </div>

        <p className="text-xs text-red-600 leading-relaxed">
          삭제하면 퀵 메모 목록에서 제거됩니다. Supabase 삭제 함수가 연결되어 있으면 서버에서도 함께 삭제됩니다.
        </p>
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setDeleteTarget(null)}
          disabled={isDeleting}
          className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-bold disabled:opacity-50"
        >
          취소
        </button>

        <button
          type="button"
          onClick={deleteMemoRecord}
          disabled={isDeleting}
          className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
          {isDeleting ? '삭제 중...' : '삭제'}
        </button>
      </div>
    </div>
  </div>
)}

      {/* Separate Modal Component */}
      <QuickMemoModal
        isOpen={isModalOpen}
        project={project}
        currentUser={currentUser}
        initialDate={selectedDate}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleMemoSaved}
      />
    </div>
  );
}

export default QuickMemoView;