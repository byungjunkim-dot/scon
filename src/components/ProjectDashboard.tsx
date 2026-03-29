import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  FileText, 
  PenTool, 
  Settings, 
  Users, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Building2,
  Clock
} from 'lucide-react';
import { Project, ScheduleItem, DailyReport } from '../types';

interface ProjectDashboardProps {
  project: Project;
  schedules: ScheduleItem[];
  onNavigate: (tab: 'gantt' | 'daily-report' | 'drawings' | 'settings') => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, schedules, onNavigate }) => {
  // Calculate progress
  const progress = useMemo(() => {
    if (schedules.length === 0) return 0;
    const completed = schedules.filter(s => s.status === '완료').length;
    return Math.round((completed / schedules.length) * 100);
  }, [schedules]);

  // Calculate cumulative personnel from localStorage daily reports
  const cumulativePersonnel = useMemo(() => {
    const savedReports = localStorage.getItem(`cp_daily_reports_${project.id}`);
    if (!savedReports) return 0;
    try {
      const reports: DailyReport[] = JSON.parse(savedReports);
      return reports.reduce((acc, report) => {
        return acc + report.personnel.direct + report.personnel.outsourced + report.personnel.other;
      }, 0);
    } catch (e) {
      return 0;
    }
  }, [project.id]);

  // Key milestones (just taking the first 3 tasks or tasks with '마일스톤' in name)
  const milestones = useMemo(() => {
    const sorted = [...schedules].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return sorted.slice(0, 3);
  }, [schedules]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">프로젝트 대시보드</h1>
          <p className="text-gray-500 mt-2">프로젝트의 전반적인 현황과 주요 메뉴를 확인하세요.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. Project Overview */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="text-blue-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">프로젝트 개요</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">프로젝트명</p>
                <p className="font-semibold text-gray-900">{project.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">현장 위치</p>
                <div className="flex items-center gap-1 text-gray-900 font-semibold">
                  <MapPin size={16} className="text-gray-400" />
                  {project.location || '미지정'}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">공사 기간</p>
                <div className="flex items-center gap-1 text-gray-900 font-semibold">
                  <Calendar size={16} className="text-gray-400" />
                  {project.startDate} ~ {project.endDate}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">총 예산</p>
                <p className="font-semibold text-gray-900">
                  {project.budget ? `₩${project.budget.toLocaleString()}` : '미지정'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500 mb-1">설명</p>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg text-sm border border-gray-100">
                  {project.description || '프로젝트 설명이 없습니다.'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Construction Status */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-emerald-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">공사 현황</h2>
            </div>
            
            <div className="space-y-6 flex-1">
              {/* Progress */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <p className="text-sm font-medium text-gray-600">전체 공정률</p>
                  <p className="text-2xl font-black text-emerald-600">{progress}%</p>
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>

              {/* Personnel */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 text-blue-800 mb-1">
                  <Users size={18} />
                  <p className="text-sm font-bold">누적 투입 인원</p>
                </div>
                <p className="text-2xl font-black text-blue-900">{cumulativePersonnel.toLocaleString()} <span className="text-sm font-medium text-blue-700">명</span></p>
              </div>

              {/* Milestones */}
              <div>
                <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock size={16} />
                  주요 마일스톤
                </p>
                <div className="space-y-3">
                  {milestones.length > 0 ? milestones.map((m, i) => (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{m.taskName}</p>
                        <p className="text-xs text-gray-500">{m.startDate} ~ {m.endDate}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500">등록된 공정이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Main Navigation Tiles */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">빠른 이동</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('gantt')}
              className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-md text-left text-white relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                <BarChart3 size={80} />
              </div>
              <div className="relative z-10">
                <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <BarChart3 size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1">공정 관리</h3>
                <p className="text-blue-100 text-sm">간트차트 및 공정표 확인</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('daily-report')}
              className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl shadow-md text-left text-white relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                <FileText size={80} />
              </div>
              <div className="relative z-10">
                <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <FileText size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1">공사 일보</h3>
                <p className="text-emerald-100 text-sm">일일 작업 및 현황 보고</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('drawings')}
              className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-2xl shadow-md text-left text-white relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                <PenTool size={80} />
              </div>
              <div className="relative z-10">
                <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <PenTool size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1">도면 보기</h3>
                <p className="text-indigo-100 text-sm">건축 평면도, 입면도 등</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('settings')}
              className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl shadow-md text-left text-white relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                <Settings size={80} />
              </div>
              <div className="relative z-10">
                <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <Settings size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1">설정 관리</h3>
                <p className="text-gray-300 text-sm">프로젝트 및 회원 관리</p>
              </div>
            </motion.button>

          </div>
        </div>

      </div>
    </div>
  );
};
