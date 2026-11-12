import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  format, 
  addDays, 
  differenceInDays, 
  startOfDay, 
  isWeekend, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  eachMonthOfInterval, 
  startOfWeek, 
  eachWeekOfInterval, 
  isSameDay, 
  isSameWeek, 
  isSameMonth 
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ScheduleItem, Category, AppSettings } from '../types';
import { 
  ChevronDown, 
  ChevronRight, 
  GripVertical, 
  Trash2, 
  GitCommit, 
  Link2, 
  ArrowRight 
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

export type GanttDensity = 'compact' | 'comfortable';

interface GanttChartProps {
  items: ScheduleItem[];
  zoom: 'day' | 'week' | 'month';
  onSelect: (item: ScheduleItem) => void;
  onDelete?: (id: string) => void;
  settings: AppSettings;
  onReorder?: (items: ScheduleItem[]) => void;
  density?: GanttDensity;
  onDensityChange?: (density: GanttDensity) => void;
  autoScheduleLink?: boolean;
  onToggleAutoScheduleLink?: (enabled: boolean) => void;
}

interface SortableRowProps {
  item: ScheduleItem;
  startDate: Date;
  columnWidth: number;
  headerInterval: any[];
  onSelect: (item: ScheduleItem) => void;
  onDeleteClick: (id: string) => void;
  zoom: 'day' | 'week' | 'month';
  settings: AppSettings;
  density: GanttDensity;
  onHoverTask: (id: string | null) => void;
  isHovered: boolean;
}

const SortableRow: React.FC<SortableRowProps> = ({ 
  item, 
  startDate, 
  columnWidth, 
  headerInterval, 
  onSelect, 
  onDeleteClick, 
  zoom, 
  settings, 
  density,
  onHoverTask,
  isHovered
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
    left = (differenceInDays(start, startDate) / 7) * columnWidth;
    width = ((differenceInDays(end, start) + 1) / 7) * columnWidth;
  } else {
    left = (differenceInDays(start, startDate) / 30) * columnWidth;
    width = ((differenceInDays(end, start) + 1) / 30) * columnWidth;
  }

  const isDelayed = item.status === '지연';
  const isCompleted = item.status === '완료';
  const isCompact = density === 'compact';

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      data-task-id={item.id}
      onMouseEnter={() => onHoverTask(item.id)}
      onMouseLeave={() => onHoverTask(null)}
      className={`flex border-b border-gray-100 last:border-0 group transition-colors ${
        isHovered ? 'bg-blue-50/40' : 'hover:bg-gray-50/60 bg-white'
      } ${
        isCompact ? 'h-8 xl:h-8' : 'h-12 xl:h-12'
      }`}
    >
      {/* Task Label (Sticky) */}
      <div 
        onClick={() => onSelect(item)}
        className={`sticky left-0 z-30 w-[250px] xl:w-[300px] flex-shrink-0 border-r border-gray-100 flex items-center transition-colors cursor-pointer ${
          isHovered ? 'bg-blue-50/70' : 'bg-white group-hover:bg-gray-50/60'
        } ${
          isCompact ? 'px-1.5 xl:px-2.5 gap-1' : 'px-2 xl:px-4 gap-1.5'
        }`}
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(item.id);
          }}
          className={`opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all flex-shrink-0 ${
            isCompact ? 'p-0.5' : 'p-1'
          }`}
          title="삭제"
        >
          <Trash2 size={isCompact ? 11 : 13} />
        </button>
        <div 
          {...attributes} 
          {...listeners} 
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 mr-0.5 xl:mr-1"
        >
          <GripVertical size={isCompact ? 12 : 14} />
        </div>
        <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className={`text-gray-800 truncate ${
              isCompact ? 'text-[10px] xl:text-[11px] leading-tight' : 'text-xs xl:text-sm leading-normal'
            }`}>
              <span className="font-bold">{item.subCategory}</span>
              <span className="mx-1 text-gray-400">/</span>
              <span className="font-normal text-gray-600">{item.taskName}</span>
            </span>
          </div>

          <div className={`text-gray-400 font-medium truncate ${
            isCompact ? 'text-[8px] leading-tight' : 'text-[9px] xl:text-[10px] leading-tight'
          }`}>
            {[
              Array.isArray(item.dongBlock) ? item.dongBlock.join(', ') : item.dongBlock,
              Array.isArray(item.floor) ? item.floor.join(', ') : item.floor,
              Array.isArray(item.zone) ? item.zone.join(', ') : item.zone
            ].filter(Boolean).join(' / ')}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div 
        onClick={() => onSelect(item)}
        className="relative flex-1 cursor-pointer"
      >
        {/* Grid Background */}
        <div className="absolute inset-0 flex pointer-events-none">
          {headerInterval.map((h, i) => (
            <div 
              key={i} 
              className={`flex-shrink-0 border-r border-gray-50/50 h-full ${h.isWeekend ? 'bg-gray-50/30' : ''}`}
              style={{ width: h.width }}
            />
          ))}
        </div>

        {/* Task Bar */}
        {(item.periods && item.periods.length > 0 ? item.periods : [{ startDate: item.startDate, endDate: item.endDate }]).map((period, idx) => {
          const pStart = new Date(period.startDate);
          const pEnd = new Date(period.endDate);
          
          let pLeft = 0;
          let pWidth = 0;
      
          if (zoom === 'day') {
            pLeft = differenceInDays(pStart, startDate) * columnWidth;
            pWidth = (differenceInDays(pEnd, pStart) + 1) * columnWidth;
          } else if (zoom === 'week') {
            pLeft = (differenceInDays(pStart, startDate) / 7) * columnWidth;
            pWidth = ((differenceInDays(pEnd, pStart) + 1) / 7) * columnWidth;
          } else {
            pLeft = (differenceInDays(pStart, startDate) / 30) * columnWidth;
            pWidth = ((differenceInDays(pEnd, pStart) + 1) / 30) * columnWidth;
          }

          const thresholdWidth = isCompact ? 40 : 55;

          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              className={`absolute top-1/2 -translate-y-1/2 shadow-xs transition-all flex items-center overflow-hidden hover:brightness-105 active:scale-[0.98] origin-left z-10
                ${isCompact ? 'h-3 xl:h-3.5 rounded-full' : 'h-5 xl:h-6 rounded-md'}
                ${isDelayed ? 'bg-rose-500' : isCompleted ? 'bg-gray-300' : ''}
                ${isHovered ? 'ring-2 ring-blue-500/60 ring-offset-1' : ''}
              `}
              style={{ 
                left: pLeft, 
                width: pWidth,
                backgroundColor: !isDelayed && !isCompleted ? (settings.categoryColors[item.category] || '#3b82f6') : undefined
              }}
            >
              {/* Progress Overlay */}
              {!isCompleted && !isDelayed && (
                <div 
                  className="absolute inset-0 bg-black/10 transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              )}
              
              {/* Task Label inside bar if wide enough */}
              {pWidth > thresholdWidth && (
                <span className={`relative z-10 font-bold text-white truncate drop-shadow-xs ${
                  isCompact ? 'px-1 text-[8px]' : 'px-2 text-[9px] xl:text-[10px]'
                }`}>
                  {item.progress}%
                </span>
              )}
            </motion.div>
          );
        })}

        {/* Floating Label for small bars */}
        {width <= (isCompact ? 40 : 55) && (
          <div 
            className={`absolute top-1/2 -translate-y-1/2 ml-1.5 font-bold text-gray-400 whitespace-nowrap z-10 ${
              isCompact ? 'text-[8px]' : 'text-[9px]'
            }`}
            style={{ left: left + width }}
          >
            {item.progress}%
          </div>
        )}
      </div>
    </div>
  );
};

// Generate curved orthogonal path for dependency arrow
function createDependencyPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const targetX = toX - 3; // tiny gap before bar start for arrowhead
  const r = 4; // corner radius

  // Straight line if both tasks happen to be on the same horizontal level
  if (Math.abs(fromY - toY) < 3) {
    return `M ${fromX} ${fromY} L ${targetX} ${toY}`;
  }

  // Forward connection (target starts after predecessor finishes + space for turn)
  if (targetX >= fromX + 14) {
    const midX = fromX + Math.min(16, (targetX - fromX) / 2);
    const dirY = toY > fromY ? 1 : -1;

    return (
      `M ${fromX} ${fromY} ` +
      `H ${midX - r} ` +
      `Q ${midX} ${fromY} ${midX} ${fromY + r * dirY} ` +
      `V ${toY - r * dirY} ` +
      `Q ${midX} ${toY} ${midX + r} ${toY} ` +
      `H ${targetX}`
    );
  }

  // Overlapping or backward connection (target starts before or too close to predecessor end)
  const rightOffset = fromX + 12;
  const leftOffset = targetX - 12;
  const midY = (fromY + toY) / 2;
  const dirY = toY > fromY ? 1 : -1;

  return (
    `M ${fromX} ${fromY} ` +
    `H ${rightOffset - r} ` +
    `Q ${rightOffset} ${fromY} ${rightOffset} ${fromY + r * dirY} ` +
    `V ${midY - r * dirY} ` +
    `Q ${rightOffset} ${midY} ${rightOffset - r} ${midY} ` +
    `H ${leftOffset + r} ` +
    `Q ${leftOffset} ${midY} ${leftOffset} ${midY + r * dirY} ` +
    `V ${toY - r * dirY} ` +
    `Q ${leftOffset} ${toY} ${leftOffset + r} ${toY} ` +
    `H ${targetX}`
  );
}

const GanttChart: React.FC<GanttChartProps> = ({ 
  items, 
  zoom, 
  onSelect, 
  onDelete, 
  settings, 
  onReorder,
  density: propDensity,
  onDensityChange,
  autoScheduleLink: propAutoLink,
  onToggleAutoScheduleLink
}) => {
  const density = propDensity ?? 'compact';

  // State: Show Dependency Arrows (연결선 표시)
  const [showDependencyArrows, setShowDependencyArrows] = useState<boolean>(() => {
    const saved = localStorage.getItem('cp_show_dependency_arrows');
    return saved !== 'false';
  });

  const handleToggleDependencyArrows = () => {
    setShowDependencyArrows(prev => {
      const next = !prev;
      localStorage.setItem('cp_show_dependency_arrows', String(next));
      return next;
    });
  };

  // State: Auto Schedule Link (자동 일정 연결)
  const [internalAutoLink, setInternalAutoLink] = useState<boolean>(() => {
    const saved = localStorage.getItem('cp_auto_schedule_link');
    return saved !== 'false';
  });

  const autoScheduleLink = propAutoLink ?? internalAutoLink;

  const handleToggleAutoLink = () => {
    const next = !autoScheduleLink;
    localStorage.setItem('cp_auto_schedule_link', String(next));
    if (onToggleAutoScheduleLink) {
      onToggleAutoScheduleLink(next);
    } else {
      setInternalAutoLink(next);
    }
  };

  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chartBodyRef = useRef<HTMLDivElement>(null);

  // Measure task row Y coordinates relative to the chart body
  const [taskRowPositions, setTaskRowPositions] = useState<Record<string, { y: number; height: number }>>({});

  const updateRowPositions = () => {
    if (!chartBodyRef.current) return;
    const container = chartBodyRef.current;
    const containerRect = container.getBoundingClientRect();
    const positions: Record<string, { y: number; height: number }> = {};

    items.forEach(item => {
      const el = container.querySelector(`[data-task-id="${item.id}"]`) as HTMLElement;
      if (el) {
        const elRect = el.getBoundingClientRect();
        const y = (elRect.top - containerRect.top) + (elRect.height / 2);
        positions[item.id] = { y, height: elRect.height };
      }
    });

    setTaskRowPositions(positions);
  };

  useEffect(() => {
    updateRowPositions();
    const timer = setTimeout(updateRowPositions, 150);
    return () => clearTimeout(timer);
  }, [items, collapsedCategories, density, zoom]);

  useEffect(() => {
    if (!chartBodyRef.current) return;
    const observer = new ResizeObserver(() => {
      updateRowPositions();
    });
    observer.observe(chartBodyRef.current);
    return () => observer.disconnect();
  }, []);

  const handleDeleteConfirm = () => {
    if (deleteId && onDelete) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const toggleCategory = (category: Category) => {
    const newSet = new Set(collapsedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setCollapsedCategories(newSet);
  };

  const toggleAllCategories = () => {
    const allCategories = Object.keys(groupedItems) as Category[];
    if (collapsedCategories.size === 0) {
      setCollapsedCategories(new Set(allCategories));
    } else {
      setCollapsedCategories(new Set());
    }
  };

  // Calculate date range
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

    // Add padding
    minDate = addDays(startOfDay(minDate), -7);
    maxDate = addDays(startOfDay(maxDate), 14);

    return { 
      startDate: minDate, 
      endDate: maxDate, 
      days: differenceInDays(maxDate, minDate) + 1 
    };
  }, [items]);

  const columnWidth = zoom === 'day' ? 40 : zoom === 'week' ? 100 : 150;

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
        label: format(date, 'MM/dd'),
        subLabel: '주차',
        isWeekend: false,
        width: columnWidth
      }));
    } else {
      return eachMonthOfInterval({ start: startDate, end: endDate }).map(date => ({
        date,
        label: format(date, 'yyyy/MM'),
        subLabel: '월',
        isWeekend: false,
        width: columnWidth
      }));
    }
  }, [startDate, endDate, zoom, columnWidth]);

  const groupedItems = useMemo(() => {
    const groups: Record<Category, ScheduleItem[]> = {} as any;
    items.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [items]);

  const getTaskPosition = (item: ScheduleItem) => {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    
    let left = 0;
    let width = 0;

    if (zoom === 'day') {
      left = differenceInDays(start, startDate) * columnWidth;
      width = (differenceInDays(end, start) + 1) * columnWidth;
    } else if (zoom === 'week') {
      left = (differenceInDays(start, startDate) / 7) * columnWidth;
      width = ((differenceInDays(end, start) + 1) / 7) * columnWidth;
    } else {
      left = (differenceInDays(start, startDate) / 30) * columnWidth;
      width = ((differenceInDays(end, start) + 1) / 30) * columnWidth;
    }

    return { left, width };
  };

  // Generate list of dependency connectors (arrows)
  const dependencyLinks = useMemo(() => {
    if (!showDependencyArrows) return [];
    const links: {
      id: string;
      predId: string;
      succId: string;
      predTask: ScheduleItem;
      succTask: ScheduleItem;
      path: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      midX: number;
      midY: number;
      isDelayed: boolean;
    }[] = [];

    const itemMap = new Map<string, ScheduleItem>(items.map(i => [i.id, i]));

    items.forEach(succ => {
      if (!succ.predecessor) return;
      const pred = itemMap.get(succ.predecessor);
      if (!pred) return;

      const predPos = taskRowPositions[pred.id];
      const succPos = taskRowPositions[succ.id];
      if (!predPos || !succPos) return;

      const predBar = getTaskPosition(pred);
      const succBar = getTaskPosition(succ);

      const fromX = predBar.left + predBar.width;
      const fromY = predPos.y;
      const toX = succBar.left;
      const toY = succPos.y;

      const path = createDependencyPath(fromX, fromY, toX, toY);
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      const isDelayed = succ.status === '지연' || new Date(succ.startDate) < new Date(pred.endDate);

      links.push({
        id: `${pred.id}->${succ.id}`,
        predId: pred.id,
        succId: succ.id,
        predTask: pred,
        succTask: succ,
        path,
        fromX,
        fromY,
        toX,
        toY,
        midX,
        midY,
        isDelayed
      });
    });

    return links;
  }, [items, showDependencyArrows, taskRowPositions, zoom, columnWidth, startDate]);

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
        style={{ left: `calc(var(--left-col-width, 250px) + ${todayLeft}px)` }}
      >
        <div className="absolute top-0 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">오늘</div>
      </div>
    );
  };

  // Auto-scroll logic for mobile/tablet optimization
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && onReorder) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-y xl:border border-gray-200 xl:rounded-xl overflow-hidden shadow-sm">
      {/* 간트차트 상단 툴바 (Top Toolbar) */}
      <div className="flex items-center justify-between px-3 xl:px-4 py-2 bg-slate-50/90 border-b border-gray-200 z-30 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            공정 간트차트
          </span>
          <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-2xs">
            총 {items.length}개 공정
          </span>
          <button
            type="button"
            onClick={toggleAllCategories}
            className="text-[10px] font-semibold text-gray-500 hover:text-blue-600 bg-white hover:bg-gray-50 border border-gray-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            {collapsedCategories.size === 0 ? '전체 접기' : '전체 펼치기'}
          </button>

          {/* 연결선 (Dependency Arrows) 토글 버튼 */}
          <button
            type="button"
            onClick={handleToggleDependencyArrows}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              showDependencyArrows
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-2xs'
                : 'bg-white text-gray-400 border-gray-200 hover:text-gray-700 hover:bg-gray-50'
            }`}
            title={showDependencyArrows ? "공정 간 연결선(Dependency Arrows) 숨기기" : "공정 간 연결선(Dependency Arrows) 표시하기"}
          >
            <GitCommit size={13} className={showDependencyArrows ? 'text-blue-600' : 'text-gray-400'} />
            <span>연결선 {showDependencyArrows ? '표시 중' : '숨김'}</span>
            {dependencyLinks.length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                showDependencyArrows ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {dependencyLinks.length}
              </span>
            )}
          </button>

          {/* 자동 일정 연결 (Auto Schedule Link) 토글 버튼 */}
          <button
            type="button"
            onClick={handleToggleAutoLink}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              autoScheduleLink
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 shadow-2xs'
                : 'bg-white text-gray-400 border-gray-200 hover:text-gray-700 hover:bg-gray-50'
            }`}
            title="공정 등록 및 수정 시 이전 공정 종료일과 후속 공정 시작일을 자동으로 연동합니다"
          >
            <Link2 size={13} className={autoScheduleLink ? 'text-indigo-600' : 'text-gray-400'} />
            <span>자동 일정 연결 {autoScheduleLink ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Container for both Header and Body */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto no-scrollbar relative max-xl:[--left-col-width:250px] xl:[--left-col-width:300px]"
      >
        <div className="min-w-full inline-block align-top">
          {/* Header */}
          <div className="flex sticky top-0 z-30 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
            {/* Sticky Corner */}
            <div className="sticky left-0 z-40 w-[250px] xl:w-[300px] flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center px-2 xl:px-4 py-2.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">공종 / 세부공종 / 위치</span>
            </div>
            
            {/* Date Labels */}
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

          {/* Body Content */}
          <div className="relative" ref={chartBodyRef}>
            {renderTodayLine()}

            {/* ============================================================== */}
            {/* SVG Dependency Arrows Layer (공정 연관 관계 연결선) */}
            {/* ============================================================== */}
            {showDependencyArrows && dependencyLinks.length > 0 && (
              <svg
                className="absolute top-0 pointer-events-none z-20 overflow-visible"
                style={{
                  left: 'var(--left-col-width, 250px)',
                  width: headerInterval.length * columnWidth,
                  height: '100%'
                }}
              >
                <defs>
                  {/* Default arrow marker */}
                  <marker
                    id="gantt-arrow-default"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
                  </marker>

                  {/* Active / Hovered arrow marker */}
                  <marker
                    id="gantt-arrow-active"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
                  </marker>

                  {/* Delayed / Alert arrow marker */}
                  <marker
                    id="gantt-arrow-delayed"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
                  </marker>
                </defs>

                {dependencyLinks.map(link => {
                  const isHovered = hoveredTaskId === link.predId || hoveredTaskId === link.succId || hoveredLinkId === link.id;
                  const strokeColor = isHovered 
                    ? '#2563eb' 
                    : link.isDelayed 
                      ? '#f43f5e' 
                      : '#94a3b8';
                  const markerId = isHovered 
                    ? 'gantt-arrow-active' 
                    : link.isDelayed 
                      ? 'gantt-arrow-delayed' 
                      : 'gantt-arrow-default';

                  return (
                    <g key={link.id} className="pointer-events-auto">
                      {/* Thick transparent hit-test path for easy mouse hovering */}
                      <path
                        d={link.path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="12"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredLinkId(link.id)}
                        onMouseLeave={() => setHoveredLinkId(null)}
                      />

                      {/* Visible dependency path */}
                      <path
                        d={link.path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        strokeDasharray={link.isDelayed ? '4,3' : undefined}
                        markerEnd={`url(#${markerId})`}
                        className="transition-all duration-150 pointer-events-none"
                        style={{
                          filter: isHovered ? 'drop-shadow(0 0 4px rgba(37,99,235,0.5))' : undefined
                        }}
                      />

                      {/* Small circular dot at predecessor bar exit */}
                      <circle
                        cx={link.fromX}
                        cy={link.fromY}
                        r={isHovered ? 3.5 : 2.5}
                        fill={strokeColor}
                        className="pointer-events-none"
                      />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Hovered Link Tooltip */}
            <AnimatePresence>
              {hoveredLinkId && (() => {
                const link = dependencyLinks.find(l => l.id === hoveredLinkId);
                if (!link) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute z-40 bg-gray-900/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none border border-gray-700 flex items-center gap-1.5 whitespace-nowrap"
                    style={{
                      left: `calc(var(--left-col-width, 250px) + ${link.midX}px)`,
                      top: `${link.midY - 26}px`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <span className="text-blue-300 font-bold">{link.predTask.taskName}</span>
                    <span className="text-gray-400 font-mono text-[9px]">({link.predTask.endDate})</span>
                    <ArrowRight size={11} className="text-gray-400" />
                    <span className="text-emerald-300 font-bold">{link.succTask.taskName}</span>
                    <span className="text-gray-400 font-mono text-[9px]">({link.succTask.startDate})</span>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
            
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {(Object.entries(groupedItems) as [Category, ScheduleItem[]][]).map(([category, catItems]) => (
                <div key={category} className="border-b border-gray-100">
                  {/* Category Header */}
                  <div className="flex items-center border-b border-gray-100 group">
                    <div 
                      className={`sticky left-0 z-30 flex items-center bg-gray-50/90 backdrop-blur-sm cursor-pointer hover:bg-gray-100 transition-colors w-[250px] xl:w-[300px] flex-shrink-0 border-r border-gray-100 ${
                        density === 'compact' ? 'px-2 xl:px-3 py-1' : 'px-2 xl:px-4 py-2 xl:py-2.5'
                      }`}
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                        {collapsedCategories.has(category) ? <ChevronRight size={density === 'compact' ? 12 : 14} /> : <ChevronDown size={density === 'compact' ? 12 : 14} />}
                      </div>
                      <span className={`ml-1 font-bold text-gray-700 ${density === 'compact' ? 'text-[11px]' : 'text-xs'}`}>{category}</span>
                      <span className="ml-2 px-1.5 py-0.5 bg-gray-200/50 text-gray-500 rounded text-[9px] font-bold hidden xl:inline-block">{catItems.length}</span>
                    </div>
                    <div className="flex-1 bg-gray-50/50 h-full"></div>
                  </div>

                  {/* Tasks List */}
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
                            onSelect={onSelect}
                            onDeleteClick={setDeleteId}
                            zoom={zoom}
                            settings={settings}
                            density={density}
                            onHoverTask={setHoveredTaskId}
                            isHovered={hoveredTaskId === item.id || hoveredTaskId === item.predecessor}
                          />
                        ))}
                      </SortableContext>
                    </div>
                  )}
                </div>
              ))}
            </DndContext>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="공정 삭제"
        message="정말로 이 공정을 삭제하시겠습니까? 삭제된 정보는 복구할 수 없습니다."
      />
    </div>
  );
};

export default GanttChart;
