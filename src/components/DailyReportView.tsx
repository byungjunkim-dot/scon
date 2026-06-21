import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Download, Upload, Loader2, Save, FileText, Edit2, AlertTriangle, Sparkles } from 'lucide-react';
import { DailyReport, DailyTask, DailyEquipment, DailyIssue, DailyPhoto, Project, AppSettings, ApprovalRecord, User } from '../types';
import { compressImage } from '../utils/image';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { TaskModal } from './TaskModal';
import { PhotoModal } from './PhotoModal';
import { PersonnelModal } from './PersonnelModal';
import { EquipmentModal } from './EquipmentModal';
import { UserSelectModal } from './UserSelectModal';
import { BulkExportModal } from './BulkExportModal';
import { fetchWeather } from '../services/weatherService';
import { supabaseService } from '../services/supabaseService';

interface DailyReportViewProps {
  project: Project | null;
  settings: AppSettings;
  currentUser: User | null;
  onDirtyChange?: (isDirty: boolean) => void;
}

const initialReport = (projectId: string): DailyReport => ({
  id: Date.now().toString(),
  projectId,
  date: new Date().toISOString().split('T')[0],
  author: '',
  reviewer: '',
  approver: '',
  approvalStatus: '작성중',
  approvalHistory: [],
  weather: {
    temperature: '22°C',
    maxTemp: '25°C',
    minTemp: '18°C',
    precipitation: '0mm',
    windSpeed: '1.5m/s',
    status: '맑음'
  },
  todayTasks: [],
  tomorrowTasks: [],
  personnel: { direct: 0, outsourced: 0, other: 0 },
  equipment: [],
  issues: [],
  photos: [],
  progressRate: { planned: 0, actual: 0 }
});

export const DailyReportView: React.FC<DailyReportViewProps> = ({ project, settings, currentUser, onDirtyChange }) => {
  const formatMultiValue = (value?: string | string[]) => {
    if (Array.isArray(value)) return value.join(', ');
    return value || '';
  };

  const [report, setReport] = useState<DailyReport>(initialReport(project?.id || ''));
  const [lastSavedReport, setLastSavedReport] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkExportModalOpen, setIsBulkExportModalOpen] = useState(false);
  const [bulkExportReports, setBulkExportReports] = useState<DailyReport[]>([]);

  useEffect(() => {
    // 프로젝트의 모든 일보 가져오기
    const loadAllReports = async () => {
      if (!project) return;
      const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL;
      if (isSupabaseConfigured) {
         try {
           const reports = await supabaseService.getDailyReports(project.id);
           setBulkExportReports(reports.sort((a,b) => b.date.localeCompare(a.date)));
         } catch (err) { console.error(err); }
      } else {
         const savedReportsStr = localStorage.getItem(`cp_daily_reports_${project.id}`);
         if (savedReportsStr) {
           const reports: DailyReport[] = JSON.parse(savedReportsStr);
           setBulkExportReports(reports.sort((a,b) => b.date.localeCompare(a.date)));
         }
      }
    };
    loadAllReports();
  }, [project?.id]);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const showStatus = (msg: string) => { setStatusMessage(msg); };

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isUserSelectModalOpen, setIsUserSelectModalOpen] = useState(false);
  const [userSelectType, setUserSelectType] = useState<'author' | 'reviewer' | 'approver'>('author');
  const [taskModalType, setTaskModalType] = useState<'today' | 'tomorrow'>('today');
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<DailyPhoto | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // 🔥 PDF 다운로드 기능 로직 보강 (섹션별 페이지 분할 및 해상도 최적화)
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    showStatus('PDF를 생성 중입니다...');

    try {
      // 스타일 적용을 위해 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 600));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      
      // 데이터 속성이 있는 모든 섹션 찾기
      const sections = reportRef.current.querySelectorAll('[data-pdf-section]');
      let currentY = margin;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as HTMLElement;
        const canvas = await htmlToImage.toCanvas(section, {
          quality: 1.0,
          backgroundColor: '#ffffff',
          pixelRatio: 2
        });

        const sectionRatio = canvas.height / canvas.width;
        const sectionPdfHeight = contentWidth * sectionRatio;

        // 섹션이 현재 페이지에 들어가지 않으면 다음 페이지로 (이미 페이지의 시작이 아닌 경우)
        if (currentY + sectionPdfHeight > pdfHeight - margin && currentY > margin) {
          pdf.addPage();
          currentY = margin;
        }

        // 섹션이 한 페이지보다 큰 경우 (자동 분할)
        let heightRemaining = sectionPdfHeight;
        let sourceY = 0;

        while (heightRemaining > 0) {
          const spaceOnPage = pdfHeight - currentY - margin;
          const heightToDraw = Math.min(heightRemaining, spaceOnPage);

          // 소스 캔버스의 실제 픽셀 단위 계산
          const pY = (sourceY / sectionPdfHeight) * canvas.height;
          const pH = (heightToDraw / sectionPdfHeight) * canvas.height;

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = pH;
          const ctx = sliceCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, pY, canvas.width, pH, 0, 0, canvas.width, pH);
            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
            pdf.addImage(sliceData, 'JPEG', margin, currentY, contentWidth, heightToDraw);
          }

          heightRemaining -= heightToDraw;
          sourceY += heightToDraw;
          currentY += heightToDraw;

          if (heightRemaining > 1) { // 소수점 오차 방지
            pdf.addPage();
            currentY = margin;
          }
        }
        
        currentY += 5; // 섹션 간 간격
      }
      
      pdf.save(`공사일보_${project?.name || '프로젝트'}_${report.date}.pdf`);
      showStatus('PDF 다운로드가 완료되었습니다.');
    } catch (error: any) {
      console.error('PDF export failed:', error);
      showStatus('PDF 다운로드에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenTaskModal = (type: 'today' | 'tomorrow', task?: DailyTask) => {
    setTaskModalType(type);
    setEditingTask(task || null);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (task: DailyTask) => {
    setReport(prev => {
      const taskList = taskModalType === 'today' ? prev.todayTasks : prev.tomorrowTasks;
      const existingIndex = taskList.findIndex(t => t.id === task.id);
      let newTasks;
      if (existingIndex >= 0) {
        newTasks = [...taskList];
        newTasks[existingIndex] = task;
      } else {
        newTasks = [...taskList, task];
      }
      return {
        ...prev,
        [taskModalType === 'today' ? 'todayTasks' : 'tomorrowTasks']: newTasks
      };
    });
  };

  const isReadOnly = report.approvalStatus !== '작성중' && report.approvalStatus !== '재작성요청';

  const handleApproval = (nextStatus: '승인요청' | '검토완료' | '승인' | '재작성요청') => {
    let message = ''; let user = '';
    if (nextStatus === '승인요청') { message = '승인요청하시겠습니까?'; user = report.author || currentUser?.name || '작성자'; }
    else if (nextStatus === '검토완료') { message = '검토완료 하시겠습니까?'; user = report.reviewer || currentUser?.name || '검토자'; }
    else if (nextStatus === '승인') { message = '승인하시겠습니까?'; user = report.approver || currentUser?.name || '승인자'; }
    else if (nextStatus === '재작성요청') { message = '재작성을 요청하시겠습니까?'; user = currentUser?.name || '검토자/승인자'; }

    setConfirmModal({
      isOpen: true, title: '결재 확인', message,
      onConfirm: () => {
        const newRecord: ApprovalRecord = {
          status: nextStatus, timestamp: new Date().toISOString(), user: currentUser?.name || user
        };
        setReport(prev => ({
          ...prev, approvalStatus: nextStatus, approvalHistory: [...(prev.approvalHistory || []), newRecord]
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleOpenUserSelectModal = (type: 'author' | 'reviewer' | 'approver') => {
    setUserSelectType(type);
    setIsUserSelectModalOpen(true);
  };

  const handleSelectUser = (user: User) => {
    setReport(prev => ({ ...prev, [userSelectType]: user.name }));
  };

  const prevDateRef = useRef('');
  const prevProjectIdRef = useRef('');

  useEffect(() => {
    const loadReport = async () => {
      if (!project) return;
      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
      let reports: DailyReport[] = [];

      if (isSupabaseConfigured) {
        try {
          reports = await supabaseService.getDailyReports(project.id);
          const existingReport = reports.find(r => r.date === report.date);
          if (existingReport) { setReport(existingReport); setLastSavedReport(JSON.stringify(existingReport)); return; }
        } catch (err) { console.error(err); }
      }

      if (!isSupabaseConfigured) {
        const savedReports = localStorage.getItem(`cp_daily_reports_${project.id}`);
        if (savedReports) {
          reports = JSON.parse(savedReports);
          const existingReport = reports.find(r => r.date === report.date);
          if (existingReport) { setReport(existingReport); setLastSavedReport(JSON.stringify(existingReport)); return; }
        }
      }

      let newReport = { ...initialReport(project.id), date: report.date };
      const today = new Date().toISOString().split('T')[0];
      if (report.date === today) {
        const previousReports = reports.filter(r => r.date < today).sort((a, b) => b.date.localeCompare(a.date));
        if (previousReports.length > 0) {
          const latestPreviousReport = previousReports[0];
          if (latestPreviousReport.tomorrowTasks && latestPreviousReport.tomorrowTasks.length > 0) {
            newReport.todayTasks = latestPreviousReport.tomorrowTasks.map(task => ({
                ...task, id: Date.now().toString() + Math.random()
            }));
          }
        }
      }
      setReport(newReport);
      setLastSavedReport(JSON.stringify(newReport));
    };

    if (project && (report.date !== prevDateRef.current || project.id !== prevProjectIdRef.current)) {
      prevDateRef.current = report.date; prevProjectIdRef.current = project.id; loadReport();
    }
  }, [project?.id, report.date]);

  useEffect(() => {
    if (project && !report.author) {
      if (project.latitude !== undefined && project.longitude !== undefined) {
        const autoFetchWeather = async () => {
          try {
            const data = await fetchWeather(project.latitude!, project.longitude!, report.date);
            if (data) { setReport(prev => ({ ...prev, weather: { ...prev.weather, ...data } })); }
          } catch (error) { console.error(error); }
        };
        autoFetchWeather();
      }
    }
  }, [project, report.date]);

  useEffect(() => {
    const currentReportStr = JSON.stringify(report);
    const dirty = lastSavedReport ? currentReportStr !== lastSavedReport : false;
    if (dirty !== isDirty) { setIsDirty(dirty); onDirtyChange?.(dirty); }
  }, [report, lastSavedReport, onDirtyChange, isDirty]);

  const handleSave = async () => {
    if (!project) return;
    const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL;

    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveDailyReport(report);
        setLastSavedReport(JSON.stringify(report));
        setIsDirty(false); onDirtyChange?.(false);
        showStatus('Supabase에 저장되었습니다.');
        return;
      } catch (err) { console.error(err); }
    }

    const savedReportsStr = localStorage.getItem(`cp_daily_reports_${project.id}`);
    let reports: DailyReport[] = savedReportsStr ? JSON.parse(savedReportsStr) : [];
    const saveToLocal = () => {
      const existingIdIndex = reports.findIndex(r => r.id === report.id || r.date === report.date);
      if (existingIdIndex >= 0) reports[existingIdIndex] = report;
      else reports.push(report);
      localStorage.setItem(`cp_daily_reports_${project.id}`, JSON.stringify(reports));
      setLastSavedReport(JSON.stringify(report));
      setIsDirty(false); onDirtyChange?.(false);
      showStatus('저장되었습니다.');
    };

    const existingDateIndex = reports.findIndex(r => r.date === report.date && r.id !== report.id);
    if (existingDateIndex >= 0) {
      setConfirmModal({
        isOpen: true, title: '덮어씌우기 확인', message: '해당 날짜에 이미 작성된 일보가 있습니다. 덮어씌우시겠습니까?',
        onConfirm: saveToLocal
      });
    } else { saveToLocal(); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    try {
      const compressedBase64 = await compressImage(files[0], 500); 
      setEditingPhoto({ id: Date.now().toString(), url: compressedBase64, title: '', category: '', subCategory: '', description: '' });
      setIsPhotoModalOpen(true);
    } catch (error) { alert('이미지 처리에 실패했습니다.'); }
    finally { setIsCompressing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

const mapQuickMemoCategoryToDailyIssueType = (
  category: string
): DailyIssue['type'] => {
  const allowedTypes: DailyIssue['type'][] = [
    '안전',
    '품질',
    '공정',
    '설계',
    '자재',
    '장비',
    '민원',
    '기타',
  ];

  if (allowedTypes.includes(category as DailyIssue['type'])) {
    return category as DailyIssue['type'];
  }

  return '기타';
};

const getDailyIssueTypeTextClass = (type: DailyIssue['type']) => {
  if (type === '안전') return 'text-red-600';

  if (
    type === '품질' ||
    type === '설계' ||
    type === '공정' ||
    type === '자재' ||
    type === '장비'
  ) {
    return 'text-blue-600';
  }

  if (type === '민원') return 'text-orange-500';

  return 'text-gray-500';
};

const getLocalQuickMemosByDate = (projectId: string, date: string) => {
  try {
    const saved = localStorage.getItem(`cp_quick_memos_${projectId}`);
    const list = saved ? JSON.parse(saved) : [];

    return list.filter((memo: any) => memo.date === date);
  } catch {
    return [];
  }
};

const handleImportQuickMemos = async () => {
  if (!project) {
    alert('프로젝트 정보가 없습니다.');
    return;
  }

  try {
    setStatusMessage('AI 퀵 메모를 불러오는 중입니다...');

    let quickMemos: any[] = [];

    const isSupabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL);
    const service = supabaseService as any;

    if (
      isSupabaseConfigured &&
      typeof service.getQuickMemosByDate === 'function'
    ) {
      quickMemos = await service.getQuickMemosByDate(project.id, report.date);
    } else {
      quickMemos = getLocalQuickMemosByDate(project.id, report.date);
    }

    if (!quickMemos || quickMemos.length === 0) {
      setStatusMessage(null);
      alert(`${report.date} 날짜에 등록된 퀵 메모가 없습니다.`);
      return;
    }

    const importedIssues: DailyIssue[] = quickMemos
      .filter((memo) => {
        const issueId = `qm-issue-${memo.id}`;
        return !report.issues.some((issue) => issue.id === issueId);
      })
      .map((memo) => ({
        id: `qm-issue-${memo.id}`,
        type: mapQuickMemoCategoryToDailyIssueType(memo.category),
        description:
          memo.dailyIssueText ||
          `[${memo.category || '기타'}] ${memo.aiSummary || memo.rawText || ''}`,
      }))
      .filter((issue) => issue.description.trim().length > 0);

    const importedPhotos: DailyPhoto[] = quickMemos.flatMap((memo) => {
      const memoPhotos = Array.isArray(memo.photos) ? memo.photos : [];

      return memoPhotos
        .filter((photo: any) => {
          const photoId = `qm-photo-${memo.id}-${photo.id}`;
          return !report.photos.some((existingPhoto) => existingPhoto.id === photoId);
        })
        .map((photo: any, index: number) => ({
          id: `qm-photo-${memo.id}-${photo.id || index}`,
          url: photo.url,
          title: photo.title || memo.aiTitle || `퀵 메모 사진 ${index + 1}`,
          category: memo.category || photo.category || '퀵 메모',
          subCategory: photo.subCategory || '',
          description: photo.description || memo.aiSummary || memo.rawText || '',
        }))
        .filter((photo: DailyPhoto) => Boolean(photo.url));
    });

    if (importedIssues.length === 0 && importedPhotos.length === 0) {
      setStatusMessage(null);
      alert('이미 가져온 퀵 메모입니다.');
      return;
    }

    setReport((prev) => ({
      ...prev,
      issues: [...prev.issues, ...importedIssues],
      photos: [...prev.photos, ...importedPhotos],
    }));

    setStatusMessage(
      `AI 퀵 메모에서 특기사항 ${importedIssues.length}건, 사진 ${importedPhotos.length}장을 가져왔습니다.`
    );

    setTimeout(() => setStatusMessage(null), 3000);
  } catch (error: any) {
    console.error(error);
    setStatusMessage(null);
    alert(`AI 퀵 메모 가져오기 실패: ${error?.message || '알 수 없는 오류'}`);
  }
};

  const handleSavePhoto = async (photo: DailyPhoto) => {
    let finalPhoto = { ...photo };
    if (finalPhoto.url.startsWith('data:image/')) {
      const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL;
      if (isSupabaseConfigured) {
        showStatus('이미지를 서버에 업로드 중입니다...');
        try {
          const res = await fetch(finalPhoto.url);
          const blob = await res.blob();
          const publicUrl = await supabaseService.uploadImage(blob, `daily_report_${project?.id}_${Date.now()}.jpg`);
          finalPhoto.url = publicUrl; 
          showStatus('이미지 업로드 완료!');
        } catch (error) { alert('이미지 업로드에 실패했습니다. 사진이 등록되지 않습니다.'); return; }
      }
    }
    setReport(prev => {
      const existingIndex = prev.photos.findIndex(p => p.id === finalPhoto.id);
      let newPhotos = [...prev.photos];
      if (existingIndex >= 0) newPhotos[existingIndex] = finalPhoto;
      else newPhotos.push(finalPhoto);
      return { ...prev, photos: newPhotos };
    });
  };

  const handleEditPhoto = (photo: DailyPhoto) => { setEditingPhoto(photo); setIsPhotoModalOpen(true); };

  const handleDeletePhoto = async (photoToDelete: DailyPhoto) => {
    setReport(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== photoToDelete.id) }));
    const isTempFile = photoToDelete.url.startsWith('data:image/') || photoToDelete.url.startsWith('blob:');
    if (!isTempFile && !!import.meta.env.VITE_SUPABASE_URL) {
      try {
        const cleanUrl = photoToDelete.url.split('?')[0];
        const fileName = decodeURIComponent(cleanUrl.split('/').pop() || '');
        if (fileName) { await supabaseService.deleteImage(fileName); showStatus('서버에서 이미지가 완전히 삭제되었습니다.'); }
      } catch (error: any) { alert(`[서버 파일 삭제 실패]\n사유: ${error.message}`); }
    }
  };

  const handleSavePersonnel = (personnelDetails: any[]) => {
    const direct = personnelDetails.reduce((sum, p) => sum + (Number(p.direct) || 0), 0);
    const outsourced = personnelDetails.reduce((sum, p) => sum + (Number(p.outsourced) || 0), 0);
    const other = personnelDetails.reduce((sum, p) => sum + (Number(p.other) || 0), 0);
    setReport({ ...report, personnel: { direct, outsourced, other, details: personnelDetails } });
    setIsPersonnelModalOpen(false);
  };

  const handleSaveEquipment = (equipmentDetails: any[]) => {
    setReport({ ...report, equipment: equipmentDetails });
    setIsEquipmentModalOpen(false);
  };

  const legacyPersonnel = React.useMemo(() => {
    if (report.personnel.details && report.personnel.details.length > 0) return report.personnel.details;
    if (report.personnel.direct > 0 || report.personnel.outsourced > 0 || report.personnel.other > 0) {
      return [{ id: 'legacy-data', discipline: '기존 데이터', direct: report.personnel.direct, outsourced: report.personnel.outsourced, other: report.personnel.other }];
    }
    return [];
  }, [report.personnel]);

  const totalPersonnel = report.personnel.direct + report.personnel.outsourced + report.personnel.other;

  return (
    <div className="h-full flex flex-col bg-white relative">
      <AnimatePresence>
        {isBulkExportModalOpen && (
          <BulkExportModal 
            isOpen={isBulkExportModalOpen} 
            onClose={() => setIsBulkExportModalOpen(false)} 
            reports={bulkExportReports}
            project={project}
          />
        )}
        {statusMessage && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 bg-gray-900 text-white rounded-full shadow-2xl text-sm font-bold flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> {statusMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-6 py-2 flex justify-end items-center">
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={isReadOnly}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-bold ${isReadOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
              <Save size={16} /> 저장
            </button>
            <button onClick={() => setIsBulkExportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-bold">
              <Download size={16} /> 일괄 다운로드
            </button>
            <button onClick={handleExportPDF} disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-bold">
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PDF 다운로드
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1 lg:p-1 bg-gray-100/50">
        <div ref={reportRef} className={`max-w-4xl mx-auto bg-white p-8 border border-gray-200 rounded-xl space-y-8 ${isExporting ? 'pdf-export-mode' : ''}`}>
          {isExporting && (
            <style>{`
              .pdf-export-mode button { display: none !important; }
              .pdf-export-mode .custom-scrollbar { overflow: visible !important; max-height: none !important; }
              .pdf-export-mode { box-shadow: none !important; border: none !important; }
              .pdf-export-mode input[type="date"]::-webkit-calendar-picker-indicator { display: none !important; }
              .pdf-export-mode input { border: none !important; }
            `}</style>
          )}
            
            <div data-pdf-section className="flex justify-between items-start mb-5">
              <div className="flex-1">
                <h1 className="text-3xl font-black text-gray-900 tracking-widest text-center mt-4 inline-block">공 사 일 보</h1>
              </div>
              <div className="flex items-stretch bg-white rounded-xl border border-gray-200 overflow-hidden divide-x divide-gray-100">
                <div className="hidden sm:flex items-center justify-center bg-gray-50 px-2 py-4 text-md text-gray-400 [writing-mode:vertical-lr] tracking-widest uppercase border-r border-gray-100">
                  결재
                </div>
                <div className="flex divide-x divide-gray-100">
                  {[
                    { role: 'author' as const, label: '작성자', name: report.author },
                    { role: 'reviewer' as const, label: '검토자', name: report.reviewer },
                    { role: 'approver' as const, label: '승인자', name: report.approver }
                  ].map((item) => {
                    const isAuthorStep = item.role === 'author';
                    const isReviewerStep = item.role === 'reviewer';
                    const isApproverStep = item.role === 'approver';
                    
                    const canRequest = isAuthorStep && (report.approvalStatus === '작성중' || report.approvalStatus === '재작성요청');
                    const canReview = isReviewerStep && report.approvalStatus === '승인요청';
                    const canApprove = isApproverStep && report.approvalStatus === '검토완료';
                    
                    const isAuthorDone = !['작성중', '재작성요청'].includes(report.approvalStatus);
                    const isReviewerDone = ['검토완료', '승인'].includes(report.approvalStatus);
                    const isApproverDone = report.approvalStatus === '승인';

                    return (
                      <div key={item.role} className="flex flex-col w-24 sm:w-28 transition-all group">
                        <div className="bg-gray-50/50 px-2 py-1.5 text-[10px] font-bold text-gray-500 text-center border-b border-gray-100 uppercase tracking-tighter">
                          {item.label}
                        </div>
                        <div 
                          className="h-20 flex flex-col items-center justify-center p-2 gap-1 relative"
                        >
                          {item.name ? (
                            <>
                              <button 
                                onClick={() => !isReadOnly && handleOpenUserSelectModal(item.role)}
                                disabled={isReadOnly}
                                className={`text-xs font-black text-gray-900 ${isReadOnly ? 'cursor-default' : 'hover:text-blue-600 underline decoration-dotted'}`}
                              >
                                {item.name}
                              </button>
                              
                              <div className="flex flex-col items-center gap-1.5">
                                {(() => {
                                  let record = null;
                                  if (isAuthorStep && isAuthorDone) {
                                    record = report.approvalHistory?.find(h => h.status === '승인요청');
                                  } else if (isReviewerStep && isReviewerDone) {
                                    record = report.approvalHistory?.find(h => h.status === '검토완료');
                                  } else if (isApproverStep && isApproverDone) {
                                    record = report.approvalHistory?.find(h => h.status === '승인');
                                  }

                                  if (record) {
                                    const dateObj = new Date(record.timestamp);
                                    return (
                                      <div className="flex flex-col items-center bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 animate-in fade-in zoom-in duration-300">
                                        <span className="text-[9px] font-black text-blue-600 leading-none">
                                          {record.status === '승인요청' ? '요청완료' : record.status === '검토완료' ? '검토완료' : '승인완료'}
                                        </span>
                                        <span className="text-[8px] text-blue-400 font-medium leading-none mt-0.5">
                                          {format(dateObj, 'yy.MM.dd HH:mm')}
                                        </span>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="flex gap-1">
                                      {canRequest && (
                                        <button 
                                          onClick={() => handleApproval('승인요청')}
                                          className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors"
                                        >
                                          요청
                                        </button>
                                      )}
                                      {canReview && (
                                        <>
                                          <button 
                                            onClick={() => handleApproval('검토완료')}
                                            className="px-2 py-1 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700 transition-colors"
                                          >
                                            검토
                                          </button>
                                          <button 
                                            onClick={() => handleApproval('재작성요청')}
                                            className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded hover:bg-red-600 transition-colors"
                                          >
                                            반려
                                          </button>
                                        </>
                                      )}
                                      {canApprove && (
                                        <>
                                          <button 
                                            onClick={() => handleApproval('승인')}
                                            className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700 transition-colors"
                                          >
                                            승인
                                          </button>
                                          <button 
                                            onClick={() => handleApproval('재작성요청')}
                                            className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded hover:bg-red-600 transition-colors"
                                          >
                                            반려
                                          </button>
                                        </>
                                      )}
                                      {!canRequest && !canReview && !canApprove && (
                                        <span className="text-[10px] text-gray-300 font-bold italic">대기 중</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </>
                          ) : (
                            <button 
                              onClick={() => handleOpenUserSelectModal(item.role)}
                              className="text-[10px] font-bold text-gray-300 italic hover:text-blue-400 transition-colors"
                            >
                              미정
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div data-pdf-section className="mb-5 bg-white rounded-xl border border-gray-200 p-5 divide-y divide-gray-100">
              {/* 프로젝트 & 일자 */}
              <div className="grid grid-cols-1 md:grid-cols-10 gap-4 pb-4">
                <div className="md:col-span-6 flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 w-16 shrink-0">프로젝트명</span>
                  <span className="text-sm font-black text-gray-900 truncate">{project?.name || '프로젝트 미지정'}</span>
                </div>
                <div className="md:col-span-4 flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 w-16 shrink-0">일자</span>
                  <input 
                    type="date" 
                    value={report.date} 
                    onChange={e => setReport({...report, date: e.target.value})} 
                    disabled={isReadOnly} 
                    className="text-sm font-bold text-gray-900 focus:outline-none bg-transparent disabled:text-gray-500" 
                  />
                </div>
              </div>

              {/* 날씨 & 공정률 */}
              <div className="grid grid-cols-1 md:grid-cols-10 gap-4 pt-4">
                <div className="md:col-span-6 flex items-start gap-3">
                  <span className="text-[10px] font-bold text-gray-400 w-16 shrink-0 mt-1.5">날씨</span>
                  <div className="flex-1 flex flex-col gap-3">
                    {/* 첫번째 줄: 상태 */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 text-[10px] font-medium">상태</span>
                      <input 
                        type="text" 
                        value={report.weather.status || ''} 
                        onChange={e => setReport({...report, weather: {...report.weather, status: e.target.value}})} 
                        disabled={isReadOnly} 
                        placeholder="날씨 상태 입력"
                        className="flex-1 border-b border-gray-200 focus:outline-none focus:border-blue-500 bg-transparent text-xs font-bold text-gray-700" 
                      />
                    </div>
                    {/* 두번째 줄: 세부 데이터 */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-[10px] font-medium">최고</span>
                        <input type="text" value={report.weather.maxTemp || ''} onChange={e => setReport({...report, weather: {...report.weather, maxTemp: e.target.value}})} disabled={isReadOnly} className="w-[54px] border-b border-gray-200 focus:outline-none focus:border-blue-500 bg-transparent text-left text-xs font-bold text-gray-700" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-[10px] font-medium">최저</span>
                        <input type="text" value={report.weather.minTemp || ''} onChange={e => setReport({...report, weather: {...report.weather, minTemp: e.target.value}})} disabled={isReadOnly} className="w-[54px] border-b border-gray-200 focus:outline-none focus:border-blue-500 bg-transparent text-left text-xs font-bold text-gray-700" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-[10px] font-medium">강수</span>
                        <input type="text" value={report.weather.precipitation || ''} onChange={e => setReport({...report, weather: {...report.weather, precipitation: e.target.value}})} disabled={isReadOnly} className="w-[54px] border-b border-gray-200 focus:outline-none focus:border-blue-500 bg-transparent text-left text-xs font-bold text-gray-700" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-[10px] font-medium">풍속</span>
                        <input type="text" value={report.weather.windSpeed || ''} onChange={e => setReport({...report, weather: {...report.weather, windSpeed: e.target.value}})} disabled={isReadOnly} className="w-[54px] border-b border-gray-200 focus:outline-none focus:border-blue-500 bg-transparent text-left text-xs font-bold text-gray-700" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-4 flex items-start gap-3 mt-1.5">
                  <span className="text-[10px] font-bold text-gray-400 w-16 shrink-0">공정률</span>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">계획</span>
                        <input type="number" step="0.01" value={report.progressRate?.planned || 0} onChange={e => setReport({...report, progressRate: {...(report.progressRate || {planned: 0, actual: 0}), planned: Number(e.target.value)}})} disabled={isReadOnly} className="w-12 border-b border-gray-200 focus:outline-none text-center text-xs font-black text-blue-600" />
                        <span className="text-[10px] text-gray-400">%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">실행</span>
                        <input type="number" step="0.01" value={report.progressRate?.actual || 0} onChange={e => setReport({...report, progressRate: {...(report.progressRate || {planned: 0, actual: 0}), actual: Number(e.target.value)}})} disabled={isReadOnly} className="w-12 border-b border-gray-200 focus:outline-none text-center text-xs font-black text-green-600" />
                        <span className="text-[10px] text-gray-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: 금일 작업 사항 */}
            <div data-pdf-section className="mb-5 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-gray-700 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">1</span> 금일 작업 사항
                </h3>
                <button 
                  onClick={() => handleOpenTaskModal('today')} 
                  disabled={isReadOnly} 
                  className="text-xs font-bold flex items-center gap-1 px-1 py-1 text-blue-600 hover:text-blue-700 hover:underline transition-all disabled:opacity-50"
                >
                  <Plus size={14} /> 내역 추가
                </button>
              </div>
              <div className="space-y-1">
                {report.todayTasks.length > 0 && (
                  <div className="flex items-center gap-4 px-3 py-1 border-b border-gray-50 mb-1 opacity-60">
                    <div className="w-32 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">공종 / 세부공종</div>
                    <div className="flex-1 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">작업내용 / 위치</div>
                    <div className="w-16 text-[10px] font-bold text-gray-600 uppercase tracking-tighter text-center">작업량</div>
                    <div className="w-32 text-[10px] font-bold text-gray-600 uppercase tracking-tighter text-right">상태 / 관리</div>
                  </div>
                )}
                {report.todayTasks.map((task, idx) => (
                  <div key={task.id} className="flex items-center py-1 px-3 bg-gray-50 rounded-lg border border-gray-100 gap-4 group transition-all hover:bg-gray-100/50">
                    <div className="flex flex-col shrink-0 w-32">
                      <span className="text-xs font-bold truncate" style={{ color: settings.categoryTextColors[task.category] }}>{task.category}</span>
                      <span className="text-[10px] text-gray-500 truncate font-medium">{task.subCategory}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{task.taskName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {[formatMultiValue(task.dongBlock), formatMultiValue(task.floor), formatMultiValue(task.zone)].filter(Boolean).join(' / ')}
                      </p>
                    </div>
                    <div className="shrink-0 w-16 text-center">
                      <span className="text-xs font-bold text-gray-700">{task.amount || '-'}</span>
                    </div>
                    <div className="shrink-0 w-32 flex items-center justify-end gap-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 whitespace-nowrap">{task.status}</span>
                      {!isReadOnly && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenTaskModal('today', task)} 
                            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                            title="수정"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setReport({...report, todayTasks: report.todayTasks.filter(t => t.id !== task.id)})} 
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {report.todayTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm bg-gray-50/50 rounded-lg border border-dashed border-gray-200">등록된 작업 사항이 없습니다.</div>
                )}
              </div>
            </div>

            {/* Section 2 & 3: Personnel and Equipment */}
            <div data-pdf-section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* 출력 인원 현황 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-gray-700 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">2</span> 출력 인원 현황
                  </h3>
                  <button 
                    onClick={() => setIsPersonnelModalOpen(true)} 
                    disabled={isReadOnly} 
                    className="text-xs font-bold flex items-center gap-1 px-1 py-1 text-blue-600 hover:text-blue-700 hover:underline transition-all disabled:opacity-50"
                  >
                    <Plus size={14} /> 인원 추가
                  </button>
                </div>
                
                <div className="mb-4 p-1 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center transition-all hover:bg-gray-100">
                  <span className="text-xs font-semibold text-gray-500">전체 투입 인력</span>
                  <span className="text-xl font-black text-blue-600">
                    {totalPersonnel}
                    <span className="text-xs font-bold text-gray-400 ml-1">명</span>
                  </span>
                </div>

                <div className="space-y-1 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                  {report.personnel.details && report.personnel.details.length > 0 && (
                    <div className="flex justify-between items-center px-2.5 py-1 border-b border-gray-50 mb-1 opacity-60">
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">공종</span>
                      <div className="flex gap-4 text-right">
                        <span className="w-8 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">직영</span>
                        <span className="w-8 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">외주</span>
                        <span className="w-8 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">기타</span>
                        <span className="w-8 text-[10px] font-bold text-blue-500 uppercase tracking-tighter">합계</span>
                      </div>
                    </div>
                  )}
                  {report.personnel.details && report.personnel.details.length > 0 ? (
                    report.personnel.details.map((p) => (
                      <div key={p.id} className="flex justify-between items-center p-1 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded-md transition-colors">
                        <span className="text-sm font-bold text-gray-700">{p.discipline}</span>
                        <div className="flex gap-4">
                          <div className="w-8 flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-600">{p.direct || 0}</span>
                          </div>
                          <div className="w-8 flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-600">{p.outsourced || 0}</span>
                          </div>
                          <div className="w-8 flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-600">{p.other || 0}</span>
                          </div>
                          <div className="w-8 flex flex-col items-end">
                            <span className="text-xs font-black text-blue-600">{(Number(p.direct) || 0) + (Number(p.outsourced) || 0) + (Number(p.other) || 0)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400 text-xs bg-gray-50/50 rounded-lg border border-dashed border-gray-200">인원 정보가 없습니다.</div>
                  )}
                </div>
              </div>

              {/* 장비 투입 현황 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-gray-700 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">3</span> 장비 투입 현황
                  </h3>
                  <button 
                    onClick={() => setIsEquipmentModalOpen(true)} 
                    disabled={isReadOnly} 
                    className="text-xs font-bold flex items-center gap-1 px-1 py-1 text-blue-600 hover:text-blue-700 hover:underline transition-all disabled:opacity-50"
                  >
                    <Plus size={14} /> 장비 추가
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                  {report.equipment.length > 0 && (
                    <div className="flex items-center gap-4 px-3 py-1 border-b border-gray-50 mb-1 opacity-60">
                      <div className="w-16 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">공종</div>
                      <div className="flex-1 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">장비명 (규격)</div>
                      <div className="w-16 text-[10px] font-bold text-gray-600 uppercase tracking-tighter text-center">수량</div>
                    </div>
                  )}
                  {report.equipment.map((eq) => (
                    <div key={eq.id} className="flex items-center p-1 px-3 bg-gray-50 rounded-lg border border-gray-50 transition-all hover:bg-gray-100/50">
                      <div className="shrink-0 w-16">
                        <span className="text-[11px] font-bold text-gray-700 truncate block">{eq.discipline || '-'}</span>
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800 truncate">{eq.type}</span>
                        {eq.capacity && (
                          <span className="text-[11px] text-gray-500 truncate pt-0.5">({eq.capacity})</span>
                        )}
                      </div>
                      <div className="shrink-0 w-16 text-center">
                        <span className="text-sm font-black text-blue-600">{eq.quantity}</span>
                        <span className="text-[10px] font-bold text-gray-400 ml-0.5">대</span>
                      </div>
                    </div>
                  ))}
                  {report.equipment.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-xs bg-gray-50/50 rounded-lg border border-dashed border-gray-200">투입된 장비가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: 특기사항 */}
            <div data-pdf-section className="mb-5 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-gray-700 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">4</span>
                특기사항
                </h3>
                
            <div className="flex items-center gap-3">
              <button
              onClick={handleImportQuickMemos}
              disabled={isReadOnly}
              className="text-xs font-bold flex items-center gap-1 px-1 py-1 text-purple-600 hover:text-purple-700 hover:underline transition-all disabled:opacity-50"
              title="선택한 날짜의 AI 퀵 메모를 공사일보 특기사항과 사진 대지로 가져옵니다."
              >
              <Sparkles size={14} /> AI 퀵 메모 가져오기
              </button>
              
              <button 
                onClick={() => setReport({...report, issues: [...report.issues, { id: Date.now().toString(), type: '안전', description: '' }]})} 
                disabled={isReadOnly}
                className="text-xs font-bold flex items-center gap-1 px-1 py-1 text-blue-600 hover:text-blue-700 hover:underline transition-all disabled:opacity-50"
              >
                <Plus size={14} /> 사항 추가
              </button>
              </div>
            </div>
            
              <div className="space-y-1">
                {report.issues.map((issue, idx) => (
                  <div key={issue.id} className="flex items-center p-1 bg-gray-50 rounded-lg border border-gray-100 gap-4 group">
                    <div className="shrink-0 w-24">
                      <select
  value={issue.type}
  onChange={(e) => {
    const newIssues = [...report.issues];
    newIssues[idx].type = e.target.value as DailyIssue['type'];
    setReport({ ...report, issues: newIssues });
  }}
  disabled={isReadOnly}
  className={`w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${getDailyIssueTypeTextClass(issue.type)}`}
>
  <option value="안전" className="text-red-600 font-bold">
    안전
  </option>
  <option value="품질" className="text-blue-600 font-bold">
    품질
  </option>
  <option value="공정" className="text-blue-600 font-bold">
    공정
  </option>
  <option value="설계" className="text-blue-600 font-bold">
    설계
  </option>
  <option value="자재" className="text-blue-600 font-bold">
    자재
  </option>
  <option value="장비" className="text-blue-600 font-bold">
    장비
  </option>
  <option value="민원" className="text-orange-500 font-bold">
    민원
  </option>
  <option value="기타" className="text-gray-500 font-bold">
    기타
  </option>
</select>
                    </div>
                    <div className="flex-1 min-w-0">
                      <input 
                        type="text" 
                        value={issue.description} 
                        onChange={e => { const newIssues = [...report.issues]; newIssues[idx].description = e.target.value; setReport({...report, issues: newIssues}); }} 
                        disabled={isReadOnly}
                        placeholder="특기사항 내용을 입력하세요." 
                        className="w-full bg-transparent focus:outline-none text-sm text-gray-700 placeholder:text-gray-400 disabled:placeholder-transparent" 
                      />
                    </div>
                    {!isReadOnly && (
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setReport({...report, issues: report.issues.filter(i => i.id !== issue.id)})} 
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {report.issues.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm bg-gray-50/50 rounded-lg border border-dashed border-gray-200">등록된 특기사항이 없습니다.</div>
                )}
              </div>
            </div>


            {/* Section 5: 사진 대지 */}
            <div data-pdf-section className="mb-5 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-gray-700 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">5</span> 사진 대지
                </h3>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isReadOnly} 
                  className="text-xs font-bold flex items-center gap-1 px-1 py-1 text-blue-600 hover:text-blue-700 hover:underline transition-all disabled:opacity-50"
                >
                  <Upload size={14} /> 사진 추가
                </button>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
              </div>
              <div className="min-h-[160px] max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {report.photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-1">
                    {report.photos.map((photo, index) => (
                      <div key={photo.id} className="relative flex flex-col gap-2 group">
                        <div 
                          className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer transition-all active:scale-95 bg-gray-50" 
                          onClick={() => !isReadOnly && handleEditPhoto(photo)}
                        >
                          <img src={photo.url} alt={photo.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            {!isReadOnly && <Edit2 size={16} className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />}
                          </div>
                        </div>
                        <div className="px-1">
                          <p className="text-[11px] font-bold text-gray-900 truncate tracking-tighter">{photo.title || `현장사진 ${index + 1}`}</p>
                          {photo.category && <p className="text-[9px] text-gray-400 truncate">{photo.category}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Upload size={32} className="mb-2 text-gray-300" />
                    <p className="text-xs font-medium">업로드된 사진이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Section 6: 명일 작업 계획 */}
            <div data-pdf-section className="mb-5 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-gray-700 text-white w-5 h-5 rounded flex items-center justify-center text-[10px]">6</span> 명일 작업 계획
                </h3>
                <button 
                  onClick={() => handleOpenTaskModal('tomorrow')} 
                  disabled={isReadOnly} 
                  className="text-xs font-bold flex items-center gap-1 px-1 py-1 text-blue-600 hover:text-blue-700 hover:underline transition-all disabled:opacity-50"
                >
                  <Plus size={14} /> 계획 추가
                </button>
              </div>
              <div className="space-y-1">
                {report.tomorrowTasks.length > 0 && (
                  <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gray-50 mb-1 opacity-60">
                    <div className="w-32 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">공종 / 세부공종</div>
                    <div className="flex-1 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">작업내용 / 위치</div>
                    <div className="w-16 text-[10px] font-bold text-gray-600 uppercase tracking-tighter text-center">작업량</div>
                    <div className="w-16 text-[10px] font-bold text-gray-600 uppercase tracking-tighter text-right">관리</div>
                  </div>
                )}
                {report.tomorrowTasks.map((task, idx) => (
                  <div key={task.id} className="flex items-center py-1.5 px-3 bg-gray-50 rounded-lg border border-gray-100 gap-4 group transition-all hover:bg-gray-100/50">
                    <div className="flex flex-col shrink-0 w-32">
                      <span className="text-xs font-bold truncate" style={{ color: settings.categoryTextColors[task.category] }}>{task.category}</span>
                      <span className="text-[10px] text-gray-500 truncate font-medium">{task.subCategory}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{task.taskName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {[formatMultiValue(task.dongBlock), formatMultiValue(task.floor), formatMultiValue(task.zone)].filter(Boolean).join(' / ')}
                      </p>
                    </div>
                    <div className="shrink-0 w-16 text-center">
                      <span className="text-xs font-bold text-gray-700">{task.amount || '-'}</span>
                    </div>
                    <div className="shrink-0 w-16 flex items-center justify-end">
                      {!isReadOnly && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenTaskModal('tomorrow', task)} 
                            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                            title="수정"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setReport({...report, tomorrowTasks: report.tomorrowTasks.filter(t => t.id !== task.id)})} 
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {report.tomorrowTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm bg-gray-50/50 rounded-lg border border-dashed border-gray-200">등록된 작업 계획이 없습니다.</div>
                )}
              </div>
            </div>


        </div>
      </div>

      <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSave={handleSaveTask} task={editingTask} type={taskModalType} settings={settings} />
      <PhotoModal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} onSave={handleSavePhoto} photo={editingPhoto} settings={settings} />
      <PersonnelModal isOpen={isPersonnelModalOpen} onClose={() => setIsPersonnelModalOpen(false)} onSave={handleSavePersonnel} initialPersonnel={legacyPersonnel} settings={settings} />
      <EquipmentModal isOpen={isEquipmentModalOpen} onClose={() => setIsEquipmentModalOpen(false)} onSave={handleSaveEquipment} initialEquipment={report.equipment} settings={settings} />
      <UserSelectModal isOpen={isUserSelectModalOpen} onClose={() => setIsUserSelectModalOpen(false)} onSelect={handleSelectUser} title={userSelectType === 'author' ? '작성자' : userSelectType === 'reviewer' ? '검토자' : '승인자'} />

      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-gray-600 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold">취소</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">확인</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};