import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Image as ImageIcon } from 'lucide-react';
import { DailyPhoto, AppSettings } from '../types';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (photo: DailyPhoto) => void;
  photo: DailyPhoto | null;
  settings: AppSettings;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  photo, 
  settings 
}) => {
  const [formData, setFormData] = useState<Partial<DailyPhoto>>({
    title: '',
    category: '',
    subCategory: '',
    description: ''
  });

  useEffect(() => {
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
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
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
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-bold text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-bold text-sm flex items-center justify-center gap-2"
              >
                <Save size={18} /> 저장하기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
