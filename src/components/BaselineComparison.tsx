import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ScheduleItem, Category, AppSettings, BaselineRevision } from '../types';
import { 
  format, 
  differenceInDays, 
  addDays, 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  eachWeekOfInterval, 
  eachMonthOfInterval, 
  endOfWeek, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameWeek, 
  isSameMonth 
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  ChevronDown, 
  ChevronRight, 
  ArrowLeftRight, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  ArrowRight,
  TrendingUp,
  History,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BaselineComparisonProps {
  items: ScheduleItem[];
  baselineRevisions?: BaselineRevision[];
  baselineItems?: ScheduleItem[];
  zoom: 'day' | 'week' | 'month';
  categories: Category[];
  settings: AppSettings;
  onCreateInitialBaseline?: () => void;
  onGoToBaselineTab?: () => void;
}

const BaselineComparison: React.FC<BaselineComparisonProps> = ({ 
  items, 
  baselineRevisions = [], 
  baselineItems = [], 
  zoom, 
  categories, 
  settings,
  onCreateInitialBaseline,
  onGoToBaselineTab
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 차수 정렬 (오름차순)
  const sortedRevisions = useMemo(() => {
    return [...baselineRevisions].sort((a, b) => a.round - b.round);
  }, [baselineRevisions]);

  const initialRevision = useMemo(() => {
    if (sortedRevisions.length === 0) return null;
    return sortedRevisions.find(r => r.round === 0) || sortedRevisions[0];
  }, [sortedRevisions]);

  const latestRevision = useMemo(() => {
    if (sortedRevisions.length === 0) return null;
    return sortedRevisions[sortedRevisions.length - 1];
  }, [sortedRevisions]);

  // 현재 비교 대상 차수 ID (기본값: 최초 계획 우선, 없으면 최종 차수)
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(() => {
    return initialRevision?.id || latestRevision?.id || null;
  });

  // 차수 목록 변경 시 유효한 ID 유지
  useEffect(() => {
    if (selectedRevisionId) {
      const exists = sortedRevisions.some(r => r.id === selectedRevisionId);
      if (!exists) {
        setSelectedRevisionId(initialRevision?.id || latestRevision?.id || null);
      }
    } else if (sortedRevisions.length > 0) {
      setSelectedRevisionId(initialRevision?.id || latestRevision?.id || null);
    }
  }, [sortedRevisions, selectedRevisionId, initialRevision, latestRevision]);

  // 현재 선택된 Baseline 차수 객체
  const activeRevision = useMemo(() => {
    if (selectedRevisionId) {
      return sortedRevisions.find(r => r.id === selectedRevisionId) || null;
    }
    return initialRevision || latestRevision || null;
  }, [selectedRevisionId, sortedRevisions, initialRevision, latestRevision]);

  // 비교에 사용할 Baseline 공정 아이템들
  const activeBaselineItems = useMemo(() => {
    if (activeRevision) {
      return activeRevision.items || [];
    }
    return baselineItems || [];
  }, [activeRevision, baselineItems]);

  const isComparingInitial = activeRevision && initialRevision && activeRevision.id === initialRevision.id;
  const isComparingLatest = activeRevision && latestRevision && activeRevision.id === latestRevision.id;
  const hasMultipleRevisions = sortedRevisions.length > 1;

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: prev[category] === false ? true : false
    }));
  };

  // 전체 날짜 범위 계산 (Baseline + Actual)
  const { startDate, endDate, days } = useMemo(() => {
    const allItems = [...items, ...activeBaselineItems];
    if (allItems.length === 0) {
      const today = startOfDay(new Date());
      return { startDate: today, endDate: addDays(today, 30), days: 30 };
    }

    let minDate = new Date(allItems[0].startDate);
    let maxDate = new Date(allItems[0].endDate);

    allItems.forEach(item => {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
    });

    if (zoom === 'day') {
      minDate = addDays(startOfDay(minDate), -7);
      maxDate = addDays(startOfDay(maxDate), 14);
    } else if (zoom === 'week') {
      minDate = startOfWeek(addDays(minDate, -14));
      maxDate = endOfWeek(addDays(maxDate, 28));
    } else {
      minDate = startOfMonth(addDays(minDate, -30));
      maxDate = endOfMonth(addDays(maxDate, 60));
    }

    return { 
      startDate: minDate, 
      endDate: maxDate, 
      days: differenceInDays(maxDate, minDate) + 1 
    };
  }, [items, activeBaselineItems, zoom]);

  const columnWidth = useMemo(() => {
    switch (zoom) {
      case 'day': return 40;
      case 'week': return 120;
      case 'month': return 200;
      default: return 40;
    }
  }, [zoom]);

  const headerInterval = useMemo(() => {
    if (zoom === 'day') {
      return eachDayOfInterval({ start: startDate, end: endDate }).map(date => ({
        date,
        label: format(date, 'MM/dd'),
        subLabel: format(date, 'eee', { locale: ko }),
        width: columnWidth
      }));
    } else if (zoom === 'week') {
      return eachWeekOfInterval({ start: startDate, end: endDate }).map(date => ({
        date,
        label: format(date, 'MM월'),
        subLabel: `${format(date, 'w')}주차`,
        width: columnWidth
      }));
    } else {
      return eachMonthOfInterval({ start: startDate, end: endDate }).map(date => ({
        date,
        label: format(date, 'yyyy년'),
        subLabel: format(date, 'MM월'),
        width: columnWidth
      }));
    }
  }, [startDate, endDate, zoom, columnWidth]);

  const getTaskPosition = (start: Date, end: Date) => {
    let left = 0;
    let width = 0;

    if (zoom === 'day') {
      left = differenceInDays(start, startDate) * columnWidth;
      width = (differenceInDays(end, start) + 1) * columnWidth;
    } else if (zoom === 'week') {
      left = differenceInDays(start, startDate) * (columnWidth / 7);
      width = (differenceInDays(end, start) + 1) * (columnWidth / 7);
    } else {
      left = differenceInDays(start, startDate) * (columnWidth / 30);
      width = (differenceInDays(end, start) + 1) * (columnWidth / 30);
    }

    return { left, width };
  };

  // Auto-scroll to today
  useEffect(() => {
    if (!scrollContainerRef.current || headerInterval.length === 0) return;

    const today = new Date();
    let targetIndex = -1;

    if (zoom === 'day') {
      const yesterday = addDays(today, -3);
      targetIndex = headerInterval.findIndex(h => isSameDay(h.date, yesterday));
    } else if (zoom === 'week') {
      targetIndex = headerInterval.findIndex(h => isSameWeek(h.date, today, { weekStartsOn: 0 }));
    } else if (zoom === 'month') {
      targetIndex = headerInterval.findIndex(h => isSameMonth(h.date, today));
    }

    if (targetIndex !== -1) {
      const scrollPosition = targetIndex * columnWidth;
      
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            left: scrollPosition,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [zoom, headerInterval, columnWidth]);

  // Aggregate data by category and subCategory for comparison
  const aggregatedData = useMemo(() => {
    const data: Record<string, Record<string, { baselineItems: ScheduleItem[], actualItems: ScheduleItem[] }>> = {};

    activeBaselineItems.forEach(item => {
      if (!data[item.category]) data[item.category] = {};
      if (!data[item.category][item.subCategory]) data[item.category][item.subCategory] = { baselineItems: [], actualItems: [] };
      data[item.category][item.subCategory].baselineItems.push(item);
    });

    items.forEach(item => {
      if (!data[item.category]) data[item.category] = {};
      if (!data[item.category][item.subCategory]) data[item.category][item.subCategory] = { baselineItems: [], actualItems: [] };
      data[item.category][item.subCategory].actualItems.push(item);
    });

    return categories
      .map(category => {
        const subCats = data[category];
        if (!subCats) return null;

        const subCategoryList = Object.entries(subCats).map(([subCategory, catItems]) => {
          const bStart = catItems.baselineItems.length > 0 ? new Date(Math.min(...catItems.baselineItems.map(i => new Date(i.startDate).getTime()))) : null;
          const bEnd = catItems.baselineItems.length > 0 ? new Date(Math.max(...catItems.baselineItems.map(i => new Date(i.endDate).getTime()))) : null;
          const aStart = catItems.actualItems.length > 0 ? new Date(Math.min(...catItems.actualItems.map(i => new Date(i.startDate).getTime()))) : null;
          const aEnd = catItems.actualItems.length > 0 ? new Date(Math.max(...catItems.actualItems.map(i => new Date(i.endDate).getTime()))) : null;
          const aProgress = catItems.actualItems.length > 0 ? catItems.actualItems.reduce((acc, i) => acc + i.progress, 0) / catItems.actualItems.length : 0;

          const isDelayed = bEnd && aEnd ? aEnd > bEnd : false;
          const delayDays = bEnd && aEnd && isDelayed ? differenceInDays(aEnd, bEnd) : 0;

          return {
            name: subCategory,
            baseline: bStart && bEnd ? { start: bStart, end: bEnd } : null,
            actual: aStart && aEnd ? { start: aStart, end: aEnd, progress: aProgress } : null,
            isDelayed,
            delayDays
          };
        });

        // Category level summary
        const catBItems = subCategoryList.filter(s => s.baseline).map(s => s.baseline!);
        const catAItems = subCategoryList.filter(s => s.actual).map(s => s.actual!);

        const catBStart = catBItems.length > 0 ? new Date(Math.min(...catBItems.map(b => b.start.getTime()))) : null;
        const catBEnd = catBItems.length > 0 ? new Date(Math.max(...catBItems.map(b => b.end.getTime()))) : null;
        const catAStart = catAItems.length > 0 ? new Date(Math.min(...catAItems.map(a => a.start.getTime()))) : null;
        const catAEnd = catAItems.length > 0 ? new Date(Math.max(...catAItems.map(a => a.end.getTime()))) : null;
        const catAProgress = subCategoryList.length > 0 ? subCategoryList.reduce((acc, s) => acc + (s.actual?.progress || 0), 0) / subCategoryList.length : 0;

        const isCatDelayed = catBEnd && catAEnd ? catAEnd > catBEnd : false;
        const catDelayDays = catBEnd && catAEnd && isCatDelayed ? differenceInDays(catAEnd, catBEnd) : 0;

        return {
          category: category as Category,
          baseline: catBStart && catBEnd ? { start: catBStart, end: catBEnd } : null,
          actual: catAStart && catAEnd ? { start: catAStart, end: catAEnd, progress: catAProgress } : null,
          isDelayed: isCatDelayed,
          delayDays: catDelayDays,
          subCategories: subCategoryList
        };
      })
      .filter((group): group is NonNullable<typeof group> => group !== null);
  }, [items, activeBaselineItems, categories]);

  // Overall comparison statistics
  const stats = useMemo(() => {
    let delayedSubCats = 0;
    let onTimeSubCats = 0;
    let totalSubCats = 0;

    aggregatedData.forEach(cat => {
      cat.subCategories.forEach(sub => {
        totalSubCats++;
        if (sub.isDelayed) delayedSubCats++;
        else onTimeSubCats++;
      });
    });

    // 전체 준공일 비교
    let baseOverallEnd: Date | null = null;
    let actOverallEnd: Date | null = null;

    if (activeBaselineItems.length > 0) {
      baseOverallEnd = new Date(Math.max(...activeBaselineItems.map(i => new Date(i.endDate).getTime())));
    }
    if (items.length > 0) {
      actOverallEnd = new Date(Math.max(...items.map(i => new Date(i.endDate).getTime())));
    }

    let overallDelayDays = 0;
    if (baseOverallEnd && actOverallEnd) {
      overallDelayDays = differenceInDays(actOverallEnd, baseOverallEnd);
    }

    const avgActualProgress = items.length > 0
      ? Math.round(items.reduce((acc, i) => acc + (i.progress || 0), 0) / items.length)
      : 0;

    return {
      totalSubCats,
      delayedSubCats,
      onTimeSubCats,
      baseOverallEnd,
      actOverallEnd,
      overallDelayDays,
      avgActualProgress
    };
  }, [aggregatedData, activeBaselineItems, items]);

  const renderTodayLine = () => {
    const today = startOfDay(new Date());
    if (today < startDate || today > endDate) return null;

    let todayLeft = 0;
    if (zoom === 'day') {
      todayLeft += differenceInDays(today, startDate) * columnWidth + (columnWidth / 2);
    } else if (zoom === 'week') {
      const startOfW = startOfWeek(today);
      const weekIndex = Math.floor(differenceInDays(startOfW, startOfWeek(startDate)) / 7);
      const dayInWeek = differenceInDays(today, startOfW);
      todayLeft += (weekIndex * columnWidth) + (dayInWeek * (columnWidth / 7));
    } else {
      const startOfM = startOfMonth(today);
      const monthIndex = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
      const dayInMonth = today.getDate() - 1;
      todayLeft += (monthIndex * columnWidth) + (dayInMonth * (columnWidth / 30));
    }

    return (
      <div 
        className="absolute top-0 bottom-0 w-px bg-blue-500 z-50 pointer-events-none"
        style={{ left: `calc(var(--left-col-width, 300px) + ${todayLeft}px)` }}
      >
        <div className="absolute top-0 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">오늘</div>
      </div>
    );
  };

  return (
    <div className="bg-white border-y xl:border border-gray-200 xl:rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* 1. 상단 컨트롤 및 차수 선택 바 */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border-b border-gray-200 p-3 xl:p-4 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ArrowLeftRight size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm xl:text-base font-extrabold text-gray-900 tracking-tight">
                  계획 vs 실행 공정 비교
                </h3>
                {activeRevision && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    activeRevision.round === 0 
                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    {activeRevision.round === 0 ? '최초 계획 비교 중' : `${activeRevision.round}차 계획 비교 중`}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500">
                원하는 Baseline 차수와 현재 실행 공정을 비교하여 공기 지연 및 변경 현황을 분석합니다.
              </p>
            </div>
          </div>

          {/* 차수 빠른 전환 버튼 및 셀렉터 */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {sortedRevisions.length > 0 ? (
              <>
                {/* 빠른 원클릭 전환: 최초 계획 vs 현재 */}
                {initialRevision && (
                  <button
                    type="button"
                    onClick={() => setSelectedRevisionId(initialRevision.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      isComparingInitial
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    title="최초 기준 계획(0차)과 현재 실행공정을 비교합니다"
                  >
                    <History size={13} className={isComparingInitial ? 'text-blue-100' : 'text-blue-600'} />
                    <span>최초 vs 현재</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isComparingInitial ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
                    }`}>
                      0차
                    </span>
                  </button>
                )}

                {/* 빠른 원클릭 전환: 최종 차수 vs 현재 */}
                {latestRevision && hasMultipleRevisions && (
                  <button
                    type="button"
                    onClick={() => setSelectedRevisionId(latestRevision.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      isComparingLatest
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    title={`최신 변경 기준(${latestRevision.round}차)과 현재 실행공정을 비교합니다`}
                  >
                    <Sparkles size={13} className={isComparingLatest ? 'text-indigo-100' : 'text-indigo-600'} />
                    <span>최종 차수 vs 현재</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isComparingLatest ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {latestRevision.round}차
                    </span>
                  </button>
                )}

                {/* 차수 드롭다운 직접 선택 */}
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 shadow-2xs">
                  <Layers size={13} className="text-gray-400" />
                  <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap hidden sm:inline">비교 차수:</span>
                  <select
                    value={activeRevision?.id || ''}
                    onChange={(e) => setSelectedRevisionId(e.target.value)}
                    className="bg-transparent text-xs font-extrabold text-gray-800 focus:outline-none cursor-pointer pr-1"
                  >
                    {sortedRevisions.map(rev => (
                      <option key={rev.id} value={rev.id}>
                        {rev.round === 0 ? `[0차] 최초 계획 (${rev.createdAt})` : `[${rev.round}차] ${rev.name} (${rev.createdAt})`}
                        {rev.id === latestRevision?.id && sortedRevisions.length > 1 ? ' ★최종' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              onCreateInitialBaseline && (
                <button
                  type="button"
                  onClick={onCreateInitialBaseline}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  <Plus size={14} />
                  <span>최초 Baseline 계획 생성</span>
                </button>
              )
            )}

            {onGoToBaselineTab && (
              <button
                type="button"
                onClick={onGoToBaselineTab}
                className="text-xs font-semibold text-gray-500 hover:text-blue-600 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                title="Baseline 계획 탭으로 이동하여 차수를 추가하거나 편집합니다"
              >
                차수 관리 ➔
              </button>
            )}
          </div>
        </div>

        {/* 2. 비교 요약 KPI 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 xl:gap-3">
          {/* 카드 1: 기준 차수 정보 */}
          <div className="bg-white border border-gray-200/90 rounded-xl p-2.5 xl:p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              비교 기준 계획 (Baseline)
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs xl:text-sm font-extrabold text-blue-700 truncate">
                {activeRevision ? `${activeRevision.name} (${activeRevision.round}차)` : '등록된 기준 없음'}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {activeRevision ? `${activeBaselineItems.length}개 공정` : '-'}
              </span>
            </div>
            {activeRevision?.createdAt && (
              <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                <Calendar size={10} />
                <span>기준일: {activeRevision.createdAt}</span>
              </div>
            )}
          </div>

          {/* 카드 2: 현재 실행 현황 */}
          <div className="bg-white border border-gray-200/90 rounded-xl p-2.5 xl:p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              현재 실행 현황 (Actual)
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs xl:text-sm font-extrabold text-gray-800">
                총 {items.length}개 공정
              </span>
              <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                평균 {stats.avgActualProgress}%
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
              <TrendingUp size={10} />
              <span>진행률 가중 평균</span>
            </div>
          </div>

          {/* 카드 3: 전체 준공일 변동 */}
          <div className="bg-white border border-gray-200/90 rounded-xl p-2.5 xl:p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              전체 준공일 변동 (공기 분석)
            </span>
            <div className="flex items-center gap-1.5">
              {stats.overallDelayDays > 0 ? (
                <div className="flex items-center gap-1 text-rose-600 font-black text-xs xl:text-sm">
                  <AlertTriangle size={13} className="text-rose-500" />
                  <span>+{stats.overallDelayDays}일 지연</span>
                </div>
              ) : stats.overallDelayDays < 0 ? (
                <div className="flex items-center gap-1 text-emerald-600 font-black text-xs xl:text-sm">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>{Math.abs(stats.overallDelayDays)}일 단축</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-blue-600 font-black text-xs xl:text-sm">
                  <CheckCircle2 size={13} className="text-blue-500" />
                  <span>일정 준수 (0일)</span>
                </div>
              )}
            </div>
            <div className="text-[10px] text-gray-400 mt-1 truncate">
              {stats.baseOverallEnd && stats.actOverallEnd ? (
                <span>
                  계획 {format(stats.baseOverallEnd, 'yyyy.MM.dd')} ➔ 실행 {format(stats.actOverallEnd, 'yyyy.MM.dd')}
                </span>
              ) : '-'}
            </div>
          </div>

          {/* 카드 4: 세부공종 지연 현황 & 범례 */}
          <div className="bg-white border border-gray-200/90 rounded-xl p-2.5 xl:p-3 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                세부공종 상태
              </span>
              <span className="text-[10px] text-gray-500 font-bold">
                지연 <span className="text-rose-600 font-black">{stats.delayedSubCats}</span> / 정상 {stats.onTimeSubCats}
              </span>
            </div>
            {/* 미니 범례 */}
            <div className="flex items-center gap-3 pt-1 border-t border-gray-100 text-[10px] text-gray-600">
              <div className="flex items-center gap-1">
                <span className="w-3 h-2 rounded-xs bg-blue-400/60 border border-blue-400/80"></span>
                <span>계획</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-2 rounded-xs bg-blue-600"></span>
                <span>실행</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-1 rounded-full bg-rose-500"></span>
                <span className="text-rose-600 font-bold">지연 구간</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Gantt Comparison Chart Area */}
      {activeBaselineItems.length === 0 && items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
          <Layers size={40} className="text-gray-300 mb-3" />
          <h4 className="text-base font-bold text-gray-700 mb-1">비교할 공정 데이터가 없습니다</h4>
          <p className="text-xs text-gray-500 max-w-sm mb-4">
            먼저 공정표를 등록하거나 Baseline 계획을 생성하여 계획과 실행 간트를 비교해 보세요.
          </p>
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto no-scrollbar max-xl:[--left-col-width:250px] xl:[--left-col-width:300px]"
        >
          <div className="relative" style={{ minWidth: `calc(var(--left-col-width, 300px) + ${headerInterval.length * columnWidth}px)` }}>
            {/* Header */}
            <div className="flex sticky top-0 z-40 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
              <div className="sticky left-0 z-50 w-[250px] xl:w-[300px] flex-shrink-0 bg-gray-50/95 backdrop-blur-sm border-r border-gray-200 p-2 xl:p-3 font-extrabold text-gray-500 text-[10px] uppercase tracking-widest truncate flex items-center justify-between">
                <span>공종 / 세부공종</span>
                <span className="text-[9px] font-normal text-gray-400 hidden xl:inline">상: 계획 / 하: 실행</span>
              </div>
              <div className="flex">
                {headerInterval.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex-shrink-0 border-r border-gray-100 text-center py-2 text-[9px] font-bold text-gray-400"
                    style={{ width: columnWidth }}
                  >
                    <div className="opacity-60">{item.label}</div>
                    <div className="uppercase tracking-tighter text-gray-600">{item.subLabel}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Today Line */}
            {renderTodayLine()}

            {/* Rows */}
            <div className="divide-y divide-gray-100 relative">
              {aggregatedData.map((group) => (
                <React.Fragment key={group.category}>
                  {/* Category Header */}
                  <div className="flex border-b border-gray-100 group/cat">
                    <div 
                      className="sticky left-0 z-30 w-[250px] xl:w-[300px] flex-shrink-0 border-r border-gray-100 py-1 px-1.5 xl:p-1.5 flex items-center gap-2 bg-slate-50/95 backdrop-blur-sm cursor-pointer hover:bg-slate-100 transition-colors overflow-hidden"
                      onClick={() => toggleCategory(group.category)}
                    >
                      {expandedCategories[group.category] !== false ? (
                        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
                      )}
                      <span className="text-[11px] xl:text-xs font-extrabold text-slate-800 truncate">{group.category}</span>
                      <span className="text-[10px] text-slate-400 font-medium flex-shrink-0 hidden xl:inline-block">({group.subCategories.length})</span>
                      {group.isDelayed && (
                        <span className="ml-auto mr-2 text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                          +{group.delayDays}일
                        </span>
                      )}
                    </div>
                    
                    <div className="relative flex-1 h-5 xl:h-8 bg-slate-50/80 group-hover/cat:bg-slate-100 transition-colors">
                      {/* Category Summary Bars */}
                      {group.baseline && (
                        <div 
                          className="absolute top-[3px] xl:top-[6px] h-[4px] xl:h-[8px] rounded-xs z-0 opacity-50"
                          style={{ 
                            left: getTaskPosition(group.baseline.start, group.baseline.end).left, 
                            width: getTaskPosition(group.baseline.start, group.baseline.end).width,
                            backgroundColor: settings.categoryColors[group.category] || '#3b82f6'
                          }}
                          title={`[${group.category} 기준 계획] ${format(group.baseline.start, 'yyyy-MM-dd')} ~ ${format(group.baseline.end, 'yyyy-MM-dd')}`}
                        />
                      )}
                      {group.actual && (
                        <div 
                          className="absolute top-[8px] xl:top-[16px] h-[4px] xl:h-[8px] rounded-xs shadow-2xs z-10 opacity-85"
                          style={{ 
                            left: getTaskPosition(group.actual.start, group.actual.end).left, 
                            width: getTaskPosition(group.actual.start, group.actual.end).width,
                            backgroundColor: settings.categoryColors[group.category] || '#3b82f6'
                          }}
                          title={`[${group.category} 현재 실행] ${format(group.actual.start, 'yyyy-MM-dd')} ~ ${format(group.actual.end, 'yyyy-MM-dd')}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* SubCategory Rows */}
                  {expandedCategories[group.category] !== false && (
                    <div className="flex flex-col">
                      {group.subCategories.map((sub, idx) => {
                        const bPos = sub.baseline ? getTaskPosition(sub.baseline.start, sub.baseline.end) : { left: 0, width: 0 };
                        const aPos = sub.actual ? getTaskPosition(sub.actual.start, sub.actual.end) : { left: 0, width: 0 };

                        return (
                          <div key={idx} className="flex hover:bg-gray-50/50 group transition-colors border-b border-gray-50 last:border-b-0">
                            <div className="w-[250px] xl:w-[300px] flex-shrink-0 border-r border-gray-100 py-1.5 px-2 xl:p-2 sticky left-0 z-30 bg-white group-hover:bg-gray-50/50 transition-colors pl-4 xl:pl-7 overflow-hidden flex items-center justify-between">
                              <span className="text-[10px] xl:text-xs font-bold text-gray-700 truncate">{sub.name}</span>
                              {sub.isDelayed && (
                                <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200/80 px-1 py-0.2 rounded shrink-0 ml-1">
                                  +{sub.delayDays}일
                                </span>
                              )}
                            </div>
                            
                            <div className="relative flex-1 h-7 xl:h-10 group-hover:bg-gray-50/50 transition-colors">
                              {/* Grid Lines */}
                              <div className="absolute inset-0 flex pointer-events-none">
                                {headerInterval.map((h, i) => (
                                  <div 
                                    key={i} 
                                    className="flex-shrink-0 border-r border-gray-50/50 h-full"
                                    style={{ width: h.width }}
                                  />
                                ))}
                              </div>

                              {/* 1. Baseline Bar (상단 바: 반투명 기준선) */}
                              {sub.baseline && (
                                <div 
                                  className="absolute top-[3px] xl:top-[5px] h-[5px] xl:h-[7px] rounded-full z-0 transition-all border border-black/10 flex items-center overflow-hidden"
                                  style={{ 
                                    left: bPos.left, 
                                    width: bPos.width,
                                    backgroundColor: settings.categoryColors[group.category] || '#3b82f6',
                                    opacity: 0.45
                                  }}
                                  title={`[${activeRevision?.name || '기준 계획'}] ${sub.name}: ${format(sub.baseline.start, 'yyyy-MM-dd')} ~ ${format(sub.baseline.end, 'yyyy-MM-dd')}`}
                                />
                              )}
                              
                              {/* 2. Actual Bar (하단 바: 솔리드 색상 + 진행률 오버레이) */}
                              {sub.actual && (
                                <div 
                                  className="absolute top-[11px] xl:top-[16px] h-[6px] xl:h-[8px] rounded-full shadow-2xs z-10 flex items-center overflow-hidden transition-all"
                                  style={{ 
                                    left: aPos.left, 
                                    width: aPos.width,
                                    backgroundColor: settings.categoryColors[group.category] || '#3b82f6'
                                  }}
                                  title={`[현재 실행] ${sub.name}: ${format(sub.actual.start, 'yyyy-MM-dd')} ~ ${format(sub.actual.end, 'yyyy-MM-dd')} (진척률 ${Math.round(sub.actual.progress)}%)`}
                                >
                                  {/* Progress Fill */}
                                  <div 
                                    className="h-full bg-black/15 transition-all"
                                    style={{ width: `${sub.actual.progress}%` }}
                                  />
                                </div>
                              )}

                              {/* 3. Delay Indicator Line (계획 대비 지연 구간 빨간선) */}
                              {sub.baseline && sub.actual && sub.actual.end > sub.baseline.end && (
                                <div 
                                  className="absolute bottom-1 xl:bottom-1.5 h-[2px] xl:h-[3px] bg-rose-500 rounded-full z-20 shadow-xs flex items-center"
                                  style={{ 
                                    left: bPos.left + bPos.width, 
                                    width: Math.max(2, getTaskPosition(sub.baseline.end, sub.actual.end).width - (zoom === 'day' ? columnWidth : zoom === 'week' ? columnWidth/7 : columnWidth/30))
                                  }}
                                  title={`지연 기간: +${sub.delayDays}일`}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaselineComparison;
