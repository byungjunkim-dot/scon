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
      if (!initialPersonnel || initialPersonnel.length === 0) {
        const baseTime = Date.now();
        setPersonnelList([
          { id: `${baseTime}-0`, discipline: '공통관리', contractor: '', direct: 0, outsourced: 0, other: 0, workTime: '주간' },
          { id: `${baseTime}-1`, discipline: '', contractor: '', direct: 0, outsourced: 0, other: 0, workTime: '주간' },
          { id: `${baseTime}-2`, discipline: '', contractor: '', direct: 0, outsourced: 0, other: 0, workTime: '주간' },
          { id: `${baseTime}-3`, discipline: '', contractor: '', direct: 0, outsourced: 0, other: 0, workTime: '주간' }
        ]);
      } else {
        const baseTime = Date.now();
        // Check if '공통관리' exists in initialPersonnel
        const commonMgmt = initialPersonnel.find(p => p.discipline === '공통관리');
        const others = initialPersonnel.filter(p => p.discipline !== '공통관리');
        
        const combined: DailyPersonnel[] = [
          commonMgmt || { id: `${baseTime}-cm`, discipline: '공통관리', contractor: '', direct: 0, outsourced: 0, other: 0, workTime: '주간' },
          ...others
        ];

        // Map existing elements to make sure workTime is '주간' if not set
        const mapped = combined.map(p => ({
          ...p,
          workTime: p.workTime || '주간'
        }));

        // Pad with empty rows up to at least 4 rows total
        while (mapped.length < 4) {
          mapped.push({
            id: `${baseTime}-pad-${mapped.length}`,
            discipline: '',
            contractor: '',
            direct: 0,
            outsourced: 0,
            other: 0,
            workTime: '주간'
          });
        }
        setPersonnelList(mapped);
      }
    }
  }, [isOpen, initialPersonnel]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setPersonnelList([
      ...personnelList,
      { id: Date.now().toString() + Math.random().toString(36).substring(2, 5), discipline: '', contractor: '', direct: 0, outsourced: 0, other: 0, workTime: '주간' }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setPersonnelList(personnelList.filter(p => p.id !== id));
  };

  const handleDisciplineChange = (id: string, newDiscipline: string) => {
    setPersonnelList(personnelList.map(p => {
      if (p.id !== id) return p;
      const availableContractors = (settings?.contractors && settings.contractors[newDiscipline]) || [];
      const contractorStillValid = Boolean(p.contractor && availableContractors.includes(p.contractor));
      return {
        ...p,
        discipline: newDiscipline,
        contractor: contractorStillValid ? p.contractor : ''
      };
    }));
  };

  const handleChange = (id: string, field: keyof DailyPersonnel, value: string | number) => {
    setPersonnelList(personnelList.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSave = () => {
    // Filter out rows that have no worker counts and no contractor
    const validPersonnel = personnelList.filter(p => 
      p.discipline.trim() !== '' && (
        Number(p.direct) > 0 || 
        Number(p.outsourced) > 0 || 
        Number(p.other) > 0 || 
        Boolean(p.contractor && p.contractor.trim() !== '')
      )
    );
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
          className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 bg-gray-50">
            <div>
              <h2 className="text-lg font-bold text-gray-900">출력 인원 현황 입력</h2>
              <p className="text-xs text-gray-500 mt-0.5">공종별 투입 인원 및 업체를 입력합니다.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
              <X size={20} />
            </button>
          </div>

          <div className="p-3.5 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-600 font-semibold md:hidden">
                총 투입: <span className="text-blue-600 font-black text-sm">{totalSum}</span>명
              </div>
              <div className="hidden md:block" />
              <button 
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs sm:text-sm font-bold cursor-pointer ml-auto"
              >
                <Plus size={16} /> 공종/업체 추가
              </button>
            </div>

            {/* 모바일 전용: 공종별 2줄 입력 - 테두리 없는 가로 구분선 레이아웃 (md:hidden) */}
            <div className="md:hidden divide-y divide-gray-200">
              {personnelList.map((p) => {
                const availableContractors = p.discipline && settings?.contractors ? (settings.contractors[p.discipline] || []) : [];
                const rowTotal = (Number(p.direct) || 0) + (Number(p.outsourced) || 0) + (Number(p.other) || 0);

                return (
                  <div key={p.id} className="py-3.5 first:pt-1 space-y-2">
                    {/* 1번째 줄: 공종 / 업체 / 계 (+ 삭제) */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="flex-[1.1] min-w-0">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">공종</label>
                        <select
                          value={p.discipline}
                          onChange={(e) => handleDisciplineChange(p.id, e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        >
                          <option value="">공종 선택</option>
                          {settings?.categories?.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-[1.3] min-w-0">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">업체</label>
                        <select
                          value={p.contractor || ''}
                          onChange={(e) => handleChange(p.id, 'contractor', e.target.value)}
                          disabled={!p.discipline}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="">{p.discipline ? (availableContractors.length > 0 ? '업체 선택' : '등록업체 없음') : '공종 먼저 선택'}</option>
                          {availableContractors.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          {p.contractor && !availableContractors.includes(p.contractor) && (
                            <option value={p.contractor}>{p.contractor} (기존/미등록)</option>
                          )}
                        </select>
                      </div>

                      <div className="w-14 text-center flex-shrink-0">
                        <label className="block text-[11px] font-bold text-blue-600 mb-1">계</label>
                        <div className="h-[34px] flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-700 font-black text-xs rounded-lg">
                          {rowTotal}
                        </div>
                      </div>

                      <div className="pt-4 flex-shrink-0">
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

                    {/* 2번째 줄: 관리자 / 작업자 / 기타 / 작업시간 */}
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5 text-center">관리자</label>
                        <input 
                          type="number" 
                          min="0"
                          value={p.direct === 0 ? '' : p.direct} 
                          placeholder="0"
                          onChange={(e) => handleChange(p.id, 'direct', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-1 py-1.5 text-xs text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5 text-center">작업자</label>
                        <input 
                          type="number" 
                          min="0"
                          value={p.outsourced === 0 ? '' : p.outsourced} 
                          placeholder="0"
                          onChange={(e) => handleChange(p.id, 'outsourced', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-1 py-1.5 text-xs text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5 text-center">기타</label>
                        <input 
                          type="number" 
                          min="0"
                          value={p.other === 0 ? '' : p.other} 
                          placeholder="0"
                          onChange={(e) => handleChange(p.id, 'other', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-1 py-1.5 text-xs text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5 text-center">작업시간</label>
                        <select
                          value={p.workTime || '주간'}
                          onChange={(e) => handleChange(p.id, 'workTime', e.target.value)}
                          className="w-full px-1 py-1.5 text-xs text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        >
                          <option value="주간">주간</option>
                          <option value="연장">연장</option>
                          <option value="야간">야간</option>
                          <option value="철야">철야</option>
                          <option value="조출">조출</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 모바일 총계 요약 카드 */}
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 text-xs mt-3">
                <div className="flex justify-between items-center font-bold text-blue-950 mb-1.5">
                  <span>총 투입 인원</span>
                  <span className="text-sm font-black text-blue-600">{totalSum}명</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-blue-800 text-center pt-1.5 border-t border-blue-200/60">
                  <div>관리자 <strong className="font-bold text-blue-950">{totalDirect}</strong>명</div>
                  <div>작업자 <strong className="font-bold text-blue-950">{totalOutsourced}</strong>명</div>
                  <div>기타 <strong className="font-bold text-blue-950">{totalOther}</strong>명</div>
                </div>
              </div>
            </div>

            {/* 데스크톱/태블릿 전용: 테이블 레이아웃 (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead className="bg-gray-100 text-gray-800">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-center w-36">공종</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-48">업체</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">관리자</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">작업자</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">기타</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-28">작업시간</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-24">계</th>
                    <th className="border border-gray-200 px-3 py-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {personnelList.map((p) => {
                    const availableContractors = p.discipline && settings?.contractors ? (settings.contractors[p.discipline] || []) : [];
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="border border-gray-200 px-2 py-1">
                          <select
                            value={p.discipline}
                            onChange={(e) => handleDisciplineChange(p.id, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                          >
                            <option value="">공종 선택</option>
                            {settings?.categories?.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          <select
                            value={p.contractor || ''}
                            onChange={(e) => handleChange(p.id, 'contractor', e.target.value)}
                            disabled={!p.discipline}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <option value="">{p.discipline ? (availableContractors.length > 0 ? '업체 선택' : '등록된 업체 없음') : '공종 먼저 선택'}</option>
                            {availableContractors.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            {p.contractor && !availableContractors.includes(p.contractor) && (
                              <option value={p.contractor}>{p.contractor} (기존/미등록)</option>
                            )}
                          </select>
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          <input 
                            type="number" 
                            min="0"
                            value={p.direct === 0 ? '' : p.direct} 
                            placeholder="0"
                            onChange={(e) => handleChange(p.id, 'direct', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                          />
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          <input 
                            type="number" 
                            min="0"
                            value={p.outsourced === 0 ? '' : p.outsourced} 
                            placeholder="0"
                            onChange={(e) => handleChange(p.id, 'outsourced', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                          />
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          <input 
                            type="number" 
                            min="0"
                            value={p.other === 0 ? '' : p.other} 
                            placeholder="0"
                            onChange={(e) => handleChange(p.id, 'other', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right"
                          />
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          <select
                            value={p.workTime || '주간'}
                            onChange={(e) => handleChange(p.id, 'workTime', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                          >
                            <option value="주간">주간</option>
                            <option value="연장">연장</option>
                            <option value="야간">야간</option>
                            <option value="철야">철야</option>
                            <option value="조출">조출</option>
                          </select>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center font-bold bg-gray-50 text-gray-700">
                          {(Number(p.direct) || 0) + (Number(p.outsourced) || 0) + (Number(p.other) || 0)}
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
                    );
                  })}
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan={2} className="border border-gray-200 px-3 py-2 text-center text-blue-900">총계</td>
                    <td className="border border-gray-200 px-3 py-2 text-right text-blue-700">{totalDirect}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right text-blue-700">{totalOutsourced}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right text-blue-700">{totalOther}</td>
                    <td className="border border-gray-200 px-3 py-2"></td>
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
