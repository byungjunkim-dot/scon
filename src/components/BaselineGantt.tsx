import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  format, 
  addDays, 
  differenceInDays, 
  startOfDay, 
  isWeekend, 
  eachDayOfInterval,
  startOfWeek,
  startOfMonth,
  eachWeekOfInterval,
  eachMonthOfInterval,
  endOfWeek,
  endOfMonth,
  isSameDay,
  isSameWeek,
  isSameMonth
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ScheduleItem, Category, AppSettings, BaselineRevision } from '../types';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Trash2, 
  GripVertical, 
  Layers, 
  Calendar, 
  Edit3, 
  Copy, 
  RefreshCw, 
  Sparkles, 
  History, 
  FileText,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmModal } from './ConfirmModal';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface BaselineGanttProps {
  revisions?: BaselineRevision[];
  activeRevisionId?: string | null;
  onSelectRevision?: (revisionId: string) => void;
  onCreateRevision?: (data: {
    round: number;
    name: string;
    description?: string;
    source: 'actual' | 'previous' | 'empty';
    sourceRevisionId?: string;
  }) => void;
  onUpdateRevision?: (revision: BaselineRevision) => void;
  onDeleteRevision?: (revisionId: string) => void;
  onSyncFromActual?: (revisionId: string) => void;
  items: ScheduleItem[];
  onAdd: (item: Omit<ScheduleItem, 'id' | 'projectId'>) => void;
  onUpdate: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  onReorder: (items: ScheduleItem[]) => void;
  settings: AppSettings;
  zoom: 'day' | 'week' | 'month';
  actualItems?: ScheduleItem[];
}

interface SortableRowProps {
  item: ScheduleItem;
  startDate: Date;
  columnWidth: number;
  headerInterval: any[];
  onDeleteClick: (id: string) => void;
  onSelect: (item: ScheduleItem) => void;
  zoom: 'day' | 'week' | 'month';
  settings: AppSettings;
}

const SortableRow: React.FC<SortableRowProps> = ({ 
  item, startDate, columnWidth, headerInterval, onDeleteClick, onSelect, zoom, settings 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1
  };

  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  
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

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex h-8 xl:h-8 border-b border-gray-100 last:border-0 group hover:bg-gray-50/60 transition-colors bg-white"
    >
      <div 
        onClick={() => onSelect(item)}
        className="sticky left-0 z-30 w-[250px] xl:w-[300px] flex-shrink-0 bg-white border-r border-gray-100 px-1.5 xl:px-2.5 flex items-center gap-1 group-hover:bg-gray-50/60 transition-colors cursor-pointer"
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(item.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all flex-shrink-0"
          title="삭제"
        >
          <Trash2 size={11} />
        </button>
        <div 
          {...attributes} 
          {...listeners} 
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 mr-0.5 xl:mr-1"
        >
          <GripVertical size={12} />
        </div>
        <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[10px] xl:text-[11px] leading-tight text-gray-800 truncate">
              <span className="font-bold">{item.subCategory}</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-normal text-gray-600">{item.taskName}</span>
            </span>
          </div>
          {([
            Array.isArray(item.dongBlock) ? item.dongBlock.join(', ') : item.dongBlock,
            Array.isArray(item.floor) ? item.floor.join(', ') : item.floor,
            Array.isArray(item.zone) ? item.zone.join(', ') : item.zone
          ].filter(Boolean).length > 0) && (
            <div className="text-gray-400 font-medium truncate text-[8px] leading-tight">
              {[
                Array.isArray(item.dongBlock) ? item.dongBlock.join(', ') : item.dongBlock,
                Array.isArray(item.floor) ? item.floor.join(', ') : item.floor,
                Array.isArray(item.zone) ? item.zone.join(', ') : item.zone
              ].filter(Boolean).join(' / ')}
            </div>
          )}
        </div>
      </div>

      <div 
        onClick={() => onSelect(item)}
        className="relative flex-1 cursor-pointer"
      >
        <div className="absolute inset-0 flex pointer-events-none">
          {headerInterval.map((h, i) => (
            <div 
              key={i} 
              className={`flex-shrink-0 border-r border-gray-50/50 h-full ${h.isWeekend ? 'bg-gray-50/30' : ''}`}
              style={{ width: h.width }}
            />
          ))}
        </div>

        {/* Compact Bar (간트차트와 동일한 콤팩트 바 형태) */}
        <motion.div 
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          className="absolute top-1/2 -translate-y-1/2 h-3 xl:h-3.5 rounded-full shadow-xs opacity-90 hover:opacity-100 transition-all flex items-center px-1 overflow-hidden hover:brightness-105 active:scale-[0.98] origin-left border border-black/10 z-10"
          style={{ 
            left, 
            width,
            backgroundColor: settings.categoryColors[item.category] || '#3b82f6'
          }}
        >
          {width > 60 ? (
            <span className="relative z-10 px-1 text-[8px] font-bold text-white truncate drop-shadow-xs leading-none">
              {item.taskName} ({item.duration}일)
            </span>
          ) : width > 32 ? (
            <span className="relative z-10 px-0.5 text-[8px] font-bold text-white truncate drop-shadow-xs leading-none">
              {item.duration}일
            </span>
          ) : null}
        </motion.div>

        {/* 좁은 바에 대한 우측 외부 라벨 */}
        {width <= 32 && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 ml-1 text-[8px] font-bold text-gray-400 whitespace-nowrap z-10 pointer-events-none"
            style={{ left: left + width }}
          >
            {item.duration}일
          </div>
        )}
      </div>
    </div>
  );
};

const BaselineGantt: React.FC<BaselineGanttProps> = ({ 
  revisions = [],
  activeRevisionId,
  onSelectRevision,
  onCreateRevision,
  onUpdateRevision,
  onDeleteRevision,
  onSyncFromActual,
  items, 
  onAdd, 
  onUpdate, 
  onDelete, 
  onReorder, 
  settings, 
  zoom,
  actualItems = []
}) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 차수 생성 모달 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoundNum, setNewRoundNum] = useState<number>(1);
  const [newRoundName, setNewRoundName] = useState<string>('');
  const [newRoundDesc, setNewRoundDesc] = useState<string>('');
  const [newRoundSource, setNewRoundSource] = useState<'actual' | 'previous' | 'empty'>('actual');

  // 차수 수정 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRoundName, setEditRoundName] = useState<string>('');
  const [editRoundDesc, setEditRoundDesc] = useState<string>('');

  // 차수 삭제 확인 모달
  const [isDeleteRevisionModalOpen, setIsDeleteRevisionModalOpen] = useState(false);

  // 실행공정 덮어쓰기 확인 모달
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // 하단 공정 추가 폼 상태
  const [newCategory, setNewCategory] = useState<Category>(settings.categories[0] || '건축');
  const [newSubCategory, setNewSubCategory] = useState<string>('');
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [newStartDate, setNewStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [newEndDate, setNewEndDate] = useState<string>(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 정렬된 차수 목록 (round 오름차순)
  const sortedRevisions = useMemo(() => {
    return [...revisions].sort((a, b) => a.round - b.round);
  }, [revisions]);

  const activeRevision = useMemo(() => {
    if (activeRevisionId) {
      return sortedRevisions.find(r => r.id === activeRevisionId) || null;
    }
    return sortedRevisions.length > 0 ? sortedRevisions[sortedRevisions.length - 1] : null;
  }, [activeRevisionId, sortedRevisions]);

  const highestRound = useMemo(() => {
    if (sortedRevisions.length === 0) return -1;
    return Math.max(...sortedRevisions.map(r => r.round));
  }, [sortedRevisions]);

  // 신규 차수 모달 열기 핸들러
  const handleOpenCreateModal = () => {
    const nextRound = highestRound + 1;
    setNewRoundNum(nextRound);
    setNewRoundName(nextRound === 0 ? '최초 계획' : `${nextRound}차 변경 계획`);
    setNewRoundDesc('');
    setNewRoundSource(actualItems.length > 0 ? 'actual' : sortedRevisions.length > 0 ? 'previous' : 'empty');
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreateRevision = () => {
    if (!onCreateRevision) return;
    onCreateRevision({
      round: newRoundNum,
      name: newRoundName.trim() || `${newRoundNum}차 계획`,
      description: newRoundDesc.trim(),
      source: newRoundSource,
      sourceRevisionId: activeRevision?.id
    });
    setIsCreateModalOpen(false);
  };

  // 차수 수정 모달 열기
  const handleOpenEditModal = () => {
    if (!activeRevision) return;
    setEditRoundName(activeRevision.name);
    setEditRoundDesc(activeRevision.description || '');
    setIsEditModalOpen(true);
  };

  const handleConfirmEditRevision = () => {
    if (!activeRevision || !onUpdateRevision) return;
    onUpdateRevision({
      ...activeRevision,
      name: editRoundName.trim() || activeRevision.name,
      description: editRoundDesc.trim()
    });
    setIsEditModalOpen(false);
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const subCategories = useMemo(() => {
    return settings.taskMaster[newCategory] ? Object.keys(settings.taskMaster[newCategory]) : [];
  }, [newCategory, settings.taskMaster]);

  const taskNames = useMemo(() => {
    return (newSubCategory && settings.taskMaster[newCategory]?.[newSubCategory]) || [];
  }, [newCategory, newSubCategory, settings.taskMaster]);

  useEffect(() => {
    if (subCategories.length > 0 && !subCategories.includes(newSubCategory)) {
      setNewSubCategory(subCategories[0]);
    }
  }, [newCategory, subCategories]);

  useEffect(() => {
    if (taskNames.length > 0 && !taskNames.includes(newTaskName)) {
      setNewTaskName(taskNames[0]);
    }
  }, [newSubCategory, taskNames]);

  const toggleCategory = (category: Category) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleSelect = (item: ScheduleItem) => {
    setEditingId(item.id);
    setNewCategory(item.category);
    setNewSubCategory(item.subCategory);
    setNewTaskName(item.taskName);
    setNewStartDate(item.startDate);
    setNewEndDate(item.endDate);
  };

  const handleClear = () => {
    setEditingId(null);
    setNewCategory(settings.categories[0] || '건축');
    setNewSubCategory('');
    setNewTaskName('');
    setNewStartDate(format(new Date(), 'yyyy-MM-dd'));
    setNewEndDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  };

  const { startDate, endDate, days } = useMemo(() => {
    if (items.length === 0) {
      const today = startOfDay(new Date());
      return { startDate: today, endDate: addDays(today, 30), days: 30 };
    }

    let minDate = new Date(items[0].startDate);
    let maxDate = new Date(items[0].endDate);

    items.forEach(item => {
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
  }, [items, zoom]);

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
        isWeekend: isWeekend(date),
        width: columnWidth
      }));
    } else if (zoom === 'week') {
      return eachWeekOfInterval({ start: startDate, end: endDate }).map(date => ({
        date,
        label: format(date, 'MM월'),
        subLabel: `${format(date, 'w')}주차`,
        isWeekend: false,
        width: columnWidth
      }));
    } else {
      return eachMonthOfInterval({ start: startDate, end: endDate }).map(date => ({
        date,
        label: format(date, 'yyyy년'),
        subLabel: format(date, 'MM월'),
        isWeekend: false,
        width: columnWidth
      }));
    }
  }, [startDate, endDate, zoom, columnWidth]);

  useEffect(() => {
    if (!scrollContainerRef.current || headerInterval.length === 0) return;

    const targetDate = addDays(startOfDay(new Date()), -3);
    let targetIndex = -1;

    if (zoom === 'day') {
      targetIndex = headerInterval.findIndex(h => isSameDay(h.date, targetDate));
    } else if (zoom === 'week') {
      targetIndex = headerInterval.findIndex(h =>
        isSameWeek(h.date, targetDate, { weekStartsOn: 0 })
      );
    } else {
      targetIndex = headerInterval.findIndex(h => isSameMonth(h.date, targetDate));
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

  const groupedItems = useMemo(() => {
    const groups: Record<Category, ScheduleItem[]> = {} as any;
    settings.categories.forEach(cat => {
      groups[cat] = [];
    });
    
    items.forEach(item => {
      if (groups[item.category]) {
        groups[item.category].push(item);
      }
    });
    return groups;
  }, [items, settings.categories]);

  const renderTodayLine = () => {
    const today = startOfDay(new Date());
    if (today < startDate || today > endDate) return null;

    let todayLeft = 0;
    if (zoom === 'day') {
      todayLeft += differenceInDays(today, startDate) * columnWidth + (columnWidth / 2);
    } else if (zoom === 'week') {
      const startOfW = startOfWeek(today);
      const weekIndex = differenceInDays(startOfW, startOfWeek(startDate)) / 7;
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
        className="absolute top-0 bottom-0 w-px bg-blue-500 z-20 pointer-events-none"
        style={{ left: `calc(var(--left-col-width, 300px) + ${todayLeft}px)` }}
      >
        <div className="absolute top-0 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">오늘</div>
      </div>
    );
  };

  const handleAddOrUpdate = () => {
    if (!newSubCategory || !newTaskName) return;
    
    if (editingId) {
      const existingItem = items.find(i => i.id === editingId);
      if (existingItem) {
        onUpdate({
          ...existingItem,
          category: newCategory,
          subCategory: newSubCategory,
          taskName: newTaskName,
          startDate: newStartDate,
          endDate: newEndDate,
          duration: differenceInDays(new Date(newEndDate), new Date(newStartDate)) + 1
        });
      }
      handleClear();
    } else {
      onAdd({
        category: newCategory,
        subCategory: newSubCategory,
        taskName: newTaskName,
        startDate: newStartDate,
        endDate: newEndDate,
        duration: differenceInDays(new Date(newEndDate), new Date(newStartDate)) + 1,
        progress: 0,
        status: '예정',
        siteName: '',
        dongBlock: '',
        zone: '',
        floor: '',
        detailLocation: '',
        predecessor: '',
        contractor: '',
        memo: '',
        isBaseline: true
      });
      handleClear();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-y sm:border border-gray-200 rounded-none sm:rounded-xl overflow-hidden shadow-sm">
      {/* 1. 상단 차수 관리 툴바 (Revision Management Toolbar) */}
      <div className="bg-slate-50/95 border-b border-gray-200 px-3 xl:px-4 py-2.5 z-30 shrink-0 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span className="text-xs font-black text-gray-800">Baseline 계획 차수</span>
          </div>

          {/* 차수 선택 드롭다운 */}
          {sortedRevisions.length > 0 ? (
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 shadow-2xs">
              <Layers size={13} className="text-gray-400" />
              <select
                value={activeRevision?.id || ''}
                onChange={(e) => onSelectRevision && onSelectRevision(e.target.value)}
                className="bg-transparent text-xs font-black text-gray-800 focus:outline-none cursor-pointer pr-1"
              >
                {sortedRevisions.map(rev => (
                  <option key={rev.id} value={rev.id}>
                    {rev.round === 0 ? `[0차] 최초 계획 (${rev.createdAt})` : `[${rev.round}차] ${rev.name} (${rev.createdAt})`}
                    {rev.round === highestRound && sortedRevisions.length > 1 ? ' ★최종' : ''}
                  </option>
                ))}
              </select>

              {/* 뱃지 */}
              {activeRevision && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  activeRevision.round === 0
                    ? 'bg-blue-100 text-blue-700'
                    : activeRevision.round === highestRound
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {activeRevision.round === 0 ? '최초' : activeRevision.round === highestRound ? '최종 차수' : `${activeRevision.round}차`}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs font-bold text-gray-400">등록된 차수 없음</span>
          )}

          {activeRevision && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-gray-500 font-medium">
              <span>총 {items.length}개 공정</span>
              {activeRevision.description && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-600 truncate max-w-[220px]" title={activeRevision.description}>
                    비고: {activeRevision.description}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* 차수 액션 버튼들 */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* 차수 정보 수정 */}
          {activeRevision && onUpdateRevision && (
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-xs font-semibold flex items-center gap-1"
              title="현재 차수 정보 (명칭, 비고) 수정"
            >
              <Edit3 size={13} />
              <span className="hidden sm:inline">차수 정보</span>
            </button>
          )}

          {/* 현재 실행공정표로 갱신 (덮어쓰기) */}
          {/* 동기화 버튼이 Baseline 계획 화면에서 제거됨 */}


          {/* 차수 삭제 */}
          {activeRevision && onDeleteRevision && sortedRevisions.length > 1 && (
            <button
              type="button"
              onClick={() => setIsDeleteRevisionModalOpen(true)}
              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
              title="현재 선택된 차수 삭제"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* 신규 차수 추가 버튼 */}
          {onCreateRevision && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Plus size={14} />
              <span>신규 차수 추가</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 등록된 차수가 전혀 없을 때 안내 배너 */}
      {sortedRevisions.length === 0 && (
        <div className="bg-blue-50 border-b border-blue-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="text-blue-600 shrink-0" size={20} />
            <div>
              <p className="text-xs font-bold text-blue-900">
                아직 프로젝트의 Baseline 기준 계획 차수가 생성되지 않았습니다.
              </p>
              <p className="text-[11px] text-blue-700">
                현재 등록된 실행 공정표({actualItems.length}개)를 기반으로 [최초 계획 (0차)]을 즉시 생성할 수 있습니다.
              </p>
            </div>
          </div>
          {onCreateRevision && (
            <button
              type="button"
              onClick={() => {
                onCreateRevision({
                  round: 0,
                  name: '최초 계획',
                  description: '프로젝트 초기 기준 계획',
                  source: actualItems.length > 0 ? 'actual' : 'empty'
                });
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow-sm shrink-0"
            >
              최초 계획 (0차) 바로 생성
            </button>
          )}
        </div>
      )}

      {/* 3. Gantt Chart Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto no-scrollbar relative max-xl:[--left-col-width:300px] xl:[--left-col-width:300px]"
      >
        <div className="min-w-full inline-block align-top">
          {/* Header */}   
          <div className="flex sticky top-0 z-30 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
            <div className="sticky left-0 z-40 w-[250px] xl:w-[300px] flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center px-2 xl:px-4 py-2.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">공종 / 세부공종</span>
            </div>
            
            <div className="flex">
              {headerInterval.map((item, i) => (
                <div 
                  key={i} 
                  className={`flex-shrink-0 border-r border-gray-100 text-center py-2.5 text-[10px] font-bold ${item.isWeekend ? 'bg-gray-100/30 text-rose-400' : 'text-gray-400'}`}
                  style={{ width: item.width }}
                >
                  <div className="opacity-60">{item.label}</div>
                  <div className="uppercase tracking-tighter">{item.subLabel}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="relative">
            {renderTodayLine()}
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {settings.categories.map((category) => {
                const catItems = groupedItems[category] || [];
                if (catItems.length === 0 && !collapsedCategories.has(category)) return null;

                return (
                  <div key={category} className="border-b border-gray-100">
                    <div className="flex items-center border-b border-gray-100 group">
                      <div 
                        className="sticky left-0 z-30 flex items-center bg-slate-50/90 backdrop-blur-sm px-2 xl:px-3 py-1 cursor-pointer hover:bg-slate-100 transition-colors w-[250px] xl:w-[300px] flex-shrink-0 border-r border-gray-100"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                          {collapsedCategories.has(category) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </div>
                        <span className="ml-1 font-bold text-[11px] text-slate-700">{category}</span>
                        <span className="ml-2 px-1.5 py-0.5 bg-slate-200/50 text-slate-500 rounded text-[9px] font-bold hidden xl:inline-block">{catItems.length}</span>
                      </div>
                      <div className="flex-1 bg-slate-50/50 h-full"></div>
                    </div>

                    {!collapsedCategories.has(category) && (
                      <div className="flex flex-col">
                        <SortableContext 
                          items={catItems.map(i => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {catItems.map((item) => (
                            <SortableRow 
                              key={item.id}
                              item={item}
                              startDate={startDate}
                              columnWidth={columnWidth}
                              headerInterval={headerInterval}
                              onDeleteClick={setDeleteId}
                              onSelect={handleSelect}
                              zoom={zoom}
                              settings={settings}
                            />
                          ))}
                        </SortableContext>
                      </div>
                    )}
                  </div>
                );
              })}
            </DndContext>
          </div>
        </div>
      </div>

      {/* 4. 하단 빠른 추가/수정 폼 */}
      <div className="bg-gray-50 border-t border-gray-200 p-3 xl:p-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700">
              {editingId ? '선택된 Baseline 공정 수정' : `[${activeRevision?.name || '기준 계획'}] 새 공정 등록`}
            </span>
            {editingId && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">수정 모드</span>
            )}
          </div>
          {editingId && (
            <button 
              onClick={handleClear}
              className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
            >
              입력 취소
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">공종</label>
            <select 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value as Category)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              {settings.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">세부공종</label>
            <input 
              type="text"
              value={newSubCategory}
              onChange={(e) => setNewSubCategory(e.target.value)}
              list="baseline-subcat-options"
              placeholder="직접 입력 또는 선택"
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
            </input>
            <datalist id="baseline-subcat-options">
              {subCategories.map(sub => <option key={sub} value={sub} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">작업내용</label>
            <input 
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              list="baseline-task-options"
              placeholder="작업내용 입력 또는 선택"
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <datalist id="baseline-task-options">
              {taskNames.map(task => <option key={task} value={task} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">시작일</label>
            <input 
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">종료일</label>
            <input 
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleAddOrUpdate}
              disabled={!newSubCategory || !newTaskName}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {editingId ? <Plus size={14} className="rotate-45" /> : <Plus size={14} />}
              <span>{editingId ? '수정 완료' : '공정 추가'}</span>
            </button>
            
            {editingId && (
              <button 
                onClick={handleClear}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold text-xs transition-all cursor-pointer"
              >
                취소
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. 신규 차수 생성 모달 */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-slate-50/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <Plus size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900">새 Baseline 차수 생성</h3>
                    <p className="text-[11px] text-gray-500">프로젝트 계획 변경에 따른 신규 차수를 등록합니다.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">차수 번호</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={newRoundNum}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setNewRoundNum(val);
                          if (newRoundName === '' || newRoundName.includes('차')) {
                            setNewRoundName(val === 0 ? '최초 계획' : `${val}차 변경 계획`);
                          }
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <span className="text-xs font-bold text-gray-500">차</span>
                    </div>
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-gray-700">차수 명칭</label>
                    <input
                      type="text"
                      value={newRoundName}
                      onChange={(e) => setNewRoundName(e.target.value)}
                      placeholder="예: 1차 변경 계획"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">기준 데이터 복사 방식</label>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      newRoundSource === 'actual' ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="roundSource"
                        checked={newRoundSource === 'actual'}
                        onChange={() => setNewRoundSource('actual')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <span>현재 실행 공정표에서 복사</span>
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.2 rounded">권장</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          현재까지 변경·조정된 실행 공정표({actualItems.length}개)를 그대로 가져와 새 기준 차수로 확정합니다.
                        </p>
                      </div>
                    </label>

                    {sortedRevisions.length > 0 && (
                      <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        newRoundSource === 'previous' ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name="roundSource"
                          checked={newRoundSource === 'previous'}
                          onChange={() => setNewRoundSource('previous')}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-800">
                            직전 차수({activeRevision?.name || '기준'})에서 복사
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            현재 선택된 Baseline 차수({items.length}개)를 복사하여 일부 일정을 수정합니다.
                          </p>
                        </div>
                      </label>
                    )}

                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      newRoundSource === 'empty' ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="roundSource"
                        checked={newRoundSource === 'empty'}
                        onChange={() => setNewRoundSource('empty')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-800">빈 계획표에서 시작</div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          공정이 등록되지 않은 빈 차수로 생성 후 직접 공정을 추가합니다.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">변경 사유 및 비고 (선택)</label>
                  <textarea
                    rows={2}
                    value={newRoundDesc}
                    onChange={(e) => setNewRoundDesc(e.target.value)}
                    placeholder="예: 설계 변경 및 인허가 지연에 따른 공기 1개월 연장 반영"
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCreateRevision}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
                >
                  차수 생성하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. 차수 정보 수정 모달 */}
      <AnimatePresence>
        {isEditModalOpen && activeRevision && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 bg-slate-50/80 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900">
                  [{activeRevision.round}차] 차수 정보 수정
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">차수 명칭</label>
                  <input
                    type="text"
                    value={editRoundName}
                    onChange={(e) => setEditRoundName(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">비고 / 변경 사유</label>
                  <textarea
                    rows={3}
                    value={editRoundDesc}
                    onChange={(e) => setEditRoundDesc(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEditRevision}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  저장
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. 차수 삭제 확인 모달 */}
      <ConfirmModal 
        isOpen={isDeleteRevisionModalOpen}
        onClose={() => setIsDeleteRevisionModalOpen(false)}
        onConfirm={() => {
          if (activeRevision && onDeleteRevision) {
            onDeleteRevision(activeRevision.id);
          }
          setIsDeleteRevisionModalOpen(false);
        }}
        title="Baseline 차수 삭제"
        message={`정말로 [${activeRevision?.name || '선택된 차수'}]를 삭제하시겠습니까? 해당 차수에 포함된 모든 계획 공정이 삭제되며 복구할 수 없습니다.`}
      />

      {/* 8. 현재 실행공정표로 덮어쓰기(동기화) 확인 모달 */}
      <ConfirmModal 
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onConfirm={() => {
          if (activeRevision && onSyncFromActual) {
            onSyncFromActual(activeRevision.id);
          }
          setIsSyncModalOpen(false);
        }}
        title="현재 실행 공정표 동기화"
        message={`현재 프로젝트의 실행 공정표(${actualItems.length}개 공정)를 [${activeRevision?.name}]에 복사하여 덮어쓰시겠습니까? 기존에 등록되어 있던 해당 차수의 계획 공정표는 현재 실행공정 내용으로 갱신됩니다.`}
      />

      {/* 9. 개별 공정 삭제 확인 모달 */}
      <ConfirmModal 
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="공정 삭제"
        message="정말로 이 공정을 삭제하시겠습니까? 삭제된 정보는 복구할 수 없습니다."
      />
    </div>
  );
};

export default BaselineGantt;
