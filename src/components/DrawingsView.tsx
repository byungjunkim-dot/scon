import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { Project, Drawing, User } from '../types';
import { compressImage } from '../utils/image';
import { isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';

interface DrawingsViewProps {
  project: Project | null;
  currentUser: User | null;
}

const DRAWING_TYPES = ['배치도', '평면도', '입면도', '단면도', '기타'] as const;

export function DrawingsView({ project, currentUser }: DrawingsViewProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedType, setSelectedType] = useState<Drawing['type']>('평면도');
  const [selectedFloor, setSelectedFloor] = useState<string>('1층');
  const [zoom, setZoom] = useState(1);
  
  // Drag to pan state
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<Drawing['type']>('평면도');
  const [newFloor, setNewFloor] = useState('1층');
  const [newName, setNewName] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadDrawings = async () => {
      if (!project) {
        setDrawings([]);
        return;
      }

      // 1. 화면이 빨리 뜨도록 로컬 스토리지에서 먼저 불러오기
      const savedDrawings = localStorage.getItem(`cp_drawings_${project.id}`);
      if (savedDrawings) {
        setDrawings(JSON.parse(savedDrawings));
      }

      // 2. Supabase에서 최신 도면 데이터 가져오기
      if (isSupabaseConfigured) {
        try {
          const dbDrawings = await supabaseService.getDrawings(project.id);
          if (dbDrawings && dbDrawings.length > 0) {
            setDrawings(dbDrawings);
            localStorage.setItem(`cp_drawings_${project.id}`, JSON.stringify(dbDrawings));
          }
        } catch (error) {
          console.error('Failed to load drawings from Supabase:', error);
        }
      }
    };

    loadDrawings();
  }, [project]);

  const saveDrawings = (newDrawings: Drawing[]) => {
    setDrawings(newDrawings);
    if (project) {
      localStorage.setItem(`cp_drawings_${project.id}`, JSON.stringify(newDrawings));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        const compressedBase64 = await compressImage(file, 500); // Allow slightly larger for drawings
        setNewImageUrl(compressedBase64);
      } catch (error) {
        console.error('Image compression failed:', error);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newImageUrl || isSubmitting) return;

    setIsSubmitting(true);

    try {
      let finalImageUrl = newImageUrl; // 기본값은 압축된 Base64

      // Supabase가 연결되어 있다면 Storage에 실제 파일로 업로드
      if (isSupabaseConfigured) {
        // Base64 문자열을 파일(Blob)로 변환
        const res = await fetch(newImageUrl);
        const blob = await res.blob();
        
        // 겹치지 않는 고유한 파일명 생성
        const uniqueFileName = `drawing_${project.id}_${Date.now()}.jpg`;
        
        // Storage에 업로드 후 Public URL 받아오기 ('photos' 버킷 재사용)
        finalImageUrl = await supabaseService.uploadImage(blob, uniqueFileName, 'photos');
      }

      const newDrawing: Drawing = {
        id: Date.now().toString(),
        projectId: project.id,
        type: newType,
        floor: newFloor,
        name: newName,
        imageUrl: finalImageUrl, // DB에는 깔끔한 URL만 들어갑니다!
        createdAt: new Date().toISOString(),
      };

      // 1. 화면 및 로컬 스토리지에 즉시 반영
      const updatedDrawings = [...drawings, newDrawing];
      setDrawings(updatedDrawings);
      localStorage.setItem(`cp_drawings_${project.id}`, JSON.stringify(updatedDrawings));

      // 2. Supabase DB에 저장
      if (isSupabaseConfigured) {
        await supabaseService.saveDrawing(newDrawing);
      }

      // 3. 입력창 초기화
      setIsAdding(false);
      setNewName('');
      setNewImageUrl('');
      setNewFloor('1층');
      setNewType('평면도');
      
    } catch (error) {
      console.error('Drawing upload failed:', error);
      alert('도면 등록 중 오류가 발생했습니다. 네트워크나 설정을 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDrawings = drawings.filter(d => d.type === selectedType);
  const floorsForType = Array.from(new Set(filteredDrawings.map(d => d.floor))).sort();
  
  // Auto-select first floor if current selected floor doesn't exist in this type
  useEffect(() => {
    if (floorsForType.length > 0 && !floorsForType.includes(selectedFloor)) {
      setSelectedFloor(floorsForType[0]);
    }
    setZoom(1);
  }, [selectedType, floorsForType, selectedFloor]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.2));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setDragStart({ x: e.pageX, y: e.pageY });
    setScrollStart({
      left: containerRef.current.scrollLeft,
      top: containerRef.current.scrollTop
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const dx = e.pageX - dragStart.x;
    const dy = e.pageY - dragStart.y;
    containerRef.current.scrollLeft = scrollStart.left - dx;
    containerRef.current.scrollTop = scrollStart.top - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const currentDrawing = filteredDrawings.find(d => d.floor === selectedFloor);

  return (
    <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 lg:p-8 flex flex-col overflow-hidden relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-1 md:gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar shrink-0 bg-gray-50 md:bg-transparent p-1 md:p-0 rounded-xl">
          {DRAWING_TYPES.map(type => (
            <button 
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-lg md:rounded-t-lg md:rounded-b-none font-bold text-xs md:text-sm transition-all whitespace-nowrap ${selectedType === type ? 'bg-blue-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
            >
              {type}
            </button>
          ))}
        </div>
        {(currentUser?.userRole === '골드' || currentUser?.userRole === '실버' || currentUser?.role === 'admin') && (
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors w-full md:w-auto shadow-md shadow-blue-500/10"
          >
            도면추가
          </button>
        )}
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row gap-4 lg:gap-6 overflow-hidden">
        <div className="w-full md:w-28 lg:w-32 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 no-scrollbar shrink-0">
          {floorsForType.length > 0 ? (
            floorsForType.map(floor => (
              <button 
                key={floor}
                onClick={() => setSelectedFloor(floor)}
                className={`px-4 py-2 md:w-full md:px-3 rounded-xl font-bold text-xs md:text-sm transition-all whitespace-nowrap text-center md:text-left ${selectedFloor === floor ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-50 md:bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {floor}
              </button>
            ))
          ) : (
            <div className="text-xs text-gray-400 text-center py-2 md:py-4 w-full">등록된 층 없음</div>
          )}
        </div>
        
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center relative overflow-hidden p-2 md:p-3 lg:p-4">
          <div className="w-full h-full border-2 border-gray-300 bg-white flex items-center justify-center relative overflow-hidden">
            {currentDrawing ? (
              <div 
                ref={containerRef}
                className={`w-full h-full overflow-auto no-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* 1. 바깥쪽 div는 스타일을 제거하고 그대로 둡니다 */}
<div className="min-w-full min-h-full flex items-center justify-center">
  {/* 2. img 태그에 직접 transform: scale()을 먹여줍니다 */}
  <img 
    src={currentDrawing.imageUrl} 
    alt={currentDrawing.name} 
    className="max-w-full max-h-full object-contain pointer-events-none select-none transition-transform duration-200 ease-out origin-center"
    style={{ transform: `scale(${zoom})` }}
  />
</div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-gray-400">
                <ImageIcon size={48} className="mb-2 opacity-50" />
                <span className="font-medium">등록된 도면이 없습니다</span>
              </div>
            )}
            <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 flex flex-col gap-2 z-10">
              <button 
                onClick={handleZoomIn}
                className="w-8 h-8 md:w-10 md:h-10 bg-white text-gray-700 rounded-full flex items-center justify-center font-bold shadow-lg hover:bg-gray-50 border border-gray-200 transition-all active:scale-95"
              >
                +
              </button>
              <button 
                onClick={handleZoomOut}
                className="w-8 h-8 md:w-10 md:h-10 bg-white text-gray-700 rounded-full flex items-center justify-center font-bold shadow-lg hover:bg-gray-50 border border-gray-200 transition-all active:scale-95"
              >
                -
              </button>
              <button 
                onClick={() => setZoom(1)}
                className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95"
              >
                1:1
              </button>
            </div>
            {currentDrawing && (
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 z-10">
                <span className="font-bold text-gray-800">{currentDrawing.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Drawing Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-[500px] p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">신규 도면 등록</h3>
                <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">도면 종류</label>
                    <select 
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as Drawing['type'])}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                    >
                      {DRAWING_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">층/구역 (예: 1층, 지하1층)</label>
                    <input 
                      type="text" 
                      value={newFloor}
                      onChange={(e) => setNewFloor(e.target.value)}
                      required
                      placeholder="예: 1층"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">도면명</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    placeholder="예: 1층 건축 평면도"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">도면 이미지</label>
                  <div className="relative">
                    {isCompressing ? (
                      <div className="h-40 border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center gap-2 bg-blue-50/30">
                        <Loader2 className="text-blue-600 animate-spin" size={32} />
                        <p className="text-xs font-bold text-blue-600">이미지 최적화 중...</p>
                      </div>
                    ) : newImageUrl ? (
                      <div className="relative h-40 rounded-xl overflow-hidden border border-gray-200">
                        <img src={newImageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => {
                            setNewImageUrl('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                      >
                        <div className="bg-gray-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                          <Upload className="text-gray-400 group-hover:text-blue-600" size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-gray-600">이미지 업로드</p>
                          <p className="text-[10px] text-gray-400">클릭하여 도면 이미지를 선택하세요</p>
                        </div>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>

                <button 
  type="submit"
  disabled={!newImageUrl || isCompressing || isSubmitting}
  className="w-full bg-blue-600 text-white font-bold py-3 md:py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
>
  {isSubmitting ? (
    <><Loader2 className="animate-spin" size={20} /> 업로드 중...</>
  ) : (
    '도면 등록'
  )}
</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
