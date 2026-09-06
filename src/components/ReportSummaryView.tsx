import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, Calendar, ArrowLeft, Share2, Clipboard, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { DailyReport, Project, User } from '../types';
import { supabaseService } from '../services/supabaseService';
import { safeJsonParse } from '../utils/safeJson';

interface ReportSummaryViewProps {
  project: Project | null;
  currentUser: User | null;
  onGoToDailyReport?: () => void;
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

  // 복사용 텍스트 생성
  const summaryText = useMemo(() => {
    if (!currentReport) return '';

    // 3. 업체별 작업내용 가공
    // 오늘 작업 작업팀 추출
    const tasks = currentReport.todayTasks || [];
    
    // 유일한 업체 목록 추출 (todayTasks 및 personnel details 참고)
    const contractorsMap = new Map<string, { discipline: string, direct: number, outsourced: number, other: number, tasks: string[] }>();

    // personnel details 기준 기본 그룹 생성
    if (currentReport.personnel?.details && Array.isArray(currentReport.personnel.details)) {
      currentReport.personnel.details.forEach(p => {
        if (!p.discipline) return;
        const contractorName = p.contractor || p.discipline; // 업체명 없으면 공종명 사용
        if (!contractorsMap.has(contractorName)) {
          contractorsMap.set(contractorName, {
            discipline: p.discipline,
            direct: Number(p.direct) || 0,
            outsourced: Number(p.outsourced) || 0,
            other: Number(p.other) || 0,
            tasks: []
          });
        } else {
          const prev = contractorsMap.get(contractorName)!;
          prev.direct += Number(p.direct) || 0;
          prev.outsourced += Number(p.outsourced) || 0;
          prev.other += Number(p.other) || 0;
        }
      });
    }

    // tasks 기준 작업내용 맵핑 및 누락된 업체 추가
    tasks.forEach(t => {
      const contractorName = t.contractor || t.category;
      if (!contractorName) return;

      if (!contractorsMap.has(contractorName)) {
        contractorsMap.set(contractorName, {
          discipline: t.category,
          direct: 0,
          outsourced: 0,
          other: 0,
          tasks: [t.taskName]
        });
      } else {
        const item = contractorsMap.get(contractorName)!;
        if (!item.tasks.includes(t.taskName)) {
          item.tasks.push(t.taskName);
        }
      }
    });

    // 공통관리(삼우) 제외 판정 함수
    const isCommonManagement = (name: string, discipline: string) => {
      const n = (name || '').trim();
      const d = (discipline || '').trim();
      return (
        n === '공통관리' || 
        n === '삼우' || 
        n.includes('공통관리') || 
        n.includes('삼우') || 
        d === '공통관리' || 
        d.includes('공통관리')
      );
    };

    // 1. 인원 현황 집계 (공통관리 제외한 외주 인원만 합산)
    let direct = 0;
    let outsourced = 0;
    let other = 0;
    
    const hasDetails = currentReport.personnel?.details && currentReport.personnel.details.length > 0;

    if (hasDetails) {
      contractorsMap.forEach((info, name) => {
        if (!isCommonManagement(name, info.discipline)) {
          direct += info.direct;
          outsourced += info.outsourced;
          other += info.other;
        } else {
          // 공통관리(삼우)의 경우 관리자(direct)만 제외하고, 근로자 및 기타 인원은 합산에 포함
          outsourced += info.outsourced;
          other += info.other;
        }
      });
    } else {
      // details가 없는 경우 기존 상위 필드를 활용하되, 삼우/공통관리를 개별로 거를 수 없으므로 전체 값 대입
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

    let workContentStr = '';
    contractorsMap.forEach((info, name) => {
      const isCommon = isCommonManagement(name, info.discipline);
      const hasWorkers = (info.outsourced + info.other) > 0;

      // 공통관리 및 삼우 제외 (단, 근로자/작업자/기타 인원이 있는 경우는 예외로 포함)
      if (isCommon && !hasWorkers) return;

      const displayName = isCommon ? `삼우(${info.discipline})` : name;
      const displayDirect = isCommon ? 0 : info.direct;
      const subTotal = displayDirect + info.outsourced + info.other;
      const tasksStr = info.tasks.length > 0
        ? info.tasks.map(t => ` : ${t}`).join('\n')
        : ' : 특별사항 없음';

      workContentStr += `■ ${displayName}\n- 인원 : ${subTotal}명\n  (관리자 ${displayDirect}명/근로자 ${info.outsourced + info.other}명)\n- 작업내용\n${tasksStr}\n\n`;
    });

    if (!workContentStr) {
      workContentStr = '등록된 외주 작업 내용이 없습니다.\n';
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

  // 클립보드 복사 처리
  const handleCopy = () => {
    if (!summaryText) return;
    navigator.clipboard.writeText(summaryText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  // 모바일 기본 공유하기 기능 지원
  const handleShare = () => {
    if (!summaryText) return;
    if (navigator.share) {
      navigator.share({
        title: `${project?.name || '현장'} 일일출력 및 작업보고`,
        text: summaryText
      })
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.log('Share canceled or failed', err);
        // Fallback to copy on fail
        handleCopy();
      });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-2 space-y-2 overflow-hidden pb-[76px]">
      {/* 카드 1: 제목과 날짜 영역 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900 leading-tight">공사일보 요약 공유하기</h2>
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

      {/* 카드 2: 내용이 보여지는 카드영역 */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col overflow-hidden">
        {/* 보고서가 없을 때 안내 */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
            <p className="text-xs font-medium text-slate-500">일보 내역을 불러오는 중입니다...</p>
          </div>
        ) : !currentReport ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center">
            <AlertCircle size={36} className="text-slate-300" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-800">{selectedDate} 일보가 없습니다.</h3>
              <p className="text-[11px] text-slate-500">선택한 날짜에 작성되거나 저장된 공사일보가 없습니다.</p>
            </div>
            {onGoToDailyReport && (
              <button
                onClick={onGoToDailyReport}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors max-w-xs"
              >
                공사일보 작성하러 가기
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
            <textarea
              readOnly
              value={summaryText}
              onClick={handleCopy}
              className="flex-1 w-full p-1 text-xs font-mono text-slate-700 border-0 focus:ring-0 focus:outline-none resize-none leading-relaxed bg-white cursor-pointer select-all"
              placeholder="보고서 데이터를 수집하고 있습니다."
            />
          </div>
        )}
      </div>

      {/* 하단 고정 액션 버튼 */}
      {currentReport && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex gap-2 z-40">
          <button
            onClick={handleShare}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all ${
              copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span>{copied ? '공유 팝업 실행 / 복사 완료' : '내용 공유하기'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
