import React, { useState, useMemo } from 'react';
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
  endOfMonth
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ScheduleItem, Category, AppSettings } from '../types';
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical } from 'lucide-react';
import { motion } from 'motion/react';
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

interface BaselineGanttProps {
  items: ScheduleItem[];
  onAdd: (item: Omit<ScheduleItem, 'id'>) => void;
  onUpdate: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  onReorder: (items: ScheduleItem[]) => void;
  settings: AppSettings;
  zoom: 'day' | 'week' | 'month';
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
      className="flex h-10 border-b border-gray-50 last:border-0 group hover:bg-gray-50/50 transition-colors bg-white"
    >
      <div 
        onClick={() => onSelect(item)}
        className="sticky left-0 z-30 w-[75px] xl:w-[250px] flex-shrink-0 bg-white border-r border-gray-100 px-2 xl:px-4 flex items-center gap-2 group-hover:bg-gray-50/50 transition-colors pl-2 xl:pl-4 cursor-pointer"
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(item.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all flex-shrink-0"
          title="삭제"
        >
          <Trash2 size={14} />
        </button>
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <div 
            {...attributes} 
            {...listeners} 
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
          >
            <GripVertical size={14} />
          </div>
          <div className="text-xs text-gray-700 truncate">
            <span className="font-bold">{item.subCategory}</span>
            <span className="mx-1 text-gray-400">/</span>
            <span className="font-normal text-gray-600">{item.taskName}</span>
          </div>
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

        <motion.div 
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          className="absolute top-1/2 -translate-y-1/2 h-2 xl:h-4 rounded-full shadow-sm border border-black/5 origin-left z-10 hover:brightness-105 active:scale-[0.98] transition-all"
          style={{ 
            left, 
            width,
            backgroundColor: settings.categoryColors[item.category] || '#3b82f6'
          }}
        />
      </div>
    </div>
  );
};

const BaselineGantt: React.FC<BaselineGanttProps> = ({ items, onAdd, onUpdate, onDelete, onReorder, settings, zoom }) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
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
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };
  // Input state for new baseline item
  const [newCategory, setNewCategory] = useState<Category>(settings.categories[0]);
  const [newSubCategory, setNewSubCategory] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newStartDate, setNewStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newEndDate, setNewEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

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
    setNewSubCategory('');
    setNewTaskName('');
    setNewStartDate(format(new Date(), 'yyyy-MM-dd'));
    setNewEndDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  };

  const subCategories = useMemo(() => {
    if (!newCategory || !settings.taskMaster[newCategory]) return [];
    return Object.keys(settings.taskMaster[newCategory]);
  }, [newCategory, settings.taskMaster]);

  const taskNames = useMemo(() => {
    if (!newCategory || !newSubCategory || !settings.taskMaster[newCategory]?.[newSubCategory]) return [];
    return settings.taskMaster[newCategory][newSubCategory];
  }, [newCategory, newSubCategory, settings.taskMaster]);

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

  const groupedItems = useMemo(() => {
    const groups: Record<Category, ScheduleItem[]> = {} as any;
    // Initialize groups in the order of settings.categories
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
        style={{ left: `calc(var(--left-col-width, 250px) + ${todayLeft}px)` }}
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

      {/* Gantt Chart Area */}
      <div className="flex-1 overflow-auto no-scrollbar relative max-xl:[--left-col-width:75px] xl:[--left-col-width:250px]">
        <div className="min-w-full inline-block align-top">
          {/* Header */}
          <div className="flex sticky top-0 z-30 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
            <div className="sticky left-0 z-40 w-[75px] xl:w-[250px] flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center px-2 xl:px-4 py-2.5">
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
                        className="sticky left-0 z-30 flex items-center bg-slate-50/90 backdrop-blur-sm px-2 xl:px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors w-[75px] xl:w-[250px] flex-shrink-0 border-r border-gray-100"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                          {collapsedCategories.has(category) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </div>
                        <span className="ml-1 font-bold text-xs text-slate-700">{category}</span>
                        <span className="ml-2 px-1.5 py-0.5 bg-slate-200/50 text-slate-500 rounded text-[9px] font-bold">{catItems.length}</span>
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

      {/* Input Area at the bottom */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-end gap-4 max-w-5xl mx-auto">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">공종 대분류</label>
            <select 
              value={newCategory}
              onChange={(e) => {
                setNewCategory(e.target.value as Category);
                setNewSubCategory('');
              }}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {settings.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">세부공종</label>
            <select 
              value={newSubCategory}
              onChange={(e) => {
                setNewSubCategory(e.target.value);
                if (!editingId) setNewTaskName(e.target.value);
              }}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">선택하세요</option>
              {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-1">
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
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">종료일</label>
            <input 
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <button 
            onClick={handleAddOrUpdate}
            disabled={!newSubCategory || !newTaskName}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingId ? <Plus size={16} className="rotate-45" /> : <Plus size={16} />}
            {editingId ? '수정 완료' : '추가'}
          </button>
          
          {editingId && (
            <button 
              onClick={handleClear}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold text-xs transition-all"
            >
              취소
            </button>
          )}
        </div>
      </div>

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
