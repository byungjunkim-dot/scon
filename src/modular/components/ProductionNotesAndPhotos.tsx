import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Image as ImageIcon, 
  Check, 
  X, 
  Calendar,
  RotateCcw
} from 'lucide-react';
import { ProductionDayData, ProductionPhoto } from '../../types';
import { compressImage } from '../../utils/image';
import { supabaseService } from '../../services/supabaseService';
import { isSupabaseConfigured } from '../../lib/supabase';

const NOTE_CATEGORIES = [
  '기타', '프레임', '슬라브', '내외장', '절단', '용접', '도장', 
  '누락', '자재', '출고', '포장', '보양', '위치', '고정', '부착', '치수'
];

interface ProductionNotesAndPhotosProps {
  projectId: string;
  projectName?: string;
  className?: string;
  onSaved?: () => void;
}

export const ProductionNotesAndPhotos: React.FC<ProductionNotesAndPhotosProps> = ({
  projectId,
  projectName,
  className = '',
  onSaved
}) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr);

  const [allDaysData, setAllDaysData] = useState<Record<string, ProductionDayData>>(() => {
    if (!projectId) return {};
    const saved = localStorage.getItem(`cp_production_data_${projectId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse production data:', e);
      }
    }
    return {};
  });

  const [currentDayData, setCurrentDayData] = useState<ProductionDayData>(() => {
    const today = getTodayStr();
    const existing = allDaysData[today];
    if (existing) return existing;
    return {
      id: today,
      projectId,
      date: today,
      steel: 0,
      single: 0,
      moduleFrame: 0,
      slab: 0,
      interiorExterior: 0,
      finished: 0,
      shipped: 0,
      notes: JSON.stringify([
        { category: '기타', content: '' }
      ]),
      photos: []
    };
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<ProductionPhoto | null>(null);

  // 1. Initial load from localStorage and Supabase
  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    const loadData = async () => {
      // 1) Load from localStorage first
      const saved = localStorage.getItem(`cp_production_data_${projectId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (isMounted) {
            setAllDaysData(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      }

      // 2) Load from Supabase
      if (isSupabaseConfigured) {
        try {
          const daysMap = await supabaseService.getProductionDays(projectId);
          if (daysMap && Object.keys(daysMap).length > 0 && isMounted) {
            setAllDaysData(daysMap);
            localStorage.setItem(`cp_production_data_${projectId}`, JSON.stringify(daysMap));
          }
        } catch (err) {
          console.warn('Supabase getProductionDays warn:', err);
        }
      }
    };

    loadData();

    // Listen to external updates from ProductionStatusView
    const handleSync = () => {
      const updatedSaved = localStorage.getItem(`cp_production_data_${projectId}`);
      if (updatedSaved) {
        try {
          const parsed = JSON.parse(updatedSaved);
          setAllDaysData(parsed);
        } catch (e) {}
      }
    };

    window.addEventListener('production_data_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      isMounted = false;
      window.removeEventListener('production_data_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [projectId]);

  // 2. Sync currentDayData when selectedDate or allDaysData updates
  useEffect(() => {
    const dataForDate = allDaysData[selectedDate];
    if (dataForDate) {
      setCurrentDayData(dataForDate);
    } else {
      setCurrentDayData({
        id: selectedDate,
        projectId,
        date: selectedDate,
        steel: 0,
        single: 0,
        moduleFrame: 0,
        slab: 0,
        interiorExterior: 0,
        finished: 0,
        shipped: 0,
        notes: JSON.stringify([{ category: '기타', content: '' }]),
        photos: []
      });
    }
    setIsDirty(false);
  }, [selectedDate, allDaysData, projectId]);

  // Helper notice
  const showNotice = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Structured notes parsing
  const structuredNotes = useMemo<{ category: string; content: string }[]>(() => {
    try {
      if (currentDayData.notes && currentDayData.notes.trim().startsWith('[')) {
        const parsed = JSON.parse(currentDayData.notes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            category: String(item.category || '기타'),
            content: String(item.content || '')
          }));
        }
      }
    } catch (e) {}

    return currentDayData.notes
      ? [{ category: '기타', content: currentDayData.notes }]
      : [{ category: '기타', content: '' }];
  }, [currentDayData.notes]);

  const updateStructuredNote = (index: number, field: 'category' | 'content', value: string) => {
    const updated = [...structuredNotes];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setCurrentDayData(prev => ({
      ...prev,
      notes: JSON.stringify(updated)
    }));
    setIsDirty(true);
  };

  const handleAddStructuredNote = () => {
    const updated = [...structuredNotes, { category: '기타', content: '' }];
    setCurrentDayData(prev => ({
      ...prev,
      notes: JSON.stringify(updated)
    }));
    setIsDirty(true);
  };

  const handleRemoveStructuredNote = (index: number) => {
    let updated = structuredNotes.filter((_, idx) => idx !== index);
    if (updated.length === 0) {
      updated = [{ category: '기타', content: '' }];
    }
    setCurrentDayData(prev => ({
      ...prev,
      notes: JSON.stringify(updated)
    }));
    setIsDirty(true);
  };

  // Image Upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsCompressing(true);

    try {
      const filesArray: File[] = Array.from(e.target.files);
      const newPhotos: ProductionPhoto[] = [];

      for (const file of filesArray) {
        let photoUrl = '';

        if (isSupabaseConfigured && projectId) {
          try {
            const fileName = `production_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
            photoUrl = await supabaseService.uploadImage(file, fileName);
          } catch (storageErr) {
            console.warn('Supabase storage fallback to base64:', storageErr);
          }
        }

        if (!photoUrl) {
          photoUrl = await compressImage(file, 500);
        }

        newPhotos.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          url: photoUrl,
          title: ''
        });
      }

      setCurrentDayData(prev => ({
        ...prev,
        photos: [...(prev.photos || []), ...newPhotos]
      }));
      setIsDirty(true);
      showNotice(`사진 ${newPhotos.length}장이 추가되었습니다. [저장]을 눌러 반영하세요.`);
    } catch (err) {
      console.error(err);
      showNotice('사진 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCompressing(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    setCurrentDayData(prev => ({
      ...prev,
      photos: (prev.photos || []).filter(p => p.id !== photoId)
    }));
    setIsDirty(true);
  };

  const handlePhotoTitleChange = (photoId: string, text: string) => {
    setCurrentDayData(prev => ({
      ...prev,
      photos: (prev.photos || []).map(p => p.id === photoId ? { ...p, title: text } : p)
    }));
    setIsDirty(true);
  };

  // Save currentDayData to localStorage and Supabase
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedAll = {
        ...allDaysData,
        [selectedDate]: currentDayData
      };

      setAllDaysData(updatedAll);
      localStorage.setItem(`cp_production_data_${projectId}`, JSON.stringify(updatedAll));

      // Dispatch event for other tabs / views like ProductionStatusView
      window.dispatchEvent(new CustomEvent('production_data_updated', { detail: { projectId, selectedDate } }));

      if (isSupabaseConfigured && projectId) {
        try {
          await supabaseService.saveProductionDay(projectId, currentDayData, updatedAll);
        } catch (supabaseErr) {
          console.warn('Supabase save warn:', supabaseErr);
        }
      }

      setIsDirty(false);
      showNotice(`${selectedDate} 특기사항 및 현황사진이 저장되었습니다.`);
      onSaved?.();
    } catch (err) {
      console.error('Failed to save production notes/photos:', err);
      showNotice('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-xs p-4 sm:p-5 ${className}`}>
      {/* Top Header / Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg shadow-xs text-xs font-semibold text-gray-700">
            <Calendar size={14} className="text-blue-600" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
            />
            {selectedDate !== getTodayStr() && (
              <button 
                type="button"
                onClick={() => setSelectedDate(getTodayStr())}
                className="text-[10px] text-blue-600 hover:underline font-normal ml-1"
                title="오늘 날짜로 이동"
              >
                오늘
              </button>
            )}
          </div>
          {saveMessage && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md animate-fade-in">
              <Check size={13} />
              {saveMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isDirty 
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>저장 중...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>{isDirty ? '변경사항 저장' : '저장'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid: [특기사항] & [현황 사진 업로드] */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: 특기사항 */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-gray-900 tracking-tight">특기사항</h3>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
                {structuredNotes.filter(n => n.content.trim()).length}건
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddStructuredNote}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-blue-600 hover:bg-blue-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>항목 추가</span>
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[320px] pr-1">
            {structuredNotes.map((note, index) => (
              <div key={index} className="flex flex-col gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100 transition-colors group lg:flex-row lg:items-start lg:p-1.5">
                <div className="flex items-center justify-between gap-2 lg:contents">
                  <select
                    value={note.category}
                    onChange={(e) => updateStructuredNote(index, 'category', e.target.value)}
                    className="text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 rounded-md px-2.5 py-1.5 border border-gray-200 focus:ring-1 focus:ring-blue-500 focus:outline-none shrink-0 cursor-pointer"
                  >
                    {NOTE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveStructuredNote(index)}
                    className="lg:hidden p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0 cursor-pointer"
                    title="항목 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={note.content}
                  onChange={(e) => updateStructuredNote(index, 'content', e.target.value)}
                  placeholder="특기사항 내용을 입력해 주세요."
                  className="flex-1 resize-none text-xs border border-gray-200 rounded-md p-2 bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-gray-800 leading-relaxed transition-all placeholder:text-gray-400"
                />

                <button
                  type="button"
                  onClick={() => handleRemoveStructuredNote(index)}
                  className="hidden lg:block p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0 cursor-pointer mt-0.5 opacity-60 group-hover:opacity-100"
                  title="항목 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: 현황사진 업로드 */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-gray-900 tracking-tight">현황사진 업로드</h3>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
                {(currentDayData.photos || []).length}장
              </span>
            </div>
            <label className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-blue-600 hover:bg-blue-50 text-xs font-semibold transition-colors cursor-pointer">
              <Plus size={13} />
              <span>사진 추가</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex-1">
            {isCompressing && (
              <div className="p-4 mb-3 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center space-y-1">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent"></div>
                <p className="text-xs font-medium text-gray-500">이미지 압축 및 처리 중...</p>
              </div>
            )}

            {(currentDayData.photos || []).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1">
                {(currentDayData.photos || []).map((photo) => (
                  <div key={photo.id} className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-2xs flex flex-col justify-between">
                    <div 
                      className="relative aspect-video bg-slate-900 overflow-hidden cursor-zoom-in"
                      onClick={() => setPreviewPhoto(photo)}
                    >
                      <img 
                        src={photo.url} 
                        alt={photo.title || '현황사진'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo.id);
                        }}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md hover:bg-red-700 transition-all shadow-md opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                        title="사진 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="p-1.5 bg-white border-t border-gray-100">
                      <input
                        type="text"
                        value={photo.title}
                        onChange={(e) => handlePhotoTitleChange(photo.id, e.target.value)}
                        placeholder="사진 설명 입력"
                        className="w-full text-[11px] font-medium text-gray-800 border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 px-1 py-0.5 focus:ring-0 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center bg-gray-50 rounded-xl flex flex-col items-center justify-center space-y-1 min-h-[90px] border border-dashed border-gray-200">
                <ImageIcon size={20} className="text-gray-300" />
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-bold text-gray-700">업로드된 현황사진이 없습니다</h4>
                  <p className="text-[9px] text-gray-400">위의 [사진 추가] 버튼을 눌러 촬영 사진을 등록해 주세요.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setPreviewPhoto(null)}
        >
          <div 
            className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
              <h4 className="text-sm font-bold text-gray-900">
                {previewPhoto.title || '현황 사진 미리보기'}
              </h4>
              <button 
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 bg-slate-900 flex items-center justify-center overflow-auto max-h-[70vh]">
              <img 
                src={previewPhoto.url} 
                alt={previewPhoto.title || '미리보기'} 
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
