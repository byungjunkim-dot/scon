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
import { Project, User } from '../types';

interface ConsolidatedBillingDashboardProps {
  projects: Project[];
  currentUser: User | null;
  onSelectProject: (
    projectId: string,
    initialMenu?: 'dashboard' | 'schedule' | 'documents' | 'drawings' | 'photo-gallery' | 'quick-memo' | 'ai-diagnosis' | 'billing'
  ) => void;
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

export const ConsolidatedBillingDashboard: React.FC<ConsolidatedBillingDashboardProps> = ({
  projects = [],
  currentUser,
  onSelectProject
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'전체' | '진행' | '완료' | '홀딩'>('전체');
  const [sortBy, setSortBy] = useState<'budget' | 'billingRate' | 'subRate' | 'name'>('budget');
  const [activeChartTab, setActiveChartTab] = useState<'billing' | 'rates' | 'discipline' | 'monthly'>('billing');
  const [trendYear, setTrendYear] = useState<string>('2026');

  // Compute multi-project dataset
  const projectSummaries = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return projects
      .filter((p): p is Project => !!p)
      .map((p, idx) => {
        const hash = getProjectHash(p.id);

        // Check if custom data stored in localStorage for this project
        let storedClientContract = null;
        let storedClientBillings = null;
        let storedSubContracts = null;
        let storedSubBillings = null;

        try {
          const saved = localStorage.getItem(`cp_billing_data_${p.id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            storedClientContract = parsed.clientContract;
            storedClientBillings = parsed.clientBillings;
            storedSubContracts = parsed.subContracts;
            storedSubBillings = parsed.subBillings;
          }
        } catch (e) {
          // Fallback to computed
        }

      // Base Contract Amount
      let clientContractAmt = p.totalBudget;
      if (!clientContractAmt || clientContractAmt === 0) {
        clientContractAmt = storedClientContract?.currentAmount || (35000000000 + (hash % 25) * 1500000000);
      }

      // Cumulative Billing
      let cumulativeBilling = 0;
      let collectedAmt = 0;
      let receivableAmt = 0;

      if (storedClientBillings && Array.isArray(storedClientBillings) && storedClientBillings.length > 0) {
        cumulativeBilling = storedClientBillings.reduce((max: number, b: any) => Math.max(max, b.cumulativeBillingAmt || 0), 0);
        collectedAmt = storedClientBillings.reduce((sum: number, b: any) => sum + (b.collectedAmt || 0), 0);
        receivableAmt = cumulativeBilling - collectedAmt;
      } else {
        const billingRatio = 0.35 + ((hash % 45) / 100);
        cumulativeBilling = Math.round(clientContractAmt * Math.min(0.95, billingRatio));
        collectedAmt = Math.round(cumulativeBilling * (0.85 + (hash % 12) / 100));
        receivableAmt = Math.max(0, cumulativeBilling - collectedAmt);
      }

      const clientBillingRate = clientContractAmt > 0 ? (cumulativeBilling / clientContractAmt) * 100 : 0;

      // Subcontractor Amounts
      let actualSubContracts = DEFAULT_SUBCONTRACTS;
      if (storedSubContracts && Array.isArray(storedSubContracts)) {
        actualSubContracts = storedSubContracts;
      }

      let actualSubBillings = DEFAULT_SUBBILLINGS;
      if (storedSubBillings && Array.isArray(storedSubBillings)) {
        actualSubBillings = storedSubBillings;
      }

      const subContractAmt = actualSubContracts.reduce((sum: number, sc: any) => sum + (sc.currentAmount || 0), 0);
      const subExecutedAmt = actualSubBillings.reduce((sum: number, sb: any) => sum + (sb.finalApprovedAmt || 0), 0);
      const subClaimedAmt = actualSubBillings.reduce((sum: number, sb: any) => sum + (sb.currentClaimAmt || sb.finalApprovedAmt || 0), 0);

      const subExecutionRate = subContractAmt > 0 ? (subExecutedAmt / subContractAmt) * 100 : 0;

      // Expected Profit & Margin
      const profitMargin = 11.5 + (hash % 7);
      const expectedProfit = Math.round(clientContractAmt * (profitMargin / 100));

      // Over-spending Risk Flag (if sub execution rate significantly exceeds billing rate)
      const isOverBudgetRisk = subExecutionRate > clientBillingRate + 8;

      const subContractorsCount = actualSubContracts.length;

      return {
        id: p.id,
        name: p.name,
        code: p.projectCode || `PRJ-${String(idx + 1).padStart(3, '0')}`,
        status: p.status || '진행',
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
        subContractorsCount
      };
    });
  }, [projects]);

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
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === '전체' || p.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'budget') return b.clientContractAmt - a.clientContractAmt;
        if (sortBy === 'billingRate') return b.clientBillingRate - a.clientBillingRate;
        if (sortBy === 'subRate') return b.subExecutionRate - a.subExecutionRate;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [projectSummaries, searchTerm, statusFilter, sortBy]);

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
    return filteredProjects.slice(0, 8).map(p => ({
      name: p.name.length > 8 ? p.name.slice(0, 8) + '...' : p.name,
      fullName: p.name,
      '도급계약액(억)': Math.round(p.clientContractAmt / 100000000),
      '누계기성액(억)': Math.round(p.cumulativeBilling / 100000000),
      '수금액(억)': Math.round(p.collectedAmt / 100000000),
      '외주계약액(억)': Math.round(p.subContractAmt / 100000000),
      '외주집행액(억)': Math.round(p.subExecutedAmt / 100000000),
      '도급기성율(%)': Number(p.clientBillingRate.toFixed(1)),
      '외주집행율(%)': Number(p.subExecutionRate.toFixed(1)),
    }));
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
  const monthlyTrendData = useMemo(() => {
    return [
      { month: '2월', '도급기성': Math.round(totalStats.totalBilling * 0.35 / 100000000), '수금액': Math.round(totalStats.totalCollected * 0.32 / 100000000), '외주집행': Math.round(totalStats.totalSubExecuted * 0.33 / 100000000) },
      { month: '3월', '도급기성': Math.round(totalStats.totalBilling * 0.48 / 100000000), '수금액': Math.round(totalStats.totalCollected * 0.45 / 100000000), '외주집행': Math.round(totalStats.totalSubExecuted * 0.46 / 100000000) },
      { month: '4월', '도급기성': Math.round(totalStats.totalBilling * 0.62 / 100000000), '수금액': Math.round(totalStats.totalCollected * 0.58 / 100000000), '외주집행': Math.round(totalStats.totalSubExecuted * 0.60 / 100000000) },
      { month: '5월', '도급기성': Math.round(totalStats.totalBilling * 0.76 / 100000000), '수금액': Math.round(totalStats.totalCollected * 0.72 / 100000000), '외주집행': Math.round(totalStats.totalSubExecuted * 0.75 / 100000000) },
      { month: '6월', '도급기성': Math.round(totalStats.totalBilling * 0.89 / 100000000), '수금액': Math.round(totalStats.totalCollected * 0.86 / 100000000), '외주집행': Math.round(totalStats.totalSubExecuted * 0.88 / 100000000) },
      { month: '7월 (현재)', '도급기성': Math.round(totalStats.totalBilling / 100000000), '수금액': Math.round(totalStats.totalCollected / 100000000), '외주집행': Math.round(totalStats.totalSubExecuted / 100000000) },
    ];
  }, [totalStats]);

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

  const clientMonthlyTrendData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
    
    const getRatiosForYear = (yearStr: string) => {
      const yrNum = parseInt(yearStr, 10) || 2026;
      const seed = yrNum % 3;
      if (seed === 0) {
        return [
          { billing: 0.15, collection: 0.12 },
          { billing: 0.22, collection: 0.18 },
          { billing: 0.32, collection: 0.28 },
          { billing: 0.42, collection: 0.36 },
          { billing: 0.52, collection: 0.45 },
          { billing: 0.62, collection: 0.54 },
          { billing: 0.72, collection: 0.64 },
          { billing: 0.80, collection: 0.72 },
          { billing: 0.86, collection: 0.78 },
          { billing: 0.92, collection: 0.84 },
          { billing: 0.96, collection: 0.89 },
          { billing: 1.00, collection: 0.92 },
        ];
      } else if (seed === 1) {
        return [
          { billing: 0.10, collection: 0.08 },
          { billing: 0.18, collection: 0.15 },
          { billing: 0.26, collection: 0.22 },
          { billing: 0.35, collection: 0.30 },
          { billing: 0.44, collection: 0.38 },
          { billing: 0.52, collection: 0.45 },
          { billing: 0.60, collection: 0.52 },
          { billing: 0.68, collection: 0.60 },
          { billing: 0.76, collection: 0.68 },
          { billing: 0.84, collection: 0.76 },
          { billing: 0.92, collection: 0.84 },
          { billing: 1.00, collection: 0.91 },
        ];
      } else {
        return [
          { billing: 0.08, collection: 0.06 },
          { billing: 0.14, collection: 0.11 },
          { billing: 0.22, collection: 0.18 },
          { billing: 0.30, collection: 0.25 },
          { billing: 0.38, collection: 0.32 },
          { billing: 0.46, collection: 0.39 },
          { billing: 0.54, collection: 0.46 },
          { billing: 0.62, collection: 0.54 },
          { billing: 0.70, collection: 0.62 },
          { billing: 0.78, collection: 0.70 },
          { billing: 0.88, collection: 0.80 },
          { billing: 1.00, collection: 0.90 },
        ];
      }
    };

    const ratios = getRatiosForYear(trendYear);

    return months.map((month, idx) => {
      const r = ratios[idx];
      const billingVal = Math.round((totalStats.totalBilling * r.billing) / 100000000); // 억원
      const collectedVal = Math.round((totalStats.totalCollected * r.collection) / 100000000); // 억원
      const receivableVal = Math.max(0, billingVal - collectedVal);
      const contractVal = Math.round(totalStats.totalContract / 100000000); // 억원
      const balanceVal = Math.max(0, contractVal - billingVal);

      return {
        month,
        '기성총액': billingVal,
        '기성총액(수금완료액 기준)': collectedVal,
        '미수금': receivableVal,
        '잔액': balanceVal,
      };
    });
  }, [totalStats, trendYear]);

  const subMonthlyTrendData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
    
    const getRatiosForYear = (yearStr: string) => {
      const yrNum = parseInt(yearStr, 10) || 2026;
      const seed = yrNum % 3;
      if (seed === 0) {
        return [
          { claimed: 0.12, executed: 0.10 },
          { claimed: 0.20, executed: 0.16 },
          { claimed: 0.30, executed: 0.25 },
          { claimed: 0.40, executed: 0.34 },
          { claimed: 0.50, executed: 0.42 },
          { claimed: 0.60, executed: 0.50 },
          { claimed: 0.70, executed: 0.60 },
          { claimed: 0.78, executed: 0.68 },
          { claimed: 0.84, executed: 0.74 },
          { claimed: 0.90, executed: 0.80 },
          { claimed: 0.95, executed: 0.86 },
          { claimed: 1.00, executed: 0.90 },
        ];
      } else if (seed === 1) {
        return [
          { claimed: 0.08, executed: 0.06 },
          { claimed: 0.15, executed: 0.12 },
          { claimed: 0.24, executed: 0.20 },
          { claimed: 0.32, executed: 0.26 },
          { claimed: 0.40, executed: 0.34 },
          { claimed: 0.48, executed: 0.40 },
          { claimed: 0.56, executed: 0.48 },
          { claimed: 0.64, executed: 0.55 },
          { claimed: 0.72, executed: 0.62 },
          { claimed: 0.80, executed: 0.70 },
          { claimed: 0.90, executed: 0.80 },
          { claimed: 1.00, executed: 0.88 },
        ];
      } else {
        return [
          { claimed: 0.06, executed: 0.04 },
          { claimed: 0.12, executed: 0.09 },
          { claimed: 0.20, executed: 0.16 },
          { claimed: 0.28, executed: 0.22 },
          { claimed: 0.36, executed: 0.29 },
          { claimed: 0.44, executed: 0.36 },
          { claimed: 0.52, executed: 0.43 },
          { claimed: 0.60, executed: 0.50 },
          { claimed: 0.68, executed: 0.58 },
          { claimed: 0.76, executed: 0.66 },
          { claimed: 0.86, executed: 0.76 },
          { claimed: 1.00, executed: 0.88 },
        ];
      }
    };

    const ratios = getRatiosForYear(trendYear);

    return months.map((month, idx) => {
      const r = ratios[idx];
      const claimedVal = Math.round((totalStats.totalSubClaimed * r.claimed) / 100000000); // 억원
      const executedVal = Math.round((totalStats.totalSubExecuted * r.executed) / 100000000); // 억원
      const pendingVal = Math.max(0, claimedVal - executedVal);
      const subContractVal = Math.round(totalStats.totalSubContract / 100000000); // 억원
      const remainingVal = Math.max(0, subContractVal - claimedVal);

      return {
        month,
        '외주승인 총액': executedVal,
        '승인대기 총액': pendingVal,
        '외주잔액': remainingVal,
      };
    });
  }, [totalStats, trendYear]);

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

            {/* Status Filter */}
            <div className="flex items-center">
              {(['전체', '진행', '완료', '홀딩'] as const).map((s, idx, arr) => (
                <React.Fragment key={s}>
                  <button
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 text-xs font-bold transition-all focus:outline-none ${
                      statusFilter === s ? 'text-blue-600 font-extrabold' : 'text-gray-500 hover:text-blue-600/80'
                    }`}
                  >
                    {s}
                  </button>
                  {idx < arr.length - 1 && (
                    <span className="w-[1px] h-3 bg-gray-300 mx-1" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
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
                  { id: 'rates', label: '도급기성율 vs 외주집행율' },
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
                <ComposedChart data={chartProjectData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: number) => [`${val}%`, '']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="도급기성율(%)" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
                  <Line type="monotone" dataKey="외주집행율(%)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5, fill: '#f59e0b' }} />
                </ComposedChart>
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
