import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ScheduleItem, AppSettings } from '../types';
import { Trash2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface ScheduleTableProps {
  items: ScheduleItem[];
  onSelect: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  selectedId: string | null;
  settings: AppSettings;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ items, onSelect, onDelete, selectedId, settings }) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="bg-white border-y xl:border border-gray-200 xl:rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm border-collapse table-fixed min-w-[450px] xl:min-w-[1000px]">
          <thead className="bg-gray-50/50 border-b border-gray-200 sticky top-0 z-20 backdrop-blur-sm">
            <tr>
              <th className="w-8 xl:w-12 px-2 xl:px-4 py-3 sticky left-0 z-30 bg-gray-50/50"></th>
              <th className="w-[68px] xl:w-36 px-2 xl:px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-8 xl:left-12 z-30 bg-gray-50/50">공종 / 세부공종</th>
              <th className="w-40 md:w-24 xl:w-auto px-3 xl:px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">작업명<span className="xl:hidden"> / 위치</span></th>
              <th className="hidden xl:table-cell w-40 px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">위치</th>
              <th className="w-24 xl:w-28 px-2 xl:px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">시작일<span className="xl:hidden"><br/>종료일</span></th>
              <th className="hidden xl:table-cell w-28 px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">종료일</th>
              <th className="w-24 xl:w-32 px-2 xl:px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">진행률<span className="xl:hidden"><br/>상태</span></th>
              <th className="hidden xl:table-cell w-24 px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center text-gray-400 font-medium">
                  등록된 공정이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => onSelect(item)}
                  className={`group cursor-pointer transition-all duration-200 ${selectedId === item.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-2 xl:px-4 py-4 text-center sticky left-0 z-10 bg-white group-hover:bg-gray-50">
                    <button 
                      onClick={(e) => handleDeleteClick(e, item.id)}
                      className="p-1 xl:p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                  <td className="px-2 xl:px-6 py-4 sticky left-8 xl:left-12 z-10 bg-white group-hover:bg-gray-50">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span 
                        className="inline-flex items-center px-1.5 xl:px-2 py-0.5 rounded-md text-[9px] xl:text-[10px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: settings.categoryColors[item.category] || '#3b82f6' }}
                      >
                        {item.category}
                      </span>
                      <span className="text-gray-500 font-medium text-[10px] xl:text-xs truncate w-full">{item.subCategory}</span>
                    </div>
                  </td>
                  <td className="w-40 md:w-24 xl:w-auto px-3 xl:px-6 py-4 font-semibold text-gray-900 truncate">
                    <div className="flex flex-col gap-1">
                      <span>{item.taskName}</span>
                      <div className="xl:hidden flex flex-col text-xs font-normal text-gray-500 mt-1">
                        <span>{item.dongBlock} {item.floor}</span>
                        <span className="text-[10px] text-gray-400">{item.zone}</span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden xl:table-cell px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-gray-700 font-medium text-xs">{item.dongBlock} {item.floor}</span>
                      <span className="text-gray-400 text-[10px]">{item.zone}</span>
                    </div>
                  </td>
                  <td className="px-2 xl:px-6 py-4 text-center text-gray-500 font-mono text-[10px] xl:text-[11px]">
                    <div className="flex flex-col gap-1 xl:block">
                      <span>{item.startDate}</span>
                      <span className="xl:hidden text-gray-400">{item.endDate}</span>
                    </div>
                  </td>
                  <td className="hidden xl:table-cell px-6 py-4 text-center text-gray-500 font-mono text-[11px]">{item.endDate}</td>
                  <td className="px-2 xl:px-6 py-4">
                    <div className="flex flex-col xl:flex-row items-center gap-1.5 xl:gap-3">
                      <div className="w-full flex items-center gap-1.5 xl:gap-3">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]" 
                          />
                        </div>
                        <span className="text-[9px] xl:text-[10px] font-bold text-gray-500 w-6 xl:w-8 text-right">{item.progress}%</span>
                      </div>
                      <div className="xl:hidden w-full flex justify-center mt-0.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border
                          ${item.status === '완료' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                            item.status === '진행중' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            item.status === '지연' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            'bg-amber-50 text-amber-600 border-amber-100'}
                        `}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden xl:table-cell px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border
                      ${item.status === '완료' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        item.status === '진행중' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        item.status === '지연' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        'bg-amber-50 text-amber-600 border-amber-100'}
                    `}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

export default ScheduleTable;
