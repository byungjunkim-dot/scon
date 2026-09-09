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
          <div className="flex items-center justify-between p-3.5 sm:p-5 md:p-6 border-b border-gray-100 bg-gray-50">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">장비 투입 현황 입력</h2>
              <p className="text-xs text-gray-500 mt-0.5">공종별 투입 장비 및 규격을 입력합니다.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
              <X size={20} />
            </button>
          </div>

          <div className="p-3.5 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-600 font-semibold md:hidden">
                총 투입: <span className="text-blue-600 font-black text-sm">{totalQuantity}</span>대
              </div>
              <div className="hidden md:block" />
              <button 
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs sm:text-sm font-bold cursor-pointer ml-auto"
              >
                <Plus size={16} /> 장비 추가
              </button>
            </div>

            {/* 모바일 전용: 장비별 2줄 입력 - 테두리 없는 가로 구분선 레이아웃 (md:hidden) */}
            <div className="md:hidden divide-y divide-gray-200">
              {equipmentList.map((p) => (
                <div key={p.id} className="py-3.5 first:pt-1 space-y-2">
                  {/* 1번째 줄: 공종 / 장비명 / 용량·규격 */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="flex-[1] min-w-0">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">공종</label>
                      <select
                        value={p.discipline || ''}
                        onChange={(e) => handleChange(p.id, 'discipline', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      >
                        <option value="">공종 선택</option>
                        {settings?.categories?.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-[1.4] min-w-0">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">장비명</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          list={`equipment-mobile-list-${p.id}`}
                          value={p.type} 
                          onChange={(e) => handleChange(p.id, 'type', e.target.value)}
                          placeholder="장비명 입력"
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        />
                        <datalist id={`equipment-mobile-list-${p.id}`}>
                          {settings?.equipmentMaster?.map(item => (
                            <option key={item} value={item} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="flex-[1.1] min-w-0">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">용량/규격</label>
                      <input 
                        type="text" 
                        value={p.capacity} 
                        onChange={(e) => handleChange(p.id, 'capacity', e.target.value)}
                        placeholder="규격 입력"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* 2번째 줄: 대수 / 비고 / 행 삭제 버튼 */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-14 sm:w-16 flex-shrink-0">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5 text-center">대수</label>
                      <input 
                        type="number" 
                        min="0"
                        value={p.quantity === 0 ? '' : p.quantity} 
                        placeholder="0"
                        onChange={(e) => handleChange(p.id, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-1 py-1.5 text-xs text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">비고</label>
                      <input 
                        type="text" 
                        value={p.note} 
                        onChange={(e) => handleChange(p.id, 'note', e.target.value)}
                        placeholder="비고 입력 (작업위치, 용도 등)"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="pt-3.5 flex-shrink-0">
                      <button 
                        type="button"
                        onClick={() => handleRemoveRow(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="행 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* 모바일 총계 요약 카드 */}
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 text-xs mt-3 flex justify-between items-center">
                <span className="font-bold text-blue-950">총 투입 장비</span>
                <span className="text-sm font-black text-blue-600">{totalQuantity}대</span>
              </div>
            </div>

            {/* 데스크톱/태블릿 전용: 테이블 레이아웃 (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
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
                        <div className="relative">
                          <input 
                            type="text" 
                            list={`equipment-list-${p.id}`}
                            value={p.type} 
                            onChange={(e) => handleChange(p.id, 'type', e.target.value)}
                            placeholder="장비명 입력 또는 선택"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                          <datalist id={`equipment-list-${p.id}`}>
                            {settings?.equipmentMaster?.map(item => (
                              <option key={item} value={item} />
                            ))}
                          </datalist>
                        </div>
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
                          value={p.quantity === 0 ? '' : p.quantity} 
                          placeholder="0"
                          onChange={(e) => handleChange(p.id, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}
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
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="행 삭제"
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
