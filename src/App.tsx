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
  FileSpreadsheet,
  User as UserIcon,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ExcelJS from 'exceljs';
import { 
  format, 
  parseISO, 
  differenceInDays, 
  addDays, 
  startOfDay, 
  isWithinInterval,
  min as minDate,
  max as maxDate
} from 'date-fns';

const LogoIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M6 2l5 9H1l5-9z" />
    <circle cx="18" cy="6.5" r="4.5" />
    <rect x="1.5" y="13.5" width="9" height="9" rx="1.5" />
    <path d="M18 22l-5-9h10l-5 9z" />
  </svg>
);

import ProjectList from './components/ProjectList';
import { ConfirmModal } from './components/ConfirmModal';
import DeleteProjectModal from './components/DeleteProjectModal';
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
import { AiDiagnosisView } from './components/AiDiagnosisView';
import { PhotoGalleryView } from './components/PhotoGalleryView';
import { QuickMemoView } from './components/QuickMemoView';

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
import { ProfileModal } from './components/ProfileModal';
import { isSupabaseConfigured } from './lib/supabase';
import { supabaseService } from './services/supabaseService';

type ViewMode = 'auth' | 'projects' | 'project-detail' | 'user-management';
type MainMenu = 'dashboard' | 'schedule' | 'documents' | 'drawings' | 'photo-gallery' | 'quick-memo' | 'ai-diagnosis';
type TabMode = 'gantt' | 'table' | 'comparison' | 'baseline';
type DocumentTab = 'daily-report' | 'inspection' | 'material' | 'concrete';
type AiDiagnosisTab = 'ai-risk' | 'ai-report';

const INITIAL_SETTINGS: AppSettings = {
  categories: CATEGORIES,
  categoryColors: CATEGORY_COLORS,
  categoryTextColors: CATEGORY_TEXT_COLORS,
  taskMaster: TASK_MASTER,
  dongBlocks: INITIAL_DONG_BLOCKS,
  floors: INITIAL_FLOORS,
  zones: INITIAL_ZONES,
  contractors: INITIAL_CONTRACTORS
};

export default function App() {
// 1. 화면 모드 (유지)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedUser = localStorage.getItem('cp_current_user');
    const savedView = localStorage.getItem('cp_view_mode') as ViewMode;
    return savedUser ? (savedView || 'projects') : 'auth';
  });

  // 2. 현재 사용자
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('cp_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch(e) {
      return null;
    }
  });

  // 3. 메뉴 및 탭 상태 (유지)
  const [mainMenu, setMainMenu] = useState<MainMenu>(() => {
    return (localStorage.getItem('cp_main_menu') as MainMenu) || 'dashboard';
  });
  const [tabMode, setTabMode] = useState<TabMode>(() => {
    return (localStorage.getItem('cp_tab_mode') as TabMode) || 'gantt';
  });
  const [documentTab, setDocumentTab] = useState<DocumentTab>(() => {
    return (localStorage.getItem('cp_document_tab') as DocumentTab) || 'daily-report';
  });
  const [aiDiagnosisTab, setAiDiagnosisTab] = useState<AiDiagnosisTab>(() => {
    return (localStorage.getItem('cp_ai_diagnosis_tab') as AiDiagnosisTab) || 'ai-risk';
  });

  // 4. 프로젝트 목록 (★AI가 지워서 에러가 났던 부분 복구!)
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('cp_projects');
      return saved ? JSON.parse(saved) : [];
    } catch(e) {
      return [];
    }
  });

  // 5. 현재 선택된 프로젝트 ID (유지)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return localStorage.getItem('cp_current_project_id');
  });

  // 6. 기타 필수 상태 변수들 (★이 부분들도 모두 살아있어야 합니다)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [baselineSchedules, setBaselineSchedules] = useState<ScheduleItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDailyReportDirty, setIsDailyReportDirty] = useState(false);
  const [autoOpenQuickMemo, setAutoOpenQuickMemo] = useState(false);

  const [unsavedChangesModal, setUnsavedChangesModal] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    onConfirm: () => {}
  });
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);

  const [filterCategory, setFilterCategory] = useState<Category | '전체'>('전체');
  const [filterStatus, setFilterStatus] = useState<Status | '전체'>('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    console.log('App: isDailyReportDirty changed to:', isDailyReportDirty);
  }, [isDailyReportDirty]);

  // --- 화면 상태 자동 저장 로직 시작 ---
  useEffect(() => {
    localStorage.setItem('cp_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (currentProjectId) {
      localStorage.setItem('cp_current_project_id', currentProjectId);
    } else {
      localStorage.removeItem('cp_current_project_id');
    }
  }, [currentProjectId]);

  useEffect(() => {
    localStorage.setItem('cp_main_menu', mainMenu);
  }, [mainMenu]);

  useEffect(() => {
    localStorage.setItem('cp_tab_mode', tabMode);
  }, [tabMode]);

  useEffect(() => {
    localStorage.setItem('cp_document_tab', documentTab);
  }, [documentTab]);
  useEffect(() => {
    localStorage.setItem('cp_ai_diagnosis_tab', aiDiagnosisTab);
  }, [aiDiagnosisTab]);
  // --- 화면 상태 자동 저장 로직 끝 ---

  const createBaselineId = (sourceId: string) => `b-${sourceId}`;

  useEffect(() => {
    const loadData = async () => {
      loadFromLocalStorage();

      if (isSupabaseConfigured) {
        try {
          console.log('Fetching projects from Supabase...');
          const projectsData = await supabaseService.getProjects();
          console.log('Supabase projects fetched:', projectsData?.length || 0);

          if (projectsData) {
            setProjects(projectsData);
            localStorage.setItem('cp_projects', JSON.stringify(projectsData));
          }

          const settingsData = await supabaseService.getSettings();
          if (settingsData) {
            localStorage.setItem('cp_settings', JSON.stringify(settingsData));
            // 👇 수정 포인트 1: 특정 프로젝트 안에 들어가 있지 않을 때만 전역 설정을 화면에 반영!
            if (!currentProjectId) {
              setSettings(settingsData);
            }
          }
        } catch (error) {
          console.error('Error loading data from Supabase:', error);
        }
      }
    };

    const loadFromLocalStorage = () => {
      const savedSettings = localStorage.getItem('cp_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);

        if (!parsedSettings.categoryColors) {
          parsedSettings.categoryColors = CATEGORY_COLORS;
        }
        if (!parsedSettings.categoryTextColors) {
          parsedSettings.categoryTextColors = CATEGORY_TEXT_COLORS;
        }

        if (Array.isArray(parsedSettings.contractors)) {
          const newContractors: Record<string, string[]> = {};
          CATEGORIES.forEach(cat => {
            newContractors[cat] = parsedSettings.contractors;
          });
          parsedSettings.contractors = newContractors;
        }
        
        // 👇 수정 포인트 2: 로컬 스토리지의 전역 설정도 프로젝트 밖에서만 화면에 반영!
        if (!currentProjectId) {
          setSettings(parsedSettings);
        }
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const loadProjectData = async () => {
      if (!currentProjectId) {
        setSchedules([]);
        setBaselineSchedules([]);
        setSettings(INITIAL_SETTINGS);
        return;
      }

      const project = projects.find(p => p.id === currentProjectId);
      if (project && project.settings) {
        setSettings(project.settings);
      } else {
        setSettings(INITIAL_SETTINGS);
      }

      if (isSupabaseConfigured) {
        try {
          const data = await supabaseService.getSchedules(currentProjectId);
          if (data && data.length > 0) {
            setSchedules(data.filter(s => !s.isBaseline));
            setBaselineSchedules(data.filter(s => s.isBaseline));
          } else {
            loadSchedulesFromLocalStorage();
          }
        } catch (error) {
          console.error('Error loading schedules from Supabase:', error);
          loadSchedulesFromLocalStorage();
        }
      } else {
        loadSchedulesFromLocalStorage();
      }
    };

    const loadSchedulesFromLocalStorage = () => {
      const savedSchedules = localStorage.getItem(`cp_schedules_${currentProjectId}`);
      const savedBaseline = localStorage.getItem(`cp_baseline_${currentProjectId}`);

      if (!savedSchedules && localStorage.getItem('cp_schedules')) {
        const oldSchedules = localStorage.getItem('cp_schedules');
        if (oldSchedules) setSchedules(JSON.parse(oldSchedules));
      } else if (savedSchedules) {
        setSchedules(JSON.parse(savedSchedules));
      } else {
        setSchedules([]);
      }

      if (!savedBaseline && localStorage.getItem('cp_baseline')) {
        const oldBaseline = localStorage.getItem('cp_baseline');
        if (oldBaseline) setBaselineSchedules(JSON.parse(oldBaseline));
      } else if (savedBaseline) {
        setBaselineSchedules(JSON.parse(savedBaseline));
      } else {
        setBaselineSchedules([]);
      }
    };

    loadProjectData();
  }, [currentProjectId, projects]);

  const currentProject = useMemo(
    () => projects.find(p => p.id === currentProjectId),
    [projects, currentProjectId]
  );

  const computedSchedules = useMemo(() => {
    return schedules.map(s => {
      const baseline = baselineSchedules.find(
        b => (b.sourceScheduleId ?? b.id) === s.id
      );

      let status = s.status;

      if (s.progress === 100) {
        status = '완료';
      } else if (baseline) {
        const currentEnd = new Date(s.endDate);
        const baselineEnd = new Date(baseline.endDate);
        status = currentEnd > baselineEnd ? '지연' : '진행';
      } else if (status !== '완료') {
        status = '진행';
      }

      return { ...s, status };
    });
  }, [schedules, baselineSchedules]);

  const filterScheduleItem = (s: ScheduleItem) => {
    const matchCategory = filterCategory === '전체' || s.category === filterCategory;
    const matchStatus = filterStatus === '전체' || s.status === filterStatus;
    const matchSearch =
      s.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contractor.toLowerCase().includes(searchTerm.toLowerCase());

    return matchCategory && matchStatus && matchSearch;
  };

  const sortScheduleItem = (a: ScheduleItem, b: ScheduleItem) => {
    const indexA = settings.categories.indexOf(a.category);
    const indexB = settings.categories.indexOf(b.category);
    if (indexA !== indexB) return indexA - indexB;
    return a.subCategory.localeCompare(b.subCategory);
  };

  const filteredSchedules = useMemo(() => {
    return computedSchedules.filter(filterScheduleItem).sort(sortScheduleItem);
  }, [computedSchedules, filterCategory, filterStatus, searchTerm, settings.categories]);

  const filteredBaselineSchedules = useMemo(() => {
    const filteredActualIds = new Set(filteredSchedules.map(s => s.id));
    return baselineSchedules
      .filter(s => filteredActualIds.has(s.sourceScheduleId ?? s.id) || filterScheduleItem(s))
      .sort(sortScheduleItem);
  }, [baselineSchedules, filteredSchedules, filterCategory, filterStatus, searchTerm, settings.categories]);

  const selectedItem = useMemo(
    () => schedules.find(s => s.id === selectedItemId) || null,
    [schedules, selectedItemId]
  );

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('cp_current_user', JSON.stringify(user));
    setViewMode('projects');
  };

  const handleLogout = () => {
    checkUnsavedChanges(() => {
      setCurrentUser(null);
      localStorage.removeItem('cp_current_user');
      
      // 로그아웃 시 화면 정보도 함께 초기화
      localStorage.removeItem('cp_view_mode');
      localStorage.removeItem('cp_current_project_id');
      localStorage.removeItem('cp_main_menu');
      localStorage.removeItem('cp_tab_mode');
      localStorage.removeItem('cp_document_tab');
      
      setViewMode('auth');
      setCurrentProjectId(null);
    });
  };

  const handleAddProject = async (projectData: Omit<Project, 'id' | 'createdAt'>) => {
    const newProject: Project = {
      ...projectData,
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toLocaleDateString(),
      settings: INITIAL_SETTINGS
    };

    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    localStorage.setItem('cp_projects', JSON.stringify(updatedProjects));

    if (isSupabaseConfigured) {
      try {
        console.log('Saving new project to Supabase:', newProject.id);
        await supabaseService.saveProject(newProject);
        console.log('Project saved to Supabase successfully');
      } catch (error) {
        console.error('Error saving project to Supabase:', error);
        alert('Supabase 저장 중 오류가 발생했습니다. 다른 사용자가 이 프로젝트를 보지 못할 수 있습니다.');
      }
    }
  };

  const handleEditProject = async (id: string, projectData: Omit<Project, 'id' | 'createdAt'>) => {
    if (currentUser?.userRole !== '골드' && currentUser?.role !== 'admin') {
      alert('프로젝트 수정 권한이 없습니다.');
      return;
    }
    const updatedProject = projects.find(p => p.id === id);
    if (updatedProject) {
      const newProject = { ...updatedProject, ...projectData };
      const updatedProjects = projects.map(p => p.id === id ? newProject : p);
      setProjects(updatedProjects);
      localStorage.setItem('cp_projects', JSON.stringify(updatedProjects));

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
    if (currentUser?.userRole !== '골드' && currentUser?.role !== 'admin') {
      alert('프로젝트 수정 권한이 없습니다.');
      return;
    }

    // 💡 핵심: 기존 데이터(특히 settings)가 증발하지 않도록 안전하게 합쳐줍니다(Merge).
    const updatedProjects = projects.map(p => {
      if (p.id === updatedProject.id) {
        return {
          ...p,
          ...updatedProject,
          // 넘어온 데이터에 settings가 빠져있어도, 기존(p.settings) 것을 그대로 유지!
          settings: updatedProject.settings || p.settings
        };
      }
      return p;
    });

    setProjects(updatedProjects);
    localStorage.setItem('cp_projects', JSON.stringify(updatedProjects));

    if (isSupabaseConfigured) {
      try {
        // 안전하게 병합된 최종 데이터를 DB에 저장
        const finalProject = updatedProjects.find(p => p.id === updatedProject.id);
        if (finalProject) {
          await supabaseService.saveProject(finalProject);
        }
      } catch (error) {
        console.error('Error saving project to Supabase:', error);
      }
    }
  };

  const handleDeleteProject = async (id: string) => {
    setProjectToDeleteId(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDeleteId) return;

    const updatedProjects = projects.filter(p => p.id !== projectToDeleteId);
    setProjects(updatedProjects);
    localStorage.setItem('cp_projects', JSON.stringify(updatedProjects));

    if (isSupabaseConfigured) {
      try {
        await supabaseService.deleteProject(projectToDeleteId);
      } catch (error) {
        console.error('Error deleting project from Supabase:', error);
        alert('프로젝트 삭제 중 오류가 발생했습니다. (로컬에서는 삭제되었습니다)');
      }
    }

    setProjectToDeleteId(null);
    setIsConfirmModalOpen(false);
    setViewMode('projects');
  };

  const handleDeleteProjects = async (ids: string[]) => {
    const updatedProjects = projects.filter(p => !ids.includes(p.id));
    setProjects(updatedProjects);
    localStorage.setItem('cp_projects', JSON.stringify(updatedProjects));

    if (isSupabaseConfigured) {
      try {
        for (const id of ids) {
          await supabaseService.deleteProject(id);
        }
      } catch (error) {
        console.error('Error deleting projects from Supabase:', error);
        alert('프로젝트 삭제 중 오류가 발생했습니다.');
      }
    }

    setViewMode('projects');
  };

  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id);
    setViewMode('project-detail');
    setMainMenu('dashboard');
  };

  const handleAddSchedule = async (item: Omit<ScheduleItem, 'id' | 'projectId'>) => {
  if (!currentProjectId) return;

  const newItem: ScheduleItem = {
    ...item,
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    projectId: currentProjectId,
    sortOrder: schedules.length
  };

  const updatedSchedules = [...schedules, newItem];
  setSchedules(updatedSchedules);
  localStorage.setItem(`cp_schedules_${currentProjectId}`, JSON.stringify(updatedSchedules));
  setIsFormOpen(false);

  if (isSupabaseConfigured) {
    try {
      await supabaseService.saveSchedule(newItem);
    } catch (error) {
      console.error('Error saving schedule to Supabase:', error);
      alert('공정은 화면에는 추가되었지만 Supabase 저장은 실패했습니다. 콘솔 에러를 확인해주세요.');
    }
  }
  };

const handleUpdateSchedule = async (item: ScheduleItem) => {
  const updatedSchedules = schedules.map(s => s.id === item.id ? item : s);
  setSchedules(updatedSchedules);

  if (currentProjectId) {
    localStorage.setItem(`cp_schedules_${currentProjectId}`, JSON.stringify(updatedSchedules));
  }

  setSelectedItemId(null);
  setIsFormOpen(false);

  if (isSupabaseConfigured) {
    try {
      await supabaseService.saveSchedule(item);
    } catch (error) {
      console.error('Error saving schedule to Supabase:', error);
      alert('공정 수정은 화면에 반영되었지만 Supabase 저장은 실패했습니다.');
    }
  }
  };

  const handleDeleteSchedule = async (id: string) => {
  const updatedSchedules = schedules.filter(s => s.id !== id);
  setSchedules(updatedSchedules);

  if (currentProjectId) {
    localStorage.setItem(`cp_schedules_${currentProjectId}`, JSON.stringify(updatedSchedules));
  }

  setSelectedItemId(null);
  setIsFormOpen(false);

  if (isSupabaseConfigured) {
    try {
      await supabaseService.deleteSchedule(id);
    } catch (error) {
      console.error('Error deleting schedule from Supabase:', error);
      alert('공정 삭제는 화면에 반영되었지만 Supabase 삭제는 실패했습니다.');
    }
  }
};

  const handleSelectItem = (item: ScheduleItem) => {
    setSelectedItemId(item.id);
    setIsFormOpen(true);
  };

  const checkUnsavedChanges = (action: () => void) => {
    console.log('Checking unsaved changes:', { mainMenu, documentTab, isDailyReportDirty });
    if (mainMenu === 'documents' && documentTab === 'daily-report' && isDailyReportDirty) {
      setUnsavedChangesModal({
        isOpen: true,
        onConfirm: () => {
          setIsDailyReportDirty(false);
          action();
        }
      });
      return;
    }
    action();
  };

  const handleOpenNewForm = () => {
    setSelectedItemId(null);
    setIsFormOpen(true);
  };

  const handleLoadSamples = async () => {
    if (!currentProjectId) return;

    const samples = SAMPLE_SCHEDULES.map((s, index) => ({
      ...s,
      projectId: currentProjectId,
      sortOrder: index
    }));

    try {
      if (isSupabaseConfigured) {
        for (const sample of samples) {
          await supabaseService.saveSchedule(sample);
        }
      }

      setSchedules(samples);
      localStorage.setItem(`cp_schedules_${currentProjectId}`, JSON.stringify(samples));
    } catch (error) {
      console.error('Error saving samples to Supabase:', error);
      alert('샘플 데이터 저장에 실패했습니다.');
    }
  };

  const handleSaveBaseline = async () => {
    if (!currentProjectId) return;

    try {
      const baselineItems: ScheduleItem[] = schedules.map((item, index) => ({
        ...item,
        id: createBaselineId(item.id),
        isBaseline: true,
        sourceScheduleId: item.id,
        sortOrder: index
      }));

      setBaselineSchedules(baselineItems);
      localStorage.setItem(`cp_baseline_${currentProjectId}`, JSON.stringify(baselineItems));

      if (isSupabaseConfigured) {
        const allSchedules = await supabaseService.getSchedules(currentProjectId);
        const existingBaselineItems = allSchedules.filter(item => item.isBaseline);

        for (const item of existingBaselineItems) {
          await supabaseService.deleteSchedule(item.id);
        }

        for (const item of baselineItems) {
          await supabaseService.saveSchedule(item);
        }
      }

      alert('Baseline 계획이 저장되었습니다.');
    } catch (error) {
      console.error('Error saving baseline:', error);
      alert('Baseline 계획 저장에 실패했습니다.');
    }
  };

  const handleExportToExcel = async () => {
    if (!schedules.length) {
      alert('내보낼 공정 데이터가 없습니다.');
      return;
    }

    const exportSchedules = [...schedules].sort(sortScheduleItem);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('실행공정표');

    // 1. 전체 날짜 범위 계산 (Baseline 포함)
    const allDates = [
      ...exportSchedules.map(s => parseISO(s.startDate)),
      ...exportSchedules.map(s => parseISO(s.endDate)),
      ...baselineSchedules.map(s => parseISO(s.startDate)),
      ...baselineSchedules.map(s => parseISO(s.endDate))
    ];
    
    if (allDates.length === 0) return;

    const projectStart = startOfDay(minDate(allDates));
    const projectEnd = startOfDay(maxDate(allDates));
    const totalDays = differenceInDays(projectEnd, projectStart) + 1;

    // 2. 컬럼 너비 설정 (A~G열 고정 너비, 이후 날짜 열)
    const columnsConfig = [
      { width: 12 }, // 공종
      { width: 15 }, // 세부공종
      { width: 40 }, // 작업명
      { width: 16 }, // 시작일
      { width: 16 }, // 종료일
      { width: 8 },  // 진척률
      { width: 8 },  // 상태
      ...Array(totalDays).fill({ width: 4 }) // 날짜별 칸
    ];
    worksheet.columns = columnsConfig;

    const lastColIndex = 7 + totalDays;

    // 3. 타이틀 및 기준일자 (1~2행)
    worksheet.mergeCells(1, 1, 1, lastColIndex);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = `실행 공정표 - ${currentProject?.name || '프로젝트 명 미지정'}`;
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 35;

    worksheet.mergeCells(2, 1, 2, lastColIndex);
    const dateCell = worksheet.getCell(2, 1);
    dateCell.value = `${format(new Date(), 'yyyy년 MM월 dd일')} 기준`;
    dateCell.font = { size: 11, color: { argb: 'FF666666' } };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 25;

    // 빈 행 추가 (3행)
    worksheet.getRow(3).height = 10;

    // 4. 헤더 행 (4~6행 3단 구조: 년/월/일)
    const headerStartRow = 4;
    const headerEndRow = 6;
    const metaHeaders = ['공종', '세부공종', '작업명', '시작일', '종료일', '진척률', '상태'];
    
    metaHeaders.forEach((h, i) => {
      worksheet.mergeCells(headerStartRow, i + 1, headerEndRow, i + 1);
      const cell = worksheet.getCell(headerStartRow, i + 1);
      cell.value = h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let yStart = 0;
    let mStart = 0;
    
    for (let i = 0; i <= totalDays; i++) {
        if (i === totalDays) {
           if (yStart < i) worksheet.mergeCells(4, 8 + yStart, 4, 8 + i - 1);
           if (mStart < i) worksheet.mergeCells(5, 8 + mStart, 5, 8 + i - 1);
           break;
        }

        const currentDate = addDays(projectStart, i);
        const prevDate = i > 0 ? addDays(projectStart, i - 1) : null;

        if (prevDate && format(currentDate, 'yyyy') !== format(prevDate, 'yyyy')) {
            worksheet.mergeCells(4, 8 + yStart, 4, 8 + i - 1);
            yStart = i;
        }
        if (prevDate && format(currentDate, 'MM') !== format(prevDate, 'MM')) {
            worksheet.mergeCells(5, 8 + mStart, 5, 8 + i - 1);
            mStart = i;
        }
        
        const colIndex = 8 + i;
        worksheet.getCell(4, colIndex).value = `${format(currentDate, 'yyyy')}년`;
        worksheet.getCell(5, colIndex).value = `${format(currentDate, 'MM')}월`;
        worksheet.getCell(6, colIndex).value = format(currentDate, 'dd');
        
        for (let r = 4; r <= 6; r++) {
            const cell = worksheet.getCell(r, colIndex);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF555555' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, size: 8 };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
    }

    // 5. 데이터 행 추가 (7행부터 시작, 각 태스크당 3행씩: 실제, 계획, 빈칸)
    let curRow = 7;

    const catMerges: { start: number, end: number }[] = [];
    const subCatMerges: { start: number, end: number }[] = [];

    let lastCat = exportSchedules[0]?.category;
    let startCatRow = 7;
    let lastSubCat = exportSchedules[0]?.subCategory;
    let startSubCatRow = 7;

    exportSchedules.forEach((item, index) => {
      if (item.category !== lastCat) {
        catMerges.push({ start: startCatRow, end: curRow - 2 });
        subCatMerges.push({ start: startSubCatRow, end: curRow - 2 });
        lastCat = item.category;
        startCatRow = curRow;
        lastSubCat = item.subCategory;
        startSubCatRow = curRow;
      } else if (item.subCategory !== lastSubCat) {
        subCatMerges.push({ start: startSubCatRow, end: curRow - 2 });
        lastSubCat = item.subCategory;
        startSubCatRow = curRow;
      }

      const baseline = baselineSchedules.find(b => b.id === createBaselineId(item.id));
      
      // Actual 행 데이터
      const actualRow = worksheet.getRow(curRow);
      actualRow.getCell(1).value = item.category;
      actualRow.getCell(2).value = item.subCategory;
      actualRow.getCell(3).value = item.taskName;
      actualRow.getCell(4).value = `${item.startDate} (실행)`;
      actualRow.getCell(5).value = `${item.endDate} (실행)`;
      actualRow.getCell(6).value = `${item.progress}%`;
      actualRow.getCell(7).value = item.status;

      // 바 차트 채우기 (Actual)
      const start = startOfDay(parseISO(item.startDate));
      const end = startOfDay(parseISO(item.endDate));
      
      const barColor = (settings.categoryColors[item.category] || '#3b82f6').replace('#', '').toUpperCase(); // Web category color
      const argbBarColor = 'FF' + barColor; // Add alpha channel

      for (let i = 0; i < totalDays; i++) {
        const currentDate = startOfDay(addDays(projectStart, i));
        if (isWithinInterval(currentDate, { start, end })) {
          const barCell = actualRow.getCell(8 + i);
          barCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbBarColor } };
        }
      }

      // 바 차트 채우기 (Baseline - 2번째 행)
      const baselineRow = worksheet.getRow(curRow + 1);
      if (baseline) {
        baselineRow.getCell(4).value = `${baseline.startDate} (계획)`;
        baselineRow.getCell(5).value = `${baseline.endDate} (계획)`;
        baselineRow.getCell(4).font = { color: { argb: 'FF888888' } };
        baselineRow.getCell(5).font = { color: { argb: 'FF888888' } };

        const bStart = startOfDay(parseISO(baseline.startDate));
        const bEnd = startOfDay(parseISO(baseline.endDate));
        for (let i = 0; i < totalDays; i++) {
          const currentDate = startOfDay(addDays(projectStart, i));
          if (isWithinInterval(currentDate, { start: bStart, end: bEnd })) {
            const barCell = baselineRow.getCell(8 + i);
            barCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; // Light Gray
          }
        }
      }

      // 왼쪽 텍스트 영역 병합 (작업명, 진척률, 상태) - 날짜는 병합 안함, 공종/세부공종은 밖에서 병합
      [3, 6, 7].forEach(colIndex => {
        worksheet.mergeCells(curRow, colIndex, curRow + 1, colIndex);
        const mergedCell = worksheet.getCell(curRow, colIndex);
        mergedCell.alignment = { vertical: 'middle', horizontal: colIndex === 3 ? 'left' : 'center' };
      });

      // 3번째 줄을 빈칸 느낌으로 살리기
      worksheet.getRow(curRow + 2).height = 10;
      
      if (index === exportSchedules.length - 1) {
        catMerges.push({ start: startCatRow, end: curRow + 1 });
        subCatMerges.push({ start: startSubCatRow, end: curRow + 1 });
      }

      curRow += 3; // 다음 항목을 위해 3행 건너뜀 (Actual, Baseline, Empty)
    });

    catMerges.forEach(m => {
      worksheet.mergeCells(m.start, 1, m.end, 1);
      const cell = worksheet.getCell(m.start, 1);
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    subCatMerges.forEach(m => {
      worksheet.mergeCells(m.start, 2, m.end, 2);
      const cell = worksheet.getCell(m.start, 2);
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 모든 셀 테두리 적용 (헤더부터 끝까지)
    worksheet.eachRow((row, rowNumber) => {
      // 4~6행은 헤더, 7행 이상은 (rowNumber-7)%3 !== 2 이면 데이터 행
      const isHeader = rowNumber >= 4 && rowNumber <= 6;
      const isDataRow = rowNumber >= 7 && (rowNumber - 7) % 3 !== 2;
      
      if (isHeader || isDataRow) {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= lastColIndex) {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          }
        });
      }
    });

    catMerges.forEach(m => {
      for(let r = m.start; r <= m.end; r++) {
         worksheet.getCell(r, 1).border = {
            top: { style: r === m.start ? 'thin' : undefined },
            left: { style: 'thin' },
            bottom: { style: r === m.end ? 'thin' : undefined },
            right: { style: 'thin' }
         };
      }
    });

    subCatMerges.forEach(m => {
      for(let r = m.start; r <= m.end; r++) {
         worksheet.getCell(r, 2).border = {
            top: { style: r === m.start ? 'thin' : undefined },
            left: { style: 'thin' },
            bottom: { style: r === m.end ? 'thin' : undefined },
            right: { style: 'thin' }
         };
      }
    });

    // 엑셀 파일 저장
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `실행공정표_${currentProject?.name || '프로젝트'}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
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
    // 화면에 즉시 반영
    setSettings(newSettings);

    if (currentProjectId) {
      // 1. 특정 프로젝트 안에 들어와 있을 때 (프로젝트별 설정 저장)
      const updatedProjects = projects.map(p =>
        p.id === currentProjectId ? { ...p, settings: newSettings } : p
      );
      setProjects(updatedProjects);
      localStorage.setItem('cp_projects', JSON.stringify(updatedProjects));

      if (isSupabaseConfigured) {
        try {
          const updatedProject = updatedProjects.find(p => p.id === currentProjectId);
          if (updatedProject) {
            // Supabase projects 테이블에 통째로 업데이트
            // await supabaseService.saveProject(updatedProject);
            console.log('업데이트 타겟 프로젝트 ID:', currentProjectId);
            await supabaseService.updateProjectSettings(currentProjectId, newSettings);
            console.log('프로젝트별 설정이 Supabase에 저장되었습니다.');
          }
        } catch (error) {
          console.error('Error saving project settings to Supabase:', error);
          alert('Supabase 저장에 실패했습니다. (projects 테이블에 settings jsonb 컬럼이 있는지 확인해주세요)');
        }
      }
    } else {
      // 2. 프로젝트 밖 메인 화면일 때 (기본/글로벌 설정 저장)
      localStorage.setItem('cp_settings', JSON.stringify(newSettings));
      
      if (isSupabaseConfigured) {
        try {
          await supabaseService.saveSettings(newSettings);
          console.log('기본 설정이 Supabase에 저장되었습니다.');
        } catch (error) {
          console.error('Error saving global settings to Supabase:', error);
        }
      }
    }
  };

const handleAddBaselineSchedule = async (item: Omit<ScheduleItem, 'id' | 'projectId'>) => {
  if (!currentProjectId) return;

  const newItem: ScheduleItem = {
    ...item,
    id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    projectId: currentProjectId,
    isBaseline: true,
    sourceScheduleId: null,
    sortOrder: baselineSchedules.length
  };

  // 여기
  // 1) 먼저 화면에 바로 반영
  const updatedBaseline = [...baselineSchedules, newItem];
  setBaselineSchedules(updatedBaseline);
  localStorage.setItem(`cp_baseline_${currentProjectId}`, JSON.stringify(updatedBaseline));

  // 2) 그 다음 Supabase 저장
  if (isSupabaseConfigured) {
    try {
      await supabaseService.saveSchedule(newItem);
    } catch (error) {
      console.error('Error adding baseline schedule:', error);
      alert('Baseline 공정은 화면에는 추가되었지만 Supabase 저장은 실패했습니다.');
    }
  }
};

const handleDeleteBaselineSchedule = async (id: string) => {
  if (!currentProjectId) return;

  const updatedBaseline = baselineSchedules.filter(s => s.id !== id);
  setBaselineSchedules(updatedBaseline);
  localStorage.setItem(`cp_baseline_${currentProjectId}`, JSON.stringify(updatedBaseline));

  if (isSupabaseConfigured) {
    try {
      await supabaseService.deleteSchedule(id);
    } catch (error) {
      console.error('Error deleting baseline schedule:', error);
      alert('Baseline 공정 삭제는 화면에 반영되었지만 Supabase 삭제는 실패했습니다.');
    }
  }
};

const handleUpdateBaselineSchedule = async (item: ScheduleItem) => {
  if (!currentProjectId) return;

  const updatedItem: ScheduleItem = {
    ...item,
    isBaseline: true
  };

  const updatedBaseline = baselineSchedules.map(s => s.id === updatedItem.id ? updatedItem : s);
  setBaselineSchedules(updatedBaseline);
  localStorage.setItem(`cp_baseline_${currentProjectId}`, JSON.stringify(updatedBaseline));

  if (isSupabaseConfigured) {
    try {
      await supabaseService.saveSchedule(updatedItem);
    } catch (error) {
      console.error('Error updating baseline schedule in Supabase:', error);
      alert('Baseline 공정 수정은 화면에 반영되었지만 Supabase 저장은 실패했습니다.');
    }
  }
};

  const handleReorderBaselineSchedules = async (newItems: ScheduleItem[]) => {
    if (!currentProjectId) return;

    const reorderedItems = newItems.map((item, index) => ({
      ...item,
      sortOrder: index
    }));

    try {
      if (isSupabaseConfigured) {
        for (const item of reorderedItems) {
          await supabaseService.saveSchedule(item);
        }
      }

      setBaselineSchedules(reorderedItems);
      localStorage.setItem(`cp_baseline_${currentProjectId}`, JSON.stringify(reorderedItems));
    } catch (error) {
      console.error('Error reordering baseline schedules:', error);
      alert('Baseline 순서 저장에 실패했습니다.');
    }
  };

  const handleReorderSchedules = async (newItems: ScheduleItem[]) => {
    if (!currentProjectId) return;

    const reorderedItems = newItems.map((item, index) => ({
      ...item,
      sortOrder: index
    }));

    try {
      if (isSupabaseConfigured) {
        for (const item of reorderedItems) {
          await supabaseService.saveSchedule(item);
        }
      }

      setSchedules(reorderedItems);
      localStorage.setItem(`cp_schedules_${currentProjectId}`, JSON.stringify(reorderedItems));
    } catch (error) {
      console.error('Error reordering schedules:', error);
      alert('공정 순서 저장에 실패했습니다.');
    }
  };

  const projectToDelete = projects.find(p => p.id === projectToDeleteId);
  const projectName = projectToDelete ? projectToDelete.name : '이 프로젝트';

  if (viewMode === 'auth') return <AuthView onLogin={handleLogin} />;

  const SupabaseWarning = () => !isSupabaseConfigured ? (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2 text-amber-800 text-xs font-bold">
      <AlertTriangle size={14} />
      <span>Supabase가 연결되지 않았습니다. 데이터가 브라우저에만 저장되며 다른 사용자와 공유되지 않습니다. [Settings] 메뉴에서 환경변수를 설정해주세요.</span>
    </div>
  ) : null;

  if (viewMode === 'user-management') return (
    <UserManagement onBack={() => setViewMode('projects')} />
  );

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden font-sans text-gray-900">
      <SupabaseWarning />

      {viewMode === 'projects' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="bg-blue-600 p-1.5 rounded-lg flex items-center justify-center text-white shadow-sm"
                title="S-CON"
              >
                <LogoIcon size={20} />
              </div>
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
              onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
              currentUser={currentUser}
            />
          </div>
        </div>
      ) : (
        <>
          <aside className="hidden xl:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
            <div className="p-6 flex items-center gap-3">
              <div
                className="bg-blue-600 p-2 rounded-xl flex items-center justify-center text-white shadow-md"
                title="S-CON"
              >
                <LogoIcon size={22} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight text-gray-900 leading-none">S-<span className="text-blue-600">CON</span></h1>
                {currentUser && (
                  <span className="text-[10px] text-gray-500 font-medium mt-1">
                    {currentUser.name} / {currentUser.affiliation}
                  </span>
                )}
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <div className="px-3 mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Main Menu</span>
              </div>
              <button
                onClick={() => checkUnsavedChanges(() => setMainMenu('dashboard'))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <LayoutDashboard size={18} className={mainMenu === 'dashboard' ? 'text-blue-600' : 'text-gray-400'} />
                <span>대시 보드</span>
              </button>
              <button
                onClick={() => checkUnsavedChanges(() => setMainMenu('schedule'))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'schedule' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <BarChart3 size={18} className={mainMenu === 'schedule' ? 'text-blue-600' : 'text-gray-400'} />
                <span>공정 관리</span>
              </button>
              <button
                onClick={() => checkUnsavedChanges(() => setMainMenu('documents'))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'documents' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <FileText size={18} className={mainMenu === 'documents' ? 'text-blue-600' : 'text-gray-400'} />
                <span>문서 관리</span>
              </button>
              <button
                onClick={() => checkUnsavedChanges(() => setMainMenu('drawings'))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'drawings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Building size={18} className={mainMenu === 'drawings' ? 'text-blue-600' : 'text-gray-400'} />
                <span>도면 보기</span>
              </button>
              <button
                onClick={() => checkUnsavedChanges(() => setMainMenu('photo-gallery'))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'photo-gallery' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <ImageIcon size={18} className={mainMenu === 'photo-gallery' ? 'text-blue-600' : 'text-gray-400'} />
                <span>사진 갤러리</span>
              </button>

              <button
                onClick={() => checkUnsavedChanges(() => setMainMenu('quick-memo'))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'quick-memo' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <AlertTriangle size={18} className={mainMenu === 'quick-memo' ? 'text-blue-600' : 'text-gray-400'} />
                <span>퀵 메모</span>
              </button>

              <button
                onClick={() => checkUnsavedChanges(() => setMainMenu('ai-diagnosis'))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${mainMenu === 'ai-diagnosis' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Sparkles size={18} className={mainMenu === 'ai-diagnosis' ? 'text-blue-600' : 'text-gray-400'} />
                <span>AI 진단</span>
              </button>

              {mainMenu === 'ai-diagnosis' && (
                <>
                  <div className="pt-6 px-3 mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SUB Menu</span>
                  </div>
                  <div className="space-y-1 px-1">
                    <button
                      onClick={() => checkUnsavedChanges(() => setAiDiagnosisTab('ai-risk'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${aiDiagnosisTab === 'ai-risk' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <ShieldAlert size={18} className={aiDiagnosisTab === 'ai-risk' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>AI 리스크</span>
                    </button>
                    <button
                      onClick={() => checkUnsavedChanges(() => setAiDiagnosisTab('ai-report'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${aiDiagnosisTab === 'ai-report' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <FileText size={18} className={aiDiagnosisTab === 'ai-report' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>AI 리포트</span>
                    </button>
                  </div>
                </>
              )}

              {mainMenu === 'schedule' && (
                <>
                  <div className="pt-6 px-3 mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SUB Menu</span>
                  </div>
                  <div className="space-y-1 px-1">
                    <button
                      onClick={() => checkUnsavedChanges(() => setTabMode('comparison'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${tabMode === 'comparison' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <ArrowLeftRight size={18} className={tabMode === 'comparison' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>계획vs실행</span>
                    </button>
                    <button
                      onClick={() => checkUnsavedChanges(() => setTabMode('baseline'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${tabMode === 'baseline' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Save size={18} className={tabMode === 'baseline' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>Baseline 계획</span>
                    </button>
                    <button
                      onClick={() => checkUnsavedChanges(() => setTabMode('gantt'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${tabMode === 'gantt' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <BarChart3 size={18} className={tabMode === 'gantt' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>간트차트</span>
                    </button>
                    <button
                      onClick={() => checkUnsavedChanges(() => setTabMode('table'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${tabMode === 'table' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <TableIcon size={18} className={tabMode === 'table' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>공정 목록</span>
                    </button>
                  </div>
                </>
              )}

              {mainMenu === 'documents' && (
                <>
                  <div className="pt-6 px-3 mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SUB Menu</span>
                  </div>
                  <div className="space-y-1 px-1">
                    <button
                      onClick={() => checkUnsavedChanges(() => setDocumentTab('daily-report'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${documentTab === 'daily-report' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <FileText size={18} className={documentTab === 'daily-report' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>공사 일보</span>
                    </button>
                    <button
                      onClick={() => checkUnsavedChanges(() => setDocumentTab('inspection'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${documentTab === 'inspection' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <FileText size={18} className={documentTab === 'inspection' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>검측요청서</span>
                    </button>
                    <button
                      onClick={() => checkUnsavedChanges(() => setDocumentTab('material'))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${documentTab === 'material' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <FileText size={18} className={documentTab === 'material' ? 'text-blue-600' : 'text-gray-400'} />
                      <span>자재승인서</span>
                    </button>
                    <button
                      onClick={() => checkUnsavedChanges(() => setDocumentTab('concrete'))}
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
              <button
                onClick={() => checkUnsavedChanges(() => setViewMode('projects'))}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
              >
                <ChevronLeft size={18} className="text-gray-400" />
                <span>프로젝트 목록</span>
              </button>
              {currentUser?.userRole !== '브론즈' && (
                <>
                  <button
                    onClick={() => checkUnsavedChanges(() => setIsSettingsOpen(true))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
                  >
                    <Settings size={18} className="text-gray-400" />
                    <span>환경 설정</span>
                  </button>
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => checkUnsavedChanges(handleLoadSamples)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
                    >
                      <Database size={18} className="text-gray-400" />
                      <span>샘플 데이터 로드</span>
                    </button>
                  )}
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => checkUnsavedChanges(() => setViewMode('user-management'))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
                    >
                      <UserIcon size={18} className="text-gray-400" />
                      <span>회원 관리</span>
                    </button>
                  )}
                  <button
                    onClick={() => checkUnsavedChanges(() => setIsProfileModalOpen(true))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
                  >
                    <UserIcon size={18} className="text-gray-400" />
                    <span>내 프로필</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-all text-sm font-medium"
                  >
                    <LogOut size={18} className="text-red-400" />
                    <span>로그 아웃</span>
                  </button>
                </>
              )}
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden relative">
            <div className="xl:hidden bg-gray-50 border-b border-gray-200 flex flex-col z-30">
              <div className="p-4 pb-0 flex items-center justify-between">
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
              <div className="flex overflow-x-auto no-scrollbar px-2 py-0 gap-2">
                <button
                  onClick={() => setMainMenu('dashboard')}
                  className={`flex-shrink-0 flex items-center gap-2 px-1 py-2 md:py-3 text-sm font-bold border-b-2 transition-all ${mainMenu === 'dashboard' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
                >
                  <LayoutDashboard size={16} className={`${mainMenu === 'dashboard' ? 'text-blue-600' : 'text-gray-400'} hidden`} />
                  <span>대시 보드</span>
                </button>
                <button
                  onClick={() => setMainMenu('schedule')}
                  className={`hidden md:flex flex-shrink-0 items-center gap-2 px-1 py-2 md:py-3 text-sm font-bold border-b-2 transition-all ${mainMenu === 'schedule' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
                >
                  <BarChart3 size={16} className={`${mainMenu === 'schedule' ? 'text-blue-600' : 'text-gray-400'} hidden`} />
                  <span>공정 관리</span>
                </button>
                <button
                  onClick={() => setMainMenu('documents')}
                  className={`hidden md:flex flex-shrink-0 items-center gap-2 px-1 py-2 md:py-3 text-sm font-bold border-b-2 transition-all ${mainMenu === 'documents' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
                >
                  <FileText size={16} className={`${mainMenu === 'documents' ? 'text-blue-600' : 'text-gray-400'} hidden`} />
                  <span>문서 관리</span>
                </button>
                <button
                  onClick={() => setMainMenu('drawings')}
                  className={`flex-shrink-0 flex items-center gap-2 px-1 py-2 md:py-3 text-sm font-bold border-b-2 transition-all ${mainMenu === 'drawings' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
                >
                  <Building size={16} className={`${mainMenu === 'drawings' ? 'text-blue-600' : 'text-gray-400'} hidden`} />
                  <span>도면 보기</span>
                </button>
                <button
                  onClick={() => setMainMenu('photo-gallery')}
                  className={`flex-shrink-0 flex items-center gap-2 px-1 py-2 md:py-3 text-sm font-bold border-b-2 transition-all ${mainMenu === 'photo-gallery' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
                >
                  <ImageIcon size={16} className={`${mainMenu === 'photo-gallery' ? 'text-blue-600' : 'text-gray-400'} hidden`} />
                  <span>사진 갤러리</span>
                </button>

                <button
                  onClick={() => setMainMenu('quick-memo')}
                  className={`flex-shrink-0 flex items-center gap-2 px-1 py-2 md:py-3 text-sm font-bold border-b-2 transition-all ${mainMenu === 'quick-memo' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
                >
                  <AlertTriangle size={16} className={`${mainMenu === 'quick-memo' ? 'text-blue-600' : 'text-gray-400'} hidden`} />
                  <span>퀵 메모</span>
                </button>
                <button
                  onClick={() => setMainMenu('ai-diagnosis')}
                  className={`hidden md:flex flex-shrink-0 items-center gap-2 px-1 py-2 md:py-3 text-sm font-bold border-b-2 transition-all ${mainMenu === 'ai-diagnosis' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}
                >
                  <Sparkles size={16} className={`${mainMenu === 'ai-diagnosis' ? 'text-blue-600' : 'text-gray-400'} hidden`} />
                  <span>AI 진단</span>
                </button>
              </div>

              {mainMenu === 'ai-diagnosis' && (
                <div className="hidden md:flex overflow-x-auto no-scrollbar px-2 pb-2 gap-2 border-t border-gray-100 pt-2">
                  <button
                    onClick={() => setAiDiagnosisTab('ai-risk')}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${aiDiagnosisTab === 'ai-risk' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
                  >
                    <ShieldAlert size={14} className={aiDiagnosisTab === 'ai-risk' ? 'text-blue-600' : 'text-gray-500'} />
                    <span>AI 리스크</span>
                  </button>
                  <button
                    onClick={() => setAiDiagnosisTab('ai-report')}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${aiDiagnosisTab === 'ai-report' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
                  >
                    <FileText size={14} className={aiDiagnosisTab === 'ai-report' ? 'text-blue-600' : 'text-gray-500'} />
                    <span>AI 리포트</span>
                  </button>
                </div>
              )}
              {mainMenu === 'schedule' && (
                <div className="flex overflow-x-auto no-scrollbar px-2 pb-2 gap-2 border-t border-gray-100 pt-2">
                  <button
                    onClick={() => setTabMode('comparison')}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${tabMode === 'comparison' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
                  >
                    <span>계획vs실행</span>
                  </button>
                  <button
                    onClick={() => setTabMode('baseline')}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${tabMode === 'baseline' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 bg-gray-100'}`}
                  >
                    <span>Baseline 계획</span>
                  </button>
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
              </div>
            </header>

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

                <div className="ml-auto flex items-center gap-3">
                  {(tabMode === 'gantt' || tabMode === 'table') && (
                    <button
                      onClick={handleExportToExcel}
                      className="flex items-center gap-2 px-3 py-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-all shadow-sm text-xs font-bold"
                      title="엑셀 내보내기"
                    >
                      <FileSpreadsheet size={16} />
                      <span className="hidden sm:inline">Excel 내보내기</span>
                    </button>
                  )}
                  {(tabMode === 'gantt' || tabMode === 'table') && (
                    <button
                      onClick={handleOpenNewForm}
                      className="hidden lg:flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
                    >
                      <Plus size={16} />
                      <span>신규 공정 등록</span>
                    </button>
                  )}
                  {(tabMode === 'gantt' || tabMode === 'comparison' || tabMode === 'baseline') && (
                    <div className="flex items-center border border-gray-200 p-0.5 rounded-lg bg-gray-50 shadow-sm">
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
              </div>
            )}

            <div className="flex-1 flex flex-col p-0 overflow-hidden relative">
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
                        currentUser={currentUser}
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

                  {mainMenu === 'photo-gallery' && (
                    <motion.div
                      key="photo-gallery"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="h-full overflow-y-auto bg-gray-50/50"
                    >
                      <PhotoGalleryView project={currentProject || null} />
                    </motion.div>
                  )}

                  {mainMenu === 'quick-memo' && (
                    <motion.div
                      key="quick-memo"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="h-full overflow-y-auto bg-gray-50/50"
                    >
                      <QuickMemoView
                        project={currentProject || null}
                        currentUser={currentUser}
                        settings={settings}
                        autoOpenModal={autoOpenQuickMemo}
                        onModalOpened={() => setAutoOpenQuickMemo(false)}
                      />
                    </motion.div>
                  )}

                  {mainMenu === 'ai-diagnosis' && (
                    <motion.div
                      key={`ai-diagnosis-${aiDiagnosisTab}`}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="h-full overflow-y-auto"
                    >
                      <AiDiagnosisView
                        project={currentProject || null}
                        schedules={schedules}
                        tab={aiDiagnosisTab}
                      />
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
                        currentUser={currentUser}
                        onDirtyChange={setIsDailyReportDirty}
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
                        onDelete={handleDeleteSchedule}
                        settings={settings}
                        onReorder={handleReorderSchedules}
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
                        onUpdate={handleUpdateBaselineSchedule}
                        onDelete={handleDeleteBaselineSchedule}
                        onReorder={handleReorderBaselineSchedules}
                        settings={settings}
                        zoom={zoom}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {mainMenu === 'schedule' && (
              <button
                onClick={handleOpenNewForm}
                className="flex lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-50"
              >
                <Plus size={24} />
              </button>
            )}

            {mainMenu === 'dashboard' && (
              <button
              onClick={() => {
                setAutoOpenQuickMemo(true);
                checkUnsavedChanges(() => setMainMenu('quick-memo'));
              }}
              className="xl:hidden fixed bottom-6 right-6 h-14 px-4 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all z-50"
              title="퀵 메모 작성"
              >
              <Plus size={22} />
              <span className="text-sm font-bold">퀵 메모</span>
              </button>
            )}

          </main>

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
        </>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        projectName={currentProject?.name}
      />

      {currentUser && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={currentUser}
          onUpdateUser={(updatedUser) => {
            setCurrentUser(updatedUser);
            localStorage.setItem('cp_current_user', JSON.stringify(updatedUser));
          }}
        />
      )}

      <DeleteProjectModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        projects={projects}
        onDelete={handleDeleteProjects}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDeleteProject}
        title="프로젝트 삭제"
        message={`${projectName} 프로젝트를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        type="danger"
      />

      <ConfirmModal
        isOpen={unsavedChangesModal.isOpen}
        onClose={() => setUnsavedChangesModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={unsavedChangesModal.onConfirm}
        title="변경사항 확인"
        message="저장되지 않은 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?"
        confirmText="이동"
        cancelText="머무르기"
        type="warning"
      />
    </div>
  );
}
