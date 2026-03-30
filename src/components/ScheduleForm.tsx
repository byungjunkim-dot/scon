import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleItem, Category, Status, AppSettings } from '../types';
import { STATUSES } from '../constants';
import { differenceInDays, parseISO, format } from 'date-fns';
import { Plus, Save, Trash2, RotateCcw, Database } from 'lucide-react';

interface ScheduleFormProps {
  onAdd: (item: Omit<ScheduleItem, 'id'>) => void;
  onUpdate: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  selectedItem: ScheduleItem | null;
  settings: AppSettings;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ 
  onAdd, onUpdate, onDelete, onReset, selectedItem, settings
}) => {
  const initialForm: Omit<ScheduleItem, 'id'> = {
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
    predecessor: '',
    contractor: '',
    memo: ''
  };

  const [formData, setFormData] = useState<Omit<ScheduleItem, 'id'>>(initialForm);

  useEffect(() => {
    if (selectedItem) {
      const { id, ...rest } = selectedItem;
      setFormData(rest);
    } else {
      setFormData(initialForm);
    }
  }, [selectedItem]);

  const subCategories = useMemo(() => {
    if (!formData.category || !settings.taskMaster[formData.category]) return [];
    return Object.keys(settings.taskMaster[formData.category]);
  }, [formData.category, settings.taskMaster]);

  const taskNames = useMemo(() => {
    if (!formData.category || !formData.subCategory || !settings.taskMaster[formData.category]?.[formData.subCategory]) return [];
    return settings.taskMaster[formData.category][formData.subCategory];
  }, [formData.category, formData.subCategory, settings.taskMaster]);

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

    if (name === 'startDate' || name === 'endDate') {
      const start = parseISO(updatedData.startDate);
      const end = parseISO(updatedData.endDate);
      if (end < start) {
        if (name === 'startDate') updatedData.endDate = updatedData.startDate;
        else updatedData.startDate = updatedData.endDate;
      }
      updatedData.duration = differenceInDays(parseISO(updatedData.endDate), parseISO(updatedData.startDate)) + 1;
    }

    setFormData(updatedData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItem) {
      onUpdate({ ...formData, id: selectedItem.id });
    } else {
      onAdd(formData);
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

      {/* Schedule Info */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">시작일</label>
          <input 
            type="date" name="startDate" value={formData.startDate} onChange={handleChange} required
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">종료일</label>
          <input 
            type="date" name="endDate" value={formData.endDate} onChange={handleChange} required
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">기간 (일)</label>
          <div className="w-full bg-gray-100/50 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-bold text-gray-500 flex items-center h-[30px]">
            {formData.duration}일
          </div>
        </div>
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
          className="flex-1 flex justify-center items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 active:scale-[0.98] transition-all text-xs font-bold shadow-sm shadow-blue-500/20"
        >
          {selectedItem ? <Save size={14} /> : <Plus size={14} />}
          {selectedItem ? '수정 완료' : '공정 등록'}
        </button>
        <button 
          type="button" 
          onClick={onReset}
          className="flex-1 flex justify-center items-center gap-2 bg-white text-gray-500 border border-gray-200 px-4 py-2 rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all text-xs font-bold"
        >
          <RotateCcw size={14} />
          초기화
        </button>
      </div>
    </form>
  );
};

export default ScheduleForm;
