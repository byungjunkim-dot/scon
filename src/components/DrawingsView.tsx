import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  Loader2,
  Image as ImageIcon,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  AlertCircle,
} from 'lucide-react';
import { Project, Drawing, User } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import { safeJsonParse } from '../utils/safeJson';
import {
  MAX_DRAWING_BYTES,
  PreparedDrawingMedia,
  blobToDataUrl,
  convertPdfBlobToImageBlob,
  extractStorageFileNameFromUrl,
  formatBytes,
  isPdfUrl,
  prepareDrawingMedia,
} from '../utils/drawingMedia';
import { PdfDrawingCanvas } from './PdfDrawingCanvas';

interface DrawingsViewProps {
  project: Project | null;
  currentUser: User | null;
}

const DRAWING_TYPES = ['배치도', '평면도', '입면도', '단면도', '기타'] as const;

function saveDrawingsCache(key: string, items: Drawing[]) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // localStorage 용량 초과 시 무시 (원본은 Supabase DB/Storage에 저장)
  }
}

export function DrawingsView({ project, currentUser }: DrawingsViewProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedType, setSelectedType] = useState<Drawing['type']>('평면도');
  const [selectedFloor, setSelectedFloor] = useState<string>('1층');
  const [zoom, setZoom] = useState(1);
  const [viewKey, setViewKey] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState(0);

  const [isAdding, setIsAdding] = useState(false);
  const [isOpenType, setIsOpenType] = useState(false);
  const [isOpenFloor, setIsOpenFloor] = useState(false);
  const [editingDrawingId, setEditingDrawingId] = useState<string | null>(null);
  const [newType, setNewType] = useState<Drawing['type']>('평면도');
  const [newFloor, setNewFloor] = useState('');
  const [newName, setNewName] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PreparedDrawingMedia | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [confirmDeleteDrawing, setConfirmDeleteDrawing] = useState<Drawing | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storageKey = project ? `cp_drawings_${project.id}` : '';
  const canEditDrawings =
    currentUser?.userRole === '골드' ||
    currentUser?.userRole === '실버' ||
    currentUser?.role === 'admin';

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  // 도면 데이터 로드 (로컬 캐시 + Supabase)
  useEffect(() => {
    const loadDrawings = async () => {
      if (!project) return;

      const saved = localStorage.getItem(storageKey);
      setDrawings(safeJsonParse(saved, []));

      if (isSupabaseConfigured) {
        try {
          const data = await supabaseService.getDrawings(project.id);
          if (data) {
            setDrawings(data);
            saveDrawingsCache(storageKey, data);
          }
        } catch (error) {
          console.error('Error loading drawings from Supabase:', error);
        }
      }
    };

    loadDrawings();
  }, [project, storageKey]);

  const filteredDrawings = drawings.filter((d) => d.type === selectedType);
  const floorsForType = Array.from(new Set(filteredDrawings.map((d) => d.floor)));
  const currentDrawing = filteredDrawings.find((d) => d.floor === selectedFloor);
  const currentIsPdf = currentDrawing ? isPdfUrl(currentDrawing.imageUrl) : false;

  useEffect(() => {
    if (floorsForType.length > 0 && !floorsForType.includes(selectedFloor)) {
      setSelectedFloor(floorsForType[0]);
    }
  }, [floorsForType, selectedFloor]);

  useEffect(() => {
    setPdfPage(1);
    setPdfNumPages(0);
    setZoom(1);
    setViewKey((prev) => prev + 1);
  }, [currentDrawing?.id]);

  const showTempStatus = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const clearPreviewState = () => {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    setPreviewObjectUrl(null);
    setPendingMedia(null);
    setNewImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeModal = () => {
    clearPreviewState();
    setIsAdding(false);
    setEditingDrawingId(null);
    setNewName('');
    setNewFloor('');
    setErrorMessage(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsCompressing(true);

    try {
      const prepared = await prepareDrawingMedia(file, MAX_DRAWING_BYTES);

      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }

      setPendingMedia(prepared);
      if (!prepared.isPdf) {
        const objUrl = URL.createObjectURL(prepared.blob);
        setPreviewObjectUrl(objUrl);
      } else {
        setPreviewObjectUrl(null);
      }
    } catch (error: any) {
      console.error('Drawing file processing failed:', error);
      setErrorMessage(
        error?.message || '도면 파일(이미지/PDF) 처리 중 오류가 발생했습니다.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsCompressing(false);
    }
  };

  const uploadMediaToStorage = async (
    projectId: string,
    media: PreparedDrawingMedia
  ): Promise<{ publicUrl: string; convertedFromPdf: boolean }> => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const primaryFileName = `drawing_${projectId}_${uniqueSuffix}.${media.extension}`;
    const uploadFile = new File([media.blob], primaryFileName, {
      type: media.contentType,
    });

    try {
      const publicUrl = await supabaseService.uploadImage(uploadFile, primaryFileName);
      return { publicUrl, convertedFromPdf: false };
    } catch (uploadErr) {
      // Storage 버킷이 image/* 만 허용해 application/pdf 업로드를 거부하는 경우,
      // 2MB 이하 고해상도 이미지로 자동 변환하여 Storage 업로드 재시도
      if (media.isPdf) {
        console.warn(
          'Storage PDF 직접 업로드가 거부되어 고해상도 이미지로 변환해 업로드합니다:',
          uploadErr
        );
        const fallbackImage = await convertPdfBlobToImageBlob(
          media.blob,
          MAX_DRAWING_BYTES
        );
        const fallbackName = `drawing_${projectId}_${uniqueSuffix}.${fallbackImage.extension}`;
        const fallbackFile = new File([fallbackImage.blob], fallbackName, {
          type: fallbackImage.contentType,
        });
        const publicUrl = await supabaseService.uploadImage(
          fallbackFile,
          fallbackName
        );
        return { publicUrl, convertedFromPdf: true };
      }
      throw uploadErr;
    }
  };

  // 도면 등록 및 수정 (Supabase Storage + DB)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!project || !newName.trim() || (!pendingMedia && !newImageUrl)) {
      setErrorMessage('도면명, 설명, 도면 파일을 모두 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const previousDrawing = editingDrawingId
        ? drawings.find((d) => d.id === editingDrawingId)
        : undefined;
      let finalUrl = newImageUrl;
      let convertedFromPdf = false;

      if (pendingMedia) {
        if (isSupabaseConfigured) {
          const uploaded = await uploadMediaToStorage(project.id, pendingMedia);
          finalUrl = uploaded.publicUrl;
          convertedFromPdf = uploaded.convertedFromPdf;
        } else {
          finalUrl = await blobToDataUrl(pendingMedia.blob);
        }
      }

      const drawingData: Drawing = {
        id:
          editingDrawingId ||
          `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        projectId: project.id,
        name: newName,
        type: newType,
        floor: newFloor,
        imageUrl: finalUrl,
        createdAt: previousDrawing?.createdAt || new Date().toISOString(),
      };

      const updatedDrawings = editingDrawingId
        ? drawings.map((d) => (d.id === editingDrawingId ? drawingData : d))
        : [...drawings, drawingData];

      if (isSupabaseConfigured) {
        await supabaseService.saveDrawing(drawingData);
      }

      // 수정 시 기존 Storage 파일 정리 (URL이 변경된 경우)
      if (
        isSupabaseConfigured &&
        previousDrawing &&
        previousDrawing.imageUrl !== finalUrl
      ) {
        const oldFileName = extractStorageFileNameFromUrl(previousDrawing.imageUrl);
        if (oldFileName) {
          supabaseService.deleteImage(oldFileName).catch((err) => {
            console.warn('이전 Storage 도면 파일 정리 실패(무시):', err);
          });
        }
      }

      setDrawings(updatedDrawings);
      saveDrawingsCache(storageKey, updatedDrawings);
      setSelectedType(drawingData.type);
      setSelectedFloor(drawingData.floor);

      if (convertedFromPdf) {
        showTempStatus(
          'Storage 버킷 정책에 맞춰 PDF를 고해상도 이미지(2MB 이하)로 변환하여 저장했습니다.'
        );
      } else if (pendingMedia?.compressed) {
        showTempStatus(
          `도면 용량을 ${formatBytes(pendingMedia.originalSize)} → ${formatBytes(
            pendingMedia.finalSize
          )}로 자동 압축해 저장했습니다.`
        );
      } else {
        showTempStatus('도면이 Supabase Storage에 저장되었습니다.');
      }

      closeModal();
    } catch (error: any) {
      console.error('도면 저장 오류:', error);
      setErrorMessage(
        error?.message ||
          '도면 저장 중 오류가 발생했습니다. 네트워크 및 Storage 권한을 확인해 주세요.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (drawing: Drawing) => {
    clearPreviewState();
    setErrorMessage(null);
    setEditingDrawingId(drawing.id);
    setNewType(drawing.type);
    setNewFloor(drawing.floor);
    setNewName(drawing.name);
    setNewImageUrl(drawing.imageUrl);
    setIsAdding(true);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteDrawing) return;
    const target = confirmDeleteDrawing;
    setConfirmDeleteDrawing(null);

    const updatedDrawings = drawings.filter((d) => d.id !== target.id);
    setDrawings(updatedDrawings);
    saveDrawingsCache(storageKey, updatedDrawings);

    if (isSupabaseConfigured) {
      try {
        await supabaseService.deleteDrawing(target.id);
        const storageFile = extractStorageFileNameFromUrl(target.imageUrl);
        if (storageFile) {
          supabaseService.deleteImage(storageFile).catch((err) => {
            console.warn('Storage 도면 파일 삭제 실패(무시):', err);
          });
        }
        showTempStatus('도면이 삭제되었습니다.');
      } catch (error: any) {
        console.error('Error deleting drawing from Supabase:', error);
        setErrorMessage(error?.message || '도면 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 8));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setViewKey((prev) => prev + 1);
  };
  const dragLimit = Math.max(1200, Math.round(zoom * 1000));

  const hasPreview = Boolean(pendingMedia || newImageUrl);

  return (
    <div className="h-full p-2 md:p-4 lg:p-8 flex flex-col overflow-hidden relative">
      {statusNotice && (
        <div className="mb-3 px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold flex items-center justify-between gap-2">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-blue-500 hover:text-blue-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex w-full gap-2">
          {/* Dropdown Type */}
          <div className="relative flex-1 md:max-w-[200px]">
            <button
              onClick={() => {
                setIsOpenType(!isOpenType);
                setIsOpenFloor(false);
              }}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl font-bold text-sm flex items-center justify-between gap-2"
            >
              {selectedType}
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${
                  isOpenType ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isOpenType && (
              <div className="absolute top-12 left-0 bg-white border border-gray-200 shadow-lg rounded-xl z-20 w-full p-2 space-y-1">
                {DRAWING_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type);
                      setIsOpenType(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                      selectedType === type
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Dropdown Floor */}
          <div className="relative flex-1 md:max-w-[200px]">
            <button
              onClick={() => {
                setIsOpenFloor(!isOpenFloor);
                setIsOpenType(false);
              }}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl font-bold text-sm flex items-center justify-between gap-2"
            >
              {selectedFloor}
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${
                  isOpenFloor ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isOpenFloor && (
              <div className="absolute top-12 left-0 bg-white border border-gray-200 shadow-lg rounded-xl z-20 w-full p-2 space-y-1">
                {floorsForType.length > 0 ? (
                  floorsForType.map((floor) => (
                    <button
                      key={floor}
                      onClick={() => {
                        setSelectedFloor(floor);
                        setIsOpenFloor(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                        selectedFloor === floor
                          ? 'bg-green-50 text-green-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {floor}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-400">도면 없음</div>
                )}
              </div>
            )}
          </div>
        </div>
        {canEditDrawings && (
          <button
            onClick={() => {
              clearPreviewState();
              setErrorMessage(null);
              setEditingDrawingId(null);
              setNewType(selectedType);
              setNewFloor('');
              setNewName('');
              setIsAdding(true);
            }}
            className="hidden md:block px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors w-full md:w-auto shadow-md shadow-blue-500/10 whitespace-nowrap"
          >
            도면추가
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 lg:gap-6 overflow-hidden">
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex items-center justify-center relative overflow-hidden p-2 md:p-3 lg:p-4">
          <div className="w-full h-full bg-white flex items-center justify-center relative overflow-hidden cursor-grab active:cursor-grabbing">
            {currentDrawing ? (
              <motion.div
                key={viewKey}
                drag
                dragConstraints={{
                  top: -dragLimit,
                  left: -dragLimit,
                  right: dragLimit,
                  bottom: dragLimit,
                }}
                dragElastic={0.2}
                animate={{ scale: zoom }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex items-center justify-center"
                style={{ originX: 0.5, originY: 0.5 }}
              >
                {currentIsPdf ? (
                  <PdfDrawingCanvas
                    source={currentDrawing.imageUrl}
                    pageNumber={pdfPage}
                    targetWidth={2000}
                    onLoadSuccess={(pages) => setPdfNumPages(pages)}
                    className="max-w-[90vw] md:max-w-[78vw] max-h-[76vh] w-auto h-auto pointer-events-none select-none shadow-sm border border-gray-100 rounded"
                  />
                ) : (
                  <img
                    src={currentDrawing.imageUrl}
                    alt={currentDrawing.name}
                    className="max-w-none object-contain pointer-events-none select-none"
                    style={{ width: '100%', height: 'auto', minHeight: '300px' }}
                    draggable={false}
                  />
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center text-gray-400">
                <ImageIcon size={48} className="mb-2 opacity-50" />
                <span className="font-medium">등록된 도면이 없습니다</span>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 flex flex-col items-center gap-2 z-10">
              <span className="px-2 py-0.5 rounded-full bg-white/95 border border-gray-200 shadow-sm text-[10px] font-bold text-gray-600 tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 8}
                title="확대 (최대 800%)"
                className="w-8 h-8 md:w-10 md:h-10 bg-white text-gray-700 rounded-full flex items-center justify-center font-bold shadow-lg hover:bg-gray-50 border border-gray-200 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="축소 (최소 50%)"
                className="w-8 h-8 md:w-10 md:h-10 bg-white text-gray-700 rounded-full flex items-center justify-center font-bold shadow-lg hover:bg-gray-50 border border-gray-200 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                -
              </button>
              <button
                type="button"
                onClick={handleResetView}
                title="원래 크기 (100%)"
                className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95"
              >
                1:1
              </button>
            </div>

            {/* PDF Multi-page Controls */}
            {currentDrawing && currentIsPdf && pdfNumPages > 1 && (
              <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-xl shadow-md border border-gray-200 z-10 flex items-center gap-2">
                <button
                  type="button"
                  disabled={pdfPage <= 1}
                  onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-700"
                  title="이전 페이지"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-gray-700 tabular-nums">
                  {pdfPage} / {pdfNumPages}
                </span>
                <button
                  type="button"
                  disabled={pdfPage >= pdfNumPages}
                  onClick={() => setPdfPage((p) => Math.min(pdfNumPages, p + 1))}
                  className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-700"
                  title="다음 페이지"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Top-left Drawing Info + Actions */}
            {currentDrawing && (
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 z-10 flex items-center gap-2.5">
                {currentIsPdf && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded">
                    PDF
                  </span>
                )}
                <span className="font-bold text-gray-800">{currentDrawing.name}</span>
                <div className="flex items-center gap-1 border-l border-gray-200 pl-2.5">
                  <a
                    href={currentDrawing.imageUrl}
                    download={currentDrawing.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="도면 다운로드"
                  >
                    <Download size={16} />
                  </a>
                  {canEditDrawings && (
                    <div className="hidden md:flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(currentDrawing)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="도면 수정"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteDrawing(currentDrawing)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="도면 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Drawing Modal */}
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
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">
                  {editingDrawingId ? '도면 수정' : '신규 도면 등록'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700 font-medium">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      도면 종류
                    </label>
                    <select
                      value={newType}
                      onChange={(e) =>
                        setNewType(e.target.value as Drawing['type'])
                      }
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                    >
                      {DRAWING_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      도면명
                    </label>
                    <input
                      type="text"
                      value={newFloor}
                      onChange={(e) => setNewFloor(e.target.value)}
                      required
                      placeholder="예: 1층 전체 or A구역"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">
                    설명
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    placeholder="예: 부분확대 or 계획도 or 조닝계획"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      도면 파일 (이미지 / PDF)
                    </label>
                    <span className="text-[11px] font-medium text-gray-400">
                      최대 2MB · 초과 시 자동 최적화
                    </span>
                  </div>
                  <div className="relative">
                    {isCompressing ? (
                      <div className="h-44 border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center gap-2 bg-blue-50/30">
                        <Loader2 className="text-blue-600 animate-spin" size={32} />
                        <p className="text-xs font-bold text-blue-600">
                          도면 파일 최적화 중 (최대 2MB)...
                        </p>
                      </div>
                    ) : hasPreview ? (
                      <div className="space-y-2">
                        <div className="relative h-44 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                          {pendingMedia?.isPdf ? (
                            <PdfDrawingCanvas
                              source={pendingMedia.blob}
                              pageNumber={1}
                              targetWidth={700}
                              className="max-h-40 w-auto object-contain"
                            />
                          ) : !pendingMedia && isPdfUrl(newImageUrl) ? (
                            <PdfDrawingCanvas
                              source={newImageUrl}
                              pageNumber={1}
                              targetWidth={700}
                              className="max-h-40 w-auto object-contain"
                            />
                          ) : (
                            <img
                              src={previewObjectUrl || newImageUrl}
                              alt="Preview"
                              className="w-full h-full object-contain"
                            />
                          )}
                          <button
                            type="button"
                            onClick={clearPreviewState}
                            className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors z-20"
                            title="파일 변경"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {pendingMedia && (
                          <div className="flex items-center justify-between text-[11px] px-2 py-1 bg-gray-50 rounded-lg border border-gray-100 text-gray-600">
                            <span className="flex items-center gap-1.5 font-medium">
                              {pendingMedia.isPdf ? (
                                <>
                                  <FileText size={13} className="text-red-500" />
                                  PDF
                                  {pendingMedia.pageCount
                                    ? ` (${pendingMedia.pageCount}페이지)`
                                    : ''}
                                </>
                              ) : (
                                <>
                                  <ImageIcon size={13} className="text-blue-500" />
                                  {pendingMedia.extension.toUpperCase()}
                                </>
                              )}
                            </span>
                            <span className="font-bold tabular-nums">
                              {pendingMedia.compressed
                                ? `${formatBytes(pendingMedia.originalSize)} → ${formatBytes(
                                    pendingMedia.finalSize
                                  )} (자동 압축)`
                                : `${formatBytes(pendingMedia.finalSize)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="h-44 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                      >
                        <div className="bg-gray-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                          <Upload
                            className="text-gray-400 group-hover:text-blue-600"
                            size={24}
                          />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-xs font-bold text-gray-600">
                            이미지 또는 PDF 도면 업로드
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            PNG·JPG·WebP·PDF 지원 · 최대 저장 용량 2MB (초과 시 자동 축소)
                          </p>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,.pdf,application/pdf"
                      className="hidden"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!hasPreview || isCompressing || isSubmitting}
                  className="w-full bg-blue-600 text-white font-bold py-3 md:py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} /> Storage 업로드
                      및 저장 중...
                    </>
                  ) : editingDrawingId ? (
                    '도면 수정 완료'
                  ) : (
                    '도면 등록'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteDrawing && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white w-full max-w-sm p-6 rounded-2xl shadow-2xl space-y-4"
            >
              <h4 className="text-lg font-bold text-gray-900">도면 삭제</h4>
              <p className="text-sm text-gray-600">
                <span className="font-bold text-gray-800">
                  {confirmDeleteDrawing.name}
                </span>
                ({confirmDeleteDrawing.floor}) 도면을 삭제하시겠습니까?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteDrawing(null)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}