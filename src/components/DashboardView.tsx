import React, { useState, useRef, useEffect } from 'react';
import { Project, DailyReport, Category, AppSettings, ScheduleItem, User } from '../types';
import { Building2, Edit2, Save, X, Upload, Loader2, CloudSun, ChevronLeft, ChevronRight, Thermometer, TrendingUp } from 'lucide-react';
import { compressImage } from '../utils/image';
import { fetchWeather } from '../services/weatherService';
import { supabaseService } from '../services/supabaseService';

import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DashboardViewProps {
  project: Project | null;
  onUpdateProject: (project: Project) => void;
  settings: AppSettings;
  currentUser: User | null;
}

const mockCalendar = [
  { day: 'Sun', date: 21, events: [] },
  { day: 'Mon', date: 22, events: ['공사일보', '검측요청서'] },
  { day: 'Tue', date: 23, events: ['공사일보'] },
  { day: 'Wed', date: 24, events: ['공사일보', '자재승인서'] },
  { day: 'Thu', date: 25, events: ['공사일보', '검측요청서', '타설계획서'] },
  { day: 'Fri', date: 26, events: ['자재승인서'] },
  { day: 'Sat', date: 27, events: ['검측요청서'] },
];

export function DashboardView({ project, onUpdateProject, settings, currentUser }: DashboardViewProps) {
  const formatMultiValue = (value?: string | string[]) => {
    if (Array.isArray(value)) return value.join(', ');
    return value || '';
  };

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTotalArea, setEditTotalArea] = useState<number | ''>('');
  const [editFloorsUG, setEditFloorsUG] = useState<number | ''>('');
  const [editFloorsAG, setEditFloorsAG] = useState<number | ''>('');
  const [editTotalBudget, setEditTotalBudget] = useState<number | ''>('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);

  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [allReports, setAllReports] = useState<DailyReport[]>([]);
  const [displayProgress, setDisplayProgress] = useState<{ planned: number; actual: number }>({ planned: 0, actual: 0 });
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [cumulativePersonnel, setCumulativePersonnel] = useState({ direct: 0, outsourced: 0, other: 0, total: 0 });
  const [weatherData, setWeatherData] = useState<{
    temperature: string;
    maxTemp?: string;
    minTemp?: string;
    precipitation: string;
    windSpeed: string;
    status: string;
  } | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{url: string, title?: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (project) {
      const fetchSchedules = async () => {
        try {
          const data = await supabaseService.getSchedules(project.id);
          setSchedules(data || []);
        } catch (error) {
          console.error('Error fetching schedules:', error);
          const localSchedules = localStorage.getItem(`schedules_${project.id}`);
          if (localSchedules) setSchedules(JSON.parse(localSchedules));
        }
      };
      fetchSchedules();

      const loadReports = async () => {
        let reports: DailyReport[] = [];
        const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
          (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

        if (isSupabaseConfigured) {
          try {
            reports = await supabaseService.getDailyReports(project.id);
          } catch (err) {
            console.error('Failed to load reports from Supabase:', err);
            const savedReports = localStorage.getItem(`cp_daily_reports_${project.id}`);
            if (savedReports) reports = JSON.parse(savedReports);
          }
        } else {
          const savedReports = localStorage.getItem(`cp_daily_reports_${project.id}`);
          if (savedReports) reports = JSON.parse(savedReports);
        }
        
        setAllReports(reports);

        // Selected date's report
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const report = reports.find(r => r.date === dateStr);
        setTodayReport(report || null);

        // Progress rate logic
        // Find the most recent report overall that has progressRate (ignore selectedDate)
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        const sortedReports = [...reports].sort((a, b) => b.date.localeCompare(a.date));
        
        const recentReportWithProgress = sortedReports.find(r => 
          r.progressRate && (r.progressRate.planned > 0 || r.progressRate.actual > 0)
        );
        
        if (recentReportWithProgress && recentReportWithProgress.progressRate) {
          setDisplayProgress(recentReportWithProgress.progressRate);
        } else {
          setDisplayProgress({ planned: 0, actual: 0 });
        }

        // Cumulative personnel
        let direct = 0, outsourced = 0, other = 0;
        reports.forEach(r => {
          direct += (r.personnel?.direct || 0);
          outsourced += (r.personnel?.outsourced || 0);
          other += (r.personnel?.other || 0);
        });
        setCumulativePersonnel({
          direct,
          outsourced,
          other,
          total: direct + outsourced + other
        });
      };
      
      loadReports();
    }
  }, [project, selectedDate]);

  useEffect(() => {
    if (project?.latitude !== undefined && project?.longitude !== undefined) {
      const getWeatherData = async () => {
        setIsWeatherLoading(true);
        try {
          const data = await fetchWeather(project.latitude!, project.longitude!);
          if (data) {
            setWeatherData(data);
          }
        } catch (error) {
          console.error('날씨 조회 실패:', error);
        } finally {
          setIsWeatherLoading(false);
        }
      };
      getWeatherData();
    }
  }, [project?.latitude, project?.longitude]);

  if (!project) return null;

  const handleEditClick = () => {
    setEditName(project.name);
    setEditLocation(project.location || '');
    setEditTotalArea(project.totalArea || '');
    setEditFloorsUG(project.floorsUnderground || '');
    setEditFloorsAG(project.floorsAboveground || '');
    setEditTotalBudget(project.totalBudget || '');
    setEditStartDate(project.startDate || '');
    setEditEndDate(project.endDate || '');
    setEditImageUrl(project.imageUrl || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    onUpdateProject({
      ...project,
      name: editName,
      location: editLocation,
      totalArea: editTotalArea === '' ? undefined : Number(editTotalArea),
      floorsUnderground: editFloorsUG === '' ? undefined : Number(editFloorsUG),
      floorsAboveground: editFloorsAG === '' ? undefined : Number(editFloorsAG),
      totalBudget: editTotalBudget === '' ? undefined : Number(editTotalBudget),
      startDate: editStartDate,
      endDate: editEndDate,
      imageUrl: editImageUrl,
    });
    setIsEditing(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        const compressedBase64 = await compressImage(file, 200);
        setEditImageUrl(compressedBase64);
      } catch (error) {
        console.error('Image compression failed:', error);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const removeImage = () => {
    setEditImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const calculateRemainingDays = (endDate: string) => {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const weekStart = startOfWeek(calendarDate, { weekStartsOn: 0 });
  const daysCount = isMobile ? 3 : 7;
  const startDate = isMobile ? addDays(calendarDate, -1) : weekStart;

  const calendarDays = Array.from({ length: daysCount }).map((_, i) => {
    const date = addDays(startDate, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Get reports to find events
    let events: string[] = [];
    if (project) {
      const report = allReports.find(r => r.date === dateStr);
      if (report) {
        events.push('공사일보');
        if (report.approvalStatus === '승인') events.push('승인완료');
      }
    }

    return {
      date,
      dayName: format(date, 'EEE', { locale: ko }),
      dayNumber: format(date, 'd'),
      events,
      isToday: isSameDay(date, new Date()),
      isSelected: isSameDay(date, selectedDate),
      isSunday: date.getDay() === 0,
      isSaturday: date.getDay() === 6,
    };
  });

  const handlePrevWeek = () => setCalendarDate(prev => addDays(prev, -7));
  const handleNextWeek = () => setCalendarDate(prev => addDays(prev, 7));
  const handleToday = () => {
    const today = new Date();
    setCalendarDate(today);
    setSelectedDate(today);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      setCalendarDate(prev => addDays(prev, isMobile ? 3 : 7));
    } else if (distance < -minSwipeDistance) {
      setCalendarDate(prev => addDays(prev, isMobile ? -3 : -7));
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const getManpowerMaxScale = (total: number) => {
    if (total <= 100) return 100;
    if (total <= 500) return 500;
    if (total <= 1000) return 1000;
    if (total <= 5000) return 5000;
    if (total <= 10000) return 10000;
    return Math.ceil(total / 5000) * 5000;
  };

  const manpowerMaxScale = getManpowerMaxScale(cumulativePersonnel.total);

  const next7DaysStart = format(new Date(), 'yyyy-MM-dd');
  const next7DaysEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  const next7DaysTasks = schedules.filter(task => {
    if (task.isBaseline) return false;
    if (!task.startDate || !task.endDate) return false;
    return task.startDate <= next7DaysEnd && task.endDate >= next7DaysStart;
  }).sort((a, b) => {
    const indexA = settings.categories.indexOf(a.category);
    const indexB = settings.categories.indexOf(b.category);
    const validIndexA = indexA !== -1 ? indexA : 999;
    const validIndexB = indexB !== -1 ? indexB : 999;
    
    if (validIndexA !== validIndexB) {
      return validIndexA - validIndexB;
    }
    return a.startDate.localeCompare(b.startDate);
  });

  return (
    <div className="h-full bg-gray-50 p-2 md:p-4 lg:p-8 overflow-y-auto scrollbar-hide xl:scrollbar-default overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto space-y-2 md:space-y-3">
        
        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3">
          
          {/* 프로젝트 개요 및 대표이미지 통합 영역 */}
          <div className="col-span-1 md:col-span-12 lg:col-span-9 bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold text-gray-900">프로젝트 개요</h2>
              {(currentUser?.userRole === '골드' || currentUser?.role === 'admin') && !isEditing && (
                <button
                  onClick={handleEditClick}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="개요 수정"
                >
                  <Edit2 size={18} />
                </button>
              )}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all text-sm font-medium"
                  >
                    <X size={16} />
                    취소
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all text-sm font-medium shadow-sm"
                  >
                    <Save size={16} />
                    저장
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 프로젝트 정보 */}
              <div className="flex-1">
                {!isEditing ? (
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <th className="py-2 text-left text-gray-500 font-medium w-24">현장명</th>
                        <td className="py-2 text-gray-900 font-bold">{project.name}</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <th className="py-2 text-left text-gray-500 font-medium w-24">위치</th>
                        <td className="py-2 text-gray-900">{project.location || '-'}</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <th className="py-2 text-left text-gray-500 font-medium w-24">연면적</th>
                        <td className="py-2 text-gray-900">{project.totalArea ? `${project.totalArea.toLocaleString()} m²` : '-'}</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <th className="py-2 text-left text-gray-500 font-medium w-24">층수</th>
                        <td className="py-2 text-gray-900">지하 {project.floorsUnderground || 0}층 / 지상 {project.floorsAboveground || 0}층</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <th className="py-2 text-left text-gray-500 font-medium w-24">총 공사비</th>
                        <td className="py-2 text-gray-900">{project.totalBudget ? `${project.totalBudget.toLocaleString()} 억원` : '-'}</td>
                      </tr>
                      <tr>
                        <th className="py-2 text-left text-gray-500 font-medium w-24 align-top">공사기간</th>
                        <td className="py-2 text-gray-900">
                          <div>{project.startDate || '-'} ~ {project.endDate || '-'}</div>
                          {project.endDate && (
                            <div className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded">
                              {calculateRemainingDays(project.endDate)}일 남음
                            </div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">현장명</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="현장명" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">위치</label>
                      <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="위치" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">연면적 (㎡)</label>
                        <input type="number" value={editTotalArea} onChange={(e) => setEditTotalArea(e.target.value ? Number(e.target.value) : '')} placeholder="연면적" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">총 공사비 (억원)</label>
                        <input type="number" value={editTotalBudget} onChange={(e) => setEditTotalBudget(e.target.value ? Number(e.target.value) : '')} placeholder="공사비" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">지하층</label>
                        <input type="number" value={editFloorsUG} onChange={(e) => setEditFloorsUG(e.target.value ? Number(e.target.value) : '')} placeholder="지하" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">지상층</label>
                        <input type="number" value={editFloorsAG} onChange={(e) => setEditFloorsAG(e.target.value ? Number(e.target.value) : '')} placeholder="지상" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">착공일</label>
                        <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">준공일</label>
                        <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 대표이미지 영역 */}
              <div className="flex flex-col">
                <div className="flex-1 bg-gray-50 rounded-lg flex items-center justify-center relative overflow-hidden border border-gray-100 min-h-[220px]">
                  {!isEditing ? (
                    project.imageUrl ? (
                      <img src={project.imageUrl} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-300">
                        <Building2 size={48} className="mb-2 opacity-50" />
                        <span className="text-sm font-medium">대표이미지 없음</span>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full p-2 flex flex-col items-center justify-center">
                      {isCompressing ? (
                        <Loader2 className="text-blue-600 animate-spin" size={24} />
                      ) : editImageUrl ? (
                        <div className="relative w-full h-full rounded-lg overflow-hidden">
                          <img src={editImageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button onClick={removeImage} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"><X size={14} /></button>
                        </div>
                      ) : (
                        <div onClick={() => fileInputRef.current?.click()} className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                          <Upload className="text-gray-400 mb-1" size={20} />
                          <span className="text-xs text-gray-500">이미지 업로드</span>
                        </div>
                      )}
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Part: 3 Cards */}
          <div className="col-span-1 md:col-span-12 lg:col-span-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-3">
            
            {/* 전체 공정률 */}
            <div className="col-span-2 md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col relative">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <TrendingUp className="text-emerald-600" size={16} />
                  전체 공정률
                </h2>
              </div>
              <div className="flex items-baseline justify-between mb-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-600">{displayProgress.actual}%</span>
                  <span className="text-[10px] font-medium text-gray-400">실행</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-gray-400">{displayProgress.planned}%</span>
                  <span className="text-[10px] font-medium text-gray-400">계획</span>
                </div>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden relative">
                <div 
                  className="absolute top-0 left-0 h-full bg-gray-300 rounded-full" 
                  style={{ width: `${displayProgress.planned}%` }}
                />
                <div 
                  className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                  style={{ width: `${displayProgress.actual}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-gray-400">계획대비 {Math.abs(displayProgress.actual - displayProgress.planned).toFixed(1)}% {displayProgress.actual >= displayProgress.planned ? '초과' : '미달'}</span>
              </div>

              {/* Milestones */}
              {schedules.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="space-y-2">
                    {schedules
                      .filter(s => s.isMilestone)
                      .sort((a, b) => a.startDate.localeCompare(b.startDate))
                      .slice(0, 3)
                      .map((milestone, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></div>
                            <span className="text-xs text-gray-700 truncate">{milestone.title}</span>
                          </div>
                          <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap ml-2">
                            {milestone.startDate.replace(/-/g, '.').substring(2)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* 누적 투입 인력 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col relative">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-sm font-bold text-gray-900">누적 투입 인력</h2>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold text-blue-600">{cumulativePersonnel.total}</span>
                <span className="text-sm font-medium text-blue-600">명</span>
              </div>
              <div className="flex items-end justify-between flex-1 min-h-[80px] mt-0 gap-2">
                <div className="flex flex-col items-center flex-1 h-full">
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full bg-blue-500 rounded-t-sm" style={{ height: `${cumulativePersonnel.total > 0 ? (cumulativePersonnel.direct / manpowerMaxScale) * 100 : 0}%`, minHeight: '2px' }}></div>
                  </div>
                  <div className="text-[10px] font-bold text-gray-600 mt-0.5">{cumulativePersonnel.direct}</div>
                  <div className="text-[9px] text-gray-400 mt-0">직영</div>
                </div>
                <div className="flex flex-col items-center flex-1 h-full">
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full bg-yellow-400 rounded-t-sm" style={{ height: `${cumulativePersonnel.total > 0 ? (cumulativePersonnel.outsourced / manpowerMaxScale) * 100 : 0}%`, minHeight: '2px' }}></div>
                  </div>
                  <div className="text-[10px] font-bold text-gray-600 mt-0.5">{cumulativePersonnel.outsourced}</div>
                  <div className="text-[9px] text-gray-400 mt-0">외주</div>
                </div>
                <div className="flex flex-col items-center flex-1 h-full">
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full bg-green-400 rounded-t-sm" style={{ height: `${cumulativePersonnel.total > 0 ? (cumulativePersonnel.other / manpowerMaxScale) * 100 : 0}%`, minHeight: '2px' }}></div>
                  </div>
                  <div className="text-[10px] font-bold text-gray-600 mt-0.5">{cumulativePersonnel.other}</div>
                  <div className="text-[9px] text-gray-400 mt-0">기타</div>
                </div>
              </div>
            </div>

            {/* 현장 날씨 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col relative">
              <h2 className="text-sm font-bold text-gray-900 mb-2">현장 날씨</h2>
              <div className="flex-1 flex flex-col items-center justify-center">
                {isWeatherLoading ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <Loader2 className="text-blue-600 animate-spin mb-1" size={20} />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <CloudSun size={32} className="text-yellow-400" />
                      <div className="text-xs text-gray-600">{weatherData?.status || todayReport?.weather?.status || '날씨 정보 없음'}</div>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-2xl font-bold text-blue-600">
                        {(weatherData?.temperature || todayReport?.weather?.temperature || '0').replace(/[^0-9.-]/g, '')}
                      </span>
                      <span className="text-sm font-medium text-blue-600">°C</span>
                    </div>
                    
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span className="flex items-center gap-0.5">
                          <span className="text-red-500 font-bold">↑</span> {weatherData?.maxTemp || todayReport?.weather?.maxTemp || '-'}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <span className="text-blue-500 font-bold">↓</span> {weatherData?.minTemp || todayReport?.weather?.minTemp || '-'}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-400 flex gap-2">
                        <span>강수 {weatherData?.precipitation || todayReport?.weather?.precipitation || '0mm'}</span>
                        <span>풍속 {weatherData?.windSpeed || todayReport?.weather?.windSpeed || '0m/s'}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Middle Section: Calendar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 overflow-hidden">
          <div className="flex items-center justify-between md:justify-start gap-4 mb-4 md:mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleToday}
                className="px-4 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <h2 className="text-sm md:text-xl font-bold text-gray-900 min-w-[120px] md:min-w-[150px]">
                {format(calendarDate, 'yyyy년 MM월', { locale: ko })}
              </h2>
            </div>
            <div className="hidden md:flex items-center border border-gray-300 rounded-md overflow-hidden">
              <button 
                onClick={handlePrevWeek}
                className="p-1.5 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="w-px h-4 bg-gray-300"></div>
              <button 
                onClick={handleNextWeek}
                className="p-1.5 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          
          <div 
            className={`grid ${isMobile ? 'grid-cols-3' : 'grid-cols-7'} border-l border-gray-200 relative`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Mobile Navigation Indicators */}
            {isMobile && (
              <>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center">
                  <ChevronLeft size={14} className="text-gray-400 -ml-1.5" />
                </div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center">
                  <ChevronRight size={14} className="text-gray-400 -mr-1.5" />
                </div>
              </>
            )}
            {calendarDays.map((day, idx) => (
              <div 
                key={idx} 
                onClick={() => handleDateClick(day.date)}
                className={`border-r border-gray-200 min-h-[100px] md:min-h-[120px] flex flex-col cursor-pointer transition-colors hover:bg-gray-50/50 ${day.isSelected ? 'bg-blue-50/20' : ''} ${day.isToday ? 'bg-blue-50/30' : ''}`}
              >
                <div className={`text-center py-2 border-b border-gray-100 ${day.isSelected ? 'bg-blue-50' : day.isToday ? 'bg-blue-50/50' : ''}`}>
                  <div className="text-xs text-gray-500 font-medium">{day.dayName}</div>
                  <div className="flex items-center justify-center gap-1.5">
                    {day.isToday && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>}
                    <div className={`text-2xl font-bold ${day.isSunday ? 'text-red-500' : day.isSaturday ? 'text-blue-500' : 'text-gray-900'}`}>
                      {day.dayNumber}
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-1 space-y-1 bg-gray-50/30">
                  {day.events.map((event, eIdx) => (
                    <div 
                      key={eIdx} 
                      className={`text-[10px] py-0.5 px-1.5 rounded truncate font-medium ${
                        event === '공사일보' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                        event === '승인완료' ? 'bg-green-100 text-green-700 border border-green-200' :
                        'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {event}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
          <h3 className="text-lg font-bold text-gray-900">
            {format(selectedDate, 'yyyy년 MM월 dd일', { locale: ko })} ({format(selectedDate, 'EEE', { locale: ko })}) 현황
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-12 lg:grid-cols-12 gap-2 md:gap-3">
          
          {/* 오늘 할 일 */}
          <div className="col-span-2 md:col-span-12 lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">오늘 할 일</h2>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
              {(todayReport?.todayTasks || []).map((task, idx) => (
                <div key={task.id || idx} className="flex items-center py-2 border-b border-gray-100 last:border-0 gap-3 md:gap-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-4 shrink-0 w-20 md:w-auto">
                    <span className="font-bold text-[11px] md:text-sm md:w-12 shrink-0 truncate" style={{ color: settings.categoryTextColors[task.category] || '#2563eb' }}>
                      {task.category}
                    </span>
                    <span className="text-gray-900 text-[11px] md:text-sm truncate w-full md:flex-1 md:min-w-[80px] md:max-w-[140px]">
                      {task.subCategory}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-4">
                    <span className="text-gray-500 text-sm truncate md:max-w-[180px] flex-1">
                      {task.taskName}
                    </span>
                    <span className="text-gray-400 text-[10px] md:text-xs truncate md:max-w-[200px]">
                      {[
                        formatMultiValue(task.dongBlock as string | string[]),
                        formatMultiValue(task.floor as string | string[]),
                        formatMultiValue(task.zone as string | string[])
                      ]
                        .filter(Boolean)
                        .join(' / ')}
                    </span>
                    <span className="text-gray-400 text-xs md:text-sm shrink-0 md:w-16 md:text-right md:ml-auto">
                      {task.amount}
                    </span>
                  </div>
                </div>
              ))}
              {(!todayReport?.todayTasks || todayReport.todayTasks.length === 0) && (
                <div className="text-center py-4 text-gray-400 text-sm bg-gray-50/50 rounded">등록된 작업 사항이 없습니다.</div>
              )}
            </div>
          </div>

          {/* 투입 인력 */}
          <div className="col-span-1 md:col-span-6 lg:col-span-2 bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">투입 인력</h2>
            <div className="mb-4 p-3 bg-white rounded-lg border border-gray-100 flex justify-between items-center">
              <span className="text-xs font-medium text-gray-500">합계</span>
              <span className="text-lg font-black text-blue-600">
                {(todayReport?.personnel?.direct || 0) + (todayReport?.personnel?.outsourced || 0) + (todayReport?.personnel?.other || 0)}
                <span className="text-xs font-bold text-gray-400 ml-1">명</span>
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">직영</span>
                <span className="text-blue-600 font-bold">{todayReport?.personnel?.direct || 0} <span className="text-gray-500 font-normal text-xs">명</span></span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">외주</span>
                <span className="text-blue-600 font-bold">{todayReport?.personnel?.outsourced || 0} <span className="text-gray-500 font-normal text-xs">명</span></span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">기타</span>
                <span className="text-blue-600 font-bold">{todayReport?.personnel?.other || 0} <span className="text-gray-500 font-normal text-xs">명</span></span>
              </div>
            </div>
          </div>

          {/* 장비 투입 */}
          <div className="col-span-1 md:col-span-6 lg:col-span-2 bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">장비 투입</h2>
            <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
              {(todayReport?.equipment || []).map((eq, idx) => (
                <div key={eq.id || idx} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-600">{eq.type}</span>
                    <span className="text-[10px] text-gray-400">{eq.capacity}</span>
                  </div>
                  <span className="text-blue-600 font-bold text-sm">
                    {eq.quantity} <span className="text-gray-500 font-normal text-xs">대</span>
                  </span>
                </div>
              ))}
              {(!todayReport?.equipment || todayReport.equipment.length === 0) && (
                <div className="text-center py-4 text-gray-400 text-xs bg-white/50 rounded border border-dashed border-gray-200">투입 장비 없음</div>
              )}
            </div>
          </div>

          {/* 특기사항 */}
          <div className="col-span-2 md:col-span-12 lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">특기사항</h2>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
              {(todayReport?.issues || []).map((issue, idx) => (
                <div key={issue.id || idx} className="flex gap-1.5 items-start p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                    issue.type === '안전' ? 'bg-red-100 text-red-700' : 
                    issue.type === '품질' ? 'bg-blue-100 text-blue-700' : 
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {issue.type}
                  </span>
                  <p className="text-sm text-gray-700 leading-snug">{issue.description}</p>
                </div>
              ))}
              {(!todayReport?.issues || todayReport.issues.length === 0) && (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50/50 rounded border border-dashed border-gray-200">
                  등록된 특기사항이 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 현장사진 */}
          <div className="col-span-2 md:col-span-12 lg:col-span-4 lg:row-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col max-h-[260px] md:max-h-[300px] lg:max-h-[600px]">
            <h2 className="text-sm font-bold text-gray-900 mb-2 md:mb-4 shrink-0">현장사진</h2>
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-4">
                {(todayReport?.photos || []).map((photo, idx) => (
                  <div 
                    key={photo.id || idx} 
                    className="relative flex flex-col gap-2 group cursor-pointer"
                    onClick={() => setSelectedPhoto({ url: photo.url, title: photo.title || `현장사진 ${idx + 1}` })}
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm group-hover:shadow-md transition-shadow">
                      <img 
                        src={photo.url} 
                        alt={photo.title || `현장사진 ${idx + 1}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    </div>
                    <div className="text-xs font-medium text-gray-700 truncate text-center px-1">
                      {photo.title || `현장사진 ${idx + 1}`}
                    </div>
                  </div>
                ))}
                {(!todayReport?.photos || todayReport.photos.length === 0) && (
                  <div className="col-span-full text-center py-8 text-gray-400 text-sm bg-gray-50/50 rounded border border-dashed border-gray-200">
                    등록된 현장사진이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 내일 할 일 */}
          <div className="col-span-2 md:col-span-12 lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">내일 할 일</h2>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
              {(todayReport?.tomorrowTasks || []).map((task, idx) => (
                <div key={task.id || idx} className="flex items-center py-2 border-b border-gray-100 last:border-0 gap-3 md:gap-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-4 shrink-0 w-20 md:w-auto">
                    <span className="font-bold text-[11px] md:text-sm md:w-12 shrink-0 truncate" style={{ color: settings.categoryTextColors[task.category] || '#2563eb' }}>
                      {task.category}
                    </span>
                    <span className="text-gray-900 text-[11px] md:text-sm truncate w-full md:flex-1 md:min-w-[80px] md:max-w-[140px]">
                      {task.subCategory}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-4">
                    <span className="text-gray-500 text-sm truncate md:max-w-[180px] flex-1">
                      {task.taskName}
                    </span>
                    <span className="text-gray-400 text-[10px] md:text-xs truncate md:max-w-[200px]">
                      {[
                        formatMultiValue(task.dongBlock as string | string[]),
                        formatMultiValue(task.floor as string | string[]),
                        formatMultiValue(task.zone as string | string[])
                      ]
                        .filter(Boolean)
                        .join(' / ')}
                    </span>
                    <span className="text-gray-400 text-xs md:text-sm shrink-0 md:w-16 md:text-right md:ml-auto">
                      {task.amount}
                    </span>
                  </div>
                </div>
              ))}
              {(!todayReport?.tomorrowTasks || todayReport.tomorrowTasks.length === 0) && (
                <div className="text-center py-4 text-gray-400 text-sm bg-gray-50/50 rounded">등록된 작업 계획이 없습니다.</div>
              )}
            </div>
          </div>

          {/* 향후 7일간 작업 */}
          <div className="col-span-2 md:col-span-12 lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">향후 7일간 작업</h2>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
              {next7DaysTasks.map((task, idx) => (
                <div key={task.id || idx} className="flex items-center py-2 border-b border-gray-100 last:border-0 gap-3 md:gap-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-4 shrink-0 w-20 md:w-auto">
                    <span className="font-bold text-[11px] md:text-sm md:w-12 shrink-0 truncate" style={{ color: settings.categoryTextColors[task.category] || '#2563eb' }}>
                      {task.category}
                    </span>
                    <span className="text-gray-900 text-[11px] md:text-sm truncate w-full md:flex-1 md:min-w-[80px] md:max-w-[140px]">
                      {task.subCategory}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-4">
                    <span className="text-gray-500 text-sm truncate md:max-w-[180px] flex-1">
                      {task.taskName}
                    </span>
                    <span className="text-gray-400 text-[10px] md:text-xs shrink-0 md:ml-auto md:text-right">
                      {task.startDate?.substring(5).replace('-', '.')} ~ {task.endDate?.substring(5).replace('-', '.')}
                    </span>
                  </div>
                </div>
              ))}
              {next7DaysTasks.length === 0 && (
                <div className="text-center py-4 text-gray-400 text-sm bg-gray-50/50 rounded">예정된 작업이 없습니다.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Photo Popup Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-bold">{selectedPhoto.title}</h3>
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="text-white/70 hover:text-white p-2 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <img 
              src={selectedPhoto.url} 
              alt={selectedPhoto.title} 
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" 
            />
          </div>
        </div>
      )}
    </div>
  );
}

