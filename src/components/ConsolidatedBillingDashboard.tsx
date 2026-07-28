import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Search,
  Download,
  Filter,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  PieChart as PieIcon,
  ShieldCheck,
  ArrowUpRight,
  BarChart3,
  Layers,
  Building,
  ArrowDownRight,
  Calculator,
  Percent,
  Briefcase,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ExcelJS from 'exceljs';
import { Project, User, ClientContract } from '../types';
import { supabaseService } from '../services/supabaseService';

const normalizeDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const clean = String(dateStr).trim().replace(/\s+/g, '');
  const match = clean.match(/^(\d{4})[./-]?(\d{1,2})[./-]?(\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
};

interface ConsolidatedBillingDashboardProps {
  projects: Project[];
  currentUser: User | null;
  onSelectProject: (
    projectId: string,
    initialMenu?: 'dashboard' | 'schedule' | 'documents' | 'drawings' | 'photo-gallery' | 'quick-memo' | 'ai-diagnosis' | 'billing'
  ) => void;
  selectedStatuses?: ('준비' | '진행' | '완료' | '홀딩')[];
  onSelectedStatusesChange?: (statuses: ('준비' | '진행' | '완료' | '홀딩')[]) => void;
}

// Simple deterministic hash for consistent mock numbers per project
const getProjectHash = (id: any) => {
  const strId = String(id || '');
  let hash = 0;
  for (let i = 0; i < strId.length; i++) {
    hash = (hash << 5) - hash + strId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

// KRW Currency Formatter
const formatKRW = (num: number) => {
  if (isNaN(num) || num === 0) return '0 원';
  if (Math.abs(num) >= 100000000) {
    return `${(num / 100000000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })} 억원`;
  }
  if (Math.abs(num) >= 10000) {
    return `${(num / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 만원`;
  }
  return `${num.toLocaleString('ko-KR')} 원`;
};

const formatNumber = (num: number) => {
  return (num || 0).toLocaleString('ko-KR');
};

const DISCIPLINE_COLORS: Record<string, string> = {
  '건축': '#3b82f6',
  '토목': '#10b981',
  '전기': '#f59e0b',
  '기계': '#ec4899',
  '통신': '#8b5cf6',
  '소방': '#ef4444',
  '조경': '#14b8a6',
  '기타': '#64748b',
};

const DEFAULT_SUBCONTRACTS = [
  {
    id: 'subc-1',
    contractorName: '(주)삼우토건',
    businessRegNo: '120-81-45678',
    representative: '박토목',
    contactPerson: '최팀장',
    contactPhone: '010-2345-6789',
    discipline: '토목',
    contractDate: '2025-03-15',
    startDate: '2025-04-01',
    endDate: '2026-08-31',
    initialAmount: 1800000000,
    amendedAmount: 1900000000,
    currentAmount: 1900000000,
    advancePayment: 190000000,
    warrantyBondRate: 5,
    performanceBondRate: 10,
    retentionRate: 5,
    paymentTerms: '익월 25일 현금 지급',
    paymentDueDate: '2026-07-25',
    laborCostType: '직접노무비',
    directPaymentStatus: false,
    bondExpirationDate: '2026-09-30',
    status: '계약체결'
  },
  {
    id: 'subc-2',
    contractorName: '(주)한남건설골조',
    businessRegNo: '214-88-99012',
    representative: '이골조',
    contactPerson: '정이사',
    contactPhone: '010-3456-7890',
    discipline: '건축',
    contractDate: '2025-04-10',
    startDate: '2025-05-01',
    endDate: '2026-12-31',
    initialAmount: 22000000000,
    amendedAmount: 23500000000,
    currentAmount: 23500000000,
    advancePayment: 2350000000,
    warrantyBondRate: 5,
    performanceBondRate: 10,
    retentionRate: 5,
    paymentTerms: '익월 30일 현금/어음 50:50',
    paymentDueDate: '2026-07-30',
    laborCostType: '직접노무비',
    directPaymentStatus: true,
    bondExpirationDate: '2027-01-31',
    status: '계약체결'
  },
  {
    id: 'subc-3',
    contractorName: '(주)대성전력',
    businessRegNo: '105-86-12345',
    representative: '김전기',
    contactPerson: '강부장',
    contactPhone: '010-4567-8901',
    discipline: '전기',
    contractDate: '2025-05-20',
    startDate: '2025-06-01',
    endDate: '2027-02-28',
    initialAmount: 3200000000,
    amendedAmount: 3200000000,
    currentAmount: 3200000000,
    advancePayment: 320000000,
    warrantyBondRate: 5,
    performanceBondRate: 10,
    retentionRate: 5,
    paymentTerms: '익월 25일 현금 지급',
    paymentDueDate: '2026-07-25',
    laborCostType: '간접노무비',
    directPaymentStatus: false,
    bondExpirationDate: '2027-03-31',
    status: '계약체결'
  },
  {
    id: 'subc-4',
    contractorName: '(주)태양설비',
    businessRegNo: '119-81-33445',
    representative: '윤기계',
    contactPerson: '송차장',
    contactPhone: '010-5678-9012',
    discipline: '기계',
    contractDate: '2025-05-25',
    startDate: '2025-06-01',
    endDate: '2027-02-28',
    initialAmount: 4100000000,
    amendedAmount: 4100000000,
    currentAmount: 4100000000,
    advancePayment: 410000000,
    warrantyBondRate: 5,
    performanceBondRate: 10,
    retentionRate: 5,
    paymentTerms: '익월 25일 현금 지급',
    paymentDueDate: '2026-07-25',
    laborCostType: '직접노무비',
    directPaymentStatus: false,
    bondExpirationDate: '2027-03-31',
    status: '계약체결'
  }
];

const DEFAULT_SUBBILLINGS = [
  {
    id: 'subb-1',
    subcontractorContractId: 'subc-1',
    subcontractorName: '(주)삼우토건',
    discipline: '토목',
    billingRound: 3,
    prevCumulativeAmt: 1530000000,
    currentClaimAmt: 200000000,
    fieldReviewedAmt: 180000000,
    finalApprovedAmt: 180000000,
    cumulativeApprovedAmt: 1710000000,
    unpaidAmt: 20000000
  },
  {
    id: 'subb-2',
    subcontractorContractId: 'subc-2',
    subcontractorName: '(주)한남건설골조',
    discipline: '건축',
    billingRound: 3,
    prevCumulativeAmt: 11000000000,
    currentClaimAmt: 3800000000,
    fieldReviewedAmt: 3500000000,
    finalApprovedAmt: 3500000000,
    cumulativeApprovedAmt: 14500000000,
    unpaidAmt: 1975000000
  },
  {
    id: 'subb-3',
    subcontractorContractId: 'subc-3',
    subcontractorName: '(주)대성전력',
    discipline: '전기',
    billingRound: 3,
    prevCumulativeAmt: 1000000000,
    currentClaimAmt: 600000000,
    fieldReviewedAmt: 500000000,
    finalApprovedAmt: 500000000,
    cumulativeApprovedAmt: 1500000000,
    unpaidAmt: 425000000
  }
];

const DEFAULT_CLIENT_BILLINGS = [
  {
    id: 'cb-1',
    billingRound: 1,
    referenceDate: '2026-04-30',
    targetPeriodEnd: '2026-04-30',
    actualCollectionDate: '2026-05-28',
    currentClaimAmt: 1200000000,
    cumulativeBillingAmt: 1200000000,
    collectedAmt: 1020000000,
    netClaimAmt: 1020000000,
    status: '완료'
  },
  {
    id: 'cb-2',
    billingRound: 2,
    referenceDate: '2026-05-31',
    targetPeriodEnd: '2026-05-31',
    actualCollectionDate: '2026-06-29',
    currentClaimAmt: 1500000000,
    cumulativeBillingAmt: 2700000000,
    collectedAmt: 1275000000,
    netClaimAmt: 1275000000,
    status: '완료'
  },
  {
    id: 'cb-3',
    billingRound: 3,
    referenceDate: '2026-06-30',
    targetPeriodEnd: '2026-06-30',
    actualCollectionDate: undefined,
    currentClaimAmt: 1000000000,
    cumulativeBillingAmt: 3700000000,
    collectedAmt: 350000000,
    netClaimAmt: 850000000,
    receivableAmt: 500000000,
    status: '수금대기'
  }
];

const DEFAULT_SUB_BILLINGS_WITH_DATES = [
  {
    id: 'subb-1',
    subcontractorContractId: 'subc-1',
    billingRound: 3,
    referenceDate: '2026-06-30',
    currentClaimAmt: 200000000,
    finalApprovedAmt: 180000000,
    cumulativeApprovedAmt: 1710000000
  },
  {
    id: 'subb-2',
    subcontractorContractId: 'subc-2',
    billingRound: 3,
    referenceDate: '2026-06-30',
    currentClaimAmt: 3800000000,
    finalApprovedAmt: 3500000000,
    cumulativeApprovedAmt: 14500000000
  },
  {
    id: 'subb-3',
    subcontractorContractId: 'subc-3',
    billingRound: 3,
    referenceDate: '2026-06-30',
    currentClaimAmt: 600000000,
    finalApprovedAmt: 500000000,
    cumulativeApprovedAmt: 1500000000
  }
];

export const ConsolidatedBillingDashboard: React.FC<ConsolidatedBillingDashboardProps> = ({
  projects = [],
  currentUser,
  onSelectProject,
  selectedStatuses: externalSelectedStatuses,
  onSelectedStatusesChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [internalSelectedStatuses, setInternalSelectedStatuses] = useState<('준비' | '진행' | '완료' | '홀딩')[]>(['진행']);

  const selectedStatuses = externalSelectedStatuses !== undefined ? externalSelectedStatuses : internalSelectedStatuses;
  const setSelectedStatuses = onSelectedStatusesChange || setInternalSelectedStatuses;
  const [sortBy, setSortBy] = useState<'registered' | 'budget' | 'billingRate' | 'subRate' | 'name'>('registered');
  const [activeChartTab, setActiveChartTab] = useState<'billing' | 'rates' | 'discipline' | 'monthly'>('billing');
  const [trendYear, setTrendYear] = useState<string>('2026');
  const [supabaseBillingMap, setSupabaseBillingMap] = useState<Record<string, any>>({});

  // Fetch billing data from Supabase for all projects
  React.useEffect(() => {
    if (!Array.isArray(projects) || projects.length === 0) return;
    let isMounted = true;
    const loadAllBillingData = async () => {
      const map: Record<string, any> = {};
      await Promise.all(
        projects.map(async (p) => {
          if (!p?.id || p.name === '본사 사업 관리' || p.name?.includes('본사 사업 관리')) return;
          try {
            const data = await supabaseService.getBillingData(p.id);
            if (data && Object.keys(data).length > 0) {
              map[p.id] = data;
            }
          } catch (e) {
            // fallback
          }
        })
      );
      if (isMounted) {
        setSupabaseBillingMap(map);
      }
    };
    loadAllBillingData();
    return () => { isMounted = false; };
  }, [projects]);

  // Compute multi-project dataset (exclude HQ Management project '본사 사업 관리')
  const projectSummaries = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return projects
      .filter((p): p is Project => !!p && p.name !== '본사 사업 관리' && !p.name.includes('본사 사업 관리'))
      .map((p, idx) => {
        const hash = getProjectHash(p.id);

        const supabaseData = supabaseBillingMap[p.id];
        let storedClientContract = supabaseData?.clientContract || null;
        let storedClientBillings = supabaseData?.clientBillings || null;
        let storedSubContracts = supabaseData?.subContracts || null;
        let storedSubBillings = supabaseData?.subBillings || null;

        const hasSavedData = Boolean(supabaseData) || Boolean(localStorage.getItem(`cp_billing_data_${p.id}`));

        if (!hasSavedData) {
          try {
            const saved = localStorage.getItem(`cp_billing_data_${p.id}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              storedClientContract = parsed.clientContract || null;
              storedClientBillings = parsed.clientBillings || null;
              storedSubContracts = parsed.subContracts || null;
              storedSubBillings = parsed.subBillings || null;
            }
          } catch (e) {
            // Fallback
          }
        }

        // Base Contract Amount (Check unit: if < 100000, it's in 억 원 unit, convert to KRW)
        let rawContractAmt = 0;
        if (storedClientContract && typeof storedClientContract.currentAmount === 'number' && storedClientContract.currentAmount > 0) {
          rawContractAmt = storedClientContract.currentAmount;
        } else if (p.totalBudget && p.totalBudget > 0) {
          rawContractAmt = p.totalBudget;
        }

        let clientContractAmt = 0;
        if (rawContractAmt > 0) {
          clientContractAmt = rawContractAmt < 100000 ? rawContractAmt * 100000000 : rawContractAmt;
        } else {
          clientContractAmt = (p.id === 'pjt-1' || p.id === 'p-1') ? 13500000000 : 0;
        }

        // Cumulative Billing & Collection
        let cumulativeBilling = 0;
        let collectedAmt = 0;
        let receivableAmt = 0;

        if (Array.isArray(storedClientBillings)) {
          if (storedClientBillings.length > 0) {
            cumulativeBilling = storedClientBillings.reduce((max: number, b: any) => {
              const amt = Number(b.cumulativeBillingAmt || b.currentClaimAmt || 0);
              return Math.max(max, amt);
            }, 0);
            collectedAmt = storedClientBillings.reduce((sum: number, b: any) => sum + Number(b.collectedAmt || 0), 0);
            receivableAmt = Math.max(0, cumulativeBilling - collectedAmt);
          } else {
            // Explicitly empty billings array -> 0
            cumulativeBilling = 0;
            collectedAmt = 0;
            receivableAmt = 0;
          }
        } else {
          if (p.id === 'pjt-1' || p.id === 'p-1') {
            cumulativeBilling = 3700000000;
            collectedAmt = 2650000000;
            receivableAmt = 1050000000;
          } else {
            cumulativeBilling = 0;
            collectedAmt = 0;
            receivableAmt = 0;
          }
        }

        const clientBillingRate = clientContractAmt > 0 ? (cumulativeBilling / clientContractAmt) * 100 : 0;

        // Subcontractor Amounts
        let actualSubContracts: any[] = [];
        if (Array.isArray(storedSubContracts)) {
          actualSubContracts = storedSubContracts;
        } else if (p.id === 'pjt-1' || p.id === 'p-1') {
          actualSubContracts = DEFAULT_SUBCONTRACTS;
        } else {
          actualSubContracts = [];
        }

        let actualSubBillings: any[] = [];
        if (Array.isArray(storedSubBillings)) {
          actualSubBillings = storedSubBillings;
        } else if (p.id === 'pjt-1' || p.id === 'p-1') {
          actualSubBillings = DEFAULT_SUBBILLINGS;
        } else {
          actualSubBillings = [];
        }

        // Filter subBillings so only billings matching an actual registered subContract are counted!
        const validContractorKeys = new Set(
          actualSubContracts.flatMap((sc: any) => [sc.id, sc.contractorName]).filter(Boolean)
        );

        const validSubBillings = actualSubBillings.filter((sb: any) =>
          validContractorKeys.has(sb.subcontractorContractId) || validContractorKeys.has(sb.subcontractorName)
        );

        const subContractAmt = actualSubContracts.reduce((sum: number, sc: any) => sum + Number(sc.currentAmount || 0), 0);
        const subExecutedAmt = validSubBillings.reduce((sum: number, sb: any) => sum + Number(sb.finalApprovedAmt || 0), 0);
        const subClaimedAmt = validSubBillings.reduce((sum: number, sb: any) => sum + Number(sb.currentClaimAmt || sb.finalApprovedAmt || 0), 0);

        const subExecutionRate = subContractAmt > 0 ? (subExecutedAmt / subContractAmt) * 100 : 0;

        // Expected Profit & Margin
        const profitMargin = 11.5 + (hash % 7);
        const expectedProfit = Math.round(clientContractAmt * (profitMargin / 100));

        // Over-spending Risk Flag
        const isOverBudgetRisk = subExecutionRate > clientBillingRate + 8 && subContractAmt > 0;

        const subContractorsCount = actualSubContracts.length;

        const defaultContract: ClientContract = (p.id === 'pjt-1' || p.id === 'p-1') ? {
          id: 'cc-01',
          projectId: p.id,
          contractDate: '2025-01-15',
          constructionStartDate: '2025-02-01',
          constructionEndDate: '2027-12-31',
          initialAmount: 10000000000,
          amendedAmount: 13500000000,
          currentAmount: 13500000000,
          amendmentRound: 1,
          changeAmount: 3500000000,
          changeReason: '지상층 골조 사양 변경 및 지하 증축에 따른 설계 변경',
          advancePayment: 1000000000,
          retentionMoney: 675000000,
          performanceBond: 1350000000,
          designChangeAmount: 2500000000,
          priceFluctuationAmount: 700000000,
          extraWorkAmount: 300000000,
          contractBalance: 11143000000,
          status: '승인',
          attachments: ['도급계약서_1차변경.pdf', '설계변경승인서.pdf'],
          history: [
            { id: 'cch-1', round: 1, contractDate: '2026-02-15', constructionStartDate: '2025-02-01', constructionEndDate: '2027-12-31', changeAmount: 3500000000, contractAmountAfter: 13500000000, reason: '지하층 지하수위 대응 강화 및 지상층 설계변경', approvedBy: '발주처 관리자' }
          ]
        } : {
          id: `cc-${p.id}`,
          projectId: p.id,
          contractDate: p.startDate ? normalizeDate(p.startDate) || '2026-01-15' : '2026-01-15',
          constructionStartDate: p.startDate ? normalizeDate(p.startDate) || '2026-01-15' : '2026-01-15',
          constructionEndDate: p.endDate ? normalizeDate(p.endDate) || '2027-12-31' : '2027-12-31',
          initialAmount: clientContractAmt,
          amendedAmount: clientContractAmt,
          currentAmount: clientContractAmt,
          amendmentRound: 0,
          changeAmount: 0,
          changeReason: '최초 계약',
          advancePayment: Math.round(clientContractAmt * 0.1),
          retentionMoney: Math.round(clientContractAmt * 0.05),
          performanceBond: Math.round(clientContractAmt * 0.1),
          designChangeAmount: 0,
          priceFluctuationAmount: 0,
          extraWorkAmount: 0,
          contractBalance: clientContractAmt - collectedAmt,
          status: '승인',
          history: []
        };

        const effectiveClientContract: ClientContract = storedClientContract ? {
          ...storedClientContract,
          contractDate: storedClientContract.contractDate || (p.startDate ? normalizeDate(p.startDate) : defaultContract.contractDate),
          constructionStartDate: storedClientContract.constructionStartDate || (p.startDate ? normalizeDate(p.startDate) : defaultContract.constructionStartDate),
          constructionEndDate: storedClientContract.constructionEndDate || (p.endDate ? normalizeDate(p.endDate) : defaultContract.constructionEndDate),
          initialAmount: (storedClientContract.initialAmount && storedClientContract.initialAmount > 0)
            ? storedClientContract.initialAmount
            : (storedClientContract.currentAmount || clientContractAmt)
        } : defaultContract;

        const rawStatus = String(p.status || '진행').trim().toLowerCase();
        let normalizedStatus: '준비' | '진행' | '완료' | '홀딩' = '진행';
        if (rawStatus.includes('준비') || rawStatus.includes('계획') || rawStatus.includes('예정') || rawStatus.includes('대기')) {
          normalizedStatus = '준비';
        } else if (rawStatus.includes('완료') || rawStatus.includes('준공')) {
          normalizedStatus = '완료';
        } else if (rawStatus.includes('홀딩') || rawStatus.includes('보류') || rawStatus.includes('중단')) {
          normalizedStatus = '홀딩';
        } else {
          normalizedStatus = '진행';
        }

        return {
          id: p.id,
          name: p.name,
          code: p.projectCode || `PRJ-${String(idx + 1).padStart(3, '0')}`,
          status: normalizedStatus,
          imageUrl: p.imageUrl,
          location: p.location || '위치 미정',
          startDate: p.startDate || '2025.03.01',
          endDate: p.endDate || '2027.08.31',
          clientContractAmt,
          cumulativeBilling,
          collectedAmt,
          receivableAmt,
          clientBillingRate,
          subContractAmt,
          subExecutedAmt,
          subExecutionRate,
          subClaimedAmt,
          profitMargin,
          expectedProfit,
          isOverBudgetRisk,
          subContractorsCount,
          createdAt: p.createdAt || '',
          originalIndex: idx,
          clientContract: effectiveClientContract,
          clientBillings: storedClientBillings || (p.id === 'pjt-1' || p.id === 'p-1' ? DEFAULT_CLIENT_BILLINGS : []),
          subContracts: actualSubContracts,
          subBillings: validSubBillings
        };
      });
  }, [projects, supabaseBillingMap]);

  const availableYears = useMemo(() => {
    const extractYear = (dateStr: string | undefined | null, defaultYear: number): number => {
      if (!dateStr) return defaultYear;
      const match = dateStr.match(/^(\d{4})/);
      if (match) {
        return parseInt(match[1], 10);
      }
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getFullYear())) {
        return parsed.getFullYear();
      }
      return defaultYear;
    };

    let minYear = 2026;
    let maxYear = 2026;

    projectSummaries.forEach(p => {
      const startY = extractYear(p.startDate, 2026);
      const endY = extractYear(p.endDate, 2026);
      if (startY < minYear) minYear = startY;
      if (endY > maxYear) maxYear = endY;
    });

    const years: string[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      years.push(String(y));
    }
    return years.length > 0 ? years : ['2026'];
  }, [projectSummaries]);

  React.useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(trendYear)) {
      setTrendYear(availableYears[0]);
    }
  }, [availableYears, trendYear]);

  // Filter and Sort
  const filteredProjects = useMemo(() => {
    return projectSummaries
      .filter(p => {
        const sTerm = searchTerm.trim().toLowerCase();
        const matchSearch = !sTerm ||
          (p.name && p.name.toLowerCase().includes(sTerm)) ||
          (p.code && p.code.toLowerCase().includes(sTerm)) ||
          (p.location && p.location.toLowerCase().includes(sTerm));
        const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(p.status as any);
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'registered') {
          const dateA = a.createdAt || a.startDate || '';
          const dateB = b.createdAt || b.startDate || '';
          if (dateA && dateB && dateA !== dateB) {
            return dateB.localeCompare(dateA);
          }
          return b.originalIndex - a.originalIndex;
        }
        if (sortBy === 'budget') return b.clientContractAmt - a.clientContractAmt;
        if (sortBy === 'billingRate') return b.clientBillingRate - a.clientBillingRate;
        if (sortBy === 'subRate') return b.subExecutionRate - a.subExecutionRate;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [projectSummaries, searchTerm, selectedStatuses, sortBy]);

  // Global Aggregated KPIs
  const totalStats = useMemo(() => {
    const totalContract = projectSummaries.reduce((sum, p) => sum + p.clientContractAmt, 0);
    const totalBilling = projectSummaries.reduce((sum, p) => sum + p.cumulativeBilling, 0);
    const totalCollected = projectSummaries.reduce((sum, p) => sum + p.collectedAmt, 0);
    const totalReceivable = projectSummaries.reduce((sum, p) => sum + p.receivableAmt, 0);
    const totalSubContract = projectSummaries.reduce((sum, p) => sum + p.subContractAmt, 0);
    const totalSubExecuted = projectSummaries.reduce((sum, p) => sum + p.subExecutedAmt, 0);
    const totalSubClaimed = projectSummaries.reduce((sum, p) => sum + (p.subClaimedAmt || 0), 0);
    const totalProfit = projectSummaries.reduce((sum, p) => sum + p.expectedProfit, 0);
    const totalSubContractorsCount = projectSummaries.reduce((sum, p) => sum + (p.subContractorsCount || 0), 0);

    const avgBillingRate = totalContract > 0 ? (totalBilling / totalContract) * 100 : 0;
    const avgSubRate = totalSubContract > 0 ? (totalSubExecuted / totalSubContract) * 100 : 0;
    const avgCollectionRate = totalBilling > 0 ? (totalCollected / totalBilling) * 100 : 0;
    const subRatioToContract = totalContract > 0 ? (totalSubContract / totalContract) * 100 : 0;
    const riskProjectsCount = projectSummaries.filter(p => p.isOverBudgetRisk).length;

    return {
      totalContract,
      totalBilling,
      totalCollected,
      totalReceivable,
      totalSubContract,
      totalSubExecuted,
      totalSubClaimed,
      totalProfit,
      avgBillingRate,
      avgSubRate,
      avgCollectionRate,
      subRatioToContract,
      riskProjectsCount,
      totalProjectsCount: projectSummaries.length,
      activeProjectsCount: projectSummaries.filter(p => p.status === '진행').length,
      totalSubContractorsCount
    };
  }, [projectSummaries]);

  // Chart Dataset 1: Project Comparison (Top 8 projects by contract)
  const chartProjectData = useMemo(() => {
    return filteredProjects.slice(0, 8).map(p => {
      const subContractVal100M = Math.round(p.subContractAmt / 100000000);
      const subExecutedVal100M = Math.round(p.subExecutedAmt / 100000000);
      const subClaimedVal = p.subClaimedAmt || 0;
      const subPendingVal100M = Math.round(Math.max(0, subClaimedVal - p.subExecutedAmt) / 100000000);
      const subRemainingVal100M = Math.max(0, subContractVal100M - Math.max(subExecutedVal100M, Math.round(subClaimedVal / 100000000)));

      return {
        name: p.name.length > 8 ? p.name.slice(0, 8) + '...' : p.name,
        fullName: p.name,
        '도급계약액(억)': Math.round(p.clientContractAmt / 100000000),
        '누계기성액(억)': Math.round(p.cumulativeBilling / 100000000),
        '수금액(억)': Math.round(p.collectedAmt / 100000000),
        '외주계약액(억)': Math.round(p.subContractAmt / 100000000),
        '외주집행액(억)': Math.round(p.subExecutedAmt / 100000000),
        '도급기성율(%)': Number(p.clientBillingRate.toFixed(1)),
        '외주집행율(%)': Number(p.subExecutionRate.toFixed(1)),
        '외주총액(억)': subContractVal100M,
        '외주승인(억)': subExecutedVal100M,
        '승인대기(억)': subPendingVal100M,
        '외주잔액(억)': subRemainingVal100M,
      };
    });
  }, [filteredProjects]);

  // Chart Dataset 3: Discipline Breakdown
  const disciplineData = useMemo(() => {
    const totalSub = totalStats.totalSubContract || 1;
    return [
      { name: '건축(골조/마감)', value: Math.round(totalSub * 0.45), color: DISCIPLINE_COLORS['건축'] },
      { name: '토목(토공/지반)', value: Math.round(totalSub * 0.18), color: DISCIPLINE_COLORS['토목'] },
      { name: '전기공사', value: Math.round(totalSub * 0.12), color: DISCIPLINE_COLORS['전기'] },
      { name: '기계설비', value: Math.round(totalSub * 0.11), color: DISCIPLINE_COLORS['기계'] },
      { name: '소방공사', value: Math.round(totalSub * 0.06), color: DISCIPLINE_COLORS['소방'] },
      { name: '통신공사', value: Math.round(totalSub * 0.05), color: DISCIPLINE_COLORS['통신'] },
      { name: '조경/기타', value: Math.round(totalSub * 0.03), color: DISCIPLINE_COLORS['조경'] },
    ];
  }, [totalStats]);

  // Chart Dataset 4: Monthly Billing Trend
  const clientMonthlyTrendData = useMemo(() => {
    const selectedYear = parseInt(trendYear, 10) || 2026;
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return months.map((m) => {
      const monthLabel = `${m}월`;
      const lastDay = new Date(selectedYear, m, 0).getDate();
      const monthEndDateStr = `${selectedYear}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let totalContractVal = 0;
      let totalBillingVal = 0;
      let totalCollectedVal = 0;

      filteredProjects.forEach((p: any) => {
        const rawStartDate = p.startDate || p.clientContract?.contractDate;
        const formattedStartDate = normalizeDate(rawStartDate);
        if (formattedStartDate && formattedStartDate > monthEndDateStr) {
          return;
        }

        const rawContractDate = p.clientContract?.contractDate || p.startDate;
        const formattedContractDate = normalizeDate(rawContractDate);

        if (!formattedContractDate || formattedContractDate <= monthEndDateStr) {
          let startAmt = Number(p.clientContract?.initialAmount || 0);
          if (startAmt === 0) {
            startAmt = Number(p.clientContractAmt || 0);
            if (p.clientContract?.history && p.clientContract.history.length > 0) {
              const histSum = p.clientContract.history.reduce((s: number, h: any) => s + Number(h.changeAmount || 0), 0);
              startAmt = Math.max(0, startAmt - histSum);
            }
          } else if (startAmt < 100000) {
            startAmt = startAmt * 100000000;
          }

          let runningContract = startAmt;

          if (p.clientContract?.history && Array.isArray(p.clientContract.history)) {
            p.clientContract.history.forEach((h: any) => {
              const hDate = normalizeDate(h.date);
              if (hDate && hDate <= monthEndDateStr) {
                let changeAmt = Number(h.changeAmount || 0);
                if (Math.abs(changeAmt) < 100000 && changeAmt !== 0) {
                  changeAmt = changeAmt * 100000000;
                }
                runningContract += changeAmt;
              }
            });
          }
          totalContractVal += runningContract;
        }

        const billings = (p.clientBillings && Array.isArray(p.clientBillings)) ? p.clientBillings : [];

        const validBillings = billings.filter((b: any) => {
          const rawD = b.referenceDate || b.targetPeriodEnd || b.createdDate || b.submittedDate;
          const d = normalizeDate(rawD);
          return d && d <= monthEndDateStr;
        });

        if (validBillings.length > 0) {
          const latestBilling = validBillings.reduce((prev: any, curr: any) => {
            const prevDate = normalizeDate(prev.referenceDate || prev.targetPeriodEnd || '');
            const currDate = normalizeDate(curr.referenceDate || curr.targetPeriodEnd || '');
            return currDate >= prevDate ? curr : prev;
          }, validBillings[0]);

          totalBillingVal += Number(latestBilling.cumulativeBillingAmt || latestBilling.currentClaimAmt || 0);

          validBillings.forEach((b: any) => {
            const collectDate = normalizeDate(b.actualCollectionDate || b.collectionDate);
            if (collectDate && collectDate <= monthEndDateStr) {
              totalCollectedVal += Number(b.collectedAmt || b.netClaimAmt || 0);
            } else if (!collectDate && Number(b.collectedAmt || 0) > 0) {
              totalCollectedVal += Number(b.collectedAmt);
            }
          });
        } else if (p.cumulativeBilling > 0 || p.collectedAmt > 0) {
          const startY = parseInt(p.startDate ? p.startDate.slice(0, 4) : '2025', 10) || 2025;
          if (selectedYear > startY || (selectedYear === startY && m >= 4)) {
            if (m < 4) {
              // Before billing
            } else if (m <= 7) {
              const factor = (m - 3) / 4;
              totalBillingVal += Math.round(p.cumulativeBilling * factor);
              totalCollectedVal += Math.round(p.collectedAmt * factor);
            } else {
              totalBillingVal += p.cumulativeBilling;
              totalCollectedVal += p.collectedAmt;
            }
          }
        }
      });

      const billingValIn100M = Math.round(totalBillingVal / 100000000);
      const collectedValIn100M = Math.round(totalCollectedVal / 100000000);
      const receivableValIn100M = Math.max(0, billingValIn100M - collectedValIn100M);
      const contractValIn100M = Math.round(totalContractVal / 100000000);
      const balanceValIn100M = Math.max(0, contractValIn100M - billingValIn100M);

      return {
        month: monthLabel,
        '기성총액': billingValIn100M,
        '기성총액(수금완료액 기준)': collectedValIn100M,
        '미수금': receivableValIn100M,
        '잔액': balanceValIn100M,
      };
    });
  }, [filteredProjects, trendYear]);

  const subMonthlyTrendData = useMemo(() => {
    const selectedYear = parseInt(trendYear, 10) || 2026;
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return months.map((m) => {
      const monthLabel = `${m}월`;
      const lastDay = new Date(selectedYear, m, 0).getDate();
      const monthEndDateStr = `${selectedYear}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let totalSubContractVal = 0;
      let totalSubExecutedVal = 0;
      let totalSubClaimedVal = 0;

      filteredProjects.forEach((p: any) => {
        // 외주현황 필터링: 프로젝트별 외주업체 최초계약일 기준
        const subContractDates = (Array.isArray(p.subContracts) ? p.subContracts : [])
          .map((sc: any) => normalizeDate(sc.contractDate || sc.startDate))
          .filter((d: any) => d)
          .sort((a: string, b: string) => a.localeCompare(b));
        const earliestSubContractDate = subContractDates.length > 0
          ? subContractDates[0]
          : normalizeDate(p.startDate);
        
        if (earliestSubContractDate && earliestSubContractDate > monthEndDateStr) {
          return;
        }

        let pSubContractVal = 0;
        if (Array.isArray(p.subContracts) && p.subContracts.length > 0) {
          p.subContracts.forEach((sc: any) => {
            const scDate = normalizeDate(sc.contractDate || sc.startDate || p.startDate);
            if (!scDate || scDate <= monthEndDateStr) {
              pSubContractVal += Number(sc.currentAmount || sc.initialAmount || 0);
            }
          });
        } else {
          const pDate = normalizeDate(p.startDate);
          if (!pDate || pDate <= monthEndDateStr) {
            pSubContractVal = Number(p.subContractAmt || 0);
          }
        }
        totalSubContractVal += pSubContractVal;

        const subBillings = (p.subBillings && Array.isArray(p.subBillings)) ? p.subBillings : [];

        const validSubBillings = subBillings.filter((sb: any) => {
          const rawD = sb.referenceDate || sb.createdDate;
          const d = normalizeDate(rawD);
          return d && d <= monthEndDateStr;
        });

        if (validSubBillings.length > 0) {
          validSubBillings.forEach((sb: any) => {
            totalSubExecutedVal += Number(sb.finalApprovedAmt || sb.cumulativeApprovedAmt || 0);
            totalSubClaimedVal += Number(sb.currentClaimAmt || sb.finalApprovedAmt || 0);
          });
        } else if (p.subExecutedAmt > 0 || p.subClaimedAmt > 0) {
          const startY = parseInt(p.startDate ? p.startDate.slice(0, 4) : '2025', 10) || 2025;
          if (selectedYear > startY || (selectedYear === startY && m >= 4)) {
            if (m < 4) {
              // Before active sub execution
            } else if (m <= 7) {
              const factor = (m - 3) / 4;
              totalSubExecutedVal += Math.round(p.subExecutedAmt * factor);
              totalSubClaimedVal += Math.round(p.subClaimedAmt * factor);
            } else {
              totalSubExecutedVal += p.subExecutedAmt;
              totalSubClaimedVal += p.subClaimedAmt;
            }
          }
        }
      });

      const executedValIn100M = Math.round(totalSubExecutedVal / 100000000);
      const claimedValIn100M = Math.round(totalSubClaimedVal / 100000000);
      const pendingValIn100M = Math.max(0, claimedValIn100M - executedValIn100M);
      const subContractValIn100M = Math.round(totalSubContractVal / 100000000);
      const remainingValIn100M = Math.max(0, subContractValIn100M - claimedValIn100M);

      return {
        month: monthLabel,
        '외주승인 총액': executedValIn100M,
        '승인대기 총액': pendingValIn100M,
        '외주잔액': remainingValIn100M,
      };
    });
  }, [filteredProjects, trendYear]);

  const monthlyTrendData = useMemo(() => {
    return clientMonthlyTrendData.map((cd, idx) => {
      const sd = subMonthlyTrendData[idx];
      return {
        month: cd.month,
        '도급기성': cd['기성총액'],
        '수금액': cd['기성총액(수금완료액 기준)'],
        '외주집행': sd ? sd['외주승인 총액'] : 0,
      };
    });
  }, [clientMonthlyTrendData, subMonthlyTrendData]);

  // Export Excel Function
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('전사_기성외주_종합현황');

    // Title
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = '전사 프로젝트 기성 및 외주 집행 종합 현황 보고서';
    titleCell.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: '1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Subheader
    sheet.mergeCells('A2:J2');
    const subCell = sheet.getCell('A2');
    subCell.value = `작성일시: ${new Date().toLocaleDateString('ko-KR')} | 대상 현장: 총 ${filteredProjects.length}개 현장`;
    subCell.font = { name: '맑은 고딕', size: 10, color: { argb: '64748B' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.addRow([]);

    // Table Header
    const headers = [
      '순번',
      '현장명',
      '프로젝트 코드',
      '상태',
      '도급 계약금액 (원)',
      '누계 기성액 (원)',
      '도급 기성율 (%)',
      '누계 수금액 (원)',
      '미수금 (원)',
      '외주 계약금액 (원)',
      '외주 누계집행액 (원)',
      '외주 집행율 (%)',
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2563EB' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Rows
    filteredProjects.forEach((p, idx) => {
      const row = sheet.addRow([
        idx + 1,
        p.name,
        p.code,
        p.status,
        p.clientContractAmt,
        p.cumulativeBilling,
        Number(p.clientBillingRate.toFixed(1)),
        p.collectedAmt,
        p.receivableAmt,
        p.subContractAmt,
        p.subExecutedAmt,
        Number(p.subExecutionRate.toFixed(1)),
      ]);

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'left' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).numFmt = '#,##0';
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '0.0"%"';
      row.getCell(8).numFmt = '#,##0';
      row.getCell(9).numFmt = '#,##0';
      row.getCell(10).numFmt = '#,##0';
      row.getCell(11).numFmt = '#,##0';
      row.getCell(12).numFmt = '0.0"%"';
    });

    // Total Row
    const totalRow = sheet.addRow([
      '합계',
      '전사 합계',
      '-',
      '-',
      totalStats.totalContract,
      totalStats.totalBilling,
      Number(totalStats.avgBillingRate.toFixed(1)),
      totalStats.totalCollected,
      totalStats.totalReceivable,
      totalStats.totalSubContract,
      totalStats.totalSubExecuted,
      Number(totalStats.avgSubRate.toFixed(1)),
    ]);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'EFF6FF' }
      };
    });

    // Column widths
    sheet.columns.forEach((col) => {
      col.width = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `전사_기성외주_종합현황_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const activeProjectRate = totalStats.totalProjectsCount > 0
    ? (totalStats.activeProjectsCount / totalStats.totalProjectsCount) * 100
    : 0;

  const billingRate = totalStats.totalContract > 0
    ? (totalStats.totalBilling / totalStats.totalContract) * 100
    : 0;

  const receivableRate = totalStats.totalBilling > 0
    ? (totalStats.totalReceivable / totalStats.totalBilling) * 100
    : 0;

  const totalBalance = totalStats.totalContract - totalStats.totalBilling;

  const balanceRate = totalStats.totalContract > 0
    ? (totalBalance / totalStats.totalContract) * 100
    : 0;

  const subClaimedRate = totalStats.totalSubContract > 0
    ? (totalStats.totalSubClaimed / totalStats.totalSubContract) * 100
    : 0;

  const subApprovedRate = totalStats.totalSubContract > 0
    ? (totalStats.totalSubExecuted / totalStats.totalSubContract) * 100
    : 0;

  const totalSubRemaining = totalStats.totalSubContract - totalStats.totalSubExecuted;

  const subRemainingRate = totalStats.totalSubContract > 0
    ? (totalSubRemaining / totalStats.totalSubContract) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* 발주처 도급 현황 & 외주 계약 현황 Cards (좌우 배치) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 발주처 도급 현황 Card */}
        <div className="bg-white p-6 sm:p-8 rounded-lg flex flex-col justify-between">
          <div className="flex flex-col h-full justify-between space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* 좌측: 도급 총액 정보 */}
              <div className="md:col-span-5 space-y-3 border-r-0 md:border-r border-gray-100 md:pr-6 py-2 flex flex-col justify-start">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider block">발주처 도급 총액</span>
                <div className="text-3xl font-black text-gray-900 tracking-tight xl:text-4xl">
                  {formatKRW(totalStats.totalContract)}
                </div>
                <div className="text-xs text-gray-500 font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg w-fit">
                  {totalStats.activeProjectsCount}개 현장 진행중
                </div>
              </div>

              {/* 우측: 상세 항목 세로 배치 */}
              <div className="md:col-span-7 space-y-5">
                {/* 기성 총액 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-gray-500">기성 총액</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-blue-600">{formatKRW(totalStats.totalBilling)}</span>
                      <span className="text-[10px] text-gray-400 font-semibold">({billingRate.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${billingRate}%` }}
                    />
                  </div>
                </div>

                {/* 미수금 총액 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-gray-500">미수금 총액</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-sky-500">{formatKRW(totalStats.totalReceivable)}</span>
                      <span className="text-[10px] text-gray-400 font-semibold">({receivableRate.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${receivableRate}%` }}
                    />
                  </div>
                </div>

                {/* 잔액 총액 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-gray-500">잔액 총액 (미수금 포함)</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-gray-700">{formatKRW(totalBalance)}</span>
                      <span className="text-[10px] text-gray-400 font-semibold">({balanceRate.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-slate-400 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${balanceRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 하단: 월별 누계 도급현황 추이 그래프 */}
            <div className="border-t border-gray-100 pt-6 mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">월별 누계 도급현황 추이 (억원)</span>
                <select
                  value={trendYear}
                  onChange={(e) => setTrendYear(e.target.value)}
                  className="text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-gray-100 transition"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={clientMonthlyTrendData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(value: any, name: string) => [`${value}억원`, name]} 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                    <Bar dataKey="기성총액(수금완료액 기준)" stackId="billing" fill="#2563eb" name="수금완료액" />
                    <Bar dataKey="미수금" stackId="billing" fill="#0ea5e9" name="미수금" />
                    <Bar dataKey="잔액" stackId="billing" fill="#cbd5e1" radius={[3, 3, 0, 0]} name="도급잔액" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* 외주 계약 현황 Card */}
        <div className="bg-white p-6 sm:p-8 rounded-lg flex flex-col justify-between">
          <div className="flex flex-col h-full justify-between space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* 좌측: 외주 계약 총액 정보 */}
              <div className="md:col-span-5 space-y-3 border-r-0 md:border-r border-gray-100 md:pr-6 py-2 flex flex-col justify-start">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider block">외주 계약 총액</span>
                <div className="text-3xl font-black text-gray-900 tracking-tight xl:text-4xl">
                  {formatKRW(totalStats.totalSubContract)}
                </div>
                <div className="text-xs text-gray-500 font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg w-fit">
                  {totalStats.totalSubContractorsCount}업체 계약중
                </div>
              </div>

              {/* 우측: 상세 항목 세로 배치 */}
              <div className="md:col-span-7 space-y-5">
                {/* 외주 기성 청구 총액 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-gray-500">외주 기성 청구 총액</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-amber-500">{formatKRW(totalStats.totalSubClaimed)}</span>
                      <span className="text-[10px] text-gray-400 font-semibold">({subClaimedRate.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${subClaimedRate}%` }}
                    />
                  </div>
                </div>

                {/* 외주 승인 총액 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-gray-500">외주 승인 총액</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-amber-600">{formatKRW(totalStats.totalSubExecuted)}</span>
                      <span className="text-[10px] text-gray-400 font-semibold">({subApprovedRate.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${subApprovedRate}%` }}
                    />
                  </div>
                </div>

                {/* 외주 기성 잔액 (미지급 포함) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-gray-500">외주 기성 잔액 (미지급 포함)</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-slate-700">{formatKRW(totalSubRemaining)}</span>
                      <span className="text-[10px] text-gray-400 font-semibold">({subRemainingRate.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-slate-400 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${subRemainingRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 하단: 월별 누계 외주 계약현황 추이 그래프 */}
            <div className="border-t border-gray-100 pt-6 mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">월별 누계 외주현황 추이 (억원)</span>
                <select
                  value={trendYear}
                  onChange={(e) => setTrendYear(e.target.value)}
                  className="text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-gray-100 transition"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={subMonthlyTrendData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(value: any, name: string) => [`${value}억원`, name]} 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                    <Bar dataKey="외주승인 총액" stackId="sub" fill="#d97706" name="외주승인 총액" />
                    <Bar dataKey="승인대기 총액" stackId="sub" fill="#f59e0b" name="승인대기 총액" />
                    <Bar dataKey="외주잔액" stackId="sub" fill="#cbd5e1" radius={[3, 3, 0, 0]} name="외주잔액" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Multi-Project Breakdown Table Section */}
      <div className="hidden md:block bg-white rounded-lg p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>현장별 상세</span>
              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold">
                총 {filteredProjects.length}개
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              개별 현장의 버튼을 누르면 해당 프로젝트의 상세 기성 및 외주 관리 페이지로 바로 연결됩니다.
            </p>
          </div>

          {/* Search, Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="현장명, 코드, 위치 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium transition-all"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="registered">등록일 순 (최신순)</option>
              <option value="budget">도급액 큰 순</option>
              <option value="billingRate">기성율 높은 순</option>
              <option value="subRate">외주집행율 높은 순</option>
              <option value="name">현장명 순</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4">현장정보</th>
                <th className="py-3.5 px-4 text-right">도급 계약금액</th>
                <th className="py-3.5 px-4 text-right">누계 기성액 (기성율)</th>
                <th className="py-3.5 px-4 text-right">수금액 (미수금)</th>
                <th className="py-3.5 px-4 text-right">외주 계약금액</th>
                <th className="py-3.5 px-4 text-right">외주 집행액 (집행율)</th>
                <th className="py-3.5 px-4 text-center">이동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    검색 조건에 해당되는 현장이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  let statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                  if (p.status === '준비') statusBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                  if (p.status === '완료') statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  if (p.status === '홀딩') statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                      onClick={() => onSelectProject(p.id, 'billing')}
                    >
                      {/* Project Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm overflow-hidden">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 size={18} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                                {p.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadgeClass}`}>
                                {p.status}
                              </span>
                              {p.isOverBudgetRisk && (
                                <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5" title="외주 집행율 초과 주의">
                                  <AlertTriangle size={10} />
                                  <span>주의</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                              <span>코드: {p.code}</span>
                              <span>•</span>
                              <span>{p.location}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Client Contract */}
                      <td className="py-4 px-4 text-right font-bold text-gray-900">
                        {formatKRW(p.clientContractAmt)}
                      </td>

                      {/* Cumulative Billing & Rate */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-bold text-blue-600">{formatKRW(p.cumulativeBilling)}</div>
                        <div className="text-[10px] font-bold text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, p.clientBillingRate)}%` }} />
                          </div>
                          <span>{p.clientBillingRate.toFixed(1)}%</span>
                        </div>
                      </td>

                      {/* Collected & Receivables */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-bold text-emerald-600">{formatKRW(p.collectedAmt)}</div>
                        {p.receivableAmt > 0 ? (
                          <div className="text-[11px] font-bold text-red-500">
                            미수: {formatKRW(p.receivableAmt)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400">미수금 없음</div>
                        )}
                      </td>

                      {/* Subcontract Amount */}
                      <td className="py-4 px-4 text-right font-medium text-gray-700">
                        {formatKRW(p.subContractAmt)}
                      </td>

                      {/* Subcontract Executed & Rate */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-bold text-amber-700">{formatKRW(p.subExecutedAmt)}</div>
                        <div className="text-[10px] font-bold text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, p.subExecutionRate)}%` }} />
                          </div>
                          <span>{p.subExecutionRate.toFixed(1)}%</span>
                        </div>
                      </td>

                      {/* Navigation Button */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(p.id, 'billing');
                          }}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-blue-600 rounded-xl transition-all flex items-center justify-center mx-auto active:scale-95 whitespace-nowrap border-none shadow-none"
                          title="이동"
                        >
                          <ChevronRight size={16} className="stroke-[2.5]" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Visual Charts Divider & Section */}
        <div className="border-t border-gray-100 pt-6 mt-6 space-y-6">
          <div className="flex justify-end pb-2">
            {/* Chart View Tabs */}
            <div className="flex items-center overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'billing', label: '현장별 도급 vs 기성' },
                  { id: 'rates', label: '외주현황' },
                  { id: 'discipline', label: '공종별 외주 비중' },
                  { id: 'monthly', label: '월별 집행 추이' }
                ] as const
              ).map((tab, idx, arr) => (
                <React.Fragment key={tab.id}>
                  <button
                    onClick={() => setActiveChartTab(tab.id)}
                    className={`px-2.5 py-1 text-xs font-bold transition-all whitespace-nowrap focus:outline-none ${
                      activeChartTab === tab.id ? 'text-blue-600 font-extrabold' : 'text-gray-500 hover:text-blue-600/80'
                    }`}
                  >
                    {tab.label}
                  </button>
                  {idx < arr.length - 1 && (
                    <span className="w-[1px] h-3 bg-gray-300 mx-1 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Chart Content Area */}
          <div className="h-[340px] w-full pt-2">
            {activeChartTab === 'billing' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartProjectData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis unit="억" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: number) => [`${val} 억원`, '']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="도급계약액(억)" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={16} />
                  <Bar dataKey="누계기성액(억)" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={16} />
                  <Bar dataKey="수금액(억)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeChartTab === 'rates' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartProjectData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis unit="억" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: number, name: string) => [`${val} 억원`, name]}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="외주총액(억)" fill="#475569" radius={[4, 4, 0, 0]} barSize={12} name="외주총액" />
                  <Bar dataKey="외주승인(억)" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={12} name="외주승인" />
                  <Bar dataKey="승인대기(억)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={12} name="승인대기" />
                  <Bar dataKey="외주잔액(억)" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={12} name="외주잔액" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeChartTab === 'discipline' && (
              <div className="grid grid-cols-1 md:grid-cols-2 h-full items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={disciplineData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {disciplineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => [formatKRW(val), '외주계약금액']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 pr-4 max-h-[280px] overflow-y-auto">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">외주 공종별 집행 비율</h4>
                  {disciplineData.map(item => {
                    const pct = totalStats.totalSubContract > 0 ? ((item.value / totalStats.totalSubContract) * 100).toFixed(1) : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs font-medium py-1 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-700">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-900 font-bold">{formatKRW(item.value)}</span>
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px] w-12 text-right">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeChartTab === 'monthly' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrendData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorBilling" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis unit="억" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val: number) => [`${val} 억원`, '']} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="도급기성" stroke="#2563eb" fillOpacity={1} fill="url(#colorBilling)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="수금액" stroke="#10b981" fillOpacity={1} fill="url(#colorCollected)" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="외주집행" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ConsolidatedBillingDashboard;
