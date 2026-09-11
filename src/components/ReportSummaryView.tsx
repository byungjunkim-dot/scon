import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Copy, 
  Check, 
  Calendar, 
  ArrowLeft, 
  Share2, 
  Clipboard, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight,
  Image as ImageIcon,
  Download,
  Eye,
  X
} from 'lucide-react';
import { DailyReport, Project, User, DailyPhoto } from '../types';
import { supabaseService } from '../services/supabaseService';
import { safeJsonParse } from '../utils/safeJson';

interface ReportSummaryViewProps {
  project: Project | null;
  currentUser: User | null;
  onGoToDailyReport?: () => void;
}

// URL/Base64를 공유 가능한 File 객체로 변환
async function urlToFile(url: string, filename: string): Promise<File> {
  if (url.startsWith('data:')) {
    const parts = url.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } else {
    const res = await fetch(url);
    const blob = await res.blob();
    const mime = blob.type || 'image/jpeg';
    return new File([blob], filename, { type: mime });
  }
}

export function ReportSummaryView({ project, currentUser, onGoToDailyReport }: ReportSummaryViewProps) {
  // 오늘 날짜 구하기 (KST 기준)
  const getTodayKST = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (9 * 60 * 60 * 1000));
    return kst.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayKST());
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  
  // 사진 선택 및 미리보기 상태
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [previewPhoto, setPreviewPhoto] = useState<DailyPhoto | null>(null);

  // 모바일 날짜 포맷 (예: 2026.09.04 (금))
  const formatMobileDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = days[d.getDay()];
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}.${mm}.${dd} (${dayName})`;
    } catch {
      return dateStr;
    }
  };

  const handleMoveDate = (daysOffset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + daysOffset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(getTodayKST());
  };

  // 일보 데이터 로드
  useEffect(() => {
    const loadReports = async () => {
      if (!project) return;
      setIsLoading(true);
      const isSupabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL;
      
      try {
        if (isSupabaseConfigured) {
          const fetched = await supabaseService.getDailyReports(project.id);
          setReports(fetched);
        } else {
          const savedReportsStr = localStorage.getItem(`cp_daily_reports_${project.id}`);
          const fetched: DailyReport[] = safeJsonParse(savedReportsStr, []);
          setReports(fetched);
        }
      } catch (err) {
        console.error('Failed to load reports in summary:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, [project?.id]);

  // 해당 일자 리포트 찾기
  const currentReport = useMemo(() => {
    return reports.find(r => r.date === selectedDate);
  }, [reports, selectedDate]);

  // 리포트가 변경되거나 날짜가 바뀔 때 모든 사진을 기본 선택
  useEffect(() => {
    if (currentReport?.photos && currentReport.photos.length > 0) {
      setSelectedPhotoIds(new Set(currentReport.photos.map(p => p.id)));
    } else {
      setSelectedPhotoIds(new Set());
    }
  }, [currentReport?.id, currentReport?.photos]);

  // 날짜 한국어 포맷팅 (26년 09월 04일 금요일 형식)
  const koreanDate = useMemo(() => {
    if (!selectedDate || !selectedDate.includes('-')) return '';
    const parts = selectedDate.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    
    const date = new Date(y, m, d);
    const yearShort = String(y).slice(-2);
    const month = String(m + 1).padStart(2, '0');
    const day = String(d).padStart(2, '0');
    const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const weekday = weekdays[date.getDay()];
    
    return `${yearShort}년 ${month}월 ${day}일 ${weekday}`;
  }, [selectedDate]);

  // 복사용 텍스트 생성 (공통관리 / 삼우 포함)
  const generatedSummaryText = useMemo(() => {
    if (!currentReport) return '';

    const tasks = currentReport.todayTasks || [];
    
    // 표준 업체/공종 키 생성 함수
    const getStandardKey = (contractor?: string, discipline?: string) => {
      const c = (contractor || '').trim();
      const d = (discipline || '').trim();
      if (d === '공통관리' || c === '공통관리' || c === '삼우') {
        return '삼우(공통관리)';
      }
      if (c) return c;
      return d || '기타';
    };

    // 유일한 업체 목록 추출
    const contractorsMap = new Map<string, { 
      discipline: string; 
      contractor: string; 
      direct: number; 
      outsourced: number; 
      other: number; 
      tasks: string[]; 
    }>();

    // personnel details 기준 기본 그룹 생성 (공통관리/삼우 포함)
    if (currentReport.personnel?.details && Array.isArray(currentReport.personnel.details)) {
      currentReport.personnel.details.forEach(p => {
        if (!p.discipline) return;
        const key = getStandardKey(p.contractor, p.discipline);
        if (!contractorsMap.has(key)) {
          contractorsMap.set(key, {
            discipline: p.discipline,
            contractor: p.contractor || '',
            direct: Number(p.direct) || 0,
            outsourced: Number(p.outsourced) || 0,
            other: Number(p.other) || 0,
            tasks: []
          });
        } else {
          const prev = contractorsMap.get(key)!;
          prev.direct += Number(p.direct) || 0;
          prev.outsourced += Number(p.outsourced) || 0;
          prev.other += Number(p.other) || 0;
        }
      });
    }

    // details가 없거나 details에 삼우(공통관리)가 없는데 상위 관리자(direct) 인원이 있는 경우 기본 생성
    if (!contractorsMap.has('삼우(공통관리)') && (Number(currentReport.personnel?.direct) || 0) > 0) {
      contractorsMap.set('삼우(공통관리)', {
        discipline: '공통관리',
        contractor: '삼우',
        direct: Number(currentReport.personnel?.direct) || 0,
        outsourced: 0,
        other: 0,
        tasks: []
      });
    }

    // tasks 기준 작업내용 맵핑 및 누락된 업체 추가
    tasks.forEach(t => {
      let key = getStandardKey(t.contractor, t.category);
      
      // 작업에 업체명이 명시되지 않은 경우, 기존 등록된 동일 공종 키와 매핑
      if (!t.contractor && t.category && !contractorsMap.has(key)) {
        for (const [existingKey, val] of contractorsMap.entries()) {
          if (val.discipline === t.category) {
            key = existingKey;
            break;
          }
        }
      }

      if (!contractorsMap.has(key)) {
        contractorsMap.set(key, {
          discipline: t.category,
          contractor: t.contractor || '',
          direct: 0,
          outsourced: 0,
          other: 0,
          tasks: [t.taskName]
        });
      } else {
        const item = contractorsMap.get(key)!;
        if (!item.tasks.includes(t.taskName)) {
          item.tasks.push(t.taskName);
        }
      }
    });

    // 1. 인원 현황 집계 (공통관리 및 삼우 포함하여 전체 집계)
    let direct = 0;
    let outsourced = 0;
    let other = 0;
    
    const hasDetails = currentReport.personnel?.details && currentReport.personnel.details.length > 0;

    if (hasDetails) {
      contractorsMap.forEach((info) => {
        direct += info.direct;
        outsourced += info.outsourced;
        other += info.other;
      });
    } else {
      direct = Number(currentReport.personnel?.direct) || 0;
      outsourced = Number(currentReport.personnel?.outsourced) || 0;
      other = Number(currentReport.personnel?.other) || 0;
    }

    const totalPersonnel = direct + outsourced + other;

    // 2. 장비 현황 집계
    const equipmentList = currentReport.equipment || [];
    const totalEquipmentCount = equipmentList.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
    const equipmentStr = equipmentList.length > 0
      ? `장비 총 ${totalEquipmentCount}대\n  (${equipmentList.map(e => `${e.type} ${e.quantity}대`).join(', ')})`
      : '등록된 장비 없음';

    // 3. 업체별 작업내용 가공 (공통관리/삼우 포함)
    let workContentStr = '';
    
    // 삼우(공통관리)가 최상단에 오도록 정렬
    const sortedContractorEntries = Array.from(contractorsMap.entries()).sort(([aName], [bName]) => {
      const aIsSamoo = aName.includes('삼우') || aName.includes('공통관리');
      const bIsSamoo = bName.includes('삼우') || bName.includes('공통관리');
      if (aIsSamoo && !bIsSamoo) return -1;
      if (!aIsSamoo && bIsSamoo) return 1;
      return 0;
    });

    sortedContractorEntries.forEach(([name, info]) => {
      const subTotal = info.direct + info.outsourced + info.other;

      const isSamoo = 
        name.includes('삼우') || 
        name.includes('공통관리') || 
        (info.contractor && (info.contractor.includes('삼우') || info.contractor.includes('공통관리'))) ||
        (info.discipline && info.discipline.includes('공통관리'));

      // 공백을 제외한 유효 작업내용 필터링
      const validTasks = info.tasks
        .map(t => (t || '').trim())
        .filter(t => t.length > 0);

      // 인원도 없고 작업내용도 없는 빈 행은 제외
      if (subTotal === 0 && validTasks.length === 0) return;

      // 표시 이름 구성
      let displayName = name;
      if (name === '공통관리') {
        displayName = '삼우(공통관리)';
      } else if (info.discipline && name !== info.discipline && !name.includes(info.discipline)) {
        displayName = `${name}(${info.discipline})`;
      }

      // '삼우'의 작업내용에 별도 저장 내용이 없을 때는 '현장 및 안전 관리'로 표현
      const defaultTask = isSamoo ? '현장 및 안전 관리' : '특별사항 없음';

      const tasksStr = validTasks.length > 0
        ? validTasks.map(t => ` : ${t}`).join('\n')
        : ` : ${defaultTask}`;

      workContentStr += `■ ${displayName}\n- 인원 : ${subTotal}명\n  (관리자 ${info.direct}명 / 근로자 ${info.outsourced + info.other}명)\n- 작업내용\n${tasksStr}\n\n`;
    });

    if (!workContentStr) {
      workContentStr = '등록된 작업 내용이 없습니다.\n';
    }

    // 최종 문자열 조립
    return `[일일출력 및 작업보고]
${koreanDate}

1. 인원/장비 현황
- 총원 : ${totalPersonnel}명 
  (관리자 ${direct}명 / 근로자 ${outsourced + other}명)
- 장비 : ${equipmentStr}

2. 작업내용
${workContentStr.trim()}`;
  }, [currentReport, koreanDate]);

  // 사용자가 직접 수정할 수 있는 내용 상태 추가
  const [summaryText, setSummaryText] = useState<string>('');

  // 생성된 텍스트가 바뀔 때 상태 동기화
  useEffect(() => {
    setSummaryText(generatedSummaryText);
  }, [generatedSummaryText]);

  // 클립보드 복사 처리
  const handleCopy = async () => {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // 사진 선택 토글
  const handleTogglePhoto = (id: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 전체 사진 선택 / 해제 토글
  const handleToggleSelectAll = () => {
    const photos = currentReport?.photos || [];
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(photos.map(p => p.id)));
    }
  };

  // 개별 사진 다운로드
  const handleDownloadPhoto = (photo: DailyPhoto, index: number) => {
    const ext = photo.url.startsWith('data:image/png') ? 'png' : 'jpg';
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = `${selectedDate}_현장사진_${index + 1}${photo.title ? `_${photo.title}` : ''}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 선택한 사진 일괄 다운로드
  const handleDownloadAllSelected = () => {
    const photos = (currentReport?.photos || []).filter(p => selectedPhotoIds.has(p.id));
    photos.forEach((p, idx) => {
      setTimeout(() => {
        handleDownloadPhoto(p, idx);
      }, idx * 200);
    });
  };

  // 모바일 공유하기 기능 (텍스트 또는 텍스트 + 선택된 사진 파일 포함)
  const handleShare = async (shareWithPhotos = true) => {
    if (!summaryText) return;
    setIsSharing(true);

    try {
      const selectedPhotos = shareWithPhotos 
        ? (currentReport?.photos || []).filter(p => selectedPhotoIds.has(p.id))
        : [];
      let filesToShare: File[] = [];

      // 선택된 사진들을 File 객체로 변환
      if (selectedPhotos.length > 0) {
        const filePromises = selectedPhotos.map(async (photo, idx) => {
          const ext = photo.url.startsWith('data:image/png') ? 'png' : 'jpg';
          const safeTitle = (photo.title || '현장사진').replace(/[\s/\\?%*:|"<>]/g, '_');
          const filename = `${selectedDate}_사진_${idx + 1}_${safeTitle}.${ext}`;
          return urlToFile(photo.url, filename);
        });
        const results = await Promise.allSettled(filePromises);
        filesToShare = results
          .filter((r): r is PromiseFulfilledResult<File> => r.status === 'fulfilled')
          .map(r => r.value);
      }

      if (navigator.share) {
        const shareData: ShareData = {
          title: `${project?.name || '현장'} 일일출력 및 작업보고`,
          text: summaryText,
        };

        // 브라우저가 파일 공유를 지원하고 선택된 사진이 있는 경우 사진 첨부
        if (filesToShare.length > 0 && navigator.canShare && navigator.canShare({ files: filesToShare })) {
          shareData.files = filesToShare;
        }

        await navigator.share(shareData);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // navigator.share 미지원 브라우저: 텍스트 복사 및 선택 사진 다운로드
        await handleCopy();
        if (filesToShare.length > 0) {
          handleDownloadAllSelected();
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share with files failed or canceled, attempting text fallback:', err);
        try {
          if (navigator.share) {
            await navigator.share({
              title: `${project?.name || '현장'} 일일출력 및 작업보고`,
              text: summaryText,
            });
          } else {
            await handleCopy();
          }
        } catch {
          await handleCopy();
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  const photos = currentReport?.photos || [];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-28 p-2 sm:p-4 space-y-2">
      {/* 카드 1: 제목과 날짜 선택 영역 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900 leading-tight">공사일보 요약 및 사진 공유</h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSetToday}
              className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              오늘
            </button>
          </div>
        </div>

        {/* 날짜 선택 버튼 그룹 */}
        <div className="flex items-center justify-between py-1 pt-1">
          <button 
            onClick={() => handleMoveDate(-1)}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg transition-all active:scale-95 cursor-pointer"
            title="이전 날짜"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="relative flex-1 text-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
            />
            <div className="flex items-center justify-center gap-1.5 py-0.5 font-black text-xs sm:text-sm text-slate-800">
              <Calendar size={14} className="text-blue-600" />
              <span>{formatMobileDate(selectedDate)}</span>
            </div>
          </div>

          <button 
            onClick={() => handleMoveDate(1)}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg transition-all active:scale-95 cursor-pointer"
            title="다음 날짜"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 카드 2: 텍스트 보고서 내용 영역 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Clipboard size={14} className="text-blue-600" />
            <span className="text-xs font-bold text-slate-800">일일출력 및 작업보고 내용</span>
          </div>
          {currentReport && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1 bg-slate-100 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
              title="텍스트 복사"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>{copied ? '복사됨' : '복사'}</span>
            </button>
          )}
        </div>

        {/* 보고서가 없을 때 안내 */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
            <p className="text-xs font-medium text-slate-500">일보 내역을 불러오는 중입니다...</p>
          </div>
        ) : !currentReport ? (
          <div className="py-10 flex flex-col items-center justify-center space-y-3 text-center">
            <AlertCircle size={32} className="text-slate-300" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-800">{selectedDate} 일보가 없습니다.</h3>
              <p className="text-[11px] text-slate-500">선택한 날짜에 저장된 공사일보 데이터가 없습니다.</p>
            </div>
            {onGoToDailyReport && (
              <button
                onClick={onGoToDailyReport}
                className="py-1.5 px-3 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                공사일보 작성하러 가기
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col w-full">
            <textarea
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              rows={11}
              className="w-full p-2.5 text-xs font-mono text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none resize-none leading-relaxed transition-all"
              placeholder="일일출력 및 작업보고 내용을 직접 입력할 수 있습니다."
            />
          </div>
        )}
      </div>

      {/* 카드 3: 현장 사진 대지 (사진 함께 공유) */}
      {currentReport && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <ImageIcon size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900">
                  현장 사진 대지 ({photos.length}장)
                </h3>
                <p className="text-xs text-slate-500">
                  {photos.length > 0
                    ? `공유에 포함할 사진을 선택하세요 (${selectedPhotoIds.size}/${photos.length}장 선택됨)`
                    : '등록된 현장 사진이 없습니다.'}
                </p>
              </div>
            </div>

            {photos.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {selectedPhotoIds.size === photos.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
            )}
          </div>

          {photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {photos.map((photo, idx) => {
                const isSelected = selectedPhotoIds.has(photo.id);
                return (
                  <div
                    key={photo.id || idx}
                    className={`relative rounded-xl border overflow-hidden transition-all group ${
                      isSelected 
                        ? 'border-slate-300 bg-white opacity-100 shadow-xs' 
                        : 'border-slate-200/80 bg-slate-50/50 opacity-60'
                    }`}
                  >
                    {/* 이미지 썸네일 */}
                    <div 
                      className="relative aspect-square w-full cursor-pointer bg-slate-100 overflow-hidden"
                      onClick={() => setPreviewPhoto(photo)}
                    >
                      <img
                        src={photo.url}
                        alt={photo.title || `현장사진 ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                        <div className="bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye size={14} />
                        </div>
                      </div>
                    </div>

                    {/* 선택 체크마크 버튼 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePhoto(photo.id);
                      }}
                      className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-black/20 backdrop-blur-xs text-transparent border border-white/40'
                      }`}
                      title={isSelected ? '공유 제외' : '공유 포함'}
                    >
                      {isSelected ? <Check size={11} strokeWidth={3.5} /> : null}
                    </button>

                    {/* 사진 하단 정보 */}
                    <div className="p-2 flex items-center gap-1 bg-white border-t border-slate-100">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-800 truncate">
                          {photo.title || `사진 ${idx + 1}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 space-y-1">
              <ImageIcon size={24} className="text-slate-300" />
              <p className="text-xs font-medium">당일 등록된 사진이 없습니다.</p>
              {onGoToDailyReport && (
                <button
                  onClick={onGoToDailyReport}
                  className="text-[11px] text-blue-600 font-bold hover:underline pt-1"
                >
                  공사일보에서 사진 등록하기 &gt;
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 하단 고정 액션 버튼 */}
      {currentReport && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex gap-2.5 z-40">
          {/* 텍스트만 공유 버튼 */}
          <button
            onClick={() => handleShare(false)}
            disabled={isSharing}
            type="button"
            className="flex-1 py-3 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="텍스트만 공유하기"
          >
            <Share2 size={15} className="text-white" />
            <span>텍스트 공유</span>
          </button>
          
          {/* 사진과 같이 공유 버튼 */}
          <button
            onClick={() => handleShare(true)}
            disabled={isSharing || selectedPhotoIds.size === 0}
            type="button"
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
              selectedPhotoIds.size === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {isSharing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>공유 파일 준비 중...</span>
              </>
            ) : (
              <>
                <ImageIcon size={15} />
                <span>
                  사진 공유 ({selectedPhotoIds.size})
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 사진 전체보기 모달 */}
      <AnimatePresence>
        {previewPhoto && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-3.5 backdrop-blur-xs"
            onClick={() => setPreviewPhoto(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50">
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {previewPhoto.title || '현장 사진 미리보기'}
                  </h4>
                  {previewPhoto.category && (
                    <p className="text-[10px] text-slate-500 truncate">{previewPhoto.category}</p>
                  )}
                </div>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-2 bg-slate-950 flex items-center justify-center min-h-[240px] max-h-[60vh]">
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.title || '현장 사진'}
                  className="max-w-full max-h-[58vh] object-contain rounded-lg"
                />
              </div>

              <div className="p-3 bg-white flex items-center justify-between border-t border-slate-100">
                <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                  {previewPhoto.description || selectedDate}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadPhoto(previewPhoto, 0)}
                    className="px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>저장</span>
                  </button>
                  <button
                    onClick={() => setPreviewPhoto(null)}
                    className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

