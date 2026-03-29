import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { DailyTask, AppSettings } from '../types';
import { motion } from 'motion/react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: DailyTask) => void;
  task?: DailyTask | null;
  type: 'today' | 'tomorrow';
  settings: AppSettings;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, task, type, settings }) => {
  const [formData, setFormData] = useState<DailyTask>({
    id: '',
    category: '',
    subCategory: '',
    taskName: '',
    location: '',
    dongBlock: '',
    floor: '',
    zone: '',
    amount: '',
    status: '진행',
    reason: ''
  });

  useEffect(() => {
    if (task) {
      setFormData(task);
    } else {
      setFormData({
        id: Date.now().toString(),
        category: '',
        subCategory: '',
        taskName: '',
        location: '',
        dongBlock: '',
        floor: '',
        zone: '',
        amount: '',
        status: '진행',
        reason: ''
      });
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'category') {
      setFormData({ ...formData, category: value, subCategory: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
      >
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">
            {type === 'today' ? '금일 작업 내역' : '명일 작업 계획'} {task ? '수정' : '추가'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">공종</label>
              <select name="category" value={formData.category} onChange={handleChange} className="w-full border rounded p-2 text-sm" required>
                <option value="">선택</option>
                {settings.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">세부공종</label>
              <select name="subCategory" value={formData.subCategory} onChange={handleChange} className="w-full border rounded p-2 text-sm" disabled={!formData.category} required>
                <option value="">선택</option>
                {formData.category && settings.taskMaster[formData.category] && Object.keys(settings.taskMaster[formData.category]).map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-600">작업명</label>
            <input type="text" name="taskName" value={formData.taskName} onChange={handleChange} className="w-full border rounded p-2 text-sm" required />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">동/블록</label>
              <select name="dongBlock" value={formData.dongBlock || ''} onChange={handleChange} className="w-full border rounded p-2 text-sm">
                <option value="">선택</option>
                {settings.dongBlocks.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">층</label>
              <select name="floor" value={formData.floor || ''} onChange={handleChange} className="w-full border rounded p-2 text-sm">
                <option value="">선택</option>
                {settings.floors.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">구역</label>
              <select name="zone" value={formData.zone || ''} onChange={handleChange} className="w-full border rounded p-2 text-sm">
                <option value="">선택</option>
                {settings.zones.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-600">작업량</label>
            <input type="text" name="amount" value={formData.amount} onChange={handleChange} className="w-full border rounded p-2 text-sm" />
          </div>

          {type === 'today' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">상태</label>
                <select name="status" value={formData.status || '진행'} onChange={handleChange} className="w-full border rounded p-2 text-sm">
                  <option value="진행">진행</option>
                  <option value="연기">연기</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">사유</label>
                <input type="text" name="reason" value={formData.reason || ''} onChange={handleChange} className="w-full border rounded p-2 text-sm" disabled={formData.status !== '연기'} />
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">취소</button>
            <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-1">
              <Save size={16} /> 저장
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
