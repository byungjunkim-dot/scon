import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Download, Upload, Loader2, Save, FileText, Edit2, AlertTriangle } from 'lucide-react';
import { DailyReport, DailyTask, DailyEquipment, DailyIssue, DailyPhoto, Project, AppSettings, ApprovalRecord, User } from '../types';
import { compressImage } from '../utils/image';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { TaskModal } from './TaskModal';
import { PhotoModal } from './PhotoModal';
import { PersonnelModal } from './PersonnelModal';
import { EquipmentModal } from './EquipmentModal';
import { UserSelectModal } from './UserSelectModal';
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
  personnel: {
    direct: 0,
    outsourced: 0,
    other: 0
  },
  equipment: [],
  issues: [],
  photos: [],
  progressRate: {
    planned: 0,
    actual: 0
  }
});

export const DailyReportView: React.FC<DailyReportViewProps> = ({ project, settings, currentUser, onDirtyChange }) => {
  const [report, setReport] = useState<DailyReport>(initialReport(project?.id || ''));
  const [lastSavedReport, setLastSavedReport] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const showStatus = (msg: string) => {
    console.log('Status:', msg);
    setStatusMessage(msg);
  };
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
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

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
    let message = '';
    let user = '';
    
    if (nextStatus === '승인요청') {
      message = '승인요청하시겠습니까?';
      user = report.author || currentUser?.name || '작성자';
    } else if (nextStatus === '검토완료') {
      message = '검토완료 하시겠습니까?';
      user = report.reviewer || currentUser?.name || '검토자';
    } else if (nextStatus === '승인') {
      message = '승인하시겠습니까?';
      user = report.approver || currentUser?.name || '승인자';
    } else if (nextStatus === '재작성요청') {
      message = '재작성을 요청하시겠습니까? (일보가 다시 수정 가능한 상태가 됩니다)';
      user = currentUser?.name || '검토자/승인자';
    }

    setConfirmModal({
      isOpen: true,
      title: '결재 확인',
      message,
      onConfirm: () => {
        const newRecord: ApprovalRecord = {
          status: nextStatus,
          timestamp: new Date().toISOString(),
          user: currentUser?.name || user
        };
        
        setReport(prev => ({
          ...prev,
          approvalStatus: nextStatus,
          approvalHistory: [...(prev.approvalHistory || []), newRecord]
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
    setReport(prev => ({
      ...prev,
      [userSelectType]: user.name
    }));
  };

  const prevDateRef = useRef('');
  const prevProjectIdRef = useRef('');

  useEffect(() => {
    const loadReport = async () => {
      if (!project) return;
      
      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

      if (isSupabaseConfigured) {
        try {
          const reports = await supabaseService.getDailyReports(project.id);
          const existingReport = reports.find(r => r.date === report.date);
          if (existingReport) {
            setReport(existingReport);
            setLastSavedReport(JSON.stringify(existingReport));
            return;
          }
        } catch (err) {
          console.error('Failed to load report from Supabase:', err);
        }
      }

      // Fallback to localStorage
      const savedReports = localStorage.getItem(`cp_daily_reports_${project.id}`);
      if (savedReports) {
        const reports: DailyReport[] = JSON.parse(savedReports);
        const existingReport = reports.find(r => r.date === report.date);
        if (existingReport) {
          setReport(existingReport);
          setLastSavedReport(JSON.stringify(existingReport));
          return;
        }
      }

      // If no report exists for this date, reset to initial state but keep the selected date
      const newReport = {
        ...initialReport(project.id),
        date: report.date
      };
      setReport(newReport);
      setLastSavedReport(JSON.stringify(newReport));
    };

    if (project && (report.date !== prevDateRef.current || project.id !== prevProjectIdRef.current)) {
      prevDateRef.current = report.date;
      prevProjectIdRef.current = project.id;
      loadReport();
    }
  }, [project?.id, report.date]);

  useEffect(() => {
  if (project && !report.author) {
    if (project.latitude !== undefined && project.longitude !== undefined) {
      const autoFetchWeather = async () => {
        try {
          const data = await fetchWeather(
            project.latitude!,
            project.longitude!,
            report.date
          );

          if (data) {
            setReport(prev => ({
              ...prev,
              weather: {
                ...prev.weather,
                ...data
              }
            }));
          }
        } catch (error) {
          console.error('날씨 자동 조회 실패:', error);
          showStatus('날씨 조회에 실패했습니다.');
        }
      };

      autoFetchWeather();
    }
  }
}, [project, report.date]);


  useEffect(() => {
    const currentReportStr = JSON.stringify(report);
    const dirty = lastSavedReport ? currentReportStr !== lastSavedReport : false;
    console.log('DailyReportView dirty state check:', { 
      dirty, 
      isDirty, 
      lastSavedReportSet: !!lastSavedReport,
      reportId: report.id,
      date: report.date
    });
    if (dirty !== isDirty) {
      console.log('DailyReportView calling onDirtyChange:', dirty);
      setIsDirty(dirty);
      onDirtyChange?.(dirty);
    }
  }, [report, lastSavedReport, onDirtyChange, isDirty]);

  const handleSave = async () => {
    if (!project) return;

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveDailyReport(report);
        const reportStr = JSON.stringify(report);
        setLastSavedReport(reportStr);
        setIsDirty(false);
        onDirtyChange?.(false);
        showStatus('Supabase에 저장되었습니다.');
        return;
      } catch (err) {
        console.error('Failed to save report to Supabase:', err);
        showStatus('Supabase 저장에 실패했습니다. 로컬 저장소에 저장합니다.');
      }
    }

    const savedReportsStr = localStorage.getItem(`cp_daily_reports_${project.id}`);
    let reports: DailyReport[] = savedReportsStr ? JSON.parse(savedReportsStr) : [];
    
    const saveToLocal = () => {
      console.log('DailyReportView saving to local storage...');
      const existingDateIndex = reports.findIndex(r => r.date === report.date && r.id !== report.id);
      if (existingDateIndex >= 0) {
        reports[existingDateIndex] = report;
      } else {
        const existingIdIndex = reports.findIndex(r => r.id === report.id);
        if (existingIdIndex >= 0) {
          reports[existingIdIndex] = report;
        } else {
          reports.push(report);
        }
      }
      localStorage.setItem(`cp_daily_reports_${project.id}`, JSON.stringify(reports));
      const reportStr = JSON.stringify(report);
      console.log('DailyReportView setting lastSavedReport:', reportStr.substring(0, 50) + '...');
      setLastSavedReport(reportStr);
      setIsDirty(false);
      onDirtyChange?.(false);
      showStatus('저장되었습니다.');
    };

    const existingDateIndex = reports.findIndex(r => r.date === report.date && r.id !== report.id);
    if (existingDateIndex >= 0) {
      setConfirmModal({
        isOpen: true,
        title: '덮어씌우기 확인',
        message: '해당 날짜에 이미 작성된 일보가 있습니다. 덮어씌우시겠습니까?',
        onConfirm: saveToLocal
      });
    } else {
      saveToLocal();
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`공사일보_${report.date}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      showStatus('PDF 다운로드에 실패했습니다.');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    try {
      const file = files[0];
      const compressedBase64 = await compressImage(file, 500); 

      const newPhoto: DailyPhoto = {
        id: Date.now().toString(),
        url: compressedBase64,
        title: '',
        category: '',
        subCategory: '',
        description: ''
      };

      setEditingPhoto(newPhoto);
      setIsPhotoModalOpen(true);

    } catch (error) {
      console.error('Image processing failed:', error);
      alert('이미지 처리에 실패했습니다.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSavePhoto = async (photo: DailyPhoto) => {
    let finalPhoto = { ...photo };

    if (finalPhoto.url.startsWith('data:image/')) {
      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

      if (isSupabaseConfigured) {
        showStatus('이미지를 서버에 업로드 중입니다...');
        try {
          const res = await fetch(finalPhoto.url);
          const blob = await res.blob();
          const uniqueFileName = `daily_report_${project?.id}_${Date.now()}.jpg`;
          
          const publicUrl = await supabaseService.uploadImage(blob, uniqueFileName);
          
          finalPhoto.url = publicUrl; 
          showStatus('이미지 업로드 완료!');
        } catch (error) {
          console.error('Image upload failed:', error);
          alert('이미지 업로드에 실패했습니다. 사진이 등록되지 않습니다.');
          return;
        }
      }
    }

    setReport(prev => {
      const existingIndex = prev.photos.findIndex(p => p.id === finalPhoto.id);
      let newPhotos;
      if (existingIndex >= 0) {
        newPhotos = [...prev.photos];
        newPhotos[existingIndex] = finalPhoto;
      } else {
        newPhotos = [...prev.photos, finalPhoto];
      }
      return { ...prev, photos: newPhotos };
    });
  };

  const handleEditPhoto = (photo: DailyPhoto) => {
    setEditingPhoto(photo);
    setIsPhotoModalOpen(true);
  };

// 사진 삭제 처리 함수
  const handleDeletePhoto = async (photoToDelete: DailyPhoto) => {
    // 1. 화면(상태)에서 먼저 제거
    setReport(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== photoToDelete.id)
    }));

    // 2. 서버에 올라간 사진이라면 Storage에서도 삭제
    if (!photoToDelete.url.startsWith('data:image/')) {
      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

      if (isSupabaseConfigured) {
        try {
          const urlParts = photoToDelete.url.split('/');
          const fileName = urlParts[urlParts.length - 1];

          if (fileName) {
            await supabaseService.deleteImage(fileName);
            showStatus('서버에서 이미지가 완전히 삭제되었습니다.');
          }
        } catch (error) {
          console.error('Storage 이미지 삭제 실패:', error);
        }
      }
    }
  };

  const handleSavePersonnel = (personnelDetails: any[]) => {
    const direct = personnelDetails.reduce((sum, p) => sum + (Number(p.direct) || 0), 0);
    const outsourced = personnelDetails.reduce((sum, p) => sum + (Number(p.outsourced) || 0), 0);
    const other = personnelDetails.reduce((sum, p) => sum + (Number(p.other) || 0), 0);

    setReport({
      ...report,
      personnel: {
        direct,
        outsourced,
        other,
        details: personnelDetails
      }
    });
    setIsPersonnelModalOpen(false);
  };

  const handleSaveEquipment = (equipmentDetails: any[]) => {
    setReport({
      ...report,
      equipment: equipmentDetails
    });
    setIsEquipmentModalOpen(false);
  };

  const legacyPersonnel = React.useMemo(() => {
    if (report.personnel.details && report.personnel.details.length > 0) {
      return report.personnel.details;
    }
    if (report.personnel.direct > 0 || report.personnel.outsourced > 0 || report.personnel.other > 0) {
      return [{ id: 'legacy-data', discipline: '기존 데이터', direct: report.personnel.direct, outsourced: report.personnel.outsourced, other: report.personnel.other }];
    }
    return [];
  }, [report.personnel]);

  const totalPersonnel = report.personnel.direct + report.personnel.outsourced + report.personnel.other;

  return (
    <div className="h-full flex flex-col bg-white relative">
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 bg-gray-900 text-white rounded-full shadow-2xl text-sm font-bold flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            {statusMessage}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">공사 일보 작성</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Daily Report</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSave} 
            disabled={isReadOnly}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-bold ${
              isReadOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            <Save size={16} /> 저장
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-bold">
            <Download size={16} /> PDF 다운로드
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-100/50">
        <div ref={reportRef} className="max-w-4xl mx-auto bg-white p-8 shadow-sm border border-gray-200 rounded-xl space-y-8">
            
            {/* Document Header */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-black text-gray-900 tracking-widest text-center mt-4 border-b-4 border-gray-900 pb-2 inline-block">공 사 일 보</h1>
              </div>
              
              {/* Approval Table */}
              <div className="flex flex-col items-end">
                <table className="border-collapse border-2 border-gray-900 text-sm text-center bg-white">
                  <tbody>
                    <tr>
                      <td rowSpan={2} className="bg-gray-100 border border-gray-900 font-bold px-3 py-2 w-12 writing-vertical-lr">결재</td>
                      <td className="bg-gray-50 border border-gray-900 px-4 py-1 w-24 text-xs font-bold text-gray-800">작성자</td>
                      <td className="bg-gray-50 border border-gray-900 px-4 py-1 w-24 text-xs font-bold text-gray-800">검토자</td>
                      <td className="bg-gray-50 border border-gray-900 px-4 py-1 w-24 text-xs font-bold text-gray-800">승인자</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-900 p-1 h-16 align-bottom relative">
                        <button 
                          onClick={() => handleOpenUserSelectModal('author')}
                          disabled={isReadOnly}
                          className={`w-full h-full flex flex-col items-center justify-center transition-colors ${isReadOnly ? 'cursor-default' : 'hover:bg-gray-50'}`}
                        >
                          <span className="text-xs text-gray-900 font-bold">{report.author || '선택'}</span>
                          {report.approvalHistory?.find(h => h.status === '승인요청') && (
                            <span className="text-[9px] text-gray-500 mt-1 leading-tight">
                              {format(new Date(report.approvalHistory.find(h => h.status === '승인요청')!.timestamp), 'MM/dd HH:mm')}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="border border-gray-900 p-1 h-16 align-bottom relative">
                        <button 
                          onClick={() => handleOpenUserSelectModal('reviewer')}
                          disabled={isReadOnly}
                          className={`w-full h-full flex flex-col items-center justify-center transition-colors ${isReadOnly ? 'cursor-default' : 'hover:bg-gray-50'}`}
                        >
                          <span className="text-xs text-gray-900 font-bold">{report.reviewer || '선택'}</span>
                          {report.approvalHistory?.find(h => h.status === '검토완료') && (
                            <span className="text-[9px] text-gray-500 mt-1 leading-tight">
                              {format(new Date(report.approvalHistory.find(h => h.status === '검토완료')!.timestamp), 'MM/dd HH:mm')}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="border border-gray-900 p-1 h-16 align-bottom relative">
                        <button 
                          onClick={() => handleOpenUserSelectModal('approver')}
                          disabled={isReadOnly}
                          className={`w-full h-full flex flex-col items-center justify-center transition-colors ${isReadOnly ? 'cursor-default' : 'hover:bg-gray-50'}`}
                        >
                          <span className="text-xs text-gray-900 font-bold">{report.approver || '선택'}</span>
                          {report.approvalHistory?.find(h => h.status === '승인') && (
                            <span className="text-[9px] text-gray-500 mt-1 leading-tight">
                              {format(new Date(report.approvalHistory.find(h => h.status === '승인')!.timestamp), 'MM/dd HH:mm')}
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-900 p-1 bg-gray-50 text-xs font-bold">상태</td>
                      <td className="border border-gray-900 p-1">
                        <button 
                          onClick={() => handleApproval('승인요청')} 
                          disabled={(report.approvalStatus !== '작성중' && report.approvalStatus !== '재작성요청') || (report.author !== currentUser?.name && currentUser?.role !== 'admin')}
                          className={`w-full text-[10px] py-1 rounded transition-colors ${
                            report.approvalStatus === '승인요청' ? 'bg-blue-600 text-white font-bold' : 
                            (report.approvalStatus === '작성중' || report.approvalStatus === '재작성요청') && (report.author === currentUser?.name || currentUser?.role === 'admin') ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold' : 
                            'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          승인요청
                        </button>
                      </td>
                      <td className="border border-gray-900 p-1">
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => handleApproval('검토완료')} 
                            disabled={report.approvalStatus !== '승인요청' || (report.reviewer !== currentUser?.name && currentUser?.role !== 'admin')}
                            className={`w-full text-[10px] py-1 rounded transition-colors ${
                              report.approvalStatus === '검토완료' ? 'bg-orange-600 text-white font-bold' : 
                              report.approvalStatus === '승인요청' && (report.reviewer === currentUser?.name || currentUser?.role === 'admin') ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 font-bold' : 
                              'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            검토완료
                          </button>
                          {report.approvalStatus === '승인요청' && (report.reviewer === currentUser?.name || currentUser?.role === 'admin') && (
                            <button 
                              onClick={() => handleApproval('재작성요청')}
                              className="w-full text-[9px] py-0.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors font-bold"
                            >
                              재작성요청
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="border border-gray-900 p-1">
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => handleApproval('승인')} 
                            disabled={report.approvalStatus !== '검토완료' || (report.approver !== currentUser?.name && currentUser?.role !== 'admin')}
                            className={`w-full text-[10px] py-1 rounded transition-colors ${
                              report.approvalStatus === '승인' ? 'bg-green-600 text-white font-bold' : 
                              report.approvalStatus === '검토완료' && (report.approver === currentUser?.name || currentUser?.role === 'admin') ? 'bg-green-50 text-green-700 hover:bg-green-100 font-bold' : 
                              'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            승인
                          </button>
                          {report.approvalStatus === '검토완료' && (report.approver === currentUser?.name || currentUser?.role === 'admin') && (
                            <button 
                              onClick={() => handleApproval('재작성요청')}
                              className="w-full text-[9px] py-0.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors font-bold"
                            >
                              재작성요청
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Project Info & Weather */}
            <table className="w-full border-collapse border-2 border-gray-900 text-sm mb-6 bg-white">
              <tbody>
                <tr>
                  <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 w-32 text-center text-gray-800">프로젝트명</td>
                  <td className="border border-gray-900 px-4 py-2 font-medium text-gray-900">{project?.name || '프로젝트 미지정'}</td>
                  <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 w-24 text-center text-gray-800">일자</td>
                  <td className="border border-gray-900 px-4 py-2 w-48">
                    <input 
                      type="date" 
                      value={report.date} 
                      onChange={e => setReport({...report, date: e.target.value})} 
                      disabled={isReadOnly}
                      className="w-full focus:outline-none bg-transparent font-medium text-gray-900 disabled:text-gray-500" 
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 text-center text-gray-800">날씨</td>
                  <td className="border border-gray-900 px-4 py-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-[10px]">최고기온:</span>
                        <input 
                          type="text" 
                          value={report.weather.maxTemp || ''} 
                          onChange={e => setReport({...report, weather: {...report.weather, maxTemp: e.target.value}})} 
                          disabled={isReadOnly}
                          className="w-10 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent text-center text-xs disabled:border-transparent" 
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-[10px]">최저기온:</span>
                        <input 
                          type="text" 
                          value={report.weather.minTemp || ''} 
                          onChange={e => setReport({...report, weather: {...report.weather, minTemp: e.target.value}})} 
                          disabled={isReadOnly}
                          className="w-10 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent text-center text-xs disabled:border-transparent" 
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-[10px]">풍속:</span>
                        <input 
                          type="text" 
                          value={report.weather.windSpeed || ''} 
                          onChange={e => setReport({...report, weather: {...report.weather, windSpeed: e.target.value}})} 
                          disabled={isReadOnly}
                          className="w-10 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent text-center text-xs disabled:border-transparent" 
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-[10px]">강수량:</span>
                        <input 
                          type="text" 
                          value={report.weather.precipitation || ''} 
                          onChange={e => setReport({...report, weather: {...report.weather, precipitation: e.target.value}})} 
                          disabled={isReadOnly}
                          className="w-10 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent text-center text-xs disabled:border-transparent" 
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-[10px]">상태:</span>
                        <input 
                          type="text" 
                          value={report.weather.status || ''} 
                          onChange={e => setReport({...report, weather: {...report.weather, status: e.target.value}})} 
                          disabled={isReadOnly}
                          className="w-12 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent text-xs disabled:border-transparent" 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="border border-gray-900 bg-gray-100 font-bold px-4 py-2 w-24 text-center text-gray-800">공정률</td>
                  <td className="border border-gray-900 px-4 py-2 w-48">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">계획:</span>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={report.progressRate?.planned || 0} 
                          onChange={e => setReport({...report, progressRate: {...(report.progressRate || {planned: 0, actual: 0}), planned: Number(e.target.value)}})} 
                          disabled={isReadOnly}
                          className="w-12 border-b border-gray-300 focus:outline-none text-center text-xs font-bold text-blue-600 disabled:border-transparent disabled:text-gray-500" 
                        />
                        <span className="text-[10px] text-gray-500">%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">실행:</span>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={report.progressRate?.actual || 0} 
                          onChange={e => setReport({...report, progressRate: {...(report.progressRate || {planned: 0, actual: 0}), actual: Number(e.target.value)}})} 
                          disabled={isReadOnly}
                          className="w-12 border-b border-gray-300 focus:outline-none text-center text-xs font-bold text-green-600 disabled:border-transparent disabled:text-gray-500" 
                        />
                        <span className="text-[10px] text-gray-500">%</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 1. Today Tasks */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                  금일 작업 사항
                </h3>
                <button 
                  onClick={() => handleOpenTaskModal('today')} 
                  disabled={isReadOnly}
                  className={`text-sm font-bold flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
                    isReadOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                  }`}
                >
                  <Plus size={14} /> 내역 추가
                </button>
              </div>
              <table className="w-full border-collapse border-2 border-gray-900 text-sm bg-white">
                <thead className="bg-gray-100 text-gray-800">
                  <tr>
                    <th className="border border-gray-900 px-2 py-2 w-10 text-center">No</th>
                    <th className="border border-gray-900 px-2 py-2 w-24 text-center">공종</th>
                    <th className="border border-gray-900 px-2 py-2 w-24 text-center">세부공종</th>
                    <th className="border border-gray-900 px-2 py-2 text-center">작업명</th>
                    <th className="border border-gray-900 px-2 py-2 w-32 text-center">위치/구역</th>
                    <th className="border border-gray-900 px-2 py-2 w-20 text-center">작업량</th>
                    <th className="border border-gray-900 px-2 py-2 w-20 text-center">상태</th>
                    <th className="border border-gray-900 px-2 py-2 w-16 text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {report.todayTasks.map((task, idx) => (
                    <tr key={task.id} className="hover:bg-gray-50 group">
                      <td className="border border-gray-900 px-2 py-2 text-center text-gray-500">{idx + 1}</td>
                      <td className="border border-gray-900 px-2 py-2 text-center">{task.category}</td>
                      <td className="border border-gray-900 px-2 py-2 text-center">{task.subCategory}</td>
                      <td className="border border-gray-900 px-2 py-2">{task.taskName}</td>
                      <td className="border border-gray-900 px-2 py-2 text-center">
                        {[task.dongBlock, task.floor, task.zone].filter(Boolean).join(' ')}
                      </td>
                      <td className="border border-gray-900 px-2 py-2 text-center">{task.amount}</td>
                      <td className="border border-gray-900 px-2 py-2 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${task.status === '진행' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="border border-gray-900 px-2 py-2 text-center">
                        <div className={`flex justify-center gap-2 transition-opacity ${isReadOnly ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button onClick={() => handleOpenTaskModal('today', task)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>
                          <button onClick={() => setReport({...report, todayTasks: report.todayTasks.filter(t => t.id !== task.id)})} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {report.todayTasks.length === 0 && (
                    <tr><td colSpan={8} className="border border-gray-900 px-4 py-8 text-center text-gray-400 bg-gray-50/50">등록된 작업 사항이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 2. Personnel & Equipment */}
            <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-6 mb-6">
              {/* Personnel */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                    출력 인원 현황
                  </h3>
                  <button 
                    onClick={() => setIsPersonnelModalOpen(true)} 
                    disabled={isReadOnly}
                    className={`text-sm font-bold flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
                      isReadOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                    }`}
                  >
                    <Plus size={14} /> 인원 추가
                  </button>
                </div>
                <table className="w-full border-collapse border-2 border-gray-900 text-sm bg-white">
                  <thead className="bg-gray-100 text-gray-800">
                    <tr>
                      <th className="border border-gray-900 px-1 py-2 text-center w-[20%]">공종</th>
                      <th className="border border-gray-900 px-1 py-2 text-center w-[20%]">직영</th>
                      <th className="border border-gray-900 px-1 py-2 text-center w-[20%]">외주</th>
                      <th className="border border-gray-900 px-1 py-2 text-center w-[20%]">기타</th>
                      <th className="border border-gray-900 px-1 py-2 text-center w-[20%]">계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.personnel.details && report.personnel.details.length > 0 ? (
                      report.personnel.details.map((p) => (
                        <tr key={p.id}>
                          <td className="border border-gray-900 px-1 py-2 text-center font-bold text-gray-700 bg-gray-50">{p.discipline}</td>
                          <td className="border border-gray-900 px-1 py-1 text-center">{p.direct}</td>
                          <td className="border border-gray-900 px-1 py-1 text-center">{p.outsourced}</td>
                          <td className="border border-gray-900 px-1 py-1 text-center">{p.other}</td>
                          <td className="border border-gray-900 px-1 py-1 text-center font-bold text-gray-900">{(Number(p.direct) || 0) + (Number(p.outsourced) || 0) + (Number(p.other) || 0)}</td>
                        </tr>
                      ))
                    ) : (report.personnel.direct > 0 || report.personnel.outsourced > 0 || report.personnel.other > 0) ? (
                      <tr>
                        <td className="border border-gray-900 px-1 py-2 text-center font-bold text-gray-700 bg-gray-50">기존 데이터</td>
                        <td className="border border-gray-900 px-1 py-1 text-center">{report.personnel.direct}</td>
                        <td className="border border-gray-900 px-1 py-1 text-center">{report.personnel.outsourced}</td>
                        <td className="border border-gray-900 px-1 py-1 text-center">{report.personnel.other}</td>
                        <td className="border border-gray-900 px-1 py-1 text-center font-bold text-gray-900">{totalPersonnel}</td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={5} className="border border-gray-900 px-1 py-8 text-center text-gray-400 bg-gray-50/50">
                          '인원 추가' 버튼을 눌러 출력 인원을 입력해주세요.
                        </td>
                      </tr>
                    )}
                    <tr className="bg-gray-100">
                      <td className="border border-gray-900 px-1 py-2 text-center font-bold text-gray-900">합계</td>
                      <td className="border border-gray-900 px-1 py-2 text-center font-bold text-blue-700">{report.personnel.direct}</td>
                      <td className="border border-gray-900 px-1 py-2 text-center font-bold text-blue-700">{report.personnel.outsourced}</td>
                      <td className="border border-gray-900 px-1 py-2 text-center font-bold text-blue-700">{report.personnel.other}</td>
                      <td className="border border-gray-900 px-1 py-2 text-center font-bold text-blue-700">{totalPersonnel}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Equipment */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                    장비 투입 현황
                  </h3>
                  <button 
                    onClick={() => setIsEquipmentModalOpen(true)} 
                    disabled={isReadOnly}
                    className={`text-sm font-bold flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
                      isReadOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                    }`}
                  >
                    <Plus size={14} /> 장비 추가
                  </button>
                </div>
                <table className="w-full border-collapse border-2 border-gray-900 text-sm bg-white">
                  <thead className="bg-gray-100 text-gray-800">
                    <tr>
                      <th className="border border-gray-900 px-2 py-2 text-center w-24">공종</th>
                      <th className="border border-gray-900 px-2 py-2 text-center">장비종류</th>
                      <th className="border border-gray-900 px-2 py-2 w-20 text-center">용량/규격</th>
                      <th className="border border-gray-900 px-2 py-2 w-16 text-center">대수</th>
                      <th className="border border-gray-900 px-2 py-2 w-24 text-center">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.equipment.map((eq) => (
                      <tr key={eq.id} className="hover:bg-gray-50">
                        <td className="border border-gray-900 px-2 py-1 text-center text-gray-600">{eq.discipline || '-'}</td>
                        <td className="border border-gray-900 px-2 py-1 text-center font-medium">{eq.type}</td>
                        <td className="border border-gray-900 px-2 py-1 text-center text-gray-600">{eq.capacity}</td>
                        <td className="border border-gray-900 px-2 py-1 text-center font-bold text-blue-700">{eq.quantity}</td>
                        <td className="border border-gray-900 px-2 py-1 text-center text-gray-600">{eq.note}</td>
                      </tr>
                    ))}
                    {report.equipment.length === 0 && (
                      <tr><td colSpan={5} className="border border-gray-900 px-4 py-8 text-center text-gray-400 bg-gray-50/50">투입 장비가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Issues */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span>
                  특기사항 (안전/품질/민원)
                </h3>
                <button 
                  onClick={() => setReport({...report, issues: [...report.issues, { id: Date.now().toString(), type: '안전', description: '' }]})} 
                  disabled={isReadOnly}
                  className={`text-sm font-bold flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
                    isReadOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                  }`}
                >
                  <Plus size={14} /> 사항 추가
                </button>
              </div>
              <table className="w-full border-collapse border-2 border-gray-900 text-sm bg-white">
                <thead className="bg-gray-100 text-gray-800">
                  <tr>
                    <th className="border border-gray-900 px-2 py-2 w-24 text-center">구분</th>
                    <th className="border border-gray-900 px-2 py-2 text-center">내용</th>
                    <th className="border border-gray-900 px-2 py-2 w-16 text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {report.issues.map((issue, idx) => (
                    <tr key={issue.id} className="hover:bg-gray-50 group">
                      <td className="border border-gray-900 px-2 py-1 text-center">
                        <select 
                          value={issue.type} 
                          onChange={e => { const newIssues = [...report.issues]; newIssues[idx].type = e.target.value as any; setReport({...report, issues: newIssues}); }} 
                          disabled={isReadOnly}
                          className="w-full bg-transparent focus:outline-none text-center font-bold text-gray-700 disabled:appearance-none"
                        >
                          <option value="안전">안전</option>
                          <option value="품질">품질</option>
                          <option value="민원">민원</option>
                        </select>
                      </td>
                      <td className="border border-gray-900 px-3 py-2">
                        <input 
                          type="text" 
                          value={issue.description} 
                          onChange={e => { const newIssues = [...report.issues]; newIssues[idx].description = e.target.value; setReport({...report, issues: newIssues}); }} 
                          disabled={isReadOnly}
                          placeholder="특기사항 내용을 입력하세요." 
                          className="w-full bg-transparent focus:outline-none disabled:placeholder-transparent" 
                        />
                      </td>
                      <td className="border border-gray-900 px-2 py-1 text-center">
                        <button 
                          onClick={() => setReport({...report, issues: report.issues.filter(i => i.id !== issue.id)})} 
                          disabled={isReadOnly}
                          className={`text-red-400 hover:text-red-600 transition-opacity ${isReadOnly ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {report.issues.length === 0 && (
                    <tr><td colSpan={3} className="border border-gray-900 px-4 py-8 text-center text-gray-400 bg-gray-50/50">등록된 특기사항이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. Photos */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">5</span>
                  사진 대지
                </h3>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isReadOnly}
                  className={`text-sm font-bold flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
                    isReadOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                  }`}
                >
                  {isCompressing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 
                  사진 추가
                </button>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
              </div>
              <div className="border-2 border-gray-900 bg-white p-4 min-h-[200px]">
                {report.photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {report.photos.map((photo, index) => (
                      <div key={photo.id} className="relative flex flex-col gap-1 group">
                        <div 
                          className={`relative aspect-square rounded-sm overflow-hidden border border-gray-300 shadow-sm ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                          onClick={() => !isReadOnly && handleEditPhoto(photo)}
                        >
                          <img src={photo.url} alt={photo.title || `현장 사진 ${index + 1}`} className="w-full h-full object-cover" />
                          {!isReadOnly && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Edit2 className="text-white" size={24} />
                            </div>
                          )}
                          {!isReadOnly && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePhoto(photo);
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <div className="px-1">
                          <p className="text-[10px] font-bold text-blue-600 truncate">{photo.category} {photo.subCategory && `> ${photo.subCategory}`}</p>
                          <p className="text-xs font-medium text-gray-900 truncate">{photo.title || `사진 ${index + 1}`}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12 bg-gray-50/50 border border-dashed border-gray-300 m-2">
                    <Upload size={32} className="mb-2 text-gray-300" />
                    <p className="text-sm font-medium">업로드된 사진이 없습니다.</p>
                    <p className="text-xs mt-1">우측 상단의 '사진 추가' 버튼을 눌러 사진을 첨부하세요.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Tomorrow Tasks */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">6</span>
                  명일 작업 계획
                </h3>
                <button 
                  onClick={() => handleOpenTaskModal('tomorrow')} 
                  disabled={isReadOnly}
                  className={`text-sm font-bold flex items-center gap-1 px-3 py-1 rounded-md transition-colors ${
                    isReadOnly ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                  }`}
                >
                  <Plus size={14} /> 계획 추가
                </button>
              </div>
              <table className="w-full border-collapse border-2 border-gray-900 text-sm bg-white">
                <thead className="bg-gray-100 text-gray-800">
                  <tr>
                    <th className="border border-gray-900 px-2 py-2 w-10 text-center">No</th>
                    <th className="border border-gray-900 px-2 py-2 w-24 text-center">공종</th>
                    <th className="border border-gray-900 px-2 py-2 w-24 text-center">세부공종</th>
                    <th className="border border-gray-900 px-2 py-2 text-center">작업명</th>
                    <th className="border border-gray-900 px-2 py-2 w-32 text-center">위치/구역</th>
                    <th className="border border-gray-900 px-2 py-2 w-20 text-center">작업량</th>
                    <th className="border border-gray-900 px-2 py-2 w-16 text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tomorrowTasks.map((task, idx) => (
                    <tr key={task.id} className="hover:bg-gray-50 group">
                      <td className="border border-gray-900 px-2 py-2 text-center text-gray-500">{idx + 1}</td>
                      <td className="border border-gray-900 px-2 py-2 text-center">{task.category}</td>
                      <td className="border border-gray-900 px-2 py-2 text-center">{task.subCategory}</td>
                      <td className="border border-gray-900 px-2 py-2">{task.taskName}</td>
                      <td className="border border-gray-900 px-2 py-2 text-center">
                        {[task.dongBlock, task.floor, task.zone].filter(Boolean).join(' ')}
                      </td>
                      <td className="border border-gray-900 px-2 py-2 text-center">{task.amount}</td>
                      <td className="border border-gray-900 px-2 py-2 text-center">
                        <div className={`flex justify-center gap-2 transition-opacity ${isReadOnly ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button onClick={() => handleOpenTaskModal('tomorrow', task)} className="text-blue-500 hover:text-blue-700"><Edit2 size={14} /></button>
                          <button onClick={() => setReport({...report, tomorrowTasks: report.tomorrowTasks.filter(t => t.id !== task.id)})} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {report.tomorrowTasks.length === 0 && (
                    <tr><td colSpan={7} className="border border-gray-900 px-4 py-8 text-center text-gray-400 bg-gray-50/50">등록된 작업 계획이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      <TaskModal 
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
        type={taskModalType}
        settings={settings}
      />

      <PhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onSave={handleSavePhoto}
        photo={editingPhoto}
        settings={settings}
      />

      <PersonnelModal
        isOpen={isPersonnelModalOpen}
        onClose={() => setIsPersonnelModalOpen(false)}
        onSave={handleSavePersonnel}
        initialPersonnel={legacyPersonnel}
        settings={settings}
      />

      <EquipmentModal
        isOpen={isEquipmentModalOpen}
        onClose={() => setIsEquipmentModalOpen(false)}
        onSave={handleSaveEquipment}
        initialEquipment={report.equipment}
        settings={settings}
      />

      <UserSelectModal
        isOpen={isUserSelectModalOpen}
        onClose={() => setIsUserSelectModalOpen(false)}
        onSelect={handleSelectUser}
        title={
          userSelectType === 'author' ? '작성자' : 
          userSelectType === 'reviewer' ? '검토자' : '승인자'
        }
      />

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-gray-600 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-bold"
                >
                  취소
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
                >
                  확인
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
