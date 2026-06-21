import React, { useState, useEffect, useMemo } from 'react';
import { Project, DailyPhoto } from '../types';
import { supabaseService } from '../services/supabaseService';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  parseISO,
  isToday,
  addMonths,
  subMonths
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Image as ImageIcon, ExternalLink, Calendar, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PhotoGalleryViewProps {
  project: Project | null;
}

interface GalleryPhoto extends DailyPhoto {
  source:
    | 'daily-report'
    | 'inspection'
    | 'material'
    | 'concrete'
    | 'quick-memo';
  date: string;
  sourceId: string;
  sourceLocalName?: string;
}

const getLocalQuickMemos = (projectId: string) => {
  try {
    const saved = localStorage.getItem(`cp_quick_memos_${projectId}`);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export function PhotoGalleryView({ project }: PhotoGalleryViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allPhotos, setAllPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [isMobileCalendarOpen, setIsMobileCalendarOpen] = useState(false);

  useEffect(() => {
  if (!project) return;

  const loadData = async () => {
    setLoading(true);

    try {
      const service = supabaseService as any;

      const [
        reports,
        inspections,
        materials,
        concrete,
        serverQuickMemos,
      ] = await Promise.all([
        supabaseService.getDailyReports(project.id).catch(() => []),
        supabaseService.getInspectionRequests(project.id).catch(() => []),
        supabaseService.getMaterialApprovals(project.id).catch(() => []),
        supabaseService.getConcretePlans(project.id).catch(() => []),
        typeof service.getQuickMemos === 'function'
          ? service.getQuickMemos(project.id).catch(() => [])
          : Promise.resolve([]),
      ]);

      const localQuickMemos = getLocalQuickMemos(project.id);

      /**
       * localStorage 퀵메모 + Supabase 퀵메모 병합
       * 같은 id가 있으면 기본은 Supabase 데이터를 우선합니다.
       * 단, Supabase 데이터에 사진이 없고 localStorage에는 사진이 있으면 localStorage 사진을 보존합니다.
       */
      const quickMemoMap = new Map<string, any>();

      localQuickMemos.forEach((memo: any) => {
        if (memo?.id) quickMemoMap.set(memo.id, memo);
      });

      serverQuickMemos.forEach((serverMemo: any) => {
        if (!serverMemo?.id) return;

        const localMemo = quickMemoMap.get(serverMemo.id);
        const serverPhotos = Array.isArray(serverMemo.photos)
          ? serverMemo.photos
          : [];
        const localPhotos = Array.isArray(localMemo?.photos)
          ? localMemo.photos
          : [];

        quickMemoMap.set(serverMemo.id, {
          ...localMemo,
          ...serverMemo,
          photos: serverPhotos.length > 0 ? serverPhotos : localPhotos,
        });
      });

      const quickMemos = Array.from(quickMemoMap.values());

      const photos: GalleryPhoto[] = [];
      const addedPhotoKeys = new Set<string>();

      const pushPhotoOnce = (photo: GalleryPhoto) => {
        if (!photo.url) return;

        const key = `${photo.date}_${photo.url}`;

        if (addedPhotoKeys.has(key)) return;

        addedPhotoKeys.add(key);
        photos.push(photo);
      };

      reports.forEach((item: any) => {
        if (item.photos && Array.isArray(item.photos)) {
          item.photos.forEach((photo: DailyPhoto) => {
            pushPhotoOnce({
              ...photo,
              source: 'daily-report',
              date: item.date,
              sourceId: item.id,
              sourceLocalName: '공사일보',
            });
          });
        }
      });

      inspections.forEach((item: any) => {
        if (item.photos && Array.isArray(item.photos)) {
          item.photos.forEach((photo: DailyPhoto) => {
            pushPhotoOnce({
              ...photo,
              source: 'inspection',
              date: item.date,
              sourceId: item.id,
              sourceLocalName: '검측요청서',
            });
          });
        }
      });

      materials.forEach((item: any) => {
        if (item.photos && Array.isArray(item.photos)) {
          item.photos.forEach((photo: DailyPhoto) => {
            pushPhotoOnce({
              ...photo,
              source: 'material',
              date: item.date,
              sourceId: item.id,
              sourceLocalName: '자재승인서',
            });
          });
        }
      });

      concrete.forEach((item: any) => {
        if (item.photos && Array.isArray(item.photos)) {
          item.photos.forEach((photo: DailyPhoto) => {
            pushPhotoOnce({
              ...photo,
              source: 'concrete',
              date: item.date,
              sourceId: item.id,
              sourceLocalName: '타설계획서',
            });
          });
        }
      });

      /**
       * AI 퀵메모 사진 추가
       */
      quickMemos.forEach((memo: any) => {
        const memoPhotos = Array.isArray(memo.photos) ? memo.photos : [];

        memoPhotos.forEach((photo: any, index: number) => {
          if (!photo?.url) return;

          pushPhotoOnce({
            id: photo.id || `quick-memo-${memo.id}-${index}`,
            url: photo.url,
            title: photo.title || memo.aiTitle || `퀵메모 사진 ${index + 1}`,
            category: photo.category || memo.category || '퀵메모',
            subCategory: photo.subCategory || memo.severity || '',
            description:
              photo.description ||
              memo.aiSummary ||
              memo.rawText ||
              '',
            source: 'quick-memo',
            date: memo.date,
            sourceId: memo.id,
            sourceLocalName: 'AI 퀵메모',
          });
        });
      });

      photos.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;

        return String(b.id).localeCompare(String(a.id));
      });

      setAllPhotos(photos);
    } catch (e) {
      console.error('Failed to load photos:', e);
    } finally {
      setLoading(false);
    }
  };

  loadData();
  }, [project]);

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getWeekOfMonth = (date: Date) => {
    const startOfMonthDate = startOfMonth(date);
    const startOfFirstWeek = startOfWeek(startOfMonthDate, { weekStartsOn: 0 });
    const startOfCurrentWeek = startOfWeek(date, { weekStartsOn: 0 });
    const diffDays = Math.floor((startOfCurrentWeek.getTime() - startOfFirstWeek.getTime()) / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const filteredPhotos = useMemo(() => {
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    return allPhotos.filter(p => p.date === selectedDateStr);
  }, [allPhotos, selectedDate]);

  // Handle ESC key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPhoto) {
        setSelectedPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto]);

  if (!project) {
    return <div className="p-4 text-center text-gray-500">프로젝트를 선택해주세요.</div>;
  }

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <div className="p-2 md:p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-2 md:space-y-4">
          <div className="flex gap-2 md:gap-4 shrink-0">
            {/* Left: Monthly Calendar */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 p-4 w-[240px] flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">
                  {format(currentDate, 'yyyy년 M월', { locale: ko })}
                </h2>
                <div className="flex gap-1">
                  <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft size={20} /></button>
                  <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight size={20} /></button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                  <div key={day} className="py-1">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day, i) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const hasPhotos = allPhotos.some(p => p.date === format(day, 'yyyy-MM-dd'));
                  
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedDate(day);
                        if (!isSameMonth(day, currentDate)) {
                          setCurrentDate(day);
                        }
                      }}
                      className={`
                        relative aspect-square flex items-center justify-center rounded-lg text-sm transition-all
                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                        ${isSelected ? 'bg-blue-400 text-white font-bold shadow-md shadow-blue-200' : 'hover:bg-gray-100'}
                        ${isToday(day) && !isSelected ? 'text-blue-600 font-bold' : ''}
                      `}
                    >
                      {format(day, 'd')}
                      {hasPhotos && !isSelected && (
                        <span className="absolute bottom-0 w-1 h-1 rounded-full bg-blue-400"></span>
                      )}
                      {hasPhotos && isSelected && (
                        <span className="absolute bottom-0 w-1 h-1 rounded-full bg-white"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Weekly Calendar (Selected Week) */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 
                    className="text-sm font-bold text-gray-900 flex items-center gap-2 md:cursor-auto cursor-pointer"
                    onClick={() => setIsMobileCalendarOpen(true)}
                  >
                    <Calendar size={20} className="text-blue-600" />
                    {format(selectedDate, 'M월 ', { locale: ko })}{getWeekOfMonth(selectedDate)}주차
                  </h2>
                  <button
                    onClick={() => {
                      const today = new Date();
                      setCurrentDate(today);
                      setSelectedDate(today);
                    }}
                    className="px-3 py-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    Today
                  </button>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-7 gap-3">
                {weekDays.map((day, i) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayPhotos = allPhotos.filter(p => p.date === dayStr);
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        flex flex-col items-center justify-center p-3 rounded-xl transition-all h-full
                        ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}
                      `}
                    >
                      <span className={`text-xs font-bold mb-1 ${['text-red-500', 'text-gray-500', 'text-gray-500', 'text-gray-500', 'text-gray-500', 'text-gray-500', 'text-blue-500'][day.getDay()]}`}>
                        {format(day, 'E', { locale: ko })}
                      </span>
                      <span className={`text-xl font-black mb-2 ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {format(day, 'd')}
                      </span>
                      
                      <div className="flex flex-col items-center gap-1 mt-auto">
                        {dayPhotos.length > 0 ? (
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                            {dayPhotos.length}장
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400 font-medium">-</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-sm font-bold text-gray-900">
                  {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} 사진 ({filteredPhotos.length}건)
                </h2>
            </div>
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredPhotos.length > 0 ? (
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredPhotos.map((photo) => (
                      <div 
                        key={photo.id} 
                        className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer shadow-sm hover:shadow-md transition-all"
                        onClick={() => setSelectedPhoto(photo)}
                      >
                        <img 
                          src={photo.url} 
                          alt={photo.title || '현장 사진'} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                          <div className="text-white text-xs font-bold truncate">
                            {photo.title || '제목 없음'}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded backdrop-blur-sm text-white">
                              {photo.category || '분류 없음'}
                            </span>
                            <span className="text-[10px] bg-blue-500/80 px-1.5 py-0.5 rounded backdrop-blur-sm text-white">
                              {photo.sourceLocalName}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <ImageIcon size={48} className="mb-4 text-gray-200" />
                  <p className="text-sm font-medium">해당 날짜에 등록된 사진이 없습니다.</p>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isMobileCalendarOpen && (
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileCalendarOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-[320px] p-4 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">
                  {format(currentDate, 'yyyy년 M월', { locale: ko })}
                </h2>
                <div className="flex gap-2">
                  <button onClick={handlePrevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft size={20} /></button>
                  <button onClick={handleNextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight size={20} /></button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                  <div key={day} className="py-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day, i) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const hasPhotos = allPhotos.some(p => p.date === format(day, 'yyyy-MM-dd'));
                  
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedDate(day);
                        if (!isSameMonth(day, currentDate)) {
                          setCurrentDate(day);
                        }
                        setIsMobileCalendarOpen(false);
                      }}
                      className={`
                        relative aspect-square flex items-center justify-center rounded-lg text-sm transition-all
                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                        ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-200' : 'hover:bg-gray-100'}
                        ${isToday(day) && !isSelected ? 'text-blue-600 font-bold' : ''}
                      `}
                    >
                      {format(day, 'd')}
                      {hasPhotos && !isSelected && (
                        <span className="absolute bottom-0 w-1 h-1 rounded-full bg-blue-400"></span>
                      )}
                      {hasPhotos && isSelected && (
                        <span className="absolute bottom-0 w-1 h-1 rounded-full bg-white"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}

        {selectedPhoto && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="absolute top-0 right-0 -mt-12 text-white/50 hover:text-white transition-colors"
                onClick={() => setSelectedPhoto(null)}
              >
                닫기 (ESC)
              </button>
              
              <div className="w-full bg-black flex-1 flex items-center justify-center rounded-t-xl overflow-hidden relative group">
                <img 
                  src={selectedPhoto.url} 
                  alt={selectedPhoto.title || '사진 이미지'} 
                  className="max-w-full max-h-[75vh] object-contain"
                />
              </div>
              
              <div className="w-full bg-gray-900 rounded-b-xl p-4 md:p-6 text-white text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold mb-1">{selectedPhoto.title || '제목 없음'}</h3>
                    <p className="text-gray-400 text-xs">
                      {selectedPhoto.date} &middot; {selectedPhoto.sourceLocalName} 
                      {selectedPhoto.category && ` · ${selectedPhoto.category}`}
                      {selectedPhoto.subCategory && ` · ${selectedPhoto.subCategory}`}
                    </p>
                    {selectedPhoto.description && (
                      <p className="mt-3 text-gray-300 leading-relaxed text-sm">
                        {selectedPhoto.description}
                      </p>
                    )}
                  </div>
                  <a 
                    href={selectedPhoto.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors shrink-0"
                  >
                    <ExternalLink size={16} />
                    <span className="font-bold text-xs">원본 보기</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PhotoGalleryView;
