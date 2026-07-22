import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Briefcase, Calendar, Plus, Trash2, Search, UserCheck, HardHat, Edit2, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, LineChart, Line, ComposedChart } from 'recharts';
import { Project, User, Allocation, AllocationPeriod } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { supabaseService } from '../services/supabaseService';

const COLORS = ['#7da0ca', '#85b79e', '#e3b177', '#a799cc', '#dca2b1', '#7cbdbf', '#a2b588', '#94a3b8'];

const WORK_TYPES = ['공통', '건축', '구조', '토목', '전기', '기계', '소방', '조경', '안전', '기타'];
const JOB_TITLES = ['설계', '소장', '공무', '공사', '품질', '안전', '관리', '기타'];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="#ffffff" 
      textAnchor="middle" 
      dominantBaseline="central" 
      className="text-xs font-black select-none pointer-events-none"
    >
      {value}
    </text>
  );
};

interface PersonnelStatusViewProps {
  projects: Project[];
  currentUser: User | null;
}

export const PersonnelStatusView: React.FC<PersonnelStatusViewProps> = ({ projects, currentUser }) => {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter active projects (whose status is '진행' or undefined/null)
  const activeProjects = projects.filter(p => (p.status || '진행') === '진행');
  
  // Filter allocations for active projects only
  const activeAllocations = allocations.filter(a => activeProjects.some(p => p.id === a.projectId));
  
  // Today's date reference
  const todayStr = '2026-07-21';

  // Helper to check if allocation is active on a date
  const isAllocationActiveOnDate = (alloc: Allocation, dateStr: string) => {
    if (alloc.periods && alloc.periods.length > 0) {
      return alloc.periods.some(p => p.startDate <= dateStr && dateStr <= p.endDate);
    }
    return alloc.startDate <= dateStr && dateStr <= alloc.endDate;
  };
  
  // Today's active allocations (allocation period includes today)
  const todayAllocations = activeAllocations.filter(a => isAllocationActiveOnDate(a, todayStr));

  // Filters state
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [selectedWorkTypeFilter, setSelectedWorkTypeFilter] = useState<string>('all');
  const [selectedJobTitleFilter, setSelectedJobTitleFilter] = useState<string>('all');

  // Gantt chart status filter (진행 / 완료 / 홀딩 / 전체)
  const [ganttStatusFilter, setGanttStatusFilter] = useState<string>('진행');

  // Year selection for the monthly allocation trend chart
  const [selectedChartYear, setSelectedChartYear] = useState<number>(2026);

  // Filter projects for Gantt chart based on status filter
  const ganttProjects = React.useMemo(() => {
    return projects.filter(p => {
      if (ganttStatusFilter === '전체') return true;
      const status = p.status || '진행';
      return status === ganttStatusFilter;
    });
  }, [projects, ganttStatusFilter]);

  // Filter allocations for gantt projects
  const ganttAllocations = React.useMemo(() => {
    return allocations.filter(a => ganttProjects.some(p => p.id === a.projectId));
  }, [allocations, ganttProjects]);

  // Reset project filter when gantt status filter changes
  useEffect(() => {
    setSelectedProjectFilter('all');
  }, [ganttStatusFilter]);

  // Input states for adding new worker (keyed by project ID for simplicity)
  const [newWorkerNames, setNewWorkerNames] = useState<Record<string, string>>({});
  const [newWorkerWorkTypes, setNewWorkerWorkTypes] = useState<Record<string, string>>({});
  const [newWorkerJobTitles, setNewWorkerJobTitles] = useState<Record<string, string>>({});
  const [newWorkerStartDates, setNewWorkerStartDates] = useState<Record<string, string>>({});
  const [newWorkerEndDates, setNewWorkerEndDates] = useState<Record<string, string>>({});

  // Editing state for existing allocations
  const [editingAllocId, setEditingAllocId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [editingWorkType, setEditingWorkType] = useState<string>('');
  const [editingJobTitle, setEditingJobTitle] = useState<string>('');
  const [editingStartDate, setEditingStartDate] = useState<string>('');
  const [editingEndDate, setEditingEndDate] = useState<string>('');
  const [editingPeriods, setEditingPeriods] = useState<AllocationPeriod[]>([]);

  // Active project ID for adding a new worker
  const [activeAddProjectId, setActiveAddProjectId] = useState<string | null>(null);

  // Collapsed projects state (Gantt folding)
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  // Gantt Chart View Tab ('project' | 'worker')
  const [activeGanttTab, setActiveGanttTab] = useState<'project' | 'worker'>('project');

  // Worker-specific Gantt chart state
  const [collapsedWorkers, setCollapsedWorkers] = useState<Record<string, boolean>>({});
  const [workerSearchQuery, setWorkerSearchQuery] = useState<string>('');
  const [workerWorkTypeFilter, setWorkerWorkTypeFilter] = useState<string>('all');
  const [workerJobTitleFilter, setWorkerJobTitleFilter] = useState<string>('all');
  const [workerProjectFilter, setWorkerProjectFilter] = useState<string>('all');
  const [workerStatusFilter, setWorkerStatusFilter] = useState<string>('전체');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [allocIdToDelete, setAllocIdToDelete] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const workerScrollContainerRef = React.useRef<HTMLDivElement>(null);

  const toggleWorkerCollapse = (userName: string) => {
    setCollapsedWorkers(prev => ({
      ...prev,
      [userName]: !prev[userName]
    }));
  };

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Dynamically calculate the timeline range based on project and allocation dates
  const { TOTAL_MONTHS, MONTHS, timelineStart, timelineEnd, totalDuration } = React.useMemo(() => {
    let maxYear = 2027;

    const checkYearStr = (dateStr?: string) => {
      if (dateStr && dateStr.length >= 4) {
        const y = parseInt(dateStr.substring(0, 4), 10);
        if (!isNaN(y) && y > maxYear) {
          maxYear = y;
        }
      }
    };

    projects.forEach(p => {
      checkYearStr(p.startDate);
      checkYearStr(p.endDate);
    });

    allocations.forEach(a => {
      checkYearStr(a.startDate);
      checkYearStr(a.endDate);
      if (a.periods) {
        a.periods.forEach(p => {
          checkYearStr(p.startDate);
          checkYearStr(p.endDate);
        });
      }
    });

    if (maxYear > 2035) {
      maxYear = 2035;
    }

    const startYear = 2026;
    const endYear = maxYear;
    const totalMonthsCount = (endYear - startYear + 1) * 12;

    const monthsArray = Array.from({ length: totalMonthsCount }, (_, i) => {
      const year = startYear + Math.floor(i / 12);
      const monthNum = (i % 12) + 1;
      return {
        year,
        num: monthNum,
        label: `${year}년 ${monthNum}월`,
        shortLabel: `${monthNum}월`,
        index: i,
      };
    });

    const startVal = new Date(`${startYear}-01-01`).getTime();
    const endVal = new Date(`${endYear}-12-31`).getTime();

    return {
      TOTAL_MONTHS: totalMonthsCount,
      MONTHS: monthsArray,
      timelineStart: startVal,
      timelineEnd: endVal,
      totalDuration: endVal - startVal,
    };
  }, [projects, allocations]);

  const yearsInMonths = React.useMemo(() => {
    const groups: { year: number; count: number }[] = [];
    MONTHS.forEach(m => {
      const existing = groups.find(g => g.year === m.year);
      if (existing) {
        existing.count += 1;
      } else {
        groups.push({ year: m.year, count: 1 });
      }
    });
    return groups;
  }, [MONTHS]);

  const getInitialScrollMonthIndex = () => {
    const today = new Date('2026-07-21');
    const start = new Date('2026-01-01');
    const yearDiff = today.getFullYear() - start.getFullYear();
    const monthDiff = today.getMonth() - start.getMonth();
    const totalMonthDiff = yearDiff * 12 + monthDiff;
    return Math.max(0, totalMonthDiff - 2);
  };

  // Scroll to 2 months before today on load
  useEffect(() => {
    if (scrollContainerRef.current && !loading) {
      const targetMonthIndex = getInitialScrollMonthIndex();
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const scrollWidth = container.scrollWidth;
          const leftColWidth = 320;
          const timelineTotalWidth = scrollWidth - leftColWidth;
          const targetScrollLeft = (targetMonthIndex / TOTAL_MONTHS) * timelineTotalWidth;
          container.scrollLeft = targetScrollLeft;
        }
      }, 150);
    }
  }, [loading]);

  // Initialize and load allocations from Supabase
  useEffect(() => {
    const fetchAllocations = async () => {
      setLoading(true);
      try {
        const saved = await supabaseService.getPersonnelAllocations();
        if (saved && saved.length > 0) {
          setAllocations(saved);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Failed to fetch allocations from Supabase:', error);
      }

      // Default mock allocations if none exist, beautifully aligned with projects
      const defaultWorkers = [
        { name: '김태호', workType: '건축', jobTitle: '소장' },
        { name: '이지훈', workType: '건축', jobTitle: '공사' },
        { name: '박민우', workType: '안전', jobTitle: '안전' },
        { name: '최현우', workType: '토목', jobTitle: '공사' },
        { name: '정성윤', workType: '전기', jobTitle: '공무' },
        { name: '한상우', workType: '기계', jobTitle: '설계' },
        { name: '조민지', workType: '소방', jobTitle: '공무' },
        { name: '윤석호', workType: '토목', jobTitle: '품질' },
        { name: '강혜원', workType: '기타', jobTitle: '관리' },
        { name: '임준서', workType: '건축', jobTitle: '설계' },
        { name: '배윤아', workType: '기계', jobTitle: '공사' },
        { name: '백성진', workType: '안전', jobTitle: '안전' },
      ];

      const initialAllocations: Allocation[] = [];

      activeProjects.forEach((project, index) => {
        // Pick 3-4 realistic workers for each project
        const workerIndices = [
          (index * 3) % defaultWorkers.length,
          (index * 3 + 1) % defaultWorkers.length,
          (index * 3 + 2) % defaultWorkers.length,
        ];

        workerIndices.forEach(idx => {
          const worker = defaultWorkers[idx];
          const pStart = project.startDate || '2026-03-01';
          const pEnd = project.endDate || '2026-11-30';

          initialAllocations.push({
            id: `allocation-${project.id}-${worker.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            projectId: project.id,
            projectName: project.name,
            userName: worker.name,
            workType: worker.workType,
            jobTitle: worker.jobTitle,
            startDate: pStart,
            endDate: pEnd,
          });
        });
      });

      try {
        await supabaseService.savePersonnelAllocations(initialAllocations);
      } catch (saveError) {
        console.error('Failed to save initial allocations to Supabase:', saveError);
      }
      setAllocations(initialAllocations);
      setLoading(false);
    };

    if (projects.length > 0) {
      fetchAllocations();
    }
  }, [projects]);

  // Handle adding new worker inline
  const handleAddWorker = async (projectId: string, projectName: string) => {
    const name = newWorkerNames[projectId]?.trim();
    if (!name) {
      alert('투입 인력의 성명을 입력해주세요.');
      return;
    }

    const workType = newWorkerWorkTypes[projectId] || '건축';
    const jobTitle = newWorkerJobTitles[projectId] || '설계';
    const startDate = newWorkerStartDates[projectId] || '2026-01-01';
    const endDate = newWorkerEndDates[projectId] || '2026-12-31';

    if (new Date(startDate) > new Date(endDate)) {
      alert('투입 시작일이 종료일보다 늦을 수 없습니다.');
      return;
    }

    const newAlloc: Allocation = {
      id: `alloc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      projectName,
      userName: name,
      workType,
      jobTitle,
      startDate,
      endDate,
      periods: [{ startDate, endDate }],
    };

    const updated = [...allocations, newAlloc];
    setAllocations(updated);
    
    try {
      await supabaseService.savePersonnelAllocations(updated);
    } catch (error) {
      console.error('Failed to save allocation to Supabase:', error);
      alert('데이터 저장 중 오류가 발생했습니다.');
    }

    // Reset inputs for this project
    setNewWorkerNames(prev => ({ ...prev, [projectId]: '' }));
    setActiveAddProjectId(null);
    // Keep date/type defaults or reset
  };

  // Handle deleting a worker
  const handleDeleteWorker = (id: string) => {
    setAllocIdToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDeleteWorker = async () => {
    if (!allocIdToDelete) return;
    const updated = allocations.filter(a => a.id !== allocIdToDelete);
    setAllocations(updated);
    
    try {
      await supabaseService.savePersonnelAllocations(updated);
    } catch (error) {
      console.error('Failed to save allocations to Supabase:', error);
      alert('데이터 저장 중 오류가 발생했습니다.');
    }
    setAllocIdToDelete(null);
  };

  // Handle editing a worker allocation
  const handleStartEdit = (alloc: Allocation) => {
    setEditingAllocId(alloc.id);
    setEditingName(alloc.userName);
    setEditingWorkType(alloc.workType);
    setEditingJobTitle(alloc.jobTitle);
    setEditingStartDate(alloc.startDate);
    setEditingEndDate(alloc.endDate);
    if (alloc.periods && alloc.periods.length > 0) {
      setEditingPeriods(alloc.periods.map(p => ({ ...p })));
    } else {
      setEditingPeriods([{ startDate: alloc.startDate, endDate: alloc.endDate }]);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) {
      alert('투입 인력의 성명을 입력해주세요.');
      return;
    }

    // Validate all editing periods
    for (let i = 0; i < editingPeriods.length; i++) {
      const p = editingPeriods[i];
      if (!p.startDate || !p.endDate) {
        alert('모든 기간의 시작일과 종료일을 입력해주세요.');
        return;
      }
      if (new Date(p.startDate) > new Date(p.endDate)) {
        alert(`${i + 1}번째 기간의 시작일이 종료일보다 늦을 수 없습니다.`);
        return;
      }
    }

    // Calculate overall start and end from periods
    let overallStart = editingStartDate;
    let overallEnd = editingEndDate;

    if (editingPeriods.length > 0) {
      const starts = editingPeriods.map(p => new Date(p.startDate).getTime());
      const ends = editingPeriods.map(p => new Date(p.endDate).getTime());
      const minStart = new Date(Math.min(...starts));
      const maxEnd = new Date(Math.max(...ends));
      
      const formatToYYYYMMDD = (d: Date) => d.toISOString().split('T')[0];
      overallStart = formatToYYYYMMDD(minStart);
      overallEnd = formatToYYYYMMDD(maxEnd);
    }

    const updated = allocations.map(a => {
      if (a.id === id) {
        return {
          ...a,
          userName: editingName.trim(),
          workType: editingWorkType,
          jobTitle: editingJobTitle,
          startDate: overallStart,
          endDate: overallEnd,
          periods: editingPeriods,
        };
      }
      return a;
    });

    setAllocations(updated);
    try {
      await supabaseService.savePersonnelAllocations(updated);
    } catch (error) {
      console.error('Failed to save allocations to Supabase:', error);
      alert('데이터 저장 중 오류가 발생했습니다.');
    }
    setEditingAllocId(null);
  };

  const handleCancelEdit = () => {
    setEditingAllocId(null);
  };

  // Donut chart calculation: Today's active allocation count by active project
  const todayDonutChartData = activeProjects.map(p => {
    const count = todayAllocations.filter(a => a.projectId === p.id).length;
    return {
      name: p.name,
      value: count,
    };
  }).filter(item => item.value > 0);

  // Donut chart calculation: Total (all-time) allocation count by active project
  const totalDonutChartData = activeProjects.map(p => {
    const count = activeAllocations.filter(a => a.projectId === p.id).length;
    return {
      name: p.name,
      value: count,
    };
  }).filter(item => item.value > 0);

  // Vertical bar chart: Today's active allocation count by JOB TITLE (직종), stacked by active project
  const barChartData = JOB_TITLES.map(title => {
    const titleAllocations = todayAllocations.filter(a => a.jobTitle === title);
    const item: Record<string, any> = { name: title, total: titleAllocations.length };
    let hasAllocations = false;

    activeProjects.forEach(p => {
      const count = titleAllocations.filter(a => a.projectId === p.id).length;
      if (count > 0) {
        item[p.id] = count;
        hasAllocations = true;
      }
    });

    return hasAllocations ? item : null;
  }).filter((item): item is Record<string, any> => item !== null);

  // Today's total Unique allocated count
  const totalAllocatedPeople = new Set(todayAllocations.map(a => a.userName)).size;

  // Total Unique allocated count across active projects (all-time)
  const totalAllocatedPeopleAllTime = new Set(activeAllocations.map(a => a.userName)).size;

  // Generate list of 14 months (from Dec of previous year to Jan of next year) based on selectedChartYear
  const chartMonths = React.useMemo(() => {
    const list: { year: number; month: number; monthStr: string }[] = [];
    // Previous year December
    list.push({ year: selectedChartYear - 1, month: 12, monthStr: `${selectedChartYear - 1}-12` });
    // Current year January to December
    for (let month = 1; month <= 12; month++) {
      list.push({ year: selectedChartYear, month, monthStr: `${selectedChartYear}-${String(month).padStart(2, '0')}` });
    }
    // Next year January
    list.push({ year: selectedChartYear + 1, month: 1, monthStr: `${selectedChartYear + 1}-01` });
    return list;
  }, [selectedChartYear]);

  // Check if an allocation is active in a given month YYYY-MM
  const isAllocationInMonth = (alloc: Allocation, monthStr: string) => {
    const [y, m] = monthStr.split('-').map(Number);
    const monthStart = new Date(y, m - 1, 1).getTime();
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999).getTime();

    const checkOverlap = (startStr: string, endStr: string) => {
      const start = new Date(startStr).getTime();
      const end = new Date(endStr).getTime();
      return start <= monthEnd && end >= monthStart;
    };
    
    if (alloc.periods && alloc.periods.length > 0) {
      return alloc.periods.some(p => checkOverlap(p.startDate, p.endDate));
    }
    
    return checkOverlap(alloc.startDate, alloc.endDate);
  };

  // Calculate monthly trend data (active per month and project-specific allocations)
  const lineChartData = React.useMemo(() => {
    return chartMonths.map(({ year, month, monthStr }) => {
      // Active in this specific month
      const activeInMonth = activeAllocations.filter(a => isAllocationInMonth(a, monthStr));
      const monthlyUniqueUsers = new Set(activeInMonth.map(a => a.userName));
      
      // Calculate allocation counts for each active project in this specific month
      const projectCounts: Record<string, number> = {};
      activeProjects.forEach(p => {
        const count = activeInMonth.filter(a => a.projectId === p.id).length;
        projectCounts[p.id] = count;
      });
      
      // Determine if this represents the current active month (today is 2026-07-21, so 2026-07)
      const isCurrentMonth = year === 2026 && month === 7;
      
      return {
        month: `${year}년 ${month}월`,
        shortMonth: year === selectedChartYear ? `${month}월` : `${String(year).slice(-2)}년 ${month}월`,
        '당월 투입': monthlyUniqueUsers.size,
        isCurrentMonth,
        year,
        monthVal: month,
        ...projectCounts,
      };
    });
  }, [chartMonths, activeAllocations, activeProjects, selectedChartYear]);

  // Timeline position calculation helpers based on dynamic duration
  // Uses dynamic timelineStart, timelineEnd, and totalDuration defined in top-level useMemo

  const getTimelineBarStyles = (startDate: string, endDate: string) => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    const clampedStart = Math.max(timelineStart, start);
    const clampedEnd = Math.min(timelineEnd, end);
    
    if (clampedStart > clampedEnd) {
      return { left: '0%', width: '0%', display: 'none' };
    }
    
    const left = ((clampedStart - timelineStart) / totalDuration) * 100;
    const width = Math.max(1.0, ((clampedEnd - clampedStart) / totalDuration) * 100);
    
    return {
      left: `${left}%`,
      width: `${width}%`,
    };
  };

  // Apply filters for Gantt display
  const filteredAllocations = React.useMemo(() => {
    return ganttAllocations.filter(a => {
      const matchProj = selectedProjectFilter === 'all' || a.projectId === selectedProjectFilter;
      const matchWorkType = selectedWorkTypeFilter === 'all' || a.workType === selectedWorkTypeFilter;
      const matchJobTitle = selectedJobTitleFilter === 'all' || a.jobTitle === selectedJobTitleFilter;
      return matchProj && matchWorkType && matchJobTitle;
    });
  }, [ganttAllocations, selectedProjectFilter, selectedWorkTypeFilter, selectedJobTitleFilter]);

  // Group allocations by worker name
  const workerGanttData = React.useMemo(() => {
    const uniqueUserNames = Array.from(new Set(allocations.map(a => a.userName)));
    
    return uniqueUserNames.map(name => {
      const userAllocations = allocations.filter(a => a.userName === name);
      // Determine representative work type and job title based on first allocation
      const firstAlloc = userAllocations[0];
      const workType = firstAlloc ? firstAlloc.workType : '';
      const jobTitle = firstAlloc ? firstAlloc.jobTitle : '';
      
      return {
        userName: name,
        workType,
        jobTitle,
        allocations: userAllocations
      };
    });
  }, [allocations]);

  // Filter worker data
  const filteredWorkerGanttData = React.useMemo(() => {
    return workerGanttData.map(worker => {
      // Filter the worker's allocations
      const filteredAllocs = worker.allocations.filter(a => {
        // Find the associated project to check status
        const project = projects.find(p => p.id === a.projectId);
        const pStatus = project ? (project.status || '진행') : '진행';

        const matchStatus = workerStatusFilter === '전체' || pStatus === workerStatusFilter;
        const matchProj = workerProjectFilter === 'all' || a.projectId === workerProjectFilter;
        const matchWorkType = workerWorkTypeFilter === 'all' || a.workType === workerWorkTypeFilter;
        const matchJobTitle = workerJobTitleFilter === 'all' || a.jobTitle === workerJobTitleFilter;

        return matchStatus && matchProj && matchWorkType && matchJobTitle;
      });

      return {
        ...worker,
        allocations: filteredAllocs
      };
    })
    .filter(worker => {
      const matchSearch = !workerSearchQuery || worker.userName.toLowerCase().includes(workerSearchQuery.toLowerCase());
      return worker.allocations.length > 0 && matchSearch;
    });
  }, [workerGanttData, projects, workerSearchQuery, workerWorkTypeFilter, workerJobTitleFilter, workerProjectFilter, workerStatusFilter]);

  // Today marker (July 21, 2026 as per local time context)
  const todayTime = new Date('2026-07-21').getTime();
  const todayLeftPercent = ((todayTime - timelineStart) / totalDuration) * 100;

  const activeFilterCount = activeGanttTab === 'project'
    ? (ganttStatusFilter !== '진행' ? 1 : 0) + (selectedProjectFilter !== 'all' ? 1 : 0) + (selectedWorkTypeFilter !== 'all' ? 1 : 0) + (selectedJobTitleFilter !== 'all' ? 1 : 0)
    : (workerStatusFilter !== '전체' ? 1 : 0) + (workerProjectFilter !== 'all' ? 1 : 0) + (workerWorkTypeFilter !== 'all' ? 1 : 0) + (workerJobTitleFilter !== 'all' ? 1 : 0) + (workerSearchQuery !== '' ? 1 : 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
        <p className="text-sm font-bold text-gray-500">인력 현황 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Charts Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Left Card: 진행 프로젝트 목록 (Active Projects List) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full justify-between">
          <div>
            <div className="mb-4">
              <h3 className="text-md font-bold text-gray-800">진행 프로젝트</h3>
            </div>

            <div className="overflow-y-auto pr-1 space-y-1.5 max-h-[255px] scrollbar-thin scrollbar-thumb-gray-200">
              {activeProjects.map((project, idx) => {
                const projectColor = project.color || COLORS[idx % COLORS.length];
                const projectTodayAllocations = todayAllocations.filter(a => a.projectId === project.id);
                const projectAllTimeAllocations = activeAllocations.filter(a => a.projectId === project.id);
                return (
                  <div key={project.id} className="flex items-center justify-between py-2 px-1 hover:bg-gray-50/50 transition-colors rounded-lg">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: projectColor }}
                      ></span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-gray-800 truncate">{project.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold">{project.startDate} ~ {project.endDate}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-0.5 pl-3">
                      <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                        총 {projectAllTimeAllocations.length}명
                      </span>
                      <span className="text-[10px] font-black text-blue-600 whitespace-nowrap">
                        현재 {projectTodayAllocations.length}명
                      </span>
                    </div>
                  </div>
                );
              })}
              {projects.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-10 font-bold">등록된 프로젝트가 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Card: Overall allocation status donut chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-md font-bold text-gray-800">프로젝트별 투입 인원 현황</h3>
              </div>
            </div>

            <div className="h-64 grid grid-cols-2 gap-4 relative">
              {/* Left: Total (All-time) Allocations of Active Projects */}
              <div className="relative w-full h-full flex flex-col justify-between items-center pb-2">
                <div className="flex-1 w-full relative">
                  {totalDonutChartData.length > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                      <span className="text-[9px] font-bold text-gray-400">총 투입</span>
                      <span className="text-sm font-black text-gray-900">{totalAllocatedPeopleAllTime}명</span>
                    </div>
                  )}
                  {totalDonutChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={totalDonutChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={56}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomizedLabel}
                        >
                          {totalDonutChartData.map((entry, index) => {
                            const pIndex = projects.findIndex(p => p.name === entry.name);
                            const color = pIndex !== -1 ? COLORS[pIndex % COLORS.length] : COLORS[index % COLORS.length];
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any, name: any) => {
                            const shortName = typeof name === 'string' 
                              ? name.split(/\s+/).filter(Boolean).slice(0, 2).join(' ') 
                              : name;
                            return [`${value}명`, shortName];
                          }}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-gray-400 font-bold">투입 없음</div>
                  )}
                </div>
                <div className="text-[11px] font-bold text-gray-500 whitespace-nowrap">총 투입 (누적)</div>
              </div>

              {/* Right: Today's Active Allocations of Active Projects */}
              <div className="relative w-full h-full flex flex-col justify-between items-center pb-2">
                <div className="flex-1 w-full relative">
                  {todayDonutChartData.length > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                      <span className="text-[9px] font-bold text-gray-400">오늘 기준</span>
                      <span className="text-sm font-black text-gray-900">{totalAllocatedPeople}명</span>
                    </div>
                  )}
                  {todayDonutChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={todayDonutChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={56}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomizedLabel}
                        >
                          {todayDonutChartData.map((entry, index) => {
                            const pIndex = projects.findIndex(p => p.name === entry.name);
                            const color = pIndex !== -1 ? COLORS[pIndex % COLORS.length] : COLORS[index % COLORS.length];
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any, name: any) => {
                            const shortName = typeof name === 'string' 
                              ? name.split(/\s+/).filter(Boolean).slice(0, 2).join(' ') 
                              : name;
                            return [`${value}명`, shortName];
                          }}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-gray-400 font-bold">투입 없음</div>
                  )}
                </div>
                <div className="text-[11px] font-bold text-gray-500 whitespace-nowrap">오늘 기준</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Occupation allocation vertical bar chart (직종별) */}
        <div className="hidden lg:flex bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex-col h-full justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-md font-bold text-gray-800">직종별 인원 투입 현황</h3>
              </div>
            </div>

            <div className="h-64 flex items-center justify-center">
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tickLine={false} 
                      axisLine={false} 
                      height={45}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const item = barChartData.find(d => d.name === payload.value);
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text 
                              x={0} 
                              y={0} 
                              dy={12} 
                              textAnchor="middle" 
                              fill="#64748b" 
                              className="text-xs font-bold"
                            >
                              {payload.value}
                            </text>
                            <text 
                              x={0} 
                              y={14} 
                              dy={12} 
                              textAnchor="middle" 
                              fill="#94a3b8" 
                              className="text-[10px] font-bold"
                            >
                              {item ? `${item.total}명` : '0명'}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis hide={true} />
                    <Tooltip 
                      formatter={(value: any, name: any) => [`${value}명`, name]}
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    {projects.map((project, idx) => {
                      const projectColor = project.color || COLORS[idx % COLORS.length];
                      return (
                        <Bar 
                          key={project.id} 
                          dataKey={project.id} 
                          name={project.name} 
                          stackId="a" 
                          fill={projectColor} 
                          maxBarSize={20} 
                        >
                          <LabelList 
                            dataKey={project.id} 
                            position="center" 
                            fill="#ffffff" 
                            style={{ fontSize: '10px', fontWeight: 'bold' }} 
                          />
                        </Bar>
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-gray-400 font-bold">직종별 데이터가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Cumulative Allocation Line Chart */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
        <div className="mb-4 flex flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-md font-bold text-gray-800">월별 투입 인력 현황</h3>
          </div>
          <div className="relative">
            <select
              value={selectedChartYear}
              onChange={(e) => setSelectedChartYear(Number(e.target.value))}
              className="appearance-none bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold pl-3 pr-8 py-1.5 rounded-lg border border-gray-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-all"
            >
              <option value={2026}>2026년</option>
              <option value={2027}>2027년</option>
              <option value={2028}>2028년</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
        <div className="h-72 w-full mt-2">
          {lineChartData && lineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={lineChartData} margin={{ top: 25, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="shortMonth" 
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const dataPoint = lineChartData[payload.index];
                    const isCurrent = dataPoint?.isCurrentMonth;
                    
                    return (
                      <g transform={`translate(${x},${y})`}>
                        {isCurrent && (
                          <rect
                            x={-28}
                            y={3}
                            width={56}
                            height={18}
                            rx={6}
                            fill="#eff6ff"
                            stroke="#bfdbfe"
                            strokeWidth={1.5}
                          />
                        )}
                        <text
                          x={0}
                          y={15}
                          textAnchor="middle"
                          fill={isCurrent ? '#2563eb' : '#64748b'}
                          style={{
                            fontSize: isCurrent ? '10px' : '9px',
                            fontWeight: isCurrent ? '900' : 'bold',
                          }}
                        >
                          {payload.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis 
                  hide={true}
                />
                <Tooltip 
                  formatter={(value: any, name: any) => {
                    if (value === 0) return [null, null];
                    return [`${value}명`, name];
                  }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelFormatter={(label, items) => {
                    if (items && items[0]) {
                      return items[0].payload.month;
                    }
                    return label;
                  }}
                />
                {activeProjects.map((project, idx) => {
                  const projectColor = project.color || COLORS[idx % COLORS.length];
                  return (
                    <Bar 
                      key={project.id}
                      dataKey={project.id} 
                      name={project.name}
                      stackId="projectStack"
                      fill={projectColor}
                      barSize={18}
                    />
                  );
                })}
                <Line 
                  type="monotone" 
                  dataKey="당월 투입" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  activeDot={{ r: 6 }}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload.isCurrentMonth) {
                      return (
                        <g key={`dot-${payload.month}`}>
                          {/* Pulsing ring */}
                          <circle cx={cx} cy={cy} r={10} fill="#2563eb" fillOpacity={0.15} />
                          <circle cx={cx} cy={cy} r={6} fill="#2563eb" stroke="#ffffff" strokeWidth={2.1} />
                        </g>
                      );
                    }
                    return (
                      <circle 
                        key={`dot-${payload.month}`} 
                        cx={cx} 
                        cy={cy} 
                        r={4.5} 
                        fill="#ffffff" 
                        stroke="#2563eb" 
                        strokeWidth={2.5} 
                      />
                    );
                  }}
                >
                  <LabelList 
                    dataKey="당월 투입" 
                    position="top" 
                    offset={12} 
                    style={{ fill: '#1e3a8a', fontSize: 10, fontWeight: 'black' }} 
                    formatter={(v: any) => v > 0 ? `${v}명` : ''} 
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-gray-400 font-bold">데이터가 없습니다.</div>
          )}
        </div>
      </div>

      {/* Filter and Gantt Timeline View */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Header and Filters */}
        <div className="p-5 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-start gap-3 w-full lg:w-auto">
            <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
              <h3 className="text-md font-bold text-gray-800">일정 및 투입 현황</h3>
              
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-200 shadow-sm"
              >
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>필터 {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
              </button>
            </div>
            
            <div className="inline-flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 self-start sm:self-auto">
              <button
                onClick={() => setActiveGanttTab('project')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeGanttTab === 'project'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                프로젝트별 현황
              </button>
              <button
                onClick={() => setActiveGanttTab('worker')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeGanttTab === 'worker'
                    ? 'bg-white text-teal-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                인원별 현황
              </button>
            </div>
          </div>

          <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-2.5 w-full lg:w-auto`}>
            {activeGanttTab === 'project' ? (
              <>
                {/* Status Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">진행상황 필터</span>
                  <select
                    value={ganttStatusFilter}
                    onChange={(e) => setGanttStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                  >
                    <option value="전체">전체 프로젝트</option>
                    <option value="진행">진행중</option>
                    <option value="완료">완료됨</option>
                    <option value="홀딩">홀딩됨</option>
                  </select>
                </div>

                {/* Project Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">현장 필터</span>
                  <select
                    value={selectedProjectFilter}
                    onChange={(e) => setSelectedProjectFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                  >
                    <option value="all">전체 현장</option>
                    {ganttProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Work Type Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">공종 필터</span>
                  <select
                    value={selectedWorkTypeFilter}
                    onChange={(e) => setSelectedWorkTypeFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    <option value="all">전체 공종</option>
                    {WORK_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Job Title Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">직종 필터</span>
                  <select
                    value={selectedJobTitleFilter}
                    onChange={(e) => setSelectedJobTitleFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    <option value="all">전체 직종</option>
                    {JOB_TITLES.map(title => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                {/* Status Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">진행상황 필터</span>
                  <select
                    value={workerStatusFilter}
                    onChange={(e) => setWorkerStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                  >
                    <option value="전체">전체 프로젝트</option>
                    <option value="진행">진행중</option>
                    <option value="완료">완료됨</option>
                    <option value="홀딩">홀딩됨</option>
                  </select>
                </div>

                {/* Project Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">현장 필터</span>
                  <select
                    value={workerProjectFilter}
                    onChange={(e) => setWorkerProjectFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                  >
                    <option value="all">전체 현장</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Work Type Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">공종 필터</span>
                  <select
                    value={workerWorkTypeFilter}
                    onChange={(e) => setWorkerWorkTypeFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    <option value="all">전체 공종</option>
                    {WORK_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Job Title Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">직종 필터</span>
                  <select
                    value={workerJobTitleFilter}
                    onChange={(e) => setWorkerJobTitleFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    <option value="all">전체 직종</option>
                    {JOB_TITLES.map(title => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>

                {/* Search Filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-400">성명 검색</span>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="성명 입력"
                      value={workerSearchQuery}
                      onChange={(e) => setWorkerSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-32 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {activeGanttTab === 'project' && (
          <div className="overflow-x-hidden md:overflow-x-auto overflow-y-auto max-h-[calc(100vh-240px)] min-h-[400px] border border-gray-200 rounded-2xl shadow-sm bg-white" ref={scrollContainerRef}>
          <div className="flex flex-col relative w-full">
            
            {/* Timeline Header Row */}
            <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-bold text-gray-500 min-w-full md:min-w-max sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              {/* Left Column Spacer */}
              <div className="w-full md:w-[320px] px-5 py-3 md:border-r border-gray-200 md:flex-shrink-0 flex items-center md:sticky md:left-0 z-40 bg-gray-50 shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.08)] md:shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.08)] text-gray-700">
                프로젝트 / 인력 정보 (공종 - 직종)
              </div>
              
              {/* Right Column Calendar Months */}
              <div 
                className="hidden md:flex flex-1 relative flex flex-col"
                style={{
                  width: `calc((100% - 320px) * ${TOTAL_MONTHS / 12})`,
                  minWidth: `${TOTAL_MONTHS * 80}px`
                }}
              >
                {/* Today Marker on Calendar Header */}
                <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-blue-500/10 border-l-2 border-blue-500/80 pointer-events-none z-30"
                  style={{ left: `${todayLeftPercent}%` }}
                >
                  <span className="absolute top-[4px] -translate-x-1/2 bg-blue-600 text-white text-[8px] tracking-wider font-black px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    오늘
                  </span>
                </div>

                {/* Year Level Header */}
                <div className="flex border-b border-gray-200/60 text-[10px] tracking-wider text-gray-500 font-extrabold uppercase bg-gray-100/50">
                  {yearsInMonths.map((y, idx) => (
                    <div 
                      key={y.year} 
                      className={`text-center py-1.5 flex items-center justify-center ${idx < yearsInMonths.length - 1 ? 'border-r border-gray-200/60' : ''}`}
                      style={{ flex: y.count }}
                    >
                      {y.year}년
                    </div>
                  ))}
                </div>
                
                {/* Month Level Header */}
                <div className="flex">
                  {MONTHS.map(m => (
                    <div key={`${m.year}-${m.num}`} className="flex-1 text-center py-2 border-r border-gray-200/60 last:border-r-0 text-xs font-bold text-gray-600">
                      {m.shortLabel}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline Rows container */}
            <div className="divide-y divide-gray-100 relative">
              {ganttProjects.map(project => {
                // If filtered by specific project and this isn't it, skip
                if (selectedProjectFilter !== 'all' && project.id !== selectedProjectFilter) return null;

                const projectAllocations = filteredAllocations.filter(a => a.projectId === project.id);
                const projectTodayAllocations = projectAllocations.filter(a => a.startDate <= todayStr && todayStr <= a.endDate);
                const isCollapsed = !!collapsedProjects[project.id];

                const pIndex = projects.findIndex(p => p.id === project.id);
                const projectColor = project.color || (pIndex !== -1 ? COLORS[pIndex % COLORS.length] : '#2563eb');

                return (
                  <React.Fragment key={project.id}>
                    {/* Project Header Group Row */}
                    <div className="flex bg-blue-50/25 text-xs font-bold text-blue-900 border-b border-gray-100 min-w-full md:min-w-max">
                      <div 
                        onClick={() => toggleProjectCollapse(project.id)}
                        className="w-full md:w-[320px] px-4 py-3 md:border-r border-gray-200/60 md:flex-shrink-0 flex items-center justify-between cursor-pointer hover:bg-blue-100/30 bg-blue-50/40 md:sticky md:left-0 z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] select-none group transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: projectColor }}
                          ></span>
                          <span className="truncate text-sm font-black text-blue-950 group-hover:text-blue-700">{project.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-blue-500 hover:text-blue-700 transition-colors">
                          <span className="text-[10px] font-medium text-blue-500/75">
                            ({projectAllocations.length}명)
                          </span>
                          {isCollapsed ? (
                            <ChevronRight size={15} />
                          ) : (
                            <ChevronDown size={15} />
                          )}
                        </div>
                      </div>
                      <div 
                        className="hidden md:flex flex-1 relative bg-blue-50/10"
                        style={{
                          width: `calc((100% - 320px) * ${TOTAL_MONTHS / 12})`,
                          minWidth: `${TOTAL_MONTHS * 80}px`
                        }}
                      >
                        {MONTHS.map(m => (
                          <div key={`${m.year}-${m.num}`} className="flex-1 border-r border-gray-200/20 last:border-r-0 h-full"></div>
                        ))}

                        {/* Today Marker Line */}
                        <div 
                          className="absolute top-0 bottom-0 w-[1px] border-l border-blue-500/40 border-dashed pointer-events-none z-10"
                          style={{ left: `${todayLeftPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Workers rows for this project */}
                    {!isCollapsed && projectAllocations.map(alloc => {
                      const barPos = getTimelineBarStyles(alloc.startDate, alloc.endDate);
                      
                      return (
                        <div key={alloc.id} className="flex text-xs text-gray-700 items-stretch hover:bg-gray-50/80 transition-colors min-w-full md:min-w-max">
                          {/* Worker Info Column */}
                          <div className="w-full md:w-[320px] pl-8 pr-4 py-3 md:border-r border-gray-200 md:flex-shrink-0 flex items-center justify-between bg-white md:sticky md:left-0 z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            {editingAllocId === alloc.id ? (
                              <div className="flex flex-col w-full bg-white gap-2 py-1.5">
                                <div className="flex items-center justify-between">
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="w-[120px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="성명"
                                  />
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => handleSaveEdit(alloc.id)}
                                      className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                      title="저장"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-all"
                                      title="취소"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <select
                                    value={editingWorkType}
                                    onChange={(e) => setEditingWorkType(e.target.value)}
                                    className="px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 focus:outline-none"
                                  >
                                    {WORK_TYPES.map(type => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={editingJobTitle}
                                    onChange={(e) => setEditingJobTitle(e.target.value)}
                                    className="px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 focus:outline-none"
                                  >
                                    {JOB_TITLES.map(title => (
                                      <option key={title} value={title}>{title}</option>
                                    ))}
                                  </select>
                                </div>
                                
                                {/* Periods List Editor */}
                                <div className="flex flex-col gap-1.5 mt-1 border-t border-gray-100 pt-1.5 max-h-[140px] overflow-y-auto">
                                  <span className="text-[10px] font-extrabold text-blue-600 flex justify-between items-center">
                                    <span>투입 기간 설정 ({editingPeriods.length}개)</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const lastPeriod = editingPeriods[editingPeriods.length - 1];
                                        let nextStart = '2026-01-01';
                                        let nextEnd = '2026-12-31';
                                        if (lastPeriod && lastPeriod.endDate) {
                                          const lastDate = new Date(lastPeriod.endDate);
                                          lastDate.setDate(lastDate.getDate() + 1);
                                          nextStart = lastDate.toISOString().split('T')[0];
                                          const endDateObj = new Date(lastDate);
                                          endDateObj.setMonth(endDateObj.getMonth() + 2);
                                          nextEnd = endDateObj.toISOString().split('T')[0];
                                        }
                                        setEditingPeriods([...editingPeriods, { startDate: nextStart, endDate: nextEnd }]);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 text-[10px] font-black flex items-center gap-0.5"
                                    >
                                      <Plus size={11} />
                                      <span>기간 추가</span>
                                    </button>
                                  </span>
                                  {editingPeriods.map((period, index) => (
                                    <div key={index} className="flex items-center gap-1 bg-gray-50/50 p-1 rounded border border-gray-100">
                                      <input
                                        type="date"
                                        value={period.startDate}
                                        onChange={(e) => {
                                          const updated = [...editingPeriods];
                                          updated[index].startDate = e.target.value;
                                          setEditingPeriods(updated);
                                        }}
                                        className="w-[42%] px-1 py-0.5 bg-white border border-gray-200 rounded-md text-[9px] font-bold text-gray-700 focus:outline-none"
                                      />
                                      <span className="text-gray-400 font-bold text-[9px]">~</span>
                                      <input
                                        type="date"
                                        value={period.endDate}
                                        onChange={(e) => {
                                          const updated = [...editingPeriods];
                                          updated[index].endDate = e.target.value;
                                          setEditingPeriods(updated);
                                        }}
                                        className="w-[42%] px-1 py-0.5 bg-white border border-gray-200 rounded-md text-[9px] font-bold text-gray-700 focus:outline-none"
                                      />
                                      {editingPeriods.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingPeriods(editingPeriods.filter((_, idx) => idx !== index));
                                          }}
                                          className="text-red-500 hover:text-red-700 p-0.5 ml-auto"
                                          title="기간 삭제"
                                        >
                                          <X size={12} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-col min-w-0 py-0.5">
                                  <div className="flex items-baseline gap-2">
                                    <span className="font-extrabold text-gray-900 text-sm whitespace-nowrap">{alloc.userName}</span>
                                    <span className="text-gray-400 font-semibold text-[10px]">
                                      {alloc.workType} · {alloc.jobTitle}
                                    </span>
                                  </div>
                                  {alloc.periods && alloc.periods.length > 1 ? (
                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                      {alloc.periods.map((p, idx) => (
                                        <span key={idx} className="text-gray-400 text-[10px] font-bold whitespace-nowrap">
                                          {p.startDate} ~ {p.endDate}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-[10px] font-bold mt-0.5">
                                      {alloc.startDate} ~ {alloc.endDate}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0 items-center">
                                  <button
                                    onClick={() => handleStartEdit(alloc)}
                                    className="p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="수정"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteWorker(alloc.id)}
                                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="삭제"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Gantt Bar Timeline */}
                          <div 
                            className="hidden md:flex flex-1 relative items-center min-h-[56px]"
                            style={{
                              width: `calc((100% - 320px) * ${TOTAL_MONTHS / 12})`,
                              minWidth: `${TOTAL_MONTHS * 80}px`
                            }}
                          >
                            {/* Background grid */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {MONTHS.map(m => (
                                <div key={`${m.year}-${m.num}`} className="flex-1 border-r border-gray-100 last:border-r-0 h-full"></div>
                              ))}
                            </div>

                            {/* Today Marker Line */}
                            <div 
                              className="absolute top-0 bottom-0 w-[1px] border-l border-blue-500/40 border-dashed pointer-events-none z-10"
                              style={{ left: `${todayLeftPercent}%` }}
                            />

                            {/* Timeline Bars */}
                            {alloc.periods && alloc.periods.length > 0 ? (
                              alloc.periods.map((period, idx) => {
                                const periodBarPos = getTimelineBarStyles(period.startDate, period.endDate);
                                return (
                                  <div
                                    key={idx}
                                    className="absolute h-6 rounded-lg flex items-center justify-between px-2.5 overflow-hidden text-[10px] font-bold pointer-events-auto"
                                    style={{
                                      ...periodBarPos,
                                      backgroundColor: `${projectColor}33`,
                                      color: projectColor
                                    }}
                                    title={`${alloc.userName} (${alloc.workType} - ${alloc.jobTitle}): ${period.startDate} ~ ${period.endDate}`}
                                  >
                                    <span className="truncate">{period.startDate}</span>
                                    <span className="truncate ml-1">{period.endDate}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <div
                                className="absolute h-6 rounded-lg flex items-center justify-between px-2.5 overflow-hidden text-[10px] font-bold pointer-events-auto"
                                style={{
                                  ...barPos,
                                  backgroundColor: `${projectColor}33`,
                                  color: projectColor
                                }}
                                title={`${alloc.userName} (${alloc.workType} - ${alloc.jobTitle}): ${alloc.startDate} ~ ${alloc.endDate}`}
                              >
                                <span className="truncate">{alloc.startDate}</span>
                                <span className="truncate ml-1">{alloc.endDate}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Inline worker creation form row for this project */}
                    {!isCollapsed && (
                      <div className="flex bg-gray-50/30 text-xs items-stretch border-t border-gray-100 min-w-full md:min-w-max">
                        {/* Form Controls / Trigger Column */}
                        {activeAddProjectId === project.id ? (
                          <div className="w-full md:w-[320px] pl-6 pr-4 py-3 md:border-r border-gray-200 md:flex-shrink-0 flex flex-col gap-2 justify-center bg-gray-50/40 md:sticky md:left-0 z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-white">
                            <div className="text-[10px] font-black text-blue-600 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Plus size={12} />
                                <span>신규 투입 인력 등록</span>
                              </span>
                              <button
                                onClick={() => setActiveAddProjectId(null)}
                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded px-1 py-0.5 text-[9px] font-bold"
                              >
                                취소
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1.5">
                              <input
                                type="text"
                                placeholder="성명"
                                value={newWorkerNames[project.id] || ''}
                                onChange={(e) => setNewWorkerNames(prev => ({ ...prev, [project.id]: e.target.value }))}
                                className="col-span-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <select
                                value={newWorkerWorkTypes[project.id] || '건축'}
                                onChange={(e) => setNewWorkerWorkTypes(prev => ({ ...prev, [project.id]: e.target.value }))}
                                className="px-1 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                title="공종"
                              >
                                {WORK_TYPES.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                              <select
                                value={newWorkerJobTitles[project.id] || '설계'}
                                onChange={(e) => setNewWorkerJobTitles(prev => ({ ...prev, [project.id]: e.target.value }))}
                                className="px-1 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                title="직종"
                              >
                                {JOB_TITLES.map(title => (
                                  <option key={title} value={title}>{title}</option>
                                ))}
                              </select>
                            </div>

                            {/* Period Inputs & Submit inline */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="flex items-center gap-1 flex-1">
                                <input
                                  type="date"
                                  value={newWorkerStartDates[project.id] || project.startDate || '2026-03-01'}
                                  onChange={(e) => setNewWorkerStartDates(prev => ({ ...prev, [project.id]: e.target.value }))}
                                  className="w-[45%] px-1 py-0.5 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                                />
                                <span className="text-gray-400 font-bold text-[10px]">~</span>
                                <input
                                  type="date"
                                  value={newWorkerEndDates[project.id] || project.endDate || '2026-11-30'}
                                  onChange={(e) => setNewWorkerEndDates(prev => ({ ...prev, [project.id]: e.target.value }))}
                                  className="w-[45%] px-1 py-0.5 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                                />
                              </div>
                              <button
                                onClick={() => handleAddWorker(project.id, project.name)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded-lg text-[10px] flex items-center gap-0.5 shadow-sm transition-all active:scale-95 hover:shadow"
                              >
                                <Plus size={11} />
                                <span>추가</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => {
                              setActiveAddProjectId(project.id);
                              if (!newWorkerStartDates[project.id]) {
                                setNewWorkerStartDates(prev => ({ ...prev, [project.id]: project.startDate || '2026-03-01' }));
                              }
                              if (!newWorkerEndDates[project.id]) {
                                setNewWorkerEndDates(prev => ({ ...prev, [project.id]: project.endDate || '2026-11-30' }));
                              }
                            }}
                            className="w-full md:w-[320px] pl-8 pr-4 py-3 md:border-r border-gray-200/60 md:flex-shrink-0 flex items-center gap-1.5 cursor-pointer text-gray-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all font-bold text-xs bg-gray-50/20 md:sticky md:left-0 z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-white"
                          >
                            <Plus size={14} className="text-gray-400" />
                            <span>신규 투입 인력 등록</span>
                          </div>
                        )}

                        {/* Right column showing the background calendar grid directly */}
                        <div 
                          className={`hidden md:flex flex-1 relative items-center ${activeAddProjectId === project.id ? 'min-h-[76px]' : 'min-h-[46px]'}`}
                          style={{
                            width: `calc((100% - 320px) * ${TOTAL_MONTHS / 12})`,
                            minWidth: `${TOTAL_MONTHS * 80}px`
                          }}
                        >
                          {/* Background grid */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {MONTHS.map(m => (
                              <div key={`${m.year}-${m.num}`} className="flex-1 border-r border-gray-100 last:border-r-0 h-full"></div>
                            ))}
                          </div>

                          {/* Today Marker Line */}
                          <div 
                            className="absolute top-0 bottom-0 w-[1px] border-l border-blue-500/40 border-dashed pointer-events-none z-10"
                            style={{ left: `${todayLeftPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {activeGanttTab === 'worker' && (
        <div className="overflow-x-hidden md:overflow-x-auto overflow-y-auto max-h-[calc(100vh-240px)] min-h-[400px] bg-white border border-gray-200 rounded-2xl shadow-sm" ref={workerScrollContainerRef}>
          <div className="flex flex-col relative w-full">
            
            {/* Timeline Header Row */}
            <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-bold text-gray-500 min-w-full md:min-w-max sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              {/* Left Column Spacer */}
              <div className="w-full md:w-[320px] px-5 py-3 md:border-r border-gray-200 md:flex-shrink-0 flex items-center md:sticky md:left-0 z-40 bg-gray-50 shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.08)] md:shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.08)] text-gray-700">
                인원 정보 (공종 - 직종) / 투입 프로젝트
              </div>
              
              {/* Right Column Calendar Months */}
              <div 
                className="hidden md:flex flex-1 relative flex flex-col"
                style={{
                  width: `calc((100% - 320px) * ${TOTAL_MONTHS / 12})`,
                  minWidth: `${TOTAL_MONTHS * 80}px`
                }}
              >
                {/* Today Marker on Calendar Header */}
                <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-blue-500/10 border-l-2 border-blue-500/80 pointer-events-none z-30"
                  style={{ left: `${todayLeftPercent}%` }}
                >
                  <span className="absolute top-[4px] -translate-x-1/2 bg-blue-600 text-white text-[8px] tracking-wider font-black px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    오늘
                  </span>
                </div>

                {/* Year Level Header */}
                <div className="flex border-b border-gray-200/60 text-[10px] tracking-wider text-gray-500 font-extrabold uppercase bg-gray-100/50">
                  {yearsInMonths.map((y, idx) => (
                    <div 
                      key={y.year} 
                      className={`text-center py-1.5 flex items-center justify-center ${idx < yearsInMonths.length - 1 ? 'border-r border-gray-200/60' : ''}`}
                      style={{ flex: y.count }}
                    >
                      {y.year}년
                    </div>
                  ))}
                </div>
                
                {/* Month Level Header */}
                <div className="flex">
                  {MONTHS.map(m => (
                    <div key={`${m.year}-${m.num}`} className="flex-1 text-center py-2 border-r border-gray-200/60 last:border-r-0 text-xs font-bold text-gray-600">
                      {m.shortLabel}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline Rows container */}
            <div className="divide-y divide-gray-100 relative">
              {filteredWorkerGanttData.map(worker => {
                const isCollapsed = !!collapsedWorkers[worker.userName];

                return (
                  <React.Fragment key={worker.userName}>
                    {/* Worker Header Group Row */}
                    <div className="flex bg-teal-50/25 text-xs font-bold text-teal-900 border-b border-gray-100 min-w-full md:min-w-max">
                      <div 
                        onClick={() => toggleWorkerCollapse(worker.userName)}
                        className="w-full md:w-[320px] px-4 py-3 md:border-r border-gray-200/60 md:flex-shrink-0 flex items-center justify-between cursor-pointer hover:bg-teal-100/30 bg-teal-50/40 md:sticky md:left-0 z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] select-none group transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-teal-500"></span>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm font-black text-teal-950 group-hover:text-teal-700">{worker.userName}</span>
                            <span className="text-[10px] font-semibold text-gray-400">
                              {worker.workType} · {worker.jobTitle}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-teal-500 hover:text-teal-700 transition-colors">
                          <span className="text-[10px] font-medium text-teal-500/75">
                            ({worker.allocations.length}개 현장)
                          </span>
                          {isCollapsed ? (
                            <ChevronRight size={15} />
                          ) : (
                            <ChevronDown size={15} />
                          )}
                        </div>
                      </div>
                      <div 
                        className="hidden md:flex flex-1 relative bg-teal-50/10"
                        style={{
                          width: `calc((100% - 320px) * ${TOTAL_MONTHS / 12})`,
                          minWidth: `${TOTAL_MONTHS * 80}px`
                        }}
                      >
                        {MONTHS.map(m => (
                          <div key={`${m.year}-${m.num}`} className="flex-1 border-r border-gray-200/20 last:border-r-0 h-full"></div>
                        ))}

                        {/* Today Marker Line */}
                        <div 
                          className="absolute top-0 bottom-0 w-[1px] border-l border-blue-500/40 border-dashed pointer-events-none z-10"
                          style={{ left: `${todayLeftPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Project Allocations rows for this worker */}
                    {!isCollapsed && worker.allocations.map(alloc => {
                      const barPos = getTimelineBarStyles(alloc.startDate, alloc.endDate);
                      const pIndex = projects.findIndex(p => p.id === alloc.projectId);
                      const projObj = projects[pIndex];
                      const projectColor = projObj?.color || (pIndex !== -1 ? COLORS[pIndex % COLORS.length] : '#14b8a6');

                      return (
                        <div key={alloc.id} className="flex text-xs text-gray-700 items-stretch hover:bg-gray-50/80 transition-colors min-w-full md:min-w-max">
                          {/* Project Column */}
                          <div className="w-full md:w-[320px] pl-8 pr-4 py-3 md:border-r border-gray-200 md:flex-shrink-0 flex items-center justify-between bg-white md:sticky md:left-0 z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            {editingAllocId === alloc.id ? (
                              <div className="flex flex-col w-full bg-white gap-2 py-1.5">
                                <div className="flex items-center justify-between">
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="w-[120px] px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="성명"
                                  />
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => handleSaveEdit(alloc.id)}
                                      className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                      title="저장"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-all"
                                      title="취소"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <select
                                    value={editingWorkType}
                                    onChange={(e) => setEditingWorkType(e.target.value)}
                                    className="px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 focus:outline-none"
                                  >
                                    {WORK_TYPES.map(type => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={editingJobTitle}
                                    onChange={(e) => setEditingJobTitle(e.target.value)}
                                    className="px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 focus:outline-none"
                                  >
                                    {JOB_TITLES.map(title => (
                                      <option key={title} value={title}>{title}</option>
                                    ))}
                                  </select>
                                </div>
                                
                                {/* Periods List Editor */}
                                <div className="flex flex-col gap-1.5 mt-1 border-t border-gray-100 pt-1.5 max-h-[140px] overflow-y-auto">
                                  <span className="text-[10px] font-extrabold text-blue-600 flex justify-between items-center">
                                    <span>투입 기간 설정 ({editingPeriods.length}개)</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const lastPeriod = editingPeriods[editingPeriods.length - 1];
                                        let nextStart = '2026-01-01';
                                        let nextEnd = '2026-12-31';
                                        if (lastPeriod && lastPeriod.endDate) {
                                          const lastDate = new Date(lastPeriod.endDate);
                                          lastDate.setDate(lastDate.getDate() + 1);
                                          nextStart = lastDate.toISOString().split('T')[0];
                                          const endDateObj = new Date(lastDate);
                                          endDateObj.setMonth(endDateObj.getMonth() + 2);
                                          nextEnd = endDateObj.toISOString().split('T')[0];
                                        }
                                        setEditingPeriods([...editingPeriods, { startDate: nextStart, endDate: nextEnd }]);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 text-[10px] font-black flex items-center gap-0.5"
                                    >
                                      <Plus size={11} />
                                      <span>기간 추가</span>
                                    </button>
                                  </span>
                                  {editingPeriods.map((period, index) => (
                                    <div key={index} className="flex items-center gap-1 bg-gray-50/50 p-1 rounded border border-gray-100">
                                      <input
                                        type="date"
                                        value={period.startDate}
                                        onChange={(e) => {
                                          const updated = [...editingPeriods];
                                          updated[index].startDate = e.target.value;
                                          setEditingPeriods(updated);
                                        }}
                                        className="w-[42%] px-1 py-0.5 bg-white border border-gray-200 rounded-md text-[9px] font-bold text-gray-700 focus:outline-none"
                                      />
                                      <span className="text-gray-400 font-bold text-[9px]">~</span>
                                      <input
                                        type="date"
                                        value={period.endDate}
                                        onChange={(e) => {
                                          const updated = [...editingPeriods];
                                          updated[index].endDate = e.target.value;
                                          setEditingPeriods(updated);
                                        }}
                                        className="w-[42%] px-1 py-0.5 bg-white border border-gray-200 rounded-md text-[9px] font-bold text-gray-700 focus:outline-none"
                                      />
                                      {editingPeriods.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingPeriods(editingPeriods.filter((_, idx) => idx !== index));
                                          }}
                                          className="text-red-500 hover:text-red-700 p-0.5 ml-auto"
                                          title="기간 삭제"
                                        >
                                          <X size={12} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-col min-w-0 py-0.5">
                                  <div className="flex items-baseline gap-2">
                                    <span className="font-extrabold text-gray-900 text-sm truncate">{alloc.projectName}</span>
                                    <span className="text-gray-400 font-semibold text-[10px]">
                                      {alloc.workType} · {alloc.jobTitle}
                                    </span>
                                  </div>
                                  {alloc.periods && alloc.periods.length > 1 ? (
                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                      {alloc.periods.map((p, idx) => (
                                        <span key={idx} className="text-gray-400 text-[10px] font-bold whitespace-nowrap">
                                          {p.startDate} ~ {p.endDate}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-[10px] font-bold mt-0.5">
                                      {alloc.startDate} ~ {alloc.endDate}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0 items-center">
                                  <button
                                    onClick={() => handleStartEdit(alloc)}
                                    className="p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="수정"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteWorker(alloc.id)}
                                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="삭제"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Gantt Bar Timeline */}
                          <div 
                            className="hidden md:flex flex-1 relative items-center min-h-[56px]"
                            style={{
                              width: `calc((100% - 320px) * ${TOTAL_MONTHS / 12})`,
                              minWidth: `${TOTAL_MONTHS * 80}px`
                            }}
                          >
                            {/* Background grid */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {MONTHS.map(m => (
                                <div key={`${m.year}-${m.num}`} className="flex-1 border-r border-gray-100 last:border-r-0 h-full"></div>
                              ))}
                            </div>

                            {/* Today Marker Line */}
                            <div 
                              className="absolute top-0 bottom-0 w-[1px] border-l border-blue-500/40 border-dashed pointer-events-none z-10"
                              style={{ left: `${todayLeftPercent}%` }}
                            />

                            {/* Timeline Bars */}
                            {alloc.periods && alloc.periods.length > 0 ? (
                              alloc.periods.map((period, idx) => {
                                const periodBarPos = getTimelineBarStyles(period.startDate, period.endDate);
                                return (
                                  <div
                                    key={idx}
                                    className="absolute h-6 rounded-lg flex items-center justify-between px-2.5 overflow-hidden text-[10px] font-bold pointer-events-auto"
                                    style={{
                                      ...periodBarPos,
                                      backgroundColor: `${projectColor}33`,
                                      color: projectColor
                                    }}
                                    title={`${alloc.userName} - [${alloc.projectName}] (${alloc.workType} - ${alloc.jobTitle}): ${period.startDate} ~ ${period.endDate}`}
                                  >
                                    <span className="truncate">{period.startDate}</span>
                                    <span className="truncate ml-1">{period.endDate}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <div
                                className="absolute h-6 rounded-lg flex items-center justify-between px-2.5 overflow-hidden text-[10px] font-bold pointer-events-auto"
                                style={{
                                  ...barPos,
                                  backgroundColor: `${projectColor}33`,
                                  color: projectColor
                                }}
                                title={`${alloc.userName} - [${alloc.projectName}] (${alloc.workType} - ${alloc.jobTitle}): ${alloc.startDate} ~ ${alloc.endDate}`}
                              >
                                <span className="truncate">{alloc.startDate}</span>
                                <span className="truncate ml-1">{alloc.endDate}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>

          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setAllocIdToDelete(null);
        }}
        onConfirm={confirmDeleteWorker}
        title="투입 인력 삭제"
        message="선택하신 투입 인력을 목록에서 영구히 삭제하시겠습니까?"
        confirmText="삭제"
        cancelText="취소"
        type="danger"
      />
    </div>
  </div>
  );
};
