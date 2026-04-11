import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ScheduleItem, Category, AppSettings } from '../types';
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
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BaselineComparisonProps {
  items: ScheduleItem[];
  baselineItems: ScheduleItem[];
  zoom: 'day' | 'week' | 'month';
  categories: Category[];
  settings: AppSettings;
}

const BaselineComparison: React.FC<BaselineComparisonProps> = ({ items, baselineItems, zoom, categories, settings }) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: prev[category] === false ? true : false
    }));
  };

  // Calculate date range for both sets
  const { startDate, endDate, days } = useMemo(() => {
    const allItems = [...items, ...baselineItems];
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

    // Add padding
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
  }, [items, baselineItems, zoom]);

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

  // Aggregate data by category and subCategory for comparison
  const aggregatedData = useMemo(() => {
    const data: Record<string, Record<string, { baselineItems: ScheduleItem[], actualItems: ScheduleItem[] }>> = {};

    baselineItems.forEach(item => {
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

        const subCategoryList = Object.entries(subCats).map(([subCategory, items]) => {
          const bStart = items.baselineItems.length > 0 ? new Date(Math.min(...items.baselineItems.map(i => new Date(i.startDate).getTime()))) : null;
          const bEnd = items.baselineItems.length > 0 ? new Date(Math.max(...items.baselineItems.map(i => new Date(i.endDate).getTime()))) : null;
          const aStart = items.actualItems.length > 0 ? new Date(Math.min(...items.actualItems.map(i => new Date(i.startDate).getTime()))) : null;
          const aEnd = items.actualItems.length > 0 ? new Date(Math.max(...items.actualItems.map(i => new Date(i.endDate).getTime()))) : null;
          const aProgress = items.actualItems.length > 0 ? items.actualItems.reduce((acc, i) => acc + i.progress, 0) / items.actualItems.length : 0;

          return {
            name: subCategory,
            baseline: bStart && bEnd ? { start: bStart, end: bEnd } : null,
            actual: aStart && aEnd ? { start: aStart, end: aEnd, progress: aProgress } : null
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

        return {
          category: category as Category,
          baseline: catBStart && catBEnd ? { start: catBStart, end: catBEnd } : null,
          actual: catAStart && catAEnd ? { start: catAStart, end: catAEnd, progress: catAProgress } : null,
          subCategories: subCategoryList
        };
      })
      .filter((group): group is NonNullable<typeof group> => group !== null);
  }, [items, baselineItems, categories]);

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
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto no-scrollbar max-xl:[--left-col-width:250px] xl:[--left-col-width:300px]"
      >
        <div className="relative" style={{ minWidth: `calc(var(--left-col-width, 300px) + ${headerInterval.length * columnWidth}px)` }}>
          {/* Header */}
          <div className="flex sticky top-0 z-40 bg-gray-50/80 backdrop-blur-sm border-b border-gray-200">
            <div className="sticky left-0 z-50 w-[250px] xl:w-[300px] flex-shrink-0 bg-gray-50/90 backdrop-blur-sm border-r border-gray-100 p-2 xl:p-4 font-bold text-gray-400 text-[10px] uppercase tracking-widest truncate">공정 정보 (대분류/세부공종)</div>
            <div className="flex">
              {headerInterval.map((item, i) => (
                <div 
                  key={i} 
                  className="flex-shrink-0 border-r border-gray-50 text-center py-2 text-[9px] font-bold text-gray-400"
                  style={{ width: columnWidth }}
                >
                  <div className="opacity-60">{item.label}</div>
                  <div className="uppercase tracking-tighter">{item.subLabel}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Today Line */}
          {renderTodayLine()}

          {/* Rows */}
          {/* Rows */}
          <div className="divide-y divide-gray-100 relative">
            {aggregatedData.map((group) => (
              <React.Fragment key={group.category}>
                {/* Category Header */}
                <div className="flex border-b border-gray-100 group/cat">
                  <div 
                    className="sticky left-0 z-30 w-[250px] xl:w-[300px] flex-shrink-0 border-r border-gray-100 py-0.5 px-1.5 xl:p-1.5 flex items-center gap-2 bg-slate-50/90 backdrop-blur-sm cursor-pointer hover:bg-slate-100 transition-colors overflow-hidden"
                    onClick={() => toggleCategory(group.category)}
                  >
                    {expandedCategories[group.category] !== false ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
                    <span className="text-[10px] xl:text-xs font-bold text-slate-700 truncate">{group.category}</span>
                    <span className="text-[10px] text-slate-400 font-medium flex-shrink-0 hidden xl:inline-block">({group.subCategories.length})</span>
                  </div>
                  
                  <div className="relative flex-1 h-4 xl:h-8 bg-slate-50/80 group-hover/cat:bg-slate-100 transition-colors">
                    {/* Category Summary Bars */}
                    {group.baseline && (
                      <div 
                        className="absolute top-[4px] xl:top-[8px] h-[4px] xl:h-[10px] rounded-md z-0"
                        style={{ 
                          left: getTaskPosition(group.baseline.start, group.baseline.end).left, 
                          width: getTaskPosition(group.baseline.start, group.baseline.end).width,
                          backgroundColor: settings.categoryColors[group.category] || '#3b82f6',
                          opacity: 0.5
                        }}
                      />
                    )}
                    {group.actual && (
                      <div 
                        className="absolute top-[8px] xl:top-[16px] h-[4px] xl:h-[10px] rounded-md shadow-sm z-10 flex items-center overflow-hidden opacity-80"
                        style={{ 
                          left: getTaskPosition(group.actual.start, group.actual.end).left, 
                          width: getTaskPosition(group.actual.start, group.actual.end).width,
                          backgroundColor: settings.categoryColors[group.category] || '#3b82f6'
                        }}
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
                          <div className="w-[250px] xl:w-[300px] flex-shrink-0 border-r border-gray-100 py-1 px-2 xl:p-2 sticky left-0 z-30 bg-white group-hover:bg-gray-50/50 transition-colors pl-4 xl:pl-8 overflow-hidden flex items-center">
                            <div className="text-[10px] xl:text-xs font-medium text-gray-700 truncate">{sub.name}</div>
                          </div>
                          
                          <div className="relative flex-1 h-4 xl:h-8 group-hover:bg-gray-50/50 transition-colors">
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

                              {/* Baseline Bar */}
                              {sub.baseline && (
                                <div 
                                  className="absolute top-[4px] xl:top-[8px] h-[3px] xl:h-[8px] rounded-md z-0 transition-all"
                                  style={{ 
                                    left: bPos.left, 
                                    width: bPos.width,
                                    backgroundColor: settings.categoryColors[group.category] || '#3b82f6',
                                    opacity: 0.5
                                  }}
                                  title={`계획: ${format(sub.baseline.start, 'yyyy-MM-dd')} ~ ${format(sub.baseline.end, 'yyyy-MM-dd')}`}
                                />
                              )}
                              
                              {/* Actual Bar */}
                              {sub.actual && (
                                <div 
                                  className="absolute top-[7px] xl:top-[16px] h-[3px] xl:h-[8px] rounded-md shadow-sm z-10 flex items-center px-1.5 xl:px-3 overflow-hidden transition-all"
                                  style={{ 
                                    left: aPos.left, 
                                    width: aPos.width,
                                    backgroundColor: settings.categoryColors[group.category] || '#3b82f6'
                                  }}
                                  title={`실행: ${format(sub.actual.start, 'yyyy-MM-dd')} ~ ${format(sub.actual.end, 'yyyy-MM-dd')} (${Math.round(sub.actual.progress)}%)`}
                                />
                              )}

                              {/* Delay Indicator */}
                              {sub.baseline && sub.actual && sub.actual.end > sub.baseline.end && (
                                  <div 
                                    className="absolute bottom-0.5 xl:bottom-3 h-0.5 xl:h-1 bg-red-600 rounded-full z-20"
                                  style={{ 
                                    left: bPos.left + bPos.width, 
                                    width: getTaskPosition(sub.baseline.end, sub.actual.end).width - (zoom === 'day' ? columnWidth : zoom === 'week' ? columnWidth/7 : columnWidth/30) 
                                  }}
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
    </div>
  );
};

export default BaselineComparison;
