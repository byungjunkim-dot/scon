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
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
type MainMenu = 'dashboard' | 'schedule' | 'documents' | 'drawings';
type TabMode = 'gantt' | 'table' | 'comparison' | 'baseline';
type DocumentTab = 'daily-report' | 'inspection' | 'material' | 'concrete';

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
    const saved = localStorage.getItem('cp_current_user');
    return saved ? JSON.parse(saved) : null;
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

  // 4. 프로젝트 목록 (★AI가 지워서 에러가 났던 부분 복구!)
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('cp_projects');
    return saved ? JSON.parse(saved) : [];
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
            setSettings(settingsData);
            localStorage.setItem('cp_settings', JSON.stringify(settingsData));
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
        setSettings(parsedSettings);
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
    return indexA - indexB;
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
    const updatedProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    setProjects(updatedProjects);
    localStorage.setItem('cp_projects', JSON.stringify(updatedProjects));

    if (isSupabaseConfigured) {
      try {
        await supabaseService.saveProject(updatedProject);
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
                <span>대쉬 보드</span>
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

              {mainMenu === 'schedule' && (
                <>
                  <div className="pt-6 px-3 mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action Menu</span>
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
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action Menu</span>
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
              {currentUser?.userRole !== '브론즈' && (
                <>
                  <button
                    onClick={() => checkUnsavedChanges(() => setIsSettingsOpen(true))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
                  >
                    <Settings size={18} className="text-gray-400" />
                    <span>설정 모드</span>
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
                </>
              )}
              <button
                onClick={() => checkUnsavedChanges(() => setViewMode('projects'))}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium"
              >
                <ChevronLeft size={18} className="text-gray-400" />
                <span>프로젝트 목록</span>
              </button>
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
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all text-sm font-medium"
              >
                <LogOut size={18} />
                <span>로그 아웃</span>
              </button>
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden relative">
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
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <button onClick={handleSaveBaseline} className="p-2 bg-white hover:bg-gray-50 border-r border-gray-200 transition-colors text-gray-600" title="현재 공정을 Baseline으로 저장">
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

            <div className="flex-1 flex flex-col p-0 xl:p-8 overflow-hidden relative">
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
