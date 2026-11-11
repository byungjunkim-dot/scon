import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Image as ImageIcon, Trash2 } from 'lucide-react';
import { DailyPhoto, AppSettings } from '../types';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (photo: DailyPhoto) => void;
  onDelete?: (photo: DailyPhoto) => void;
  photo: DailyPhoto | null;
  settings: AppSettings;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  photo, 
  settings 
}) => {
  const [formData, setFormData] = useState<Partial<DailyPhoto>>({
    title: '',
    category: '',
    subCategory: '',
    description: ''
  });
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setIsConfirmingDelete(false);
    if (photo) {
      setFormData({
        title: photo.title || '',
        category: photo.category || '',
        subCategory: photo.subCategory || '',
        description: photo.description || ''
      });
    } else {
      setFormData({
        title: '',
        category: '',
        subCategory: '',
        description: ''
      });
    }
  }, [photo, isOpen]);

  const handleSave = () => {
    if (!photo) return;
    onSave({
      ...photo,
      title: formData.title,
      category: formData.category,
      subCategory: formData.subCategory,
      description: formData.description
    });
    onClose();
  };

  const handleDelete = () => {
    if (!photo || !onDelete) return;
    onDelete(photo);
    onClose();
  };

  const categories = settings.categories || [];
  const subCategories = formData.category ? (settings.taskMaster[formData.category] ? Object.keys(settings.taskMaster[formData.category]) : []) : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <ImageIcon size={20} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">사진 정보 입력</h3>
              </div>
              <div className="flex items-center gap-1">
                {onDelete && photo && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="p-2 hover:bg-red-50 rounded-full transition-colors text-gray-400 hover:text-red-600 cursor-pointer"
                    title="사진 삭제"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Photo Preview */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-inner">
                {photo?.url ? (
                  <img 
                    src={photo.url} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    이미지가 없습니다.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">공종</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  >
                    <option value="">공종 선택</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Sub Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">세부공종</label>
                  <select
                    value={formData.subCategory}
                    onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                    disabled={!formData.category}
                  >
                    <option value="">세부공종 선택</option>
                    {subCategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">사진 제목</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="사진 제목을 입력하세요"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">사진 설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="사진에 대한 추가 설명을 입력하세요"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
              {onDelete && photo ? (
                <div>
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2 bg-red-50/80 px-3 py-1.5 rounded-xl border border-red-200/80">
                      <span className="text-xs font-semibold text-red-600">사진을 삭제하시겠습니까?</span>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        삭제 확인
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsConfirmingDelete(false)}
                        className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="px-3.5 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors font-bold text-sm flex items-center gap-1.5 border border-red-200 bg-white cursor-pointer shadow-xs"
                    >
                      <Trash2 size={16} /> 사진 삭제
                    </button>
                  )}
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-bold text-sm cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Save size={18} /> 저장하기
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
