import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Download, Upload, Loader2, Save, FileText, Edit2, X } from 'lucide-react';
import { InspectionRequest, DailyPhoto, Project, AppSettings } from '../types';
import { compressImage } from '../utils/image';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PhotoModal } from './PhotoModal';
import { supabaseService } from '../services/supabaseService';

interface InspectionRequestViewProps {
  project: Project | null;
  settings: AppSettings;
}

const initialRequest = (projectId: string): InspectionRequest => ({
  id: Date.now().toString(),
  projectId,
  date: new Date().toISOString().split('T')[0],
  category: '',
  subCategory: '',
  taskName: '',
  location: '',
  description: '',
  status: '작성중',
  photos: [],
  author: '',
  reviewer: '',
  approver: ''
});

export const InspectionRequestView: React.FC<InspectionRequestViewProps> = ({ project, settings }) => {
  const [request, setRequest] = useState<InspectionRequest>(initialRequest(project?.id || ''));
  const [isCompressing, setIsCompressing] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<DailyPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project) {
      setRequest(prev => ({ ...prev, projectId: project.id }));
    }
  }, [project?.id]);

  const handleSave = async () => {
    if (!project) return;
    // Save logic (localStorage for now, Supabase if configured)
    const savedRequestsStr = localStorage.getItem(`cp_inspection_requests_${project.id}`);
    let requests: InspectionRequest[] = savedRequestsStr ? JSON.parse(savedRequestsStr) : [];
    const index = requests.findIndex(r => r.id === request.id);
    if (index >= 0) {
      requests[index] = request;
    } else {
      requests.push(request);
    }
    localStorage.setItem(`cp_inspection_requests_${project.id}`, JSON.stringify(requests));
    alert('저장되었습니다.');
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    try {
      const canvas = await html2canvas(contentRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`검측요청서_${request.date}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF 다운로드에 실패했습니다.');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    try {
      const file = files[0];
      const compressedBase64 = await compressImage(file, 1000);
      const newPhoto: DailyPhoto = {
        id: Date.now().toString(),
        url: compressedBase64,
        title: '',
        category: request.category,
        subCategory: request.subCategory,
        description: ''
      };
      setEditingPhoto(newPhoto);
      setIsPhotoModalOpen(true);
    } catch (error) {
      console.error('Image compression failed:', error);
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSavePhoto = (photo: DailyPhoto) => {
    setRequest(prev => {
      const existingIndex = prev.photos.findIndex(p => p.id === photo.id);
      let newPhotos;
      if (existingIndex >= 0) {
        newPhotos = [...prev.photos];
        newPhotos[existingIndex] = photo;
      } else {
        newPhotos = [...prev.photos, photo];
      }
      return { ...prev, photos: newPhotos };
    });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">검측 요청서 작성</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Inspection Request</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-bold">
            <Save size={16} /> 저장
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-bold">
            <Download size={16} /> PDF 다운로드
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-100/50">
        <div ref={contentRef} className="max-w-4xl mx-auto bg-white p-8 shadow-sm border border-gray-200 rounded-xl space-y-8">
          <h1 className="text-3xl font-black text-gray-900 tracking-widest text-center border-b-4 border-gray-900 pb-2">검 측 요 청 서</h1>
          
          <table className="w-full border-collapse border-2 border-gray-900 text-sm bg-white">
            <tbody>
              <tr>
                <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 w-32 text-center">공종</td>
                <td className="border border-gray-900 px-4 py-2">
                  <select 
                    value={request.category} 
                    onChange={e => setRequest({...request, category: e.target.value})}
                    className="w-full focus:outline-none bg-transparent"
                  >
                    <option value="">선택하세요</option>
                    {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 w-32 text-center">요청일자</td>
                <td className="border border-gray-900 px-4 py-2">
                  <input type="date" value={request.date} onChange={e => setRequest({...request, date: e.target.value})} className="w-full focus:outline-none bg-transparent" />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 text-center">위치</td>
                <td className="border border-gray-900 px-4 py-2">
                  <input type="text" value={request.location} onChange={e => setRequest({...request, location: e.target.value})} className="w-full focus:outline-none bg-transparent" placeholder="위치 입력" />
                </td>
                <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 text-center">상태</td>
                <td className="border border-gray-900 px-4 py-2">
                  <select value={request.status} onChange={e => setRequest({...request, status: e.target.value as any})} className="w-full focus:outline-none bg-transparent">
                    <option value="작성중">작성중</option>
                    <option value="요청">요청</option>
                    <option value="검토중">검토중</option>
                    <option value="완료">완료</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 text-center">검측항목</td>
                <td colSpan={3} className="border border-gray-900 px-4 py-2">
                  <input type="text" value={request.taskName} onChange={e => setRequest({...request, taskName: e.target.value})} className="w-full focus:outline-none bg-transparent" placeholder="검측 항목 입력" />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 text-center">상세내용</td>
                <td colSpan={3} className="border border-gray-900 px-4 py-2 h-32 align-top">
                  <textarea 
                    value={request.description} 
                    onChange={e => setRequest({...request, description: e.target.value})}
                    className="w-full h-full focus:outline-none bg-transparent resize-none"
                    placeholder="상세 검측 요청 내용을 입력하세요."
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div>
            <div className="flex justify-between items-end mb-2">
              <h3 className="text-lg font-bold text-gray-900">현장 사진</h3>
              <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-md">
                {isCompressing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 사진 추가
              </button>
              <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-2 border-gray-900 p-4 min-h-[150px]">
              {request.photos.map((photo, idx) => (
                <div key={photo.id} className="relative aspect-square border border-gray-300 rounded overflow-hidden group">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => { setEditingPhoto(photo); setIsPhotoModalOpen(true); }} className="text-white p-2"><Edit2 size={20} /></button>
                    <button onClick={() => setRequest({...request, photos: request.photos.filter(p => p.id !== photo.id)})} className="text-red-500 p-2"><Trash2 size={20} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PhotoModal 
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        photo={editingPhoto}
        onSave={handleSavePhoto}
        settings={settings}
      />
    </div>
  );
};
