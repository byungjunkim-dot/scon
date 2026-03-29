import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2 } from 'lucide-react';
import { DailyEquipment, AppSettings } from '../types';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (equipment: DailyEquipment[]) => void;
  initialEquipment: DailyEquipment[];
  settings: AppSettings;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({ isOpen, onClose, onSave, initialEquipment, settings }) => {
  const [equipmentList, setEquipmentList] = useState<DailyEquipment[]>([]);

  useEffect(() => {
    if (isOpen) {
      setEquipmentList(initialEquipment.length > 0 ? initialEquipment : [
        { id: Date.now().toString(), discipline: '', type: '', capacity: '', quantity: 0, note: '' }
      ]);
    }
  }, [isOpen, initialEquipment]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setEquipmentList([
      ...equipmentList,
      { id: Date.now().toString(), discipline: '', type: '', capacity: '', quantity: 0, note: '' }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setEquipmentList(equipmentList.filter(p => p.id !== id));
  };

  const handleChange = (id: string, field: keyof DailyEquipment, value: string | number) => {
    setEquipmentList(equipmentList.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSave = () => {
    // Filter out empty rows
    const validEquipment = equipmentList.filter(p => p.type.trim() !== '' || p.quantity > 0);
    onSave(validEquipment);
  };

  const totalQuantity = equipmentList.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">장비 투입 현황 입력</h2>
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
                <Plus size={16} /> 장비 추가
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead className="bg-gray-100 text-gray-800">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-center w-32">공종</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-40">장비명</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-32">용량/규격</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">대수</th>
                    <th className="border border-gray-200 px-3 py-2 text-center">비고</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentList.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-2 py-1">
                        <select
                          value={p.discipline || ''}
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
                          type="text" 
                          value={p.type} 
                          onChange={(e) => handleChange(p.id, 'type', e.target.value)}
                          placeholder="장비명 입력"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input 
                          type="text" 
                          value={p.capacity} 
                          onChange={(e) => handleChange(p.id, 'capacity', e.target.value)}
                          placeholder="규격 입력"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input 
                          type="number" 
                          min="0"
                          value={p.quantity} 
                          onChange={(e) => handleChange(p.id, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                        />
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <input 
                          type="text" 
                          value={p.note} 
                          onChange={(e) => handleChange(p.id, 'note', e.target.value)}
                          placeholder="비고"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
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
                    <td className="border border-gray-200 px-3 py-2 text-center text-blue-900" colSpan={3}>총계</td>
                    <td className="border border-gray-200 px-3 py-2 text-right text-blue-700">{totalQuantity}</td>
                    <td className="border border-gray-200 px-3 py-2" colSpan={2}></td>
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
