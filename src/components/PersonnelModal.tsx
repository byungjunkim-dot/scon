import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2 } from 'lucide-react';
import { DailyPersonnel, AppSettings } from '../types';

interface PersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (personnel: DailyPersonnel[]) => void;
  initialPersonnel: DailyPersonnel[];
  settings: AppSettings;
}

export const PersonnelModal: React.FC<PersonnelModalProps> = ({ isOpen, onClose, onSave, initialPersonnel, settings }) => {
  const [personnelList, setPersonnelList] = useState<DailyPersonnel[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPersonnelList(initialPersonnel.length > 0 ? initialPersonnel : [
        { id: Date.now().toString(), discipline: '', direct: 0, outsourced: 0, other: 0 }
      ]);
    }
  }, [isOpen, initialPersonnel]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setPersonnelList([
      ...personnelList,
      { id: Date.now().toString(), discipline: '', direct: 0, outsourced: 0, other: 0 }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setPersonnelList(personnelList.filter(p => p.id !== id));
  };

  const handleChange = (id: string, field: keyof DailyPersonnel, value: string | number) => {
    setPersonnelList(personnelList.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSave = () => {
    // Filter out empty rows
    const validPersonnel = personnelList.filter(p => p.discipline.trim() !== '' || p.direct > 0 || p.outsourced > 0 || p.other > 0);
    onSave(validPersonnel);
  };

  const totalDirect = personnelList.reduce((sum, p) => sum + (Number(p.direct) || 0), 0);
  const totalOutsourced = personnelList.reduce((sum, p) => sum + (Number(p.outsourced) || 0), 0);
  const totalOther = personnelList.reduce((sum, p) => sum + (Number(p.other) || 0), 0);
  const totalSum = totalDirect + totalOutsourced + totalOther;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">출력 인원 현황 입력</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 md:p-6 overflow-y-auto flex-1">
            <div className="flex justify-end mb-4">
              <button 
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-bold"
              >
                <Plus size={16} /> 공종 추가
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead className="bg-gray-100 text-gray-800">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-center w-40">공종</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">직영</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">외주</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">기타</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">계</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {personnelList.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-2 py-1">
                        <select
                          value={p.discipline}
                          onChange={(e) => handleChange(p.id, 'discipline', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        >
                          <option value="">공종 선택</option>
                          {settings?.categories?.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input 
                          type="number" 
                          min="0"
                          value={p.direct} 
                          onChange={(e) => handleChange(p.id, 'direct', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                        />
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input 
                          type="number" 
                          min="0"
                          value={p.outsourced} 
                          onChange={(e) => handleChange(p.id, 'outsourced', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                        />
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input 
                          type="number" 
                          min="0"
                          value={p.other} 
                          onChange={(e) => handleChange(p.id, 'other', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                        />
                      </td>
                      <td className="border border-gray-200 px-2 py-1 text-center font-bold bg-gray-50 text-gray-700">
                        {(Number(p.direct) || 0) + (Number(p.outsourced) || 0) + (Number(p.other) || 0)}
                      </td>
                      <td className="border border-gray-200 px-2 py-1 text-center">
                        <button 
                          onClick={() => handleRemoveRow(p.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-bold">
                    <td className="border border-gray-200 px-3 py-2 text-center text-blue-900">총계</td>
                    <td className="border border-gray-200 px-3 py-2 text-right text-blue-700">{totalDirect}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right text-blue-700">{totalOutsourced}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right text-blue-700">{totalOther}</td>
                    <td className="border border-gray-200 px-3 py-2 text-center text-blue-900">{totalSum}</td>
                    <td className="border border-gray-200 px-3 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors"
            >
              취소
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
            >
              저장
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
