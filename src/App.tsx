/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Building,
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Save, 
  ChevronLeft, 
  BarChart3, 
  CalendarDays, 
  Table as TableIcon,
  Plus,
  ArrowLeftRight,
  Database,
  FileText,
  User as UserIcon,
  Youtube
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import ProjectList from './components/ProjectList';
import ScheduleForm from './components/ScheduleForm';
import ScheduleTable from './components/ScheduleTable';
import GanttChart from './components/GanttChart';
import BaselineComparison from './components/BaselineComparison';
import BaselineGantt from './components/BaselineGantt';
import { DailyReportView } from './components/DailyReportView';
import { DashboardView } from './components/DashboardView';
import { DrawingsView } from './components/DrawingsView';
import { AuthView } from './components/AuthView';
import { UserManagement } from './components/UserManagement';

import { Project, ScheduleItem, Category, Status, AppSettings, User } from './types';
import { 
  SAMPLE_SCHEDULES, 
  CATEGORIES, 
  STATUSES,
  TASK_MASTER,
  INITIAL_DONG_BLOCKS,
  INITIAL_FLOORS,
  INITIAL_ZONES,
  INITIAL_CONTRACTORS,
  CATEGORY_COLORS,
  CATEGORY_TEXT_COLORS
} from './constants';
import { SettingsModal } from './components/SettingsModal';
import { supabase } from './lib/supabase';
import { supabaseService } from './services/supabaseService';

type ViewMode = 'auth' | 'projects' | 'project-detail' | 'user-management';
type MainMenu = 'dashboard' | 'schedule' | 'documents' | 'drawings';
type TabMode = 'gantt' | 'table' | 'comparison' | 'baseline';
type DocumentTab = 'daily-report' | 'inspection' | 'material' | 'concrete';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('auth');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mainMenu, setMainMenu] = useState<MainMenu>('dashboard');
  const [tabMode, setTabMode] = useState<TabMode>('gantt');
  const [documentTab, setDocumentTab] = useState<DocumentTab>('daily-report');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [baselineSchedules, setBaselineSchedules] = useState<ScheduleItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    categories: CATEGORIES,
    categoryColors: CATEGORY_COLORS,
    categoryTextColors: CATEGORY_TEXT_COLORS,
    taskMaster: TASK_MASTER,
    dongBlocks: INITIAL_DONG_BLOCKS,
    floors: INITIAL_FLOORS,
    zones: INITIAL_ZONES,
    contractors: INITIAL_CONTRACTORS
  });

  // Filters
  const [filterCategory, setFilterCategory] = useState<Category | '전체'>('전체');
  const [filterStatus, setFilterStatus] = useState<Status | '전체'>('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('day');

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      // Check if Supabase is configured
      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

      if (isSupabaseConfigured) {
        try {
          const projectsData = await supabaseService.getProjects();
          if (projectsData && projectsData.length > 0) setProjects(projectsData);
          
          const settingsData = await supabaseService.getSettings();
          if (settingsData) setSettings(settingsData);

          const savedUser = localStorage.getItem('cp_current_user');
          if (savedUser) {
            const user = JSON.parse(savedUser);
            setCurrentUser(user);
            setViewMode('projects');
          }
        } catch (error) {
          console.error('Error loading data from Supabase:', error);
          // Fallback to localStorage
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
    };

    const loadFromLocalStorage = () => {
      const savedProjects = localStorage.getItem('cp_projects');
      const savedSchedules = localStorage.getItem('cp_schedules');
      const savedBaseline = localStorage.getItem('cp_baseline');
      const savedSettings = localStorage.getItem('cp_settings');

      if (savedProjects) setProjects(JSON.parse(savedProjects));
      if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
      if (savedBaseline) setBaselineSchedules(JSON.parse(savedBaseline));
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        
        // Migration: Ensure categoryColors and categoryTextColors exist
        if (!parsedSettings.categoryColors) {
          parsedSettings.categoryColors = CATEGORY_COLORS;
        }
        if (!parsedSettings.categoryTextColors) {
          parsedSettings.categoryTextColors = CATEGORY_TEXT_COLORS;
        }

        // Migration: Convert contractors from array to object if necessary
        if (Array.isArray(parsedSettings.contractors)) {
          const newContractors: Record<string, string[]> = {};
          CATEGORIES.forEach(cat => {
            newContractors[cat] = parsedSettings.contractors;
          });
          parsedSettings.contractors = newContractors;
        }
        setSettings(parsedSettings);
      }

      const savedUser = localStorage.getItem('cp_current_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setViewMode('projects');
      }
    };

    loadData();
  }, []);

  // Save data on change
  useEffect(() => {
    localStorage.setItem('cp_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
  if (currentUser) {
    localStorage.setItem('cp_current_user', JSON.stringify(currentUser));
  } else {
    localStorage.removeItem('cp_current_user');
  }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('cp_schedules', JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    localStorage.setItem('cp_baseline', JSON.stringify(baselineSchedules));
  }, [baselineSchedules]);

  useEffect(() => {
    localStorage.setItem('cp_settings', JSON.stringify(settings));
  }, [settings]);

  // Load schedules when project changes
  useEffect(() => {
    const loadSchedules = async () => {
      if (!currentProjectId) {
        setSchedules([]);
        setBaselineSchedules([]);
        return;
      }

      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

      if (isSupabaseConfigured) {
        try {
          const data = await supabaseService.getSchedules(currentProjectId);
          setSchedules(data.filter(s => !s.isBaseline));
          setBaselineSchedules(data.filter(s => s.isBaseline));
        } catch (error) {
          console.error('Error loading schedules from Supabase:', error);
        }
      } else {
        // Fallback to localStorage
        const savedSchedules = localStorage.getItem('cp_schedules');
        const savedBaseline = localStorage.getItem('cp_baseline');
        if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
        if (savedBaseline) setBaselineSchedules(JSON.parse(savedBaseline));
      }
    };

    loadSchedules();
  }, [currentProjectId]);

  const currentProject = useMemo(() => 
    projects.find(p => p.id === currentProjectId), 
    [projects, currentProjectId]
  );

  const filterScheduleItem = (s: ScheduleItem) => {
    const matchCategory = filterCategory === '전체' || s.category === filterCategory;
    const matchStatus = filterStatus === '전체' || s.status === filterStatus;
    const matchSearch = s.taskName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        s.subCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.contractor.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchStatus && matchSearch;
  };

  const sortScheduleItem = (a: ScheduleItem, b: ScheduleItem) => {
    const indexA = settings.categories.indexOf(a.category);
    const indexB = settings.categories.indexOf(b.category);
    return indexA - indexB;
  };

  const filteredSchedules = useMemo(() => {
    return schedules.filter(filterScheduleItem).sort(sortScheduleItem);
  }, [schedules, filterCategory, filterStatus, searchTerm, settings.categories]);

  const filteredBaselineSchedules = useMemo(() => {
    const filteredActualIds = new Set(filteredSchedules.map(s => s.id));
    return baselineSchedules
      .filter(s => filteredActualIds.has(s.id) || filterScheduleItem(s))
      .sort(sortScheduleItem);
  }, [baselineSchedules, filteredSchedules, filterCategory, filterStatus, searchTerm, settings.categories]);

  const selectedItem = useMemo(() => 
    schedules.find(s => s.id === selectedItemId) || null,
    [schedules, selectedItemId]
  );

  // Handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setViewMode('projects');
  };
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('cp_current_user');
    setViewMode('auth');
    setCurrentProjectId(null);
  };

  const handleAddProject = async (projectData: Omit<Project, 'id' | 'createdAt'>) => {
    const newProject: Project = {
      ...projectData,
      id: Date.now().toString(),
      createdAt: new Date().toLocaleDateString()
    };
    setProjects([...projects, newProject]);

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveProject(newProject);
      } catch (error) {
        console.error('Error saving project to Supabase:', error);
      }
    }
  };

  const handleEditProject = async (id: string, projectData: Omit<Project, 'id' | 'createdAt'>) => {
    const updatedProject = projects.find(p => p.id === id);
    if (updatedProject) {
      const newProject = { ...updatedProject, ...projectData };
      setProjects(projects.map(p => p.id === id ? newProject : p));

      const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isSupabaseConfigured) {
        try {
          await supabaseService.saveProject(newProject);
        } catch (error) {
          console.error('Error saving project to Supabase:', error);
        }
      }
    }
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveProject(updatedProject);
      } catch (error) {
        console.error('Error saving project to Supabase:', error);
      }
    }
  };

  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id);
    setViewMode('project-detail');
    setMainMenu('dashboard');
  };

  const handleAddSchedule = async (item: Omit<ScheduleItem, 'id'>) => {
    const newItem: ScheduleItem = { ...item, id: Date.now().toString() };
    setSchedules([...schedules, newItem]);
    setIsFormOpen(false);

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveSchedule(newItem);
      } catch (error) {
        console.error('Error saving schedule to Supabase:', error);
      }
    }
  };

  const handleUpdateSchedule = async (item: ScheduleItem) => {
    setSchedules(schedules.map(s => s.id === item.id ? item : s));
    setSelectedItemId(null);
    setIsFormOpen(false);

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveSchedule(item);
      } catch (error) {
        console.error('Error saving schedule to Supabase:', error);
      }
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    setSchedules(schedules.filter(s => s.id !== id));
    setSelectedItemId(null);
    setIsFormOpen(false);

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabaseService.deleteSchedule(id);
      } catch (error) {
        console.error('Error deleting schedule from Supabase:', error);
      }
    }
  };

  const handleSelectItem = (item: ScheduleItem) => {
    setSelectedItemId(item.id);
    setIsFormOpen(true);
  };

  const handleOpenNewForm = () => {
    setSelectedItemId(null);
    setIsFormOpen(true);
  };

  const handleLoadSamples = async () => {
    if (!currentProjectId) return;
    const samples = SAMPLE_SCHEDULES.map(s => ({ ...s, projectId: currentProjectId }));
    setSchedules(samples);

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isSupabaseConfigured) {
      try {
        for (const sample of samples) {
          await supabaseService.saveSchedule(sample);
        }
      } catch (error) {
        console.error('Error saving samples to Supabase:', error);
      }
    }
  };

  const handleSaveBaseline = async () => {
    if (!currentProjectId) return;
    const baselineItems = schedules.map(s => ({ ...s, isBaseline: true }));
    setBaselineSchedules(baselineItems);

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isSupabaseConfigured) {
      try {
        for (const item of baselineItems) {
          await supabaseService.saveSchedule(item);
        }
        alert('현재 공정표가 Supabase Baseline으로 저장되었습니다.');
      } catch (error) {
        console.error('Error saving baseline to Supabase:', error);
        alert('Baseline 저장 중 오류가 발생했습니다.');
      }
    } else {
      alert('현재 공정표가 Baseline으로 저장되었습니다.');
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(schedules));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `schedule_${currentProject?.name}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);

    const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && 
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveSettings(newSettings);
      } catch (error) {
        console.error('Error saving settings to Supabase:', error);
      }
    }
  };

  const handleAddBaselineSchedule = (item: Omit<ScheduleItem, 'id'>) => {
    const newItem: ScheduleItem = { ...item, id: Date.now().toString(), isBaseline: true };
    setBaselineSchedules([...baselineSchedules, newItem]);
  };

  const handleDeleteBaselineSchedule = (id: string) => {
    setBaselineSchedules(baselineSchedules.filter(s => s.id !== id));
  };

  const handleReorderBaselineSchedules = (newItems: ScheduleItem[]) => {
    setBaselineSchedules(newItems);
  };

  if (viewMode === 'auth') return <AuthView onLogin={handleLogin} />;

  if (viewMode === 'user-management') return (
    <UserManagement onBack={() => setViewMode('projects')} />
  );

  if (viewMode === 'projects') return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a 
            href="https://www.youtube.com/@%EC%82%BC%EC%9A%B0%ED%8B%B0%EB%B9%84" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-red-600 p-1.5 rounded-lg shadow-sm hover:bg-red-700 transition-all flex items-center justify-center"
            title="삼우티비 유튜브 채널"
          >
            <Youtube size={20} className="text-white" />
          </a>
          <h1 className="text-lg font-bold tracking-tight text-gray-900">S-<span className="text-blue-600">CON</span></h1>
        </div>
        <div className="flex items-center gap-4">
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => setViewMode('user-management')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all text-sm font-bold"
            >
              <UserIcon size={16} />
              <span>회원 관리</span>
            </button>
          )}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
              {currentUser?.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900">{currentUser?.name}</span>
              <span className="text-[10px] text-gray-400 font-medium">{currentUser?.affiliation}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="로그아웃"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ProjectList 
          projects={projects} 
          onSelect={handleSelectProject} 
          onAdd={handleAddProject} 
          onEdit={handleEditProject}
          currentUser={currentUser}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden font-sans text-gray-900">
      {/* Sidebar (Desktop only) */}
      <aside className="hidden xl:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
        <div className="p-6 flex items-center gap-3">
          <a 
            href="https://www.youtube.com/@%EC%82%BC%EC%9A%B0%ED%8B%B0%EB%B9%84" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-red-600 p-1.5 rounded-lg shadow-sm hover:bg-red-700 transition-all flex items-center justify-center"
            title="삼우티비 유튜브 채널"
          >
            <Youtube size={20} className="text-white" />
          </a>
          <h1 className="text-lg font-bold tracking-tight text-gray-900">S-<span className="text-blue-600">CON</span></h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Main Menu</span>
          </div>
          <button 
            onClick={() => setMainMenu('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={18} className={mainMenu === 'dashboard' ? 'text-blue-600' : 'text-gray-400'} />
            <span>대쉬 보드</span>
          </button>
          <button 
            onClick={() => setMainMenu('schedule')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'schedule' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <BarChart3 size={18} className={mainMenu === 'schedule' ? 'text-blue-600' : 'text-gray-400'} />
            <span>공정 관리</span>
          </button>
          <button 
            onClick={() => setMainMenu('documents')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'documents' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <FileText size={18} className={mainMenu === 'documents' ? 'text-blue-600' : 'text-gray-400'} />
            <span>문서 관리</span>
          </button>
          <button 
            onClick={() => setMainMenu('drawings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'drawings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Building size={18} className={mainMenu === 'drawings' ? 'text-blue-600' : 'text-gray-400'} />
            <span>도면 보기</span>
          </button>

          {mainMenu === 'schedule' && (
            <>
              <div className="pt-6 px-3 mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action Menu</span>
              </div>
              <div className="space-y-1 px-1">
                <button 
                  onClick={() => setTabMode('gantt')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${tabMode === 'gantt' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <BarChart3 size={18} className={tabMode === 'gantt' ? 'text-blue-600' : 'text-gray-400'} />
                  <span>간트차트</span>
                </button>
                <button 
                  onClick={() => setTabMode('table')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${tabMode === 'table' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <TableIcon size={18} className={tabMode === 'table' ? 'text-blue-600' : 'text-gray-400'} />
                  <span>공정 목록</span>
                </button>
                <button 
                  onClick={() => setTabMode('comparison')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${tabMode === 'comparison' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <ArrowLeftRight size={18} className={tabMode === 'comparison' ? 'text-blue-600' : 'text-gray-400'} />
                  <span>계획 vs 실행 비교</span>
                </button>
                <button 
                  onClick={() => setTabMode('baseline')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${tabMode === 'baseline' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Save size={18} className={tabMode === 'baseline' ? 'text-blue-600' : 'text-gray-400'} />
                  <span>Baseline 계획</span>
                </button>
              </div>
            </>
          )}

          {mainMenu === 'documents' && (
            <>
              <div className="pt-6 px-3 mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action Menu</span>
              </div>
              <div className="space-y-1 px-1">
                <button 
                  onClick={() => setDocumentTab('daily-report')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${documentTab === 'daily-report' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <FileText size={18} className={documentTab === 'daily-report' ? 'text-blue-600' : 'text-gray-400'} />
                  <span>공사 일보</span>
                </button>
                <button 
                  onClick={() => setDocumentTab('inspection')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${documentTab === 'inspection' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <FileText size={18} className={documentTab === 'inspection' ? 'text-blue-600' : 'text-gray-400'} />
                  <span>검측요청서</span>
                </button>
                <button 
                  onClick={() => setDocumentTab('material')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${documentTab === 'material' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <FileText size={18} className={documentTab === 'material' ? 'text-blue-600' : 'text-gray-400'} />
                  <span>자재승인서</span>
                </button>
                <button 
                  onClick={() => setDocumentTab('concrete')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${documentTab === 'concrete' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <FileText size={18} className={documentTab === 'concrete' ? 'text-blue-600' : 'text-gray-400'} />
                  <span>타설계획서</span>
                </button>
              </div>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-1">
          {currentUser?.userRole !== '브론즈' && (
            <>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
              >
                <Settings size={18} className="text-gray-400" />
                <span>관리자 모드</span>
              </button>
              <button 
                onClick={handleLoadSamples}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
              >
                <Database size={18} className="text-gray-400" />
                <span>샘플 데이터 로드</span>
              </button>
            </>
          )}
          <button 
            onClick={() => setViewMode('projects')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
          >
            <ChevronLeft size={18} className="text-gray-400" />
            <span>프로젝트 목록</span>
          </button>
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => setViewMode('user-management')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
            >
              <UserIcon size={18} className="text-gray-400" />
              <span>회원 관리</span>
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            <span>로그 아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Top Navigation */}
        <div className="xl:hidden bg-white border-b border-gray-200 flex flex-col z-30">
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1 rounded-md shadow-sm">
                <Building2 size={16} className="text-white" />
              </div>
              <h1 className="text-base font-bold tracking-tight text-gray-900 truncate max-w-[150px]">{currentProject?.name}</h1>
            </div>
            <button 
              onClick={() => setViewMode('projects')}
              className="text-gray-500 p-2 rounded-lg hover:bg-gray-50"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <div className="flex overflow-x-auto no-scrollbar px-2 py-2 gap-2">
            <button 
              onClick={() => setMainMenu('dashboard')}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium ${mainMenu === 'dashboard' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 bg-gray-50 border border-gray-200'}`}
            >
              <LayoutDashboard size={16} className={mainMenu === 'dashboard' ? 'text-blue-600' : 'text-gray-400'} />
              <span>대쉬 보드</span>
            </button>
            <button 
              onClick={() => setMainMenu('schedule')}
              className={`hidden md:flex flex-shrink-0 items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium ${mainMenu === 'schedule' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 bg-gray-50 border border-gray-200'}`}
            >
              <BarChart3 size={16} className={mainMenu === 'schedule' ? 'text-blue-600' : 'text-gray-400'} />
              <span>공정 관리</span>
            </button>
            <button 
              onClick={() => setMainMenu('documents')}
              className={`hidden md:flex flex-shrink-0 items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium ${mainMenu === 'documents' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 bg-gray-50 border border-gray-200'}`}
            >
              <FileText size={16} className={mainMenu === 'documents' ? 'text-blue-600' : 'text-gray-400'} />
              <span>문서 관리</span>
            </button>
            <button 
              onClick={() => setMainMenu('drawings')}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium ${mainMenu === 'drawings' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 bg-gray-50 border border-gray-200'}`}
            >
              <Building size={16} className={mainMenu === 'drawings' ? 'text-blue-600' : 'text-gray-400'} />
              <span>도면 보기</span>
            </button>
          </div>
          {mainMenu === 'schedule' && (
            <div className="flex overflow-x-auto no-scrollbar px-2 pb-2 gap-2 border-t border-gray-100 pt-2">
              <button 
                onClick={() => setTabMode('gantt')}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${tabMode === 'gantt' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
              >
                <span>간트차트</span>
              </button>
              <button 
                onClick={() => setTabMode('table')}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${tabMode === 'table' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
              >
                <span>공정 목록</span>
              </button>
              <button 
                onClick={() => setTabMode('comparison')}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${tabMode === 'comparison' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
              >
                <span>계획 vs 실행 비교</span>
              </button>
              <button 
                onClick={() => setTabMode('baseline')}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${tabMode === 'baseline' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
              >
                <span>Baseline 계획</span>
              </button>
            </div>
          )}
          {mainMenu === 'documents' && (
            <div className="flex overflow-x-auto no-scrollbar px-2 pb-2 gap-2 border-t border-gray-100 pt-2">
              <button 
                onClick={() => setDocumentTab('daily-report')}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${documentTab === 'daily-report' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
              >
                <span>공사 일보</span>
              </button>
              <button 
                onClick={() => setDocumentTab('inspection')}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${documentTab === 'inspection' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
              >
                <span>검측요청서</span>
              </button>
              <button 
                onClick={() => setDocumentTab('material')}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${documentTab === 'material' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
              >
                <span>자재승인서</span>
              </button>
              <button 
                onClick={() => setDocumentTab('concrete')}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${documentTab === 'concrete' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
              >
                <span>타설계획서</span>
              </button>
            </div>
          )}
        </div>

        {/* Header (Desktop only) */}
        <header className="hidden xl:flex bg-white border-b border-gray-200 px-8 py-4 items-center justify-between z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{currentProject?.name}</h2>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <CalendarDays size={14} />
              <span>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm w-56"
              />
            </div>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <button onClick={() => setTabMode('baseline')} className={`p-2 bg-white hover:bg-gray-50 border-r border-gray-200 transition-colors ${tabMode === 'baseline' ? 'text-blue-600' : 'text-gray-600'}`} title="Baseline 계획">
                <Save size={16} />
              </button>
              <button onClick={handleExport} className="p-2 bg-white hover:bg-gray-50 text-gray-600 border-r border-gray-200 transition-colors" title="내보내기">
                <Download size={16} />
              </button>
              <button className="p-2 bg-white hover:bg-gray-50 text-gray-600 transition-colors" title="불러오기">
                <Upload size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        {mainMenu === 'schedule' && (
          <div className="bg-white border-b border-gray-200 px-4 xl:px-8 py-2.5 flex items-center gap-2 xl:gap-4 overflow-x-auto no-scrollbar z-20">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <Filter size={12} />
              <span className="hidden xl:inline">Filters</span>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value as any)}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="전체">모든 공종</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="전체">모든 상태</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {(tabMode === 'gantt' || tabMode === 'comparison' || tabMode === 'baseline') && (
              <div className="ml-auto flex items-center border border-gray-200 p-0.5 rounded-lg bg-gray-50 shadow-sm">
                <button 
                  onClick={() => setZoom('day')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${zoom === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <span className="hidden xl:inline">일간</span><span className="xl:hidden">일</span>
                </button>
                <button 
                  onClick={() => setZoom('week')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${zoom === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <span className="hidden xl:inline">주간</span><span className="xl:hidden">주</span>
                </button>
                <button 
                  onClick={() => setZoom('month')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${zoom === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <span className="hidden xl:inline">월간</span><span className="xl:hidden">월</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col p-0 xl:p-8 overflow-hidden relative">
          {/* Main Visualization */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {mainMenu === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full"
                >
                  <DashboardView 
                  project={currentProject || null} 
                  onUpdateProject={handleUpdateProject} 
                  settings={settings}
                />
                </motion.div>
              )}
              {mainMenu === 'drawings' && (
                <motion.div 
                  key="drawings"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full"
                >
                  <DrawingsView project={currentProject || null} currentUser={currentUser} />
                </motion.div>
              )}
              {mainMenu === 'documents' && documentTab === 'daily-report' && (
                <motion.div 
                  key="daily-report"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  <DailyReportView 
                    project={currentProject || null}
                    settings={settings}
                  />
                </motion.div>
              )}
              {mainMenu === 'documents' && documentTab !== 'daily-report' && (
                <motion.div 
                  key={`doc-${documentTab}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex items-center justify-center"
                >
                  <div className="text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-lg font-medium text-gray-900">준비 중입니다</p>
                    <p className="text-sm mt-1">해당 문서 기능은 곧 추가될 예정입니다.</p>
                  </div>
                </motion.div>
              )}
              {mainMenu === 'schedule' && tabMode === 'gantt' && (
                <motion.div 
                  key="gantt"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full"
                >
                  <GanttChart 
                    items={filteredSchedules} 
                    zoom={zoom} 
                    onSelect={handleSelectItem}
                    settings={settings}
                  />
                </motion.div>
              )}
              {mainMenu === 'schedule' && tabMode === 'table' && (
                <motion.div 
                  key="table"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full"
                >
                  <ScheduleTable 
                    items={filteredSchedules} 
                    onSelect={handleSelectItem}
                    onDelete={handleDeleteSchedule}
                    selectedId={selectedItemId}
                    settings={settings}
                  />
                </motion.div>
              )}
              {mainMenu === 'schedule' && tabMode === 'comparison' && (
                <motion.div 
                  key="comparison"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full"
                >
                  <BaselineComparison 
                    items={filteredSchedules} 
                    baselineItems={filteredBaselineSchedules} 
                    zoom={zoom}
                    categories={settings.categories}
                    settings={settings}
                  />
                </motion.div>
              )}
              {mainMenu === 'schedule' && tabMode === 'baseline' && (
                <motion.div 
                  key="baseline"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full"
                >
                  <BaselineGantt 
                    items={baselineSchedules} 
                    onAdd={handleAddBaselineSchedule}
                    onDelete={handleDeleteBaselineSchedule}
                    onReorder={handleReorderBaselineSchedules}
                    settings={settings}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Floating Action Button */}
        {mainMenu === 'schedule' && (
          <button
            onClick={handleOpenNewForm}
            className={`hidden md:flex xl:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-50`}
          >
            <Plus size={24} />
          </button>
        )}
      </main>

      {/* Popup Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
            >
              <div className="px-8 py-6 flex justify-between items-center border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                    {selectedItemId ? <Save size={20} /> : <Plus size={20} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedItemId ? '공정 정보 수정' : '신규 공정 등록'}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Schedule Management</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-8 max-h-[80vh] overflow-y-auto no-scrollbar">
                <ScheduleForm 
                  onAdd={handleAddSchedule}
                  onUpdate={handleUpdateSchedule}
                  onDelete={handleDeleteSchedule}
                  onReset={() => setSelectedItemId(null)}
                  selectedItem={selectedItem}
                  settings={settings}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
