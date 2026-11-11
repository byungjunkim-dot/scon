import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleItem, Category, Status, AppSettings } from '../types';
import { differenceInDays, parseISO, format, isValid } from 'date-fns';
import { Plus, Save, Trash2, RotateCcw, Link2, Info, CheckCircle2, ArrowRight } from 'lucide-react';
import { calculateLinkedStartDate, calculateLinkedEndDate, getCascadeUpdates } from '../utils/scheduleLink';

interface ScheduleFormProps {
  onAdd: (item: Omit<ScheduleItem, 'id' | 'projectId'>, cascadeUpdates?: ScheduleItem[]) => void;
  onUpdate: (item: ScheduleItem, cascadeUpdates?: ScheduleItem[]) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  selectedItem: ScheduleItem | null;
  settings: AppSettings;
  allSchedules?: ScheduleItem[];
  autoScheduleLinkDefault?: boolean;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ 
  onAdd, onUpdate, onDelete, onReset, selectedItem, settings, allSchedules = [], autoScheduleLinkDefault = true
}) => {
  const initialForm: Omit<ScheduleItem, 'id' | 'projectId'> = {
    category: '공통관리',
    subCategory: '',
    taskName: '',
    siteName: '',
    dongBlock: '',
    zone: '',
    floor: '',
    detailLocation: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    duration: 1,
    progress: 0,
    status: '예정',
    periods: [],
    predecessor: '',
    contractor: '',
    memo: ''
  };

  const [formData, setFormData] = useState<Omit<ScheduleItem, 'id' | 'projectId'>>(initialForm);
  const [autoLink, setAutoLink] = useState<boolean>(() => {
    const saved = localStorage.getItem('cp_auto_schedule_link');
    return saved !== null ? saved !== 'false' : autoScheduleLinkDefault;
  });
  const [lagDays, setLagDays] = useState<number>(1);

  useEffect(() => {
    if (selectedItem) {
      const { id, projectId, ...rest } = selectedItem;
      setFormData(rest);
    } else {
      setFormData(initialForm);
    }
  }, [selectedItem]);

  // Available predecessors (excluding self and any tasks that would cause a cycle)
  const availablePredecessors = useMemo(() => {
    if (!allSchedules || allSchedules.length === 0) return [];
    const currentId = selectedItem?.id;
    return allSchedules.filter(s => {
      if (currentId && s.id === currentId) return false;
      // Also prevent direct back-reference (A has pred B, so B shouldn't pick A)
      if (currentId && s.predecessor === currentId) return false;
      return true;
    });
  }, [allSchedules, selectedItem?.id]);

  // Currently selected predecessor task object
  const currentPredecessor = useMemo(() => {
    if (!formData.predecessor) return null;
    return allSchedules.find(s => s.id === formData.predecessor) || null;
  }, [allSchedules, formData.predecessor]);

  // Downstream tasks that will be cascaded when this task changes
  const downstreamTasks = useMemo(() => {
    if (!selectedItem || !allSchedules) return [];
    return allSchedules.filter(s => s.predecessor === selectedItem.id);
  }, [selectedItem, allSchedules]);

  const subCategories = useMemo(() => {
    if (!formData.category || !settings.taskMaster[formData.category]) return [];
    return Object.keys(settings.taskMaster[formData.category]);
  }, [formData.category, settings.taskMaster]);

  const taskNames = useMemo(() => {
    if (!formData.category || !formData.subCategory || !settings.taskMaster[formData.category]?.[formData.subCategory]) return [];
    return settings.taskMaster[formData.category][formData.subCategory];
  }, [formData.category, formData.subCategory, settings.taskMaster]);

  // Toggle Auto Schedule Link
  const handleToggleAutoLink = (enabled: boolean) => {
    setAutoLink(enabled);
    localStorage.setItem('cp_auto_schedule_link', String(enabled));

    // If turned on and predecessor is already selected, immediately link dates
    if (enabled && currentPredecessor) {
      applyPredecessorLink(currentPredecessor.id, lagDays);
    }
  };

  // Apply predecessor linking
  const applyPredecessorLink = (predId: string, lag: number) => {
    const pred = allSchedules.find(s => s.id === predId);
    if (pred && pred.endDate) {
      const newStart = calculateLinkedStartDate(pred.endDate, lag);
      const curDuration = Math.max(1, formData.duration || 1);
      const newEnd = calculateLinkedEndDate(newStart, curDuration);
      setFormData(prev => ({
        ...prev,
        predecessor: predId,
        startDate: newStart,
        endDate: newEnd,
        duration: curDuration
      }));
    } else {
      setFormData(prev => ({ ...prev, predecessor: predId }));
    }
  };

  // Change Predecessor
  const handlePredecessorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const predId = e.target.value;
    if (autoLink && predId) {
      applyPredecessorLink(predId, lagDays);
    } else {
      setFormData(prev => ({ ...prev, predecessor: predId }));
    }
  };

  // Change Lag Days
  const handleLagChange = (newLag: number) => {
    setLagDays(newLag);
    if (autoLink && formData.predecessor) {
      applyPredecessorLink(formData.predecessor, newLag);
    }
  };

  // Auto-select immediately preceding task
  const handleAutoSelectPrevTask = () => {
    if (availablePredecessors.length === 0) return;
    const lastTask = availablePredecessors[availablePredecessors.length - 1];
    if (lastTask) {
      applyPredecessorLink(lastTask.id, lagDays);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let updatedData = { ...formData, [name]: value };

    if (name === 'progress') {
      const numValue = parseInt(value) || 0;
      updatedData.progress = Math.min(100, Math.max(0, numValue));
    }

    // Reset dependent fields when parent changes
    if (name === 'category') {
      updatedData.subCategory = '';
      updatedData.taskName = '';
      updatedData.contractor = '';
    } else if (name === 'subCategory') {
      updatedData.taskName = '';
    }

    // Handle Start Date change
    if (name === 'startDate') {
      const curDuration = Math.max(1, formData.duration || 1);
      updatedData.endDate = calculateLinkedEndDate(value, curDuration);
    }

    // Handle End Date change
    if (name === 'endDate') {
      try {
        const start = parseISO(updatedData.startDate);
        const end = parseISO(value);
        if (isValid(start) && isValid(end)) {
          if (end < start) {
            updatedData.startDate = value;
            updatedData.duration = 1;
          } else {
            updatedData.duration = differenceInDays(end, start) + 1;
          }
        }
      } catch (err) {}
    }

    // Handle Duration change
    if (name === 'duration') {
      const dur = Math.max(1, parseInt(value) || 1);
      updatedData.duration = dur;
      updatedData.endDate = calculateLinkedEndDate(updatedData.startDate, dur);
    }

    setFormData(updatedData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let cascadeUpdates: ScheduleItem[] = [];
    if (autoLink && selectedItem && allSchedules.length > 0) {
      const fullItem: ScheduleItem = {
        ...formData,
        id: selectedItem.id,
        projectId: selectedItem.projectId
      };
      cascadeUpdates = getCascadeUpdates(fullItem, allSchedules, lagDays);
    }

    if (selectedItem) {
      onUpdate(
        { ...formData, id: selectedItem.id, projectId: selectedItem.projectId },
        cascadeUpdates
      );
    } else {
      onAdd(formData, cascadeUpdates);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Location Info */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">동/블록</label>
          <select 
            name="dongBlock" value={formData.dongBlock} onChange={handleChange}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          >
            <option value="">선택</option>
            {settings.dongBlocks.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">층</label>
          <select 
            name="floor" value={formData.floor} onChange={handleChange}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          >
            <option value="">선택</option>
            {settings.floors.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">구역</label>
          <select 
            name="zone" value={formData.zone} onChange={handleChange}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          >
            <option value="">선택</option>
            {settings.zones.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">공종 대분류</label>
          <select 
            name="category" 
            value={formData.category} 
            onChange={handleChange}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          >
            {settings.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">세부공종</label>
          <select 
            name="subCategory" 
            value={formData.subCategory} 
            onChange={handleChange}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          >
            <option value="">선택</option>
            {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">작업내용</label>
        <input 
          type="text"
          name="taskName" 
          list="task-options"
          value={formData.taskName} 
          onChange={handleChange}
          required
          placeholder="작업 내용을 입력하거나 선택하세요"
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
        />
        <datalist id="task-options">
          {taskNames.map(task => <option key={task} value={task} />)}
        </datalist>
      </div>

      {/* ============================================================== */}
      {/* 선행 공정 및 자동 일정 연결 (Auto Schedule Linking) 카드 */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border border-blue-200/70 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
              <Link2 size={14} />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-900 block leading-tight">자동 일정 연결</span>
              <span className="text-[10px] text-gray-500 font-normal">이전 공정의 종료일과 연동하여 시작일을 자동 설정합니다.</span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => handleToggleAutoLink(!autoLink)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
              autoLink 
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoLink ? 'bg-white' : 'bg-gray-400'}`}></span>
            <span>{autoLink ? '연동 켜짐 (ON)' : '연동 꺼짐 (OFF)'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-8 space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                선행 공정 (이전 공정)
              </label>
              {availablePredecessors.length > 0 && !formData.predecessor && (
                <button
                  type="button"
                  onClick={handleAutoSelectPrevTask}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline underline-offset-2"
                >
                  직전 공정 자동 선택
                </button>
              )}
            </div>
            <select
              name="predecessor"
              value={formData.predecessor}
              onChange={handlePredecessorChange}
              className="w-full bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">선행 공정 없음 (독립 일정)</option>
              {availablePredecessors.map(pred => (
                <option key={pred.id} value={pred.id}>
                  [{pred.category}] {pred.subCategory ? `${pred.subCategory} - ` : ''}{pred.taskName} (종료: {pred.endDate})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              시작 간격 (Lag)
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => handleLagChange(1)}
                className={`py-1.5 px-2 text-[10px] font-bold rounded-md border text-center transition-all cursor-pointer ${
                  lagDays === 1 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                title="선행 공정 종료 다음날 시작"
              >
                익일(+1일)
              </button>
              <button
                type="button"
                onClick={() => handleLagChange(0)}
                className={`py-1.5 px-2 text-[10px] font-bold rounded-md border text-center transition-all cursor-pointer ${
                  lagDays === 0 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                title="선행 공정 종료일과 같은 날 시작"
              >
                당일(+0일)
              </button>
            </div>
          </div>
        </div>

        {/* 연동 상태 피드백 안내 바 */}
        {currentPredecessor && (
          <div className="flex items-center gap-2 p-2 bg-white/90 rounded-lg border border-blue-200/80 text-[11px] text-blue-900 shadow-2xs">
            <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
            <div className="flex-1 truncate">
              <span className="font-semibold text-blue-700">'{currentPredecessor.taskName}'</span> 종료일(<b>{currentPredecessor.endDate}</b>) 기준
              <span className="mx-1.5 text-blue-400">➔</span>
              시작일 <b>{formData.startDate}</b> 자동 설정됨
            </div>
          </div>
        )}

        {/* 이 공정을 선행으로 둔 후속 공정 연쇄 알림 */}
        {downstreamTasks.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-amber-50/90 rounded-lg border border-amber-200 text-[11px] text-amber-900 shadow-2xs">
            <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-amber-800">후속 공정 {downstreamTasks.length}개 연동 안내:</span> 본 공정의 종료일이 변경되면 후속 공정({downstreamTasks.map(t => t.taskName).join(', ')})의 일정도 저장 시 자동으로 연동되어 함께 조정됩니다.
            </div>
          </div>
        )}
      </div>

      {/* Schedule Info (시작일, 종료일, 기간) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>시작일</span>
            {currentPredecessor && autoLink && (
              <span className="text-[9px] text-blue-600 font-semibold">자동 연동</span>
            )}
          </label>
          <input 
            type="date" 
            name="startDate" 
            value={formData.startDate} 
            onChange={handleChange} 
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">종료일</label>
          <input 
            type="date" 
            name="endDate" 
            value={formData.endDate} 
            onChange={handleChange} 
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">기간 (일)</label>
          <div className="relative">
            <input
              type="number"
              name="duration"
              min="1"
              value={formData.duration}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">일</span>
          </div>
        </div>
      </div>
      
      {/* Periods Management */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">세부 기간 (다중 구간)</label>
          <button 
            type="button"
            onClick={() => setFormData({...formData, periods: [...(formData.periods || []), { startDate: formData.startDate, endDate: formData.endDate }]})}
            className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
          >
            + 기간 추가
          </button>
        </div>
        {(formData.periods || []).map((period, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input 
              type="date"
              value={period.startDate}
              onChange={(e) => {
                const newPeriods = [...(formData.periods || [])];
                newPeriods[index].startDate = e.target.value;
                setFormData({...formData, periods: newPeriods});
              }}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 font-mono"
            />
            <ArrowRight size={12} className="text-gray-400 shrink-0" />
            <input 
              type="date"
              value={period.endDate}
              onChange={(e) => {
                const newPeriods = [...(formData.periods || [])];
                newPeriods[index].endDate = e.target.value;
                setFormData({...formData, periods: newPeriods});
              }}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 font-mono"
            />
            <button
               type="button"
               onClick={() => {
                 const newPeriods = (formData.periods || []).filter((_, i) => i !== index);
                 setFormData({...formData, periods: newPeriods});
               }}
               className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
               title="구간 삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Status Info */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">진행률 (%)</label>
            <div className="flex items-center gap-1">
              <input 
                type="number" name="progress" min="0" max="100" value={formData.progress} onChange={handleChange}
                className="w-12 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] font-bold text-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-right"
              />
              <span className="text-[10px] font-bold text-gray-400">%</span>
            </div>
          </div>
          <div className="h-[30px] flex items-center">
            <input 
              type="range" name="progress" min="0" max="100" value={formData.progress} onChange={handleChange}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">담당업체</label>
          <select 
            name="contractor" value={formData.contractor} onChange={handleChange}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          >
            <option value="">선택</option>
            {(settings.contractors[formData.category] || []).map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">상태</label>
          <select 
            name="status" value={formData.status} onChange={handleChange}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          >
            <option value="예정">예정</option>
            <option value="진행">진행</option>
            <option value="완료">완료</option>
            <option value="지연">지연</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">메모</label>
        <textarea 
          name="memo" value={formData.memo} onChange={handleChange} rows={2}
          placeholder="추가 정보를 입력하세요..."
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none placeholder:text-gray-300"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
        <button 
          type="submit" 
          className="flex-1 flex justify-center items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all text-xs font-bold shadow-sm shadow-blue-500/20 cursor-pointer"
        >
          {selectedItem ? <Save size={14} /> : <Plus size={14} />}
          {selectedItem ? '수정 완료 (자동 연동 저장)' : '공정 등록 (자동 연동)'}
        </button>
        {selectedItem && (
          <button 
            type="button" 
            onClick={() => {
              if (window.confirm('이 공정을 삭제하시겠습니까?')) {
                onDelete(selectedItem.id);
              }
            }}
            className="flex-none flex justify-center items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-lg hover:bg-red-100 active:scale-[0.98] transition-all text-xs font-bold cursor-pointer"
          >
            <Trash2 size={14} />
            삭제
          </button>
        )}
        <button 
          type="button" 
          onClick={onReset}
          className="flex-none flex justify-center items-center gap-1.5 bg-white text-gray-500 border border-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all text-xs font-bold cursor-pointer"
        >
          <RotateCcw size={14} />
          초기화
        </button>
      </div>
    </form>
  );
};

export default ScheduleForm;
