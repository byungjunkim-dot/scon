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
  isToday,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  isSameDay,
  isSameWeek,
  isSameMonth
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ScheduleItem, Category, AppSettings } from '../types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface GanttChartProps {
  items: ScheduleItem[];
  zoom: 'day' | 'week' | 'month';
  onSelect: (item: ScheduleItem) => void;
  settings: AppSettings;
}

const GanttChart: React.FC<GanttChartProps> = ({ items, zoom, onSelect, settings }) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleCategory = (category: Category) => {
    const newSet = new Set(collapsedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setCollapsedCategories(newSet);
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

  // Auto-scroll logic for mobile/tablet optimization
  useEffect(() => {
    if (!scrollContainerRef.current || headerInterval.length === 0) return;

    const today = new Date();
    let targetIndex = -1;

    if (zoom === 'day') {
      const yesterday = addDays(today, -1);
      targetIndex = headerInterval.findIndex(h => isSameDay(h.date, yesterday));
    } else if (zoom === 'week') {
      targetIndex = headerInterval.findIndex(h => isSameWeek(h.date, today, { weekStartsOn: 0 }));
    } else if (zoom === 'month') {
      targetIndex = headerInterval.findIndex(h => isSameMonth(h.date, today));
    }

    if (targetIndex !== -1) {
      // Calculate scroll position: targetIndex * columnWidth
      // We don't need to add the sticky header width because the scroll container
      // scrolls the content *under* the sticky header.
      const scrollPosition = targetIndex * columnWidth;
      
      // Use setTimeout to ensure rendering is complete before scrolling
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

  return (
    <div className="flex flex-col h-full bg-white border-y xl:border border-gray-200 xl:rounded-xl overflow-hidden shadow-sm">
      {/* Scrollable Container for both Header and Body */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto no-scrollbar relative max-xl:[--left-col-width:18vw] xl:[--left-col-width:250px]"
      >
        <div className="min-w-full inline-block align-top">
          {/* Header */}
          <div className="flex sticky top-0 z-30 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
            {/* Sticky Corner */}
            <div className="sticky left-0 z-40 w-[18vw] xl:w-[250px] flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center px-2 xl:px-4 py-2.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">공정명 / 위치</span>
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
          <div className="relative">
            {renderTodayLine()}
            
            {(Object.entries(groupedItems) as [Category, ScheduleItem[]][]).map(([category, catItems]) => (
              <div key={category} className="border-b border-gray-100">
                {/* Category Header */}
                <div className="flex items-center border-b border-gray-100 group">
                  <div 
                    className="sticky left-0 z-30 flex items-center bg-gray-50/90 backdrop-blur-sm px-2 xl:px-4 py-1 xl:py-2.5 cursor-pointer hover:bg-gray-100 transition-colors w-[18vw] xl:w-[250px] flex-shrink-0 border-r border-gray-100"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                      {collapsedCategories.has(category) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </div>
                    <span className="ml-1 font-bold text-xs text-gray-700">{category}</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-gray-200/50 text-gray-500 rounded text-[9px] font-bold hidden xl:inline-block">{catItems.length}</span>
                  </div>
                  <div className="flex-1 bg-gray-50/50 h-full"></div>
                </div>

                {/* Tasks List */}
                {!collapsedCategories.has(category) && (
                  <div className="flex flex-col">
                    {catItems.map((item) => {
                      const { left, width } = getTaskPosition(item);
                      const isDelayed = item.status === '지연';
                      const isCompleted = item.status === '완료';

                      return (
                        <div key={item.id} className="flex h-6 xl:h-12 border-b border-gray-50 last:border-0 group hover:bg-gray-50/50 transition-colors">
                          {/* Task Label (Sticky) */}
                          <div className="sticky left-0 z-30 w-[18vw] xl:w-[250px] flex-shrink-0 bg-white border-r border-gray-100 px-2 xl:px-4 flex flex-col justify-center group-hover:bg-gray-50/50 transition-colors overflow-hidden">
                            <div className="text-[10px] xl:text-xs text-gray-800 truncate">
                              <span className="font-bold">{item.subCategory}</span>
                              <span className="mx-1 text-gray-400">/</span>
                              <span className="font-normal text-gray-600">{item.taskName}</span>
                            </div>
                            <div className="text-[8px] xl:text-[9px] text-gray-400 font-medium truncate">{item.dongBlock} {item.floor} {item.zone}</div>
                          </div>

                          {/* Chart Area */}
                          <div className="relative flex-1">
                            {/* Grid Background */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {headerInterval.map((item, i) => (
                                <div 
                                  key={i} 
                                  className={`flex-shrink-0 border-r border-gray-50/50 h-full ${item.isWeekend ? 'bg-gray-50/30' : ''}`}
                                  style={{ width: item.width }}
                                />
                              ))}
                            </div>

                            {/* Task Bar */}
                            <motion.div 
                              initial={{ opacity: 0, scaleX: 0 }}
                              animate={{ opacity: 1, scaleX: 1 }}
                              onClick={() => onSelect(item)}
                              className={`absolute top-1/2 -translate-y-1/2 h-2 xl:h-4 rounded-full shadow-sm transition-all flex items-center overflow-hidden cursor-pointer hover:brightness-105 active:scale-[0.98] origin-left z-10
                                ${isDelayed ? 'bg-rose-500' : isCompleted ? 'bg-gray-300' : ''}
                              `}
                              style={{ 
                                left, 
                                width,
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
                              {width > 60 && (
                                <span className="relative z-10 px-1.5 xl:px-3 text-[8px] xl:text-[9px] font-bold text-white truncate drop-shadow-sm">
                                  {item.progress}%
                                </span>
                              )}
                            </motion.div>

                            {/* Floating Label for small bars */}
                            {width <= 60 && (
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 ml-2 text-[9px] font-bold text-gray-400 whitespace-nowrap z-10"
                                style={{ left: left + width }}
                              >
                                {item.progress}%
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
