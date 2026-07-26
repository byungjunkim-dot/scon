import React, { useState, useMemo, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area
} from 'recharts';
import {
  FileText,
  DollarSign,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Building,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  Lock,
  Unlock,
  Eye,
  Edit,
  Trash2,
  ShieldAlert,
  Paperclip,
  MessageSquare,
  History,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  FileSpreadsheet,
  ChevronRight,
  Maximize2,
  Minimize2,
  PieChart as PieChartIcon,
  Calculator,
  UserCheck,
  Percent,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  Category,
  ClientContract,
  ClientContractHistory,
  ClientBilling,
  ClientBillingItem,
  ClientBillingStatus,
  SubcontractorContract,
  SubcontractorBilling,
  SubcontractorBillingItem,
  SubcontractorBillingStatus,
  SiteExecutionBudget,
  MonthlyClosing,
  BillingAuditLog,
  BillingComment,
  AppSettings
} from '../types';

interface Props {
  projectId?: string;
  settings?: AppSettings;
}

// Helper currency formatter
const formatKRW = (num: number) => {
  if (isNaN(num)) return '0 원';
  if (Math.abs(num) >= 100000000) {
    return `${(num / 100000000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} 억원`;
  }
  if (Math.abs(num) >= 10000) {
    return `${(num / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 만원`;
  }
  return `${num.toLocaleString('ko-KR')} 원`;
};

const formatNumber = (num: number) => {
  return (num || 0).toLocaleString('ko-KR');
};

export const BillingAndSubcontractorView: React.FC<Props> = ({ projectId = 'pjt-1', settings }) => {
  const disciplinesList = useMemo<Category[]>(() => {
    if (settings?.categories && settings.categories.length > 0) {
      return settings.categories;
    }
    try {
      const saved = localStorage.getItem('cp_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.categories && parsed.categories.length > 0) {
          return parsed.categories;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return ['공통관리', '토목', '건축', '전기', '기계'];
  }, [settings]);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'client-contract' | 'sub-contract' | 'sub-billing' | 'closing'
  >('client-contract');

  // Common filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('전체');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('전체');

  // Monthly Closing State
  const [closings, setClosings] = useState<MonthlyClosing[]>([
    { id: 'close-1', projectId, yearMonth: '2026-05', isClosed: true, closedAt: '2026-06-05', closedBy: '김현장 (소장)' },
    { id: 'close-2', projectId, yearMonth: '2026-06', isClosed: true, closedAt: '2026-07-05', closedBy: '김현장 (소장)' },
    { id: 'close-3', projectId, yearMonth: '2026-07', isClosed: false }
  ]);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const isCurrentMonthClosed = useMemo(() => {
    return closings.find(c => c.yearMonth === selectedMonth)?.isClosed || false;
  }, [closings, selectedMonth]);

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  // 1. 발주처 계약 데이터 (Client Contract)
  const [clientContract, setClientContract] = useState<ClientContract>({
    id: 'cc-01',
    projectId,
    initialAmount: 10000000000, // 최초 100억
    amendedAmount: 13500000000, // 1차 변경 35억 증액 => 최종 135억
    currentAmount: 13500000000,
    amendmentRound: 1, // 1차 변경
    changeAmount: 3500000000,
    changeReason: '지상층 골조 사양 변경 및 지하 증축에 따른 설계 변경',
    advancePayment: 1000000000, // 선급금 10%
    retentionMoney: 675000000, // 유보금 5%
    performanceBond: 1350000000, // 계약보증금 10%
    designChangeAmount: 2500000000,
    priceFluctuationAmount: 700000000,
    extraWorkAmount: 300000000,
    contractBalance: 11143000000, // 연동 전 초기값
    status: '승인',
    attachments: ['도급계약서_1차변경.pdf', '설계변경승인서.pdf'],
    history: [
      { id: 'cch-1', round: 1, date: '2026-02-15', changeAmount: 3500000000, contractAmountAfter: 13500000000, reason: '지하층 지하수위 대응 강화 및 지상층 설계변경', approvedBy: '발주처 관리자' }
    ]
  });

  // 2. 발주처 기성 데이터 (Client Billings)
  const [clientBillings, setClientBillings] = useState<ClientBilling[]>([
    {
      id: 'cb-1',
      projectId,
      contractId: 'cc-01',
      billingRound: 1,
      targetPeriodStart: '2026-04-01',
      targetPeriodEnd: '2026-04-30',
      referenceDate: '2026-04-30',
      createdDate: '2026-05-02',
      submittedDate: '2026-05-03',
      approvedDate: '2026-05-10',
      billingExpectedDate: '2026-05-15',
      taxInvoiceDate: '2026-05-15',
      collectionExpectedDate: '2026-05-30',
      actualCollectionDate: '2026-05-28',
      prevCumulativeAmt: 0,
      currentClaimAmt: 1200000000, // 금회 청구액 12억
      cumulativeBillingAmt: 1200000000,
      billingRate: 8.89, // 12억 / 135억 * 100
      advanceDeductionAmt: 120000000,
      retentionAmt: 60000000,
      otherDeductionsAmt: 0,
      vatAmt: 0,
      netClaimAmt: 1020000000, // 12억 - 1.2억 - 0.6억 = 10.2억
      collectedAmt: 1020000000, // 수금 완료
      receivableAmt: 0,
      status: '완료',
      remarks: '1차 기성 정상 수금 완료'
    },
    {
      id: 'cb-2',
      projectId,
      contractId: 'cc-01',
      billingRound: 2,
      targetPeriodStart: '2026-05-01',
      targetPeriodEnd: '2026-05-31',
      referenceDate: '2026-05-31',
      createdDate: '2026-06-02',
      submittedDate: '2026-06-04',
      approvedDate: '2026-06-12',
      billingExpectedDate: '2026-06-15',
      taxInvoiceDate: '2026-06-15',
      collectionExpectedDate: '2026-06-30',
      actualCollectionDate: '2026-06-29',
      prevCumulativeAmt: 1200000000,
      currentClaimAmt: 1500000000, // 2차 금회 청구액 15억
      cumulativeBillingAmt: 2700000000, // 누계 27억
      billingRate: 20.00, // 27억 / 135억 * 100
      advanceDeductionAmt: 150000000,
      retentionAmt: 75000000,
      otherDeductionsAmt: 0,
      vatAmt: 0,
      netClaimAmt: 1275000000, // 15억 - 1.5억 - 0.75억 = 12.75억
      collectedAmt: 1275000000,
      receivableAmt: 0,
      status: '완료',
      remarks: '2차 기성 정상 수금 완료'
    },
    {
      id: 'cb-3',
      projectId,
      contractId: 'cc-01',
      billingRound: 3,
      targetPeriodStart: '2026-06-01',
      targetPeriodEnd: '2026-06-30',
      referenceDate: '2026-06-30',
      createdDate: '2026-07-01',
      submittedDate: '2026-07-03',
      approvedDate: '2026-07-15',
      billingExpectedDate: '2026-07-20',
      taxInvoiceDate: '2026-07-20',
      collectionExpectedDate: '2026-07-31',
      actualCollectionDate: undefined,
      prevCumulativeAmt: 2700000000,
      currentClaimAmt: 1000000000, // 3차 금회 청구액 10억
      cumulativeBillingAmt: 3700000000, // 누계 37억
      billingRate: 27.41, // 37억 / 135억 * 100
      advanceDeductionAmt: 100000000,
      retentionAmt: 50000000,
      otherDeductionsAmt: 0,
      vatAmt: 0,
      netClaimAmt: 850000000, // 실청구액 8.5억
      collectedAmt: 350000000, // 수금액 3.5억
      receivableAmt: 500000000, // 미수금 5억
      status: '수금대기',
      remarks: '3차 기성 승인완료, 수금 진행 중'
    }
  ]);

  // 발주처 공종별 기성 내역
  const [clientBillingItems, setClientBillingItems] = useState<ClientBillingItem[]>([
    {
      id: 'cbi-1',
      billingId: 'cb-3',
      majorCategory: '공통관리',
      middleCategory: '가설공사',
      minorCategory: '가설펜스 및 휀스',
      itemCode: 'A001',
      itemName: '가설펜스 설치 및 유지',
      spec: 'H=3.0m EGI',
      unit: 'm',
      contractQty: 1000,
      contractUnitPrice: 150000,
      contractAmount: 150000000,
      prevCumulativeQty: 800,
      currentQty: 100,
      cumulativeQty: 900,
      prevCumulativeAmt: 120000000,
      currentBillingAmt: 15000000,
      cumulativeBillingAmt: 135000000,
      remainingAmt: 15000000,
      currentProgressRate: 10,
      cumulativeProgressRate: 90,
      calcBasis: '현장 실측 900m 시공 완료',
      remarks: '정상 진도'
    },
    {
      id: 'cbi-2',
      billingId: 'cb-3',
      majorCategory: '토목',
      middleCategory: '토공사',
      minorCategory: '터파기 및 흙막이',
      itemCode: 'B001',
      itemName: '토사 굴착 및 사토처리',
      spec: '풍화암 포함',
      unit: 'm3',
      contractQty: 50000,
      contractUnitPrice: 40000,
      contractAmount: 2000000000,
      prevCumulativeQty: 42000,
      currentQty: 5000,
      cumulativeQty: 47000,
      prevCumulativeAmt: 1680000000,
      currentBillingAmt: 200000000,
      cumulativeBillingAmt: 1880000000,
      remainingAmt: 120000000,
      currentProgressRate: 10,
      cumulativeProgressRate: 94,
      calcBasis: '덤프 계량표 확인',
      remarks: '토공 마무리 단계'
    },
    {
      id: 'cbi-3',
      billingId: 'cb-3',
      majorCategory: '건축',
      middleCategory: '골조공사',
      minorCategory: '레미콘 및 철근',
      itemCode: 'C001',
      itemName: '철근콘크리트 골조 공사',
      spec: '25-24-150 / SD400',
      unit: 'm2',
      contractQty: 80000,
      contractUnitPrice: 350000,
      contractAmount: 28000000000,
      prevCumulativeQty: 38000,
      currentQty: 12000,
      cumulativeQty: 50000,
      prevCumulativeAmt: 13300000000,
      currentBillingAmt: 4200000000,
      cumulativeBillingAmt: 17500000000,
      remainingAmt: 10500000000,
      currentProgressRate: 15,
      cumulativeProgressRate: 62.5,
      calcBasis: '지상 8층 타설 완료',
      remarks: '주요 골조 정상 추진'
    },
    {
      id: 'cbi-4',
      billingId: 'cb-3',
      majorCategory: '전기',
      middleCategory: '전기설비',
      minorCategory: '배관배선',
      itemCode: 'E001',
      itemName: '전기 배관 배선 공사',
      spec: 'HIV 2.5sq',
      unit: '식',
      contractQty: 1,
      contractUnitPrice: 4000000000,
      contractAmount: 4000000000,
      prevCumulativeQty: 0.3,
      currentQty: 0.15,
      cumulativeQty: 0.45,
      prevCumulativeAmt: 1200000000,
      currentBillingAmt: 600000000,
      cumulativeBillingAmt: 1800000000,
      remainingAmt: 2200000000,
      currentProgressRate: 15,
      cumulativeProgressRate: 45,
      calcBasis: '지하층 및 지상 4층 입선 작업',
      remarks: '골조 후속 공정 연계'
    },
    {
      id: 'cbi-5',
      billingId: 'cb-3',
      majorCategory: '기계',
      middleCategory: '배관설비',
      minorCategory: '소방 및 위생배관',
      itemCode: 'M001',
      itemName: '기계 설비 배관 공사',
      spec: '배관 및 밸브류',
      unit: '식',
      contractQty: 1,
      contractUnitPrice: 5000000000,
      contractAmount: 5000000000,
      prevCumulativeQty: 0.35,
      currentQty: 0.15,
      cumulativeQty: 0.50,
      prevCumulativeAmt: 1750000000,
      currentBillingAmt: 750000000,
      cumulativeBillingAmt: 2500000000,
      remainingAmt: 2500000000,
      currentProgressRate: 15,
      cumulativeProgressRate: 50,
      calcBasis: '기계실 입상관 작업',
      remarks: '정상 진행'
    }
  ]);

  // 3. 외주계약 데이터 (Subcontractor Contracts)
  const [subContracts, setSubContracts] = useState<SubcontractorContract[]>([
    {
      id: 'subc-1',
      projectId,
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
      status: '계약체결',
      attachments: ['토공하도급계약서.pdf', '계약이행보증서.pdf']
    },
    {
      id: 'subc-2',
      projectId,
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
      directPaymentStatus: true, // 노무비 직불
      bondExpirationDate: '2027-01-31',
      status: '계약체결',
      attachments: ['골조하도급계약서.pdf', '직불동의서.pdf']
    },
    {
      id: 'subc-3',
      projectId,
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
      status: '계약체결',
      attachments: ['전기공사계약서.pdf']
    },
    {
      id: 'subc-4',
      projectId,
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
      status: '계약체결',
      attachments: ['기계설비계약서.pdf']
    }
  ]);

  // 4. 외주기성 데이터 (Subcontractor Billings)
  const [subBillings, setSubBillings] = useState<SubcontractorBilling[]>([
    {
      id: 'subb-1',
      projectId,
      subcontractorContractId: 'subc-1',
      subcontractorName: '(주)삼우토건',
      discipline: '토목',
      billingRound: 3,
      targetPeriodStart: '2026-06-01',
      targetPeriodEnd: '2026-06-30',
      claimDate: '2026-07-02',
      reviewDate: '2026-07-05',
      approvalDate: '2026-07-10',
      paymentScheduledDate: '2026-07-25',
      actualPaymentDate: undefined,
      prevCumulativeAmt: 1530000000,
      currentClaimAmt: 200000000,
      fieldReviewedAmt: 180000000,
      finalApprovedAmt: 180000000,
      cumulativeApprovedAmt: 1710000000,
      executionRate: 90.0,
      advanceDeductionAmt: 18000000,
      retentionAmt: 9000000,
      warrantyDeductionAmt: 0,
      laborCostAmt: 60000000,
      equipmentCostAmt: 80000000,
      materialCostAmt: 20000000,
      otherDeductionsAmt: 0,
      vatAmt: 0,
      netPayableAmt: 153000000, // 1.8억 - 1800만 - 900만 = 1.53억
      actualPaidAmt: 180000000,
      unpaidAmt: 20000000, // 미지급액
      paymentType: '현금',
      taxInvoiceIssued: true,
      directPaymentStatus: false,
      status: '지급완료',
      remarks: '현장 실측 결과 1.8억 사정 완료'
    },
    {
      id: 'subb-2',
      projectId,
      subcontractorContractId: 'subc-2',
      subcontractorName: '(주)한남건설골조',
      discipline: '건축',
      billingRound: 3,
      targetPeriodStart: '2026-06-01',
      targetPeriodEnd: '2026-06-30',
      claimDate: '2026-07-03',
      reviewDate: '2026-07-06',
      approvalDate: '2026-07-12',
      paymentScheduledDate: '2026-07-30',
      actualPaymentDate: undefined,
      prevCumulativeAmt: 11000000000,
      currentClaimAmt: 3800000000,
      fieldReviewedAmt: 3500000000,
      finalApprovedAmt: 3500000000,
      cumulativeApprovedAmt: 14500000000,
      executionRate: 61.7,
      advanceDeductionAmt: 350000000,
      retentionAmt: 175000000,
      warrantyDeductionAmt: 0,
      laborCostAmt: 1800000000, // 노무비
      equipmentCostAmt: 700000000,
      materialCostAmt: 800000000,
      otherDeductionsAmt: 0,
      vatAmt: 0,
      netPayableAmt: 2975000000, // 35억 - 3.5억 - 1.75억 = 29.75억
      actualPaidAmt: 1000000000,
      unpaidAmt: 1975000000, // 미지급액 19.75억
      paymentType: '현금',
      taxInvoiceIssued: true,
      directPaymentStatus: true, // 노무비 직불
      status: '승인',
      remarks: '노무비 직불건 현장 확인 후 승인'
    },
    {
      id: 'subb-3',
      projectId,
      subcontractorContractId: 'subc-3',
      subcontractorName: '(주)대성전력',
      discipline: '전기',
      billingRound: 3,
      targetPeriodStart: '2026-06-01',
      targetPeriodEnd: '2026-06-30',
      claimDate: '2026-07-04',
      reviewDate: '2026-07-08',
      approvalDate: undefined,
      paymentScheduledDate: '2026-07-25',
      actualPaymentDate: undefined,
      prevCumulativeAmt: 1000000000,
      currentClaimAmt: 600000000,
      fieldReviewedAmt: 500000000,
      finalApprovedAmt: 500000000,
      cumulativeApprovedAmt: 1500000000,
      executionRate: 46.8,
      advanceDeductionAmt: 50000000,
      retentionAmt: 25000000,
      warrantyDeductionAmt: 0,
      laborCostAmt: 200000000,
      equipmentCostAmt: 100000000,
      materialCostAmt: 200000000,
      otherDeductionsAmt: 0,
      vatAmt: 0,
      netPayableAmt: 425000000, // 5억 - 5000만 - 2500만 = 4.25억
      actualPaidAmt: 0,
      unpaidAmt: 425000000,
      paymentType: '현금',
      taxInvoiceIssued: false,
      directPaymentStatus: false,
      status: '검토',
      remarks: '본사 승인 진행 중'
    }
  ]);

  // 외주 공종별 기성 내역
  const [subBillingItems, setSubBillingItems] = useState<SubcontractorBillingItem[]>([
    {
      id: 'sbi-1',
      subcontractorBillingId: 'subb-1',
      subcontractorContractId: 'subc-1',
      itemCode: 'SUB-A001',
      discipline: '토목',
      itemName: '터파기 하도급 시공',
      spec: '풍화암 및 토사',
      unit: 'm3',
      contractQty: 50000,
      contractUnitPrice: 38000,
      contractAmount: 1900000000,
      prevCumulativeQty: 40000,
      currentQty: 5000,
      cumulativeQty: 45000,
      currentApprovedAmt: 180000000,
      cumulativeApprovedAmt: 1710000000,
      remainingContractAmt: 190000000,
      progressRate: 90,
      inspectionResult: '합격',
      reviewerOpinion: '토공사 마무리 및 토사유출 방지 양호'
    },
    {
      id: 'sbi-2',
      subcontractorBillingId: 'subb-2',
      subcontractorContractId: 'subc-2',
      itemCode: 'SUB-B001',
      discipline: '건축',
      itemName: '철근 가공 및 타설 하도급',
      spec: '지상층 골조 전체',
      unit: '식',
      contractQty: 1,
      contractUnitPrice: 23500000000,
      contractAmount: 23500000000,
      prevCumulativeQty: 0.468,
      currentQty: 0.149,
      cumulativeQty: 0.617,
      currentApprovedAmt: 3500000000,
      cumulativeApprovedAmt: 14500000000,
      remainingContractAmt: 9000000000,
      progressRate: 61.7,
      inspectionResult: '합격',
      reviewerOpinion: '8층 타설 품질 검측 완료'
    }
  ]);

  // 5. 실행예산 및 원가관리 데이터 (Site Execution Budget)
  const [executionBudgets, setExecutionBudgets] = useState<SiteExecutionBudget[]>([
    {
      id: 'seb-1',
      projectId,
      discipline: '공통관리',
      executionBudgetAmt: 1200000000,
      subcontractCost: 150000000,
      materialCost: 50000000,
      laborCost: 400000000,
      equipmentCost: 200000000,
      expenseCost: 200000000,
      siteOverheadAmt: 200000000,
      accumulatedIncurredCost: 950000000,
      estimatedRemainingCost: 200000000,
      expectedFinalCost: 1150000000,
      costExecutionRate: 79.2,
      expectedProfit: 350000000, // 도급계약 15억 대비
      expectedProfitMargin: 23.3,
      remainingBudget: 250000000,
      varianceReason: '안전관리비 집행 효율화'
    },
    {
      id: 'seb-2',
      projectId,
      discipline: '토목',
      executionBudgetAmt: 1850000000,
      subcontractCost: 1710000000,
      materialCost: 40000000,
      laborCost: 30000000,
      equipmentCost: 20000000,
      expenseCost: 10000000,
      siteOverheadAmt: 40000000,
      accumulatedIncurredCost: 1750000000,
      estimatedRemainingCost: 80000000,
      expectedFinalCost: 1830000000,
      costExecutionRate: 94.6,
      expectedProfit: 170000000, // 도급 20억 대비
      expectedProfitMargin: 8.5,
      remainingBudget: 100000000,
      varianceReason: '암반 파쇄 추가비용 일부 발생'
    },
    {
      id: 'seb-3',
      projectId,
      discipline: '건축',
      executionBudgetAmt: 25000000000,
      subcontractCost: 21000000000,
      materialCost: 2500000000,
      laborCost: 800000000,
      equipmentCost: 400000000,
      expenseCost: 150000000,
      siteOverheadAmt: 150000000,
      accumulatedIncurredCost: 15200000000,
      estimatedRemainingCost: 9200000000,
      expectedFinalCost: 24400000000,
      costExecutionRate: 60.8,
      expectedProfit: 3600000000, // 도급 280억 대비
      expectedProfitMargin: 12.8,
      remainingBudget: 9800000000,
      varianceReason: '레미콘 단가 인상 반영'
    },
    {
      id: 'seb-4',
      projectId,
      discipline: '전기',
      executionBudgetAmt: 3500000000,
      subcontractCost: 3000000000,
      materialCost: 300000000,
      laborCost: 100000000,
      equipmentCost: 50000000,
      expenseCost: 25000000,
      siteOverheadAmt: 25000000,
      accumulatedIncurredCost: 1600000000,
      estimatedRemainingCost: 1800000000,
      expectedFinalCost: 3400000000,
      costExecutionRate: 45.7,
      expectedProfit: 600000000, // 도급 40억 대비
      expectedProfitMargin: 15.0,
      remainingBudget: 1900000000,
      varianceReason: '전선 케이블 자재 직구 수급'
    },
    {
      id: 'seb-5',
      projectId,
      discipline: '기계',
      executionBudgetAmt: 4400000000,
      subcontractCost: 3800000000,
      materialCost: 400000000,
      laborCost: 100000000,
      equipmentCost: 50000000,
      expenseCost: 25000000,
      siteOverheadAmt: 25000000,
      accumulatedIncurredCost: 2600000000,
      estimatedRemainingCost: 1700000000,
      expectedFinalCost: 4300000000,
      costExecutionRate: 59.1,
      expectedProfit: 700000000, // 도급 50억 대비
      expectedProfitMargin: 14.0,
      remainingBudget: 1800000000,
      varianceReason: '장비 납품일정 준수'
    }
  ]);

  // Audit Logs & Comments
  const [auditLogs, setAuditLogs] = useState<BillingAuditLog[]>([
    { id: 'al-1', projectId, timestamp: '2026-07-15 14:30', user: '홍길동 (공무팀장)', action: '발주처 3차 기성 승인', module: '발주처 기성', details: '승인금액 90억원, 수금예정일 2026-07-31' },
    { id: 'al-2', projectId, timestamp: '2026-07-12 11:15', user: '김현장 (소장)', action: '외주기성 (주)한남건설골조 승인', module: '외주 기성', details: '승인금액 35억원 (노무비 직불 18억 포함)' }
  ]);

  // Modals state
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isInitialContractModalOpen, setIsInitialContractModalOpen] = useState(false);
  const [isEditHistoryModalOpen, setIsEditHistoryModalOpen] = useState(false);
  const [editingHistoryItem, setEditingHistoryItem] = useState<ClientContractHistory | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: ''
  });
  const [isClientBillingModalOpen, setIsClientBillingModalOpen] = useState(false);
  const [isEditClientBillingModalOpen, setIsEditClientBillingModalOpen] = useState(false);
  const [editingClientBilling, setEditingClientBilling] = useState<ClientBilling | null>(null);
  const [isSubContractModalOpen, setIsSubContractModalOpen] = useState(false);
  const [editingSubContractId, setEditingSubContractId] = useState<string | null>(null);
  const [isSubBillingModalOpen, setIsSubBillingModalOpen] = useState(false);
  const [isOverContractModalOpen, setIsOverContractModalOpen] = useState(false);
  const [overContractReason, setOverContractReason] = useState('');
  const [pendingOverContractSubmit, setPendingOverContractSubmit] = useState<(() => void) | null>(null);
  const [isEditSubBillingModalOpen, setIsEditSubBillingModalOpen] = useState(false);
  const [editingSubBilling, setEditingSubBilling] = useState<SubcontractorBilling | null>(null);
  const [selectedSubHistoryName, setSelectedSubHistoryName] = useState<string>('all');
  const [isSubHistoryInitialized, setIsSubHistoryInitialized] = useState(false);

  const subcontractorNames = useMemo(() => {
    const names = new Set<string>();
    if (Array.isArray(subContracts)) {
      subContracts.forEach(sc => {
        if (sc && sc.contractorName) names.add(sc.contractorName);
      });
    }
    if (Array.isArray(subBillings)) {
      subBillings.forEach(sb => {
        if (sb && sb.subcontractorName) names.add(sb.subcontractorName);
      });
    }
    return Array.from(names);
  }, [subContracts, subBillings]);

  useEffect(() => {
    if (!isSubHistoryInitialized && subcontractorNames.length > 0) {
      setSelectedSubHistoryName(subcontractorNames[0]);
      setIsSubHistoryInitialized(true);
    }
  }, [subcontractorNames, isSubHistoryInitialized]);

  const filteredSubHistory = useMemo(() => {
    let list = Array.isArray(subBillings) ? subBillings : [];
    if (selectedSubHistoryName !== 'all') {
      list = list.filter(sb => sb && sb.subcontractorName === selectedSubHistoryName);
    }
    return [...list].sort((a, b) => {
      const aRound = a?.billingRound || 0;
      const bRound = b?.billingRound || 0;
      return bRound - aRound;
    });
  }, [subBillings, selectedSubHistoryName]);

  const subHistorySummary = useMemo(() => {
    let list = Array.isArray(subBillings) ? subBillings : [];
    let contractAmount = 0;
    if (selectedSubHistoryName !== 'all') {
      list = list.filter(sb => sb && sb.subcontractorName === selectedSubHistoryName);
      const contract = subContracts.find(sc => sc.contractorName === selectedSubHistoryName);
      contractAmount = contract ? (contract.currentAmount || 0) : 0;
    }
    const totalClaim = list.reduce((sum, item) => sum + (item?.currentClaimAmt || 0), 0);
    const totalApproved = list.reduce((sum, item) => sum + (item?.finalApprovedAmt || 0), 0);
    const totalPaid = list.reduce((sum, item) => sum + (item?.actualPaidAmt || 0), 0);
    const totalUnpaid = list.reduce((sum, item) => sum + (item?.unpaidAmt || 0), 0);
    return { totalClaim, totalApproved, totalPaid, totalUnpaid, contractAmount };
  }, [subBillings, selectedSubHistoryName, subContracts]);

  const subContractorStats = useMemo(() => {
    if (!Array.isArray(subContracts)) return [];
    return subContracts.map(sc => {
      if (!sc) return null;
      const billings = Array.isArray(subBillings)
        ? subBillings.filter(
            sb => sb && (sb.subcontractorContractId === sc.id || sb.subcontractorName === sc.contractorName)
          )
        : [];
      const cumulativeClaim = billings.reduce((sum, sb) => sum + (sb?.currentClaimAmt || 0), 0);
      const cumulativeApproved = billings.reduce((sum, sb) => sum + (sb?.finalApprovedAmt || 0), 0);
      const cumulativePaid = billings.reduce((sum, sb) => sum + (sb?.actualPaidAmt || 0), 0);
      const balance = (sc.currentAmount || 0) - cumulativePaid;
      return {
        ...sc,
        cumulativeClaim,
        cumulativeApproved,
        cumulativePaid,
        balance
      };
    }).filter((sc): sc is NonNullable<typeof sc> => sc !== null);
  }, [subContracts, subBillings]);

  const overallSubContractorTotals = useMemo(() => {
    const totalContract = Array.isArray(subContracts)
      ? subContracts.reduce((sum, sc) => sum + (sc?.currentAmount || 0), 0)
      : 0;
    const totalClaim = Array.isArray(subBillings)
      ? subBillings.reduce((sum, sb) => sum + (sb?.currentClaimAmt || 0), 0)
      : 0;
    const totalApproved = Array.isArray(subBillings)
      ? subBillings.reduce((sum, sb) => sum + (sb?.finalApprovedAmt || 0), 0)
      : 0;
    const totalPaid = Array.isArray(subBillings)
      ? subBillings.reduce((sum, sb) => sum + (sb?.actualPaidAmt || 0), 0)
      : 0;
    const totalUnpaid = Array.isArray(subBillings)
      ? subBillings.reduce((sum, sb) => sum + (sb?.unpaidAmt || 0), 0)
      : 0;
    return {
      totalContract,
      totalClaim,
      totalApproved,
      totalPaid,
      totalUnpaid
    };
  }, [subContracts, subBillings]);

  // Initial Contract Form State
  const [initialContractForm, setInitialContractForm] = useState({
    initialAmount: 10000000000,
    advancePayment: 1000000000,
    retentionMoney: 675000000,
    performanceBond: 1350000000
  });

  const handleResetToDefault = () => {
    supabaseService.deleteBillingData(projectId);
    window.location.reload();
  };

  // Load stored data if present
  React.useEffect(() => {
    supabaseService.getBillingData(projectId).then(parsed => {
      try {
        if (parsed && Object.keys(parsed).length > 0) {
        
          // Migration check: If stored data contains the legacy 45B/48.5B KRW setup, or legacy 120B billing claims, or legacy VAT amounts (>0), or corrupted high billing collection amounts, clear it to apply the new 13.5B KRW zero-VAT schema
          const hasLegacyAmount = parsed.clientContract && 
            (parsed.clientContract.initialAmount === 45000000000 || 
             parsed.clientContract.currentAmount === 48500000000);

          const hasLegacyBillings = parsed.clientBillings && parsed.clientBillings.some((b: any) => {
            const claim = Number(b.currentClaimAmt || 0);
            const net = Number(b.netClaimAmt || 0);
            const coll = Number(b.collectedAmt || 0);
            const vat = Number(b.vatAmt || 0);
            return claim > 5000000000 || coll > 5000000000 || vat > 0; // If any claim or collection is > 5B KRW or vat is > 0, trigger migration to the new schema
          });

          if (hasLegacyAmount || hasLegacyBillings) {
            supabaseService.deleteBillingData(projectId);
            window.location.reload();
            return;
          }

          if (parsed.clientContract) setClientContract(parsed.clientContract);
          if (parsed.clientBillings) setClientBillings(parsed.clientBillings);
          if (parsed.subContracts) setSubContracts(parsed.subContracts);
          if (parsed.subBillings) setSubBillings(parsed.subBillings);
          if (parsed.clientBillingItems) setClientBillingItems(parsed.clientBillingItems);
          if (parsed.subBillingItems) setSubBillingItems(parsed.subBillingItems);
          if (parsed.executionBudgets) setExecutionBudgets(parsed.executionBudgets);
        }
      } catch (e) {
        console.error('Failed to parse saved billing data:', e);
      }
    });
  }, [projectId]);

  // Helper to save to Supabase
  const saveToSupabase = async (updatedDataFields: any) => {
    const dataToSave = {
      clientContract: updatedDataFields.clientContract || clientContract,
      clientBillings: updatedDataFields.clientBillings || clientBillings,
      subContracts: updatedDataFields.subContracts || subContracts,
      subBillings: updatedDataFields.subBillings || subBillings,
      clientBillingItems: updatedDataFields.clientBillingItems || clientBillingItems,
      subBillingItems: updatedDataFields.subBillingItems || subBillingItems,
      executionBudgets: updatedDataFields.executionBudgets || executionBudgets,
    };
    try {
      await supabaseService.saveBillingData(projectId, dataToSave);
    } catch (err) {
      console.error('Failed to save billing data to Supabase:', err);
    }
  };
  const [amendmentForm, setAmendmentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    changeAmount: 0,
    designChangeAmount: 0,
    priceFluctuationAmount: 0,
    extraWorkAmount: 0,
    reason: '',
    approvedBy: '발주처 관리자',
    attachment: ''
  });

  // Form states for modals
  const [newSubContract, setNewSubContract] = useState<Partial<SubcontractorContract>>({
    contractorName: '',
    businessRegNo: '',
    representative: '',
    contactPerson: '',
    contactPhone: '',
    discipline: '건축',
    contractDate: new Date().toISOString().split('T')[0],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2027-03-31',
    initialAmount: 0,
    amendedAmount: 0,
    currentAmount: 0,
    advancePayment: 0,
    warrantyBondRate: 5,
    performanceBondRate: 10,
    retentionRate: 5,
    paymentTerms: '익월 25일 현금',
    paymentDueDate: new Date().toISOString().split('T')[0],
    laborCostType: '직접노무비',
    directPaymentStatus: false,
    bondExpirationDate: '2027-04-30',
    status: '계약체결'
  });

  const [newClientBilling, setNewClientBilling] = useState<Partial<ClientBilling>>({
    billingRound: clientBillings.length + 1,
    targetPeriodStart: '2026-07-01',
    targetPeriodEnd: '2026-07-31',
    referenceDate: '2026-07-31',
    createdDate: new Date().toISOString().split('T')[0],
    billingExpectedDate: '2026-08-15',
    collectionExpectedDate: '2026-08-31',
    currentClaimAmt: 5000000000,
    advanceDeductionAmt: 500000000,
    retentionAmt: 250000000,
    otherDeductionsAmt: 0,
    vatAmt: 0,
    netClaimAmt: 4250000000,
    status: '임시저장',
    remarks: ''
  });

  const [newSubBilling, setNewSubBilling] = useState({
    subcontractorContractId: '',
    billingRound: 1,
    targetPeriodStart: '2026-07-01',
    targetPeriodEnd: '2026-07-31',
    currentClaimAmt: 0,
    fieldReviewedAmt: 0,
    finalApprovedAmt: 0,
    remarks: ''
  });

  // Save Contract Amendment Handler (차수 추가)
  const handleSaveContractAmendment = (e: React.FormEvent) => {
    e.preventDefault();
    const changeAmt = Number(amendmentForm.changeAmount || 0);
    const newCurrentAmount = clientContract.currentAmount + changeAmt;
    const newRound = (clientContract.history?.length || 0) + 1;

    const newHistoryItem = {
      id: `cch-${Date.now()}`,
      round: newRound,
      date: amendmentForm.date || new Date().toISOString().split('T')[0],
      changeAmount: changeAmt,
      contractAmountAfter: newCurrentAmount,
      reason: amendmentForm.reason || '설계 변경 및 계약 금액 조정',
      approvedBy: amendmentForm.approvedBy || '발주처 관리자'
    };

    const updatedContract: ClientContract = {
      ...clientContract,
      amendmentRound: newRound,
      currentAmount: newCurrentAmount,
      amendedAmount: newCurrentAmount,
      changeAmount: changeAmt,
      changeReason: amendmentForm.reason || '설계 변경 반영',
      designChangeAmount: (clientContract.designChangeAmount || 0) + Number(amendmentForm.designChangeAmount || 0),
      priceFluctuationAmount: (clientContract.priceFluctuationAmount || 0) + Number(amendmentForm.priceFluctuationAmount || 0),
      extraWorkAmount: (clientContract.extraWorkAmount || 0) + Number(amendmentForm.extraWorkAmount || 0),
      contractBalance: newCurrentAmount - cumulativeClientCollectedAmt,
      attachments: amendmentForm.attachment
        ? [...(clientContract.attachments || []), amendmentForm.attachment]
        : clientContract.attachments,
      history: [...(clientContract.history || []), newHistoryItem]
    };

    setClientContract(updatedContract);

    // Recalculate billing rates based on new current amount
    const updatedBillings = clientBillings.map(b => ({
      ...b,
      billingRate: Number(((b.cumulativeBillingAmt / (newCurrentAmount || 1)) * 100).toFixed(2))
    }));
    setClientBillings(updatedBillings);

    // Save in Supabase
    saveToSupabase({
      clientContract: updatedContract,
      clientBillings: updatedBillings
    });

    // Add Audit Log
    setAuditLogs(prev => [
      {
        id: `al-${Date.now()}`,
        projectId,
        timestamp: new Date().toLocaleString('ko-KR'),
        user: '공무담당자',
        action: `발주처 계약 변경 (${newRound}차 등록)`,
        module: '발주처 계약',
        details: `증감: ${formatKRW(changeAmt)}, 변경 후: ${formatKRW(newCurrentAmount)} (${amendmentForm.reason})`
      },
      ...prev
    ]);

    setIsContractModalOpen(false);
    setAmendmentForm({
      date: new Date().toISOString().split('T')[0],
      changeAmount: 0,
      designChangeAmount: 0,
      priceFluctuationAmount: 0,
      extraWorkAmount: 0,
      reason: '',
      approvedBy: '발주처 관리자',
      attachment: ''
    });
  };

  // Save Initial Contract Handler (최초 계약 정보 수정)
  const handleSaveInitialContract = (e: React.FormEvent) => {
    e.preventDefault();
    const newInitial = Number(initialContractForm.initialAmount || 0);
    const newAdvance = Number(initialContractForm.advancePayment || 0);
    const newRetention = Number(initialContractForm.retentionMoney || 0);
    const newBond = Number(initialContractForm.performanceBond || 0);

    let runningAmount = newInitial;
    const updatedHistory = (clientContract.history || []).map((h, idx) => {
      runningAmount += h.changeAmount;
      return {
        ...h,
        round: idx + 1,
        contractAmountAfter: runningAmount
      };
    });

    const newCurrentAmount = runningAmount;

    const updatedContract: ClientContract = {
      ...clientContract,
      initialAmount: newInitial,
      currentAmount: newCurrentAmount,
      amendedAmount: newCurrentAmount,
      advancePayment: newAdvance,
      retentionMoney: newRetention,
      performanceBond: newBond,
      contractBalance: newCurrentAmount - cumulativeClientCollectedAmt,
      history: updatedHistory
    };

    setClientContract(updatedContract);

    // Recalculate billing rates based on new current amount
    const updatedBillings = clientBillings.map(b => ({
      ...b,
      billingRate: Number(((b.cumulativeBillingAmt / (newCurrentAmount || 1)) * 100).toFixed(2))
    }));
    setClientBillings(updatedBillings);

    saveToSupabase({
      clientContract: updatedContract,
      clientBillings: updatedBillings
    });

    setAuditLogs(prev => [
      {
        id: `al-${Date.now()}`,
        projectId,
        timestamp: new Date().toLocaleString('ko-KR'),
        user: '공무담당자',
        action: '발주처 최초 계약 정보 수정',
        module: '발주처 계약',
        details: `최초 계약금액: ${formatKRW(newInitial)}, 변경후 현재 계약금액: ${formatKRW(newCurrentAmount)}`
      },
      ...prev
    ]);

    setIsInitialContractModalOpen(false);
  };

  // Save Contract Amendment History Edit Handler
  const handleSaveEditHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHistoryItem) return;

    const updatedHistory = (clientContract.history || []).map(h => {
      if (h.id === editingHistoryItem.id) {
        return {
          ...h,
          date: editingHistoryItem.date,
          changeAmount: Number(editingHistoryItem.changeAmount || 0),
          reason: editingHistoryItem.reason,
          approvedBy: editingHistoryItem.approvedBy
        };
      }
      return h;
    });

    // Recalculate contractAmountAfter and rounds sequentially starting from initialAmount
    let runningAmount = clientContract.initialAmount;
    const recalculatedHistory = updatedHistory.map((h, idx) => {
      runningAmount += h.changeAmount;
      return {
        ...h,
        round: idx + 1,
        contractAmountAfter: runningAmount
      };
    });

    const finalAmount = runningAmount;
    const maxRound = recalculatedHistory.length;
    const lastItem = recalculatedHistory[recalculatedHistory.length - 1];

    const updatedContract: ClientContract = {
      ...clientContract,
      amendmentRound: maxRound,
      currentAmount: finalAmount,
      amendedAmount: finalAmount,
      changeAmount: lastItem ? lastItem.changeAmount : 0,
      changeReason: lastItem ? lastItem.reason : '최초 계약 상태',
      contractBalance: finalAmount - cumulativeClientCollectedAmt,
      history: recalculatedHistory
    };

    setClientContract(updatedContract);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.clientContract = updatedContract;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }

    setAuditLogs(prev => [
      {
        id: `al-${Date.now()}`,
        projectId,
        timestamp: new Date().toLocaleString('ko-KR'),
        user: '공무담당자',
        action: `발주처 계약 변경 이력 수정 (${editingHistoryItem.round}차)`,
        module: '발주처 계약',
        details: `${editingHistoryItem.round}차 계약변경 이력 수정 완료 (최종 계약금액: ${formatKRW(finalAmount)})`
      },
      ...prev
    ]);

    setIsEditHistoryModalOpen(false);
    setEditingHistoryItem(null);
  };

  // Perform Specific Contract Amendment History Item Delete
  const performDeleteHistoryItem = (historyId: string) => {
    const target = clientContract.history?.find(h => h.id === historyId);
    if (!target) return;

    const filteredHistory = (clientContract.history || []).filter(h => h.id !== historyId);

    let runningAmount = clientContract.initialAmount;
    const recalculatedHistory = filteredHistory.map((h, idx) => {
      runningAmount += h.changeAmount;
      return {
        ...h,
        round: idx + 1,
        contractAmountAfter: runningAmount
      };
    });

    const finalAmount = runningAmount;
    const maxRound = recalculatedHistory.length;
    const lastItem = recalculatedHistory[recalculatedHistory.length - 1];

    const updatedContract: ClientContract = {
      ...clientContract,
      amendmentRound: maxRound,
      currentAmount: finalAmount,
      amendedAmount: finalAmount,
      changeAmount: lastItem ? lastItem.changeAmount : 0,
      changeReason: lastItem ? lastItem.reason : '최초 계약 상태',
      contractBalance: finalAmount - cumulativeClientCollectedAmt,
      history: recalculatedHistory
    };

    setClientContract(updatedContract);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.clientContract = updatedContract;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }

    setAuditLogs(prev => [
      {
        id: `al-${Date.now()}`,
        projectId,
        timestamp: new Date().toLocaleString('ko-KR'),
        user: '공무담당자',
        action: `발주처 계약 변경 이력 삭제 (${target.round}차)`,
        module: '발주처 계약',
        details: `${target.round}차 계약 변경 이력 삭제 (최종 계약금액: ${formatKRW(finalAmount)})`
      },
      ...prev
    ]);
  };

  // Delete Specific Contract Amendment History Item Handler
  const handleDeleteHistoryItem = (historyId: string) => {
    const target = clientContract.history?.find(h => h.id === historyId);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: `${target.round}차 계약 변경 이력 삭제`,
      message: `${target.round}차 계약 변경 이력(${formatKRW(target.changeAmount)})을 삭제하시겠습니까? 삭제 후 최종 계약금액이 자동으로 재계산됩니다.`,
      type: 'danger',
      onConfirm: () => performDeleteHistoryItem(historyId)
    });
  };

  // Perform All Amendment History Delete (Reset to Initial Contract State)
  const performDeleteAllAmendmentHistory = () => {
    const finalAmount = clientContract.initialAmount;

    const updatedContract: ClientContract = {
      ...clientContract,
      amendmentRound: 0,
      currentAmount: finalAmount,
      amendedAmount: finalAmount,
      changeAmount: 0,
      changeReason: '최초 계약 상태',
      designChangeAmount: 0,
      priceFluctuationAmount: 0,
      extraWorkAmount: 0,
      contractBalance: finalAmount - cumulativeClientCollectedAmt,
      history: []
    };

    setClientContract(updatedContract);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.clientContract = updatedContract;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }

    setAuditLogs(prev => [
      {
        id: `al-${Date.now()}`,
        projectId,
        timestamp: new Date().toLocaleString('ko-KR'),
        user: '공무담당자',
        action: '발주처 계약 변경 이력 전체 삭제 (초기화)',
        module: '발주처 계약',
        details: `변경 이력 전체 삭제 완료 및 최초 계약금액(${formatKRW(finalAmount)})으로 초기화`
      },
      ...prev
    ]);
  };

  const handleDeleteSubBilling = (id: string) => {
    const target = subBillings.find(sb => sb.id === id);
    setConfirmModal({
      isOpen: true,
      title: '외주 기성 이력 삭제',
      message: target ? `[${target.subcontractorName}] ${target.billingRound}차 기성 신청/사정 이력을 정말 삭제하시겠습니까?` : '해당 외주 기성 이력을 삭제하시겠습니까?',
      type: 'danger',
      onConfirm: () => performDeleteSubBilling(id)
    });
  };

  const performDeleteSubBilling = (id: string) => {
    const updatedSubBillings = subBillings.filter(sb => sb.id !== id);
    setSubBillings(updatedSubBillings);
    
    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.subBillings = updatedSubBillings;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubBilling = (sb: SubcontractorBilling) => {
    setEditingSubBilling({ ...sb });
    setIsEditSubBillingModalOpen(true);
  };
  
  const handleSaveEditSubBilling = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingSubBilling) return;

    const currentClaim = Number(editingSubBilling.currentClaimAmt || 0);
    const finalApproved = Number(editingSubBilling.finalApprovedAmt || 0);
    const actualPaid = Number(editingSubBilling.actualPaidAmt || 0);
    const unpaid = Math.max(0, currentClaim - actualPaid);

    let paymentStatus: SubcontractorBillingStatus = editingSubBilling.status;
    if (actualPaid >= finalApproved && finalApproved > 0) {
      paymentStatus = '지급완료';
    } else {
      paymentStatus = editingSubBilling.status || '승인';
    }

    const updatedBilling: SubcontractorBilling = {
      ...editingSubBilling,
      currentClaimAmt: Number(editingSubBilling.currentClaimAmt || 0),
      finalApprovedAmt: finalApproved,
      actualPaidAmt: actualPaid,
      unpaidAmt: unpaid,
      status: paymentStatus
    };

    const updatedSubBillings = subBillings.map(sb => sb.id === updatedBilling.id ? updatedBilling : sb);
    setSubBillings(updatedSubBillings);
    
    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.subBillings = updatedSubBillings;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }
    
    setIsEditSubBillingModalOpen(false);
    setEditingSubBilling(null);
  };

  // Delete All Amendment History Handler
  const handleDeleteAllAmendmentHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: '계약 변경 이력 전체 삭제 (초기화)',
      message: '모든 계약 변경 이력을 삭제하고 최초 계약금액 상태로 초기화하시겠습니까?',
      type: 'danger',
      onConfirm: () => performDeleteAllAmendmentHistory()
    });
  };

  // Save Client Billing Handler
  const handleSaveClientBilling = (e: React.FormEvent) => {
    e.preventDefault();
    const newRound = clientBillings.length + 1;
    const claimAmt = Number(newClientBilling.currentClaimAmt || 0);
    const prevCum = cumulativeClientBillingAmt;
    const cumBilling = prevCum + claimAmt;
    const billingRate = totalContractAmount > 0 ? Number(((cumBilling / totalContractAmount) * 100).toFixed(2)) : 0;

    const advDeduct = Number(newClientBilling.advanceDeductionAmt || 0);
    const retDeduct = Number(newClientBilling.retentionAmt || 0);
    const otherDeduct = Number(newClientBilling.otherDeductionsAmt || 0);
    const vat = 0; // 부가세 미반영
    const netClaim = claimAmt - advDeduct - retDeduct - otherDeduct;

    const newBilling: ClientBilling = {
      id: `cb-${Date.now()}`,
      projectId,
      contractId: clientContract.id,
      billingRound: newRound,
      targetPeriodStart: newClientBilling.targetPeriodStart || '2026-07-01',
      targetPeriodEnd: newClientBilling.targetPeriodEnd || '2026-07-31',
      referenceDate: newClientBilling.targetPeriodEnd || '2026-07-31',
      createdDate: new Date().toISOString().split('T')[0],
      submittedDate: new Date().toISOString().split('T')[0],
      billingExpectedDate: newClientBilling.billingExpectedDate || '2026-08-15',
      collectionExpectedDate: newClientBilling.collectionExpectedDate || '2026-08-31',
      prevCumulativeAmt: prevCum,
      currentClaimAmt: claimAmt,
      cumulativeBillingAmt: cumBilling,
      billingRate,
      advanceDeductionAmt: advDeduct,
      retentionAmt: retDeduct,
      otherDeductionsAmt: otherDeduct,
      vatAmt: vat,
      netClaimAmt: netClaim,
      collectedAmt: 0,
      receivableAmt: netClaim,
      status: '승인요청',
      remarks: newClientBilling.remarks || `${newRound}차 기성 청구`
    };

    const updatedBillings = [...clientBillings, newBilling];
    setClientBillings(updatedBillings);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.clientBillings = updatedBillings;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }

    setIsClientBillingModalOpen(false);
  };

  // Update Client Billing Handler
  const handleUpdateClientBilling = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClientBilling) return;

    const updatedList = clientBillings.map(b => b.id === editingClientBilling.id ? editingClientBilling : b);

    let runningCum = 0;
    const contractAmt = clientContract.currentAmount || 1;

    const recalculated = updatedList.map((b, idx) => {
      const prevCum = runningCum;
      const claimAmt = Number(b.currentClaimAmt || 0);
      const cumBilling = prevCum + claimAmt;
      runningCum = cumBilling;

      const rate = Number(((cumBilling / contractAmt) * 100).toFixed(2));
      const advDeduct = Number(b.advanceDeductionAmt || 0);
      const retDeduct = Number(b.retentionAmt || 0);
      const otherDeduct = Number(b.otherDeductionsAmt || 0);
      const vat = 0; // 부가세 미반영
      const netClaim = claimAmt - advDeduct - retDeduct - otherDeduct;
      const collected = Number(b.collectedAmt || 0);
      const receivable = Math.max(0, netClaim - collected);

      return {
        ...b,
        billingRound: idx + 1,
        prevCumulativeAmt: prevCum,
        currentClaimAmt: claimAmt,
        cumulativeBillingAmt: cumBilling,
        billingRate: rate,
        advanceDeductionAmt: advDeduct,
        retentionAmt: retDeduct,
        otherDeductionsAmt: otherDeduct,
        vatAmt: vat,
        netClaimAmt: netClaim,
        collectedAmt: collected,
        receivableAmt: receivable
      };
    });

    setClientBillings(recalculated);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.clientBillings = recalculated;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }

    setAuditLogs(prev => [
      {
        id: `al-${Date.now()}`,
        projectId,
        timestamp: new Date().toLocaleString('ko-KR'),
        user: '공무담당자',
        action: `발주처 ${editingClientBilling.billingRound}차 기성 청구 수정`,
        module: '발주처 기성',
        details: `청구액: ${formatKRW(editingClientBilling.currentClaimAmt)}, 실수금액: ${formatKRW(editingClientBilling.collectedAmt)}`
      },
      ...prev
    ]);

    setIsEditClientBillingModalOpen(false);
    setEditingClientBilling(null);
  };

  // Perform Client Billing Delete Handler
  const performDeleteClientBilling = (id: string) => {
    const target = clientBillings.find(b => b.id === id);
    if (!target) return;

    const filtered = clientBillings.filter(b => b.id !== id);

    let runningCum = 0;
    const contractAmt = clientContract.currentAmount || 1;

    const recalculated = filtered.map((b, idx) => {
      const prevCum = runningCum;
      const claimAmt = Number(b.currentClaimAmt || 0);
      const cumBilling = prevCum + claimAmt;
      runningCum = cumBilling;

      const rate = Number(((cumBilling / contractAmt) * 100).toFixed(2));
      const advDeduct = Number(b.advanceDeductionAmt || 0);
      const retDeduct = Number(b.retentionAmt || 0);
      const otherDeduct = Number(b.otherDeductionsAmt || 0);
      const vat = 0; // 부가세 미반영
      const netClaim = claimAmt - advDeduct - retDeduct - otherDeduct;
      const collected = Number(b.collectedAmt || 0);
      const receivable = Math.max(0, netClaim - collected);

      return {
        ...b,
        billingRound: idx + 1,
        prevCumulativeAmt: prevCum,
        currentClaimAmt: claimAmt,
        cumulativeBillingAmt: cumBilling,
        billingRate: rate,
        advanceDeductionAmt: advDeduct,
        retentionAmt: retDeduct,
        otherDeductionsAmt: otherDeduct,
        vatAmt: vat,
        netClaimAmt: netClaim,
        collectedAmt: collected,
        receivableAmt: receivable
      };
    });

    setClientBillings(recalculated);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.clientBillings = recalculated;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }

    setAuditLogs(prev => [
      {
        id: `al-${Date.now()}`,
        projectId,
        timestamp: new Date().toLocaleString('ko-KR'),
        user: '공무담당자',
        action: `발주처 ${target.billingRound}차 기성 청구 삭제`,
        module: '발주처 기성',
        details: `삭제된 기성 청구액: ${formatKRW(target.currentClaimAmt)}`
      },
      ...prev
    ]);
  };

  // Delete Client Billing Handler
  const handleDeleteClientBilling = (id: string) => {
    const target = clientBillings.find(b => b.id === id);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: `${target.billingRound}차 발주처 기성 청구 삭제`,
      message: `${target.billingRound}차 기성 청구(금회 청구액: ${formatKRW(target.currentClaimAmt)})를 삭제하시겠습니까? 삭제 후 나머지 기성의 차수 및 누계액이 자동으로 재계산됩니다.`,
      type: 'danger',
      onConfirm: () => performDeleteClientBilling(id)
    });
  };

  // Save Subcontractor Contract Handler
  const handleSaveSubContract = (e: React.FormEvent) => {
    e.preventDefault();
    const curAmt = Number(newSubContract.currentAmount || 0);
    const adv = Number(newSubContract.advancePayment || 0);

    let updatedSubContracts: SubcontractorContract[];

    if (editingSubContractId) {
      updatedSubContracts = subContracts.map(sc => {
        if (sc.id === editingSubContractId) {
          return {
            ...sc,
            contractorName: newSubContract.contractorName || '(주)신규하도급',
            businessRegNo: newSubContract.businessRegNo || '000-00-00000',
            representative: newSubContract.representative || '000',
            contactPerson: newSubContract.contactPerson || '담당자',
            contactPhone: newSubContract.contactPhone || '010-0000-0000',
            discipline: newSubContract.discipline || '건축',
            contractDate: newSubContract.contractDate || new Date().toISOString().split('T')[0],
            startDate: newSubContract.startDate || new Date().toISOString().split('T')[0],
            endDate: newSubContract.endDate || '2027-03-31',
            initialAmount: sc.initialAmount || curAmt,
            amendedAmount: curAmt,
            currentAmount: curAmt,
            advancePayment: adv,
            warrantyBondRate: Number(newSubContract.warrantyBondRate || 5),
            performanceBondRate: Number(newSubContract.performanceBondRate || 10),
            retentionRate: Number(newSubContract.retentionRate || 5),
            paymentTerms: newSubContract.paymentTerms || '익월 25일 현금',
            paymentDueDate: newSubContract.paymentDueDate || new Date().toISOString().split('T')[0],
            laborCostType: newSubContract.laborCostType || '직접노무비',
            directPaymentStatus: !!newSubContract.directPaymentStatus,
            bondExpirationDate: newSubContract.bondExpirationDate || '2027-04-30',
            status: newSubContract.status || sc.status
          };
        }
        return sc;
      });
    } else {
      const createdSub: SubcontractorContract = {
        id: `subc-${Date.now()}`,
        projectId,
        contractorName: newSubContract.contractorName || '(주)신규하도급',
        businessRegNo: newSubContract.businessRegNo || '000-00-00000',
        representative: newSubContract.representative || '000',
        contactPerson: newSubContract.contactPerson || '담당자',
        contactPhone: newSubContract.contactPhone || '010-0000-0000',
        discipline: newSubContract.discipline || '건축',
        contractDate: newSubContract.contractDate || new Date().toISOString().split('T')[0],
        startDate: newSubContract.startDate || new Date().toISOString().split('T')[0],
        endDate: newSubContract.endDate || '2027-03-31',
        initialAmount: curAmt,
        amendedAmount: curAmt,
        currentAmount: curAmt,
        advancePayment: adv,
        warrantyBondRate: Number(newSubContract.warrantyBondRate || 5),
        performanceBondRate: Number(newSubContract.performanceBondRate || 10),
        retentionRate: Number(newSubContract.retentionRate || 5),
        paymentTerms: newSubContract.paymentTerms || '익월 25일 현금',
        paymentDueDate: newSubContract.paymentDueDate || new Date().toISOString().split('T')[0],
        laborCostType: newSubContract.laborCostType || '직접노무비',
        directPaymentStatus: !!newSubContract.directPaymentStatus,
        bondExpirationDate: newSubContract.bondExpirationDate || '2027-04-30',
        status: '계약체결',
        attachments: []
      };
      updatedSubContracts = [...subContracts, createdSub];
    }

    setSubContracts(updatedSubContracts);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.subContracts = updatedSubContracts;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }

    setIsSubContractModalOpen(false);
    setEditingSubContractId(null);
  };

  const handleEditSubContract = (sc: SubcontractorContract) => {
    setNewSubContract({
      contractorName: sc.contractorName,
      businessRegNo: sc.businessRegNo,
      representative: sc.representative,
      contactPerson: sc.contactPerson,
      contactPhone: sc.contactPhone,
      discipline: sc.discipline,
      contractDate: sc.contractDate,
      startDate: sc.startDate,
      endDate: sc.endDate,
      currentAmount: sc.currentAmount,
      advancePayment: sc.advancePayment,
      warrantyBondRate: sc.warrantyBondRate,
      performanceBondRate: sc.performanceBondRate,
      retentionRate: sc.retentionRate,
      paymentTerms: sc.paymentTerms,
      paymentDueDate: sc.paymentDueDate,
      laborCostType: sc.laborCostType,
      directPaymentStatus: sc.directPaymentStatus,
      bondExpirationDate: sc.bondExpirationDate,
      status: sc.status
    });
    setEditingSubContractId(sc.id);
    setIsSubContractModalOpen(true);
  };

  const handleDeleteSubContract = (id: string) => {
    const target = subContracts.find(sc => sc.id === id);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: `외주 하도급 계약 삭제`,
      message: `외주 하도급 계약 [${target.discipline}] ${target.contractorName} 건을 정말로 삭제하시겠습니까?`,
      type: 'danger',
      onConfirm: () => performDeleteSubContract(id)
    });
  };

  const performDeleteSubContract = (id: string) => {
    const updatedSubContracts = subContracts.filter(sc => sc.id !== id);
    setSubContracts(updatedSubContracts);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.subContracts = updatedSubContracts;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }
  };

  // Save Subcontractor Billing Handler
  const handleSaveSubBilling = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedSubId = newSubBilling.subcontractorContractId || subContracts[0]?.id || '';
    const subContract = subContracts.find(sc => sc.id === selectedSubId) || subContracts[0];
    const claimAmt = Number(newSubBilling.currentClaimAmt || 0);
    const approvedAmt = Number(newSubBilling.finalApprovedAmt || claimAmt);

    const prevCum = subContract
      ? subBillings
          .filter(sb => sb.subcontractorContractId === subContract.id)
          .reduce((sum, sb) => sum + sb.finalApprovedAmt, 0)
      : 0;

    const createdSubBilling: SubcontractorBilling = {
      id: `subb-${Date.now()}`,
      projectId,
      subcontractorContractId: subContract?.id || 'subc-1',
      subcontractorName: subContract?.contractorName || '(주)외주업체',
      discipline: subContract?.discipline || '건축',
      billingRound: newSubBilling.billingRound || 1,
      targetPeriodStart: newSubBilling.targetPeriodStart,
      targetPeriodEnd: newSubBilling.targetPeriodEnd,
      claimDate: new Date().toISOString().split('T')[0],
      paymentScheduledDate: '2026-08-25',
      prevCumulativeAmt: prevCum,
      currentClaimAmt: claimAmt,
      fieldReviewedAmt: approvedAmt,
      finalApprovedAmt: approvedAmt,
      cumulativeApprovedAmt: prevCum + approvedAmt,
      executionRate: subContract && subContract.currentAmount > 0 ? Number((((prevCum + approvedAmt) / subContract.currentAmount) * 100).toFixed(1)) : 0,
      advanceDeductionAmt: 0,
      retentionAmt: 0,
      warrantyDeductionAmt: 0,
      laborCostAmt: Math.round(approvedAmt * 0.4),
      equipmentCostAmt: Math.round(approvedAmt * 0.2),
      materialCostAmt: Math.round(approvedAmt * 0.4),
      otherDeductionsAmt: 0,
      vatAmt: 0,
      netPayableAmt: approvedAmt,
      actualPaidAmt: 0,
      unpaidAmt: claimAmt,
      paymentType: '현금',
      taxInvoiceIssued: false,
      directPaymentStatus: subContract ? subContract.directPaymentStatus : false,
      status: '청구',
      remarks: newSubBilling.remarks || '신규 외주기성 접수'
    };

    const updatedSubBillings = [...subBillings, createdSubBilling];
    setSubBillings(updatedSubBillings);

    try {
      const saved = localStorage.getItem(`cp_billing_data_${projectId}`) || '{}';
      const parsed = JSON.parse(saved);
      parsed.subBillings = updatedSubBillings;
      localStorage.setItem(`cp_billing_data_${projectId}`, JSON.stringify(parsed));
    } catch (err) {
      console.error(err);
    }

    setIsSubBillingModalOpen(false);
  };

  // Calculate Key Summary Indicators (KPIs)
  const totalContractAmount = clientContract.currentAmount;
  const cumulativeClientBillingAmt = useMemo(() => {
    return clientBillings.reduce((sum, b) => sum + b.currentClaimAmt, 0);
  }, [clientBillings]);

  const cumulativeClientCollectedAmt = useMemo(() => {
    return clientBillings.reduce((sum, b) => sum + b.collectedAmt, 0);
  }, [clientBillings]);

  const totalClientReceivableAmt = useMemo(() => {
    return clientBillings.reduce((sum, b) => sum + Math.max(0, b.netClaimAmt - b.collectedAmt), 0);
  }, [clientBillings]);

  const latestReceivableBilling = useMemo(() => {
    return [...clientBillings].reverse().find(b => (b.netClaimAmt - b.collectedAmt) > 0);
  }, [clientBillings]);

  const cumulativeSubApprovedAmt = useMemo(() => {
    return subBillings.reduce((sum, sb) => sum + sb.finalApprovedAmt, 0);
  }, [subBillings]);

  const calculatedProfitMargin = useMemo(() => {
    const marginAmt = cumulativeClientBillingAmt - cumulativeSubApprovedAmt;
    const marginRate = cumulativeClientBillingAmt > 0 ? (marginAmt / cumulativeClientBillingAmt) * 100 : 0;
    return { marginAmt, marginRate };
  }, [cumulativeClientBillingAmt, cumulativeSubApprovedAmt]);

  const trendChartData = useMemo(() => {
    return clientBillings.map((cb) => {
      const round = cb.billingRound;
      const targetYM = cb.targetPeriodEnd ? cb.targetPeriodEnd.substring(0, 7) : '';

      const currentYMSub = subBillings
        .filter(sb => sb.targetPeriodEnd && sb.targetPeriodEnd.substring(0, 7) === targetYM)
        .reduce((sum, sb) => sum + sb.finalApprovedAmt, 0);

      const cumYMSub = subBillings
        .filter(sb => sb.targetPeriodEnd && sb.targetPeriodEnd.substring(0, 7) <= targetYM)
        .reduce((sum, sb) => sum + sb.finalApprovedAmt, 0);

      const monthLabel = cb.targetPeriodEnd ? `${cb.targetPeriodEnd.split('-')[1]}월 (${round}차)` : `${round}차`;

      return {
        month: monthLabel,
        도급기성: Number((cb.currentClaimAmt / 100000000).toFixed(2)),
        외주기성: Number((currentYMSub / 100000000).toFixed(2)),
        누적도급: Number((cb.cumulativeBillingAmt / 100000000).toFixed(2)),
        누적외주: Number((cumYMSub / 100000000).toFixed(2))
      };
    });
  }, [clientBillings, subBillings]);

  const cumulativeSubPaidAmt = useMemo(() => {
    return subBillings.reduce((sum, sb) => sum + sb.actualPaidAmt, 0);
  }, [subBillings]);

  const totalSubUnpaidAmt = useMemo(() => {
    return subBillings.reduce((sum, sb) => sum + sb.unpaidAmt, 0);
  }, [subBillings]);

  const totalExpectedFinalCost = useMemo(() => {
    return executionBudgets.reduce((sum, b) => sum + b.expectedFinalCost, 0);
  }, [executionBudgets]);

  const totalExpectedProfit = totalContractAmount - totalExpectedFinalCost;
  const totalExpectedProfitMargin = (totalExpectedProfit / totalContractAmount) * 100;

  // Key Alert Counts
  const alertsList = useMemo(() => {
    const list: { type: 'danger' | 'warning' | 'info'; title: string; desc: string; module: string }[] = [];

    // 1. Pending Approvals
    const pendingClient = clientBillings.filter(b => b.status === '승인요청' || b.status === '검토중');
    if (pendingClient.length > 0) {
      list.push({ type: 'warning', title: `발주처 기성 승인대기 ${pendingClient.length}건`, desc: '3차 발주처 기성이 승인 검토 중입니다.', module: '발주처 기성' });
    }

    const pendingSub = subBillings.filter(sb => sb.status === '청구' || sb.status === '검토');
    if (pendingSub.length > 0) {
      list.push({ type: 'warning', title: `외주기성 검토/승인 대기 ${pendingSub.length}건`, desc: '(주)대성전력 외주기성 검토 요청 접수', module: '외주 기성' });
    }

    // 2. Overdue A/R (미수금)
    if (totalClientReceivableAmt > 0) {
      list.push({ type: 'danger', title: `발주처 미수금 발생 (${formatKRW(totalClientReceivableAmt)})`, desc: '3차 기성 수금 예정일 도래 (미수 잔액 존재)', module: '수금 관리' });
    }

    // 3. Overdue A/P (미지급금)
    if (totalSubUnpaidAmt > 0) {
      list.push({ type: 'danger', title: `외주업체 미지급금 발생 (${formatKRW(totalSubUnpaidAmt)})`, desc: '(주)한남건설골조 등 지급 예정 미지급액 존재', module: '지급 관리' });
    }

    // 4. Subcontractor execution > Client billing per discipline check
    clientBillingItems.forEach(cbi => {
      const subBillingsForDisc = subBillings.filter(sb => sb.discipline === cbi.majorCategory);
      const subCum = subBillingsForDisc.reduce((s, sb) => s + sb.finalApprovedAmt, 0);
      if (subCum > cbi.cumulativeBillingAmt) {
        list.push({
          type: 'danger',
          title: `[경고] 외주선집행 발생 (${cbi.majorCategory})`,
          desc: `외주누계(${formatKRW(subCum)})가 발주처 도급누계(${formatKRW(cbi.cumulativeBillingAmt)})를 초과했습니다.`,
          module: '기성 비교'
        });
      }
    });

    // 5. Bond Expiration Warning
    subContracts.forEach(sc => {
      const expDate = new Date(sc.bondExpirationDate);
      const today = new Date();
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      if (diffDays <= 60 && diffDays > 0) {
        list.push({
          type: 'info',
          title: `보증서 만료 예정: ${sc.contractorName}`,
          desc: `보증서 유효기간 ${sc.bondExpirationDate} (${diffDays}일 남음)`,
          module: '외주 계약'
        });
      }
    });

    return list;
  }, [clientBillings, subBillings, totalClientReceivableAmt, totalSubUnpaidAmt, clientBillingItems, subBillingItems, subContracts]);

  // Comparison Matrix Data
  const comparisonData = useMemo(() => {
    const disciplines: Category[] = ['공통관리', '토목', '건축', '전기', '기계'];
    return disciplines.map(disc => {
      const clientItem = clientBillingItems.find(item => item.majorCategory === disc);
      
      // Calculate from dynamic subBillings instead of static items
      const subBillingsForDisc = subBillings.filter(sb => sb.discipline === disc);
      const subContract = subContracts.find(sc => sc.discipline === disc);
      const budget = executionBudgets.find(b => b.discipline === disc);

      const clientCum = clientItem ? clientItem.cumulativeBillingAmt : 0;
      const clientCurrent = clientItem ? clientItem.currentBillingAmt : 0;

      const subCum = subBillingsForDisc.reduce((s, i) => s + i.finalApprovedAmt, 0);
      
      const maxRound = subBillingsForDisc.length > 0 
        ? Math.max(...subBillingsForDisc.map(sb => sb.billingRound)) 
        : 0;
      
      const subCurrent = subBillingsForDisc
        .filter(sb => sb.billingRound === maxRound)
        .reduce((s, i) => s + i.finalApprovedAmt, 0);

      const varianceCurrent = clientCurrent - subCurrent;
      const varianceCum = clientCum - subCum;

      const profit = clientCum - subCum;
      const profitMargin = clientCum > 0 ? (profit / clientCum) * 100 : 0;

      const isSubExceeded = subCum > clientCum;

      return {
        discipline: disc,
        clientContractAmt: clientItem ? clientItem.contractAmount : 0,
        subContractAmt: subContract ? subContract.currentAmount : 0,
        budgetAmt: budget ? budget.executionBudgetAmt : 0,
        clientCurrent,
        subCurrent,
        varianceCurrent,
        clientCum,
        subCum,
        varianceCum,
        profit,
        profitMargin,
        isSubExceeded
      };
    });
  }, [clientBillingItems, subBillings, subContracts, executionBudgets]);

  // Excel Export Handler
  const exportToExcel = (sheetName: string, dataArray: any[]) => {
    const worksheet = XLSX.utils.json_to_sheet(dataArray);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Monthly Closing Toggle Handler
  const handleToggleClosing = (yearMonth: string) => {
    setClosings(prev =>
      prev.map(c => {
        if (c.yearMonth === yearMonth) {
          return {
            ...c,
            isClosed: !c.isClosed,
            closedAt: !c.isClosed ? new Date().toISOString().split('T')[0] : undefined,
            closedBy: !c.isClosed ? '관리자 (현재사용자)' : undefined
          };
        }
        return c;
      })
    );
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-800">
      {/* Main Module Tabs */}
      <div className="flex items-center overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {[
          { id: 'client-contract', label: '1. 발주처 계약관리', icon: Building },
          { id: 'sub-contract', label: '2. 외주계약 관리', icon: Briefcase },
          { id: 'sub-billing', label: '3. 외주기성 관리', icon: DollarSign },
          { id: 'closing', label: '4. 월마감 & 감사로그', icon: Lock }
        ].reduce((acc, tab, idx) => {
          if (idx > 0) {
            acc.push(
              <span key={`sep-${idx}`} className="text-slate-300 mx-3 select-none">|</span>
            );
          }
          acc.push(
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 font-extrabold text-xs whitespace-nowrap transition-all focus:outline-none bg-transparent border-none p-0 ${
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          );
          return acc;
        }, [] as React.ReactNode[])}
      </div>

      {/* Monthly Closed Warning Banner if locked */}
      {isCurrentMonthClosed && !isAdminUnlocked && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center gap-3">
            <Lock className="text-amber-600 flex-shrink-0" size={20} />
            <div>
              <p className="font-bold">{selectedMonth}월 마감 처리가 완료되었습니다.</p>
              <p className="text-amber-700">일반 사용자는 데이터를 수정할 수 없으며, 조회만 가능합니다.</p>
            </div>
          </div>
          <button
            onClick={() => setShowUnlockModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all"
          >
            마감 해제 요청 / 관리자 권한
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}

      {/* ---------------------------------------------------- */}
      {/* 2. 발주처 계약관리 (TAB 2) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'client-contract' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">발주처 도급 계약 정보</h2>
                <p className="text-xs text-slate-500 mt-1">최초 계약 및 설계 변경, 증감 이력 종합 관리</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setInitialContractForm({
                      initialAmount: clientContract.initialAmount,
                      advancePayment: clientContract.advancePayment,
                      retentionMoney: clientContract.retentionMoney,
                      performanceBond: clientContract.performanceBond
                    });
                    setIsInitialContractModalOpen(true);
                  }}
                  disabled={isCurrentMonthClosed && !isAdminUnlocked}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-300"
                >
                  <Edit size={15} />
                  최초 계약 정보 수정
                </button>
                <button
                  onClick={() => setIsContractModalOpen(true)}
                  disabled={isCurrentMonthClosed && !isAdminUnlocked}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Plus size={16} />
                  계약 변경 등록 (차수 추가)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">
                  현재 계약금액 {clientContract.amendmentRound > 0 ? `(차수: ${clientContract.amendmentRound}차 변경)` : '(최초 계약)'}
                </span>
                <p className="text-xl font-bold text-blue-900 mt-1">{formatKRW(clientContract.currentAmount)}</p>
                <span className="text-[11px] text-blue-600">
                  최초 계약금액 {formatKRW(clientContract.initialAmount)} / 누적 변경 {clientContract.currentAmount - clientContract.initialAmount >= 0 ? '+' : ''}{formatKRW(clientContract.currentAmount - clientContract.initialAmount)}
                </span>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">기성 수금 완료 (누계)</span>
                <p className="text-xl font-bold text-emerald-900 mt-1">{formatKRW(cumulativeClientCollectedAmt)}</p>
                <span className="text-[11px] text-emerald-600">
                  수금율: {clientContract.currentAmount > 0 ? ((cumulativeClientCollectedAmt / clientContract.currentAmount) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">기성 수금 잔액</span>
                <p className="text-xl font-bold text-amber-900 mt-1">
                  {formatKRW(clientContract.currentAmount - cumulativeClientCollectedAmt)}
                </p>
                <span className="text-[11px] text-amber-600">
                  미수금 {formatKRW(totalClientReceivableAmt)} 포함 잔여 금액
                </span>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-center gap-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">선수금</span>
                  <span className="font-bold text-slate-700">{formatKRW(clientContract.advancePayment)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">유보금</span>
                  <span className="font-bold text-slate-700">{formatKRW(clientContract.retentionMoney)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">계약보증금</span>
                  <span className="font-bold text-slate-700">{formatKRW(clientContract.performanceBond)}</span>
                </div>
              </div>
            </div>

            {/* Amendment History */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">차수별 계약 변경 이력</h3>
              {(clientContract.history?.length || 0) > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllAmendmentHistory}
                  disabled={isCurrentMonthClosed && !isAdminUnlocked}
                  className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-all flex items-center gap-1 disabled:opacity-50"
                  title="모든 계약 변경 이력을 삭제하고 초기 계약금액 상태로 리셋합니다"
                >
                  <Trash2 size={13} />
                  변경 이력 전체 삭제 (초기화)
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
                    <th className="p-3">차수</th>
                    <th className="p-3">변경 일자</th>
                    <th className="p-3 text-right">증감액</th>
                    <th className="p-3 text-right">변경 후 계약금액</th>
                    <th className="p-3">변경 사유</th>
                    <th className="p-3">승인자</th>
                    <th className="p-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!clientContract.history || clientContract.history.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                        등록된 계약 변경 이력이 없습니다. (실제 변경 발생 시 1차 변경부터 기록됩니다.)
                      </td>
                    </tr>
                  ) : (
                    clientContract.history.map((h, index) => {
                      const isLastItem = index === clientContract.history.length - 1;
                      return (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold">{h.round}차 변경</td>
                        <td className="p-3">{h.date}</td>
                        <td className={`p-3 text-right font-bold ${h.changeAmount >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                          {h.changeAmount > 0 ? `+${formatKRW(h.changeAmount)}` : formatKRW(h.changeAmount)}
                        </td>
                        <td className="p-3 text-right font-bold">{formatKRW(h.contractAmountAfter)}</td>
                        <td className="p-3">{h.reason}</td>
                        <td className="p-3">{h.approvedBy}</td>
                        <td className="p-3 text-center">
                          {isLastItem && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingHistoryItem({ ...h });
                                  setIsEditHistoryModalOpen(true);
                                }}
                                disabled={isCurrentMonthClosed && !isAdminUnlocked}
                                className="p-1 text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                                title="수정"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteHistoryItem(h.id)}
                                disabled={isCurrentMonthClosed && !isAdminUnlocked}
                                className="p-1 text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                                title="삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 발주처 기성 청구 내역 */}
          <div className="bg-white p-6 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">발주처 기성 청구 내역</h2>
                <p className="text-xs text-slate-500 mt-1">월별 기성 차수 관리 입력</p>
              </div>
              <button
                onClick={() => {
                  const defaultClaim = 1000000000;
                  const advRatio = clientContract.currentAmount > 0 ? (clientContract.advancePayment / clientContract.currentAmount) : 0.1;
                  const adv = Math.round(defaultClaim * advRatio);
                  const ret = Math.round(defaultClaim * 0.05);
                  setNewClientBilling({
                    billingRound: clientBillings.length + 1,
                    targetPeriodStart: '2026-07-01',
                    targetPeriodEnd: '2026-07-31',
                    referenceDate: '2026-07-31',
                    createdDate: new Date().toISOString().split('T')[0],
                    billingExpectedDate: '2026-08-15',
                    collectionExpectedDate: '2026-08-31',
                    currentClaimAmt: defaultClaim,
                    advanceDeductionAmt: adv,
                    retentionAmt: ret,
                    otherDeductionsAmt: 0,
                    vatAmt: 0,
                    netClaimAmt: defaultClaim - adv - ret,
                    status: '임시저장',
                    remarks: ''
                  });
                  setIsClientBillingModalOpen(true);
                }}
                disabled={isCurrentMonthClosed && !isAdminUnlocked}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Plus size={16} />
                신규 기성 청구 등록
              </button>
            </div>

            {/* Billings List */}
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
                    <th className="p-3">차수</th>
                    <th className="p-3">기성 대상 기간</th>
                    <th className="p-3 text-right">전회 누계</th>
                    <th className="p-3 text-right">금회 청구액</th>
                    <th className="p-3 text-right">누계 기성액</th>
                    <th className="p-3 text-center">기성률 (%)</th>
                    <th className="p-3 text-right">실청구액</th>
                    <th className="p-3 text-right">수금액</th>
                    <th className="p-3 text-right">미수금</th>
                    <th className="p-3 text-center">상태</th>
                    <th className="p-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientBillings.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                        등록된 발주처 기성 청구 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    clientBillings.map((b, index) => {
                      const isLastItem = index === clientBillings.length - 1;
                      return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-blue-600">{b.billingRound}차</td>
                        <td className="p-3">{b.targetPeriodStart} ~ {b.targetPeriodEnd}</td>
                        <td className="p-3 text-right">{formatKRW(b.prevCumulativeAmt)}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{formatKRW(b.currentClaimAmt)}</td>
                        <td className="p-3 text-right font-bold">{formatKRW(b.cumulativeBillingAmt)}</td>
                        <td className="p-3 text-center font-bold text-blue-600">
                          {totalContractAmount > 0 ? ((b.cumulativeBillingAmt / totalContractAmount) * 100).toFixed(2) : 0}%
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-600">{formatKRW(b.netClaimAmt)}</td>
                        <td className="p-3 text-right text-slate-900 font-medium">
                          {formatKRW(b.collectedAmt)}
                        </td>
                        <td className="p-3 text-right font-bold">
                          {b.netClaimAmt - b.collectedAmt > 0 ? (
                            <span className="text-rose-600">{formatKRW(b.netClaimAmt - b.collectedAmt)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              b.status === '완료'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === '수금대기'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {isLastItem && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClientBilling({ ...b });
                                  setIsEditClientBillingModalOpen(true);
                                }}
                                disabled={isCurrentMonthClosed && !isAdminUnlocked}
                                className="p-1 text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                                title="수정"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClientBilling(b.id)}
                                disabled={isCurrentMonthClosed && !isAdminUnlocked}
                                className="p-1 text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                                title="삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. 외주계약 관리 (TAB 4) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'sub-contract' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">외주 업체별 하도급 계약 관리</h2>
                <p className="text-xs text-slate-500 mt-1">업체별 계약정보, 보증서, 노무비 구분 및 직불 관리</p>
              </div>
              <button
                onClick={() => {
                  setNewSubContract({
                    contractorName: '',
                    businessRegNo: '',
                    representative: '',
                    contactPerson: '',
                    contactPhone: '',
                    discipline: disciplinesList[0] || '건축',
                    contractDate: new Date().toISOString().split('T')[0],
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: '2027-03-31',
                    initialAmount: 0,
                    amendedAmount: 0,
                    currentAmount: 0,
                    advancePayment: 0,
                    warrantyBondRate: 5,
                    performanceBondRate: 10,
                    retentionRate: 5,
                    paymentTerms: '익월 25일 현금',
                    paymentDueDate: new Date().toISOString().split('T')[0],
                    laborCostType: '직접노무비',
                    directPaymentStatus: false,
                    bondExpirationDate: '2027-04-30',
                    status: '계약체결'
                  });
                  setIsSubContractModalOpen(true);
                }}
                disabled={isCurrentMonthClosed && !isAdminUnlocked}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Plus size={16} />
                신규 외주계약 등록
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {subContracts.map(sc => (
                <div key={sc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-blue-600 px-2 py-0.5 bg-blue-50 rounded">
                      {sc.discipline}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{sc.status}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{sc.contractorName}</h3>
                  <p className="text-[11px] text-slate-500">사업자: {sc.businessRegNo} | 대표: {sc.representative}</p>

                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">현재 계약액:</span>
                      <span className="font-bold text-slate-900">{formatKRW(sc.currentAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">계약 기간:</span>
                      <span className="font-semibold text-slate-700">{sc.startDate} ~ {sc.endDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">선급금 / 유보율:</span>
                      <span className="font-semibold">{formatKRW(sc.advancePayment)} ({sc.retentionRate}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">노무비/직불:</span>
                      <span className={`font-bold ${sc.directPaymentStatus ? 'text-amber-600' : 'text-slate-700'}`}>
                        {sc.laborCostType} {sc.directPaymentStatus ? '(직불 적용)' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">보증서 유효기간:</span>
                      <span className="font-bold text-slate-700">{sc.bondExpirationDate}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      onClick={() => handleEditSubContract(sc)}
                      className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="수정"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteSubContract(sc.id)}
                      className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. 외주업체 기성관리 및 공종별 내역 (TAB 5) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'sub-billing' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">외주업체 기성 집행 관리</h2>
                <p className="text-xs text-slate-500 mt-1">현장 대리인의 기성 사정 및 본사 최종 승인, 하도급 직불 현황</p>
              </div>
              <button
                onClick={() => setIsSubBillingModalOpen(true)}
                disabled={isCurrentMonthClosed && !isAdminUnlocked}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Plus size={16} />
                외주 기성 청구 접수
              </button>
            </div>

            {/* 외주업체 전체 합계 요약 보드 */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">총 계약 금액</div>
                <div className="text-sm font-extrabold text-slate-800">{formatKRW(overallSubContractorTotals.totalContract)}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">총 청구 금액</div>
                <div className="text-sm font-extrabold text-slate-700">{formatKRW(overallSubContractorTotals.totalClaim)}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">총 최종 승인액</div>
                <div className="text-sm font-extrabold text-emerald-700">{formatKRW(overallSubContractorTotals.totalApproved)}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">실지급 완료액</div>
                <div className="text-sm font-extrabold text-blue-700">{formatKRW(overallSubContractorTotals.totalPaid)}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">잔여 미지급액</div>
                <div className="text-sm font-extrabold text-rose-700">{formatKRW(overallSubContractorTotals.totalUnpaid)}</div>
              </div>
            </div>

            {/* Subcontractor Billings List */}
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
                    <th className="p-3">외주업체명</th>
                    <th className="p-3">공종</th>
                    <th className="p-3 text-right">계약 금액</th>
                    <th className="p-3 text-right">청구 금액</th>
                    <th className="p-3 text-right">최종 승인액</th>
                    <th className="p-3 text-right">실지급 완료액</th>
                    <th className="p-3 text-right">잔여 미지급액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subContractorStats.map(sc => {
                    const isSelected = selectedSubHistoryName === sc.contractorName;
                    return (
                      <tr
                        key={sc.id}
                        onClick={() => {
                          if (selectedSubHistoryName === sc.contractorName) {
                            setSelectedSubHistoryName('all');
                          } else {
                            setSelectedSubHistoryName(sc.contractorName);
                          }
                        }}
                        className={`cursor-pointer transition-all hover:bg-blue-50/40 ${
                          isSelected ? 'bg-blue-50/80 font-semibold' : ''
                        }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-1 h-6 rounded ${isSelected ? 'bg-indigo-600' : 'bg-transparent'}`} />
                            <span className="font-bold text-slate-900">{sc.contractorName}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-700">
                            {sc.discipline}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatKRW(sc.currentAmount)}</td>
                        <td className="p-3 text-right font-bold text-slate-600">{formatKRW(sc.cumulativeClaim)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{formatKRW(sc.cumulativeApproved)}</td>
                        <td className="p-3 text-right font-bold text-blue-600">{formatKRW(sc.cumulativePaid)}</td>
                        <td className="p-3 text-right font-bold text-rose-600">{formatKRW(sc.balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>


          </div>

          {/* 차수별 외주업체 기성신청 및 사정 이력 조회 카드 */}
          <div className="bg-white p-6 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 mb-1">
                  <History size={18} className="text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedSubHistoryName === 'all' ? (
                      '외주업체별 차수별 기성 신청 및 사정 이력'
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg text-xs font-black">
                          {selectedSubHistoryName}
                        </span>
                        <span>기성 신청 이력</span>
                      </span>
                    )}
                  </h3>
                </div>
                <p className="text-xs text-slate-500">외주업체별로 차수별 기성 청구금액, 최종 승인액 및 지급 내역을 조회합니다.</p>
              </div>

            </div>

            {selectedSubHistoryName === 'all' ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <History size={36} className="text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-600 mb-1">외주업체 기성 이력 조회</p>
                <p className="text-xs text-slate-400 text-center">
                  상단 '외주업체 기성 집행 & 사정(검토) 관리' 목록에서 업체를 클릭하면<br />
                  해당 업체의 차수별 상세 청구 및 사정(검토) 이력이 이곳에 표시됩니다.
                </p>
              </div>
            ) : (
              <>
                {/* List Table of History Items */}
                <div className="overflow-x-auto">
                  {filteredSubHistory.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                          <th className="p-3">기성 차수</th>
                          <th className="p-3">대상 기간</th>
                          <th className="p-3">청구 일자</th>
                          <th className="p-3 text-right">금회 청구액</th>
                          <th className="p-3 text-right bg-emerald-50/30 text-emerald-800">최종 승인액</th>
                          <th className="p-3 text-right text-blue-800">실지급액 / 미지급액</th>
                          <th className="p-3 text-center">지급 상태</th>
                          <th className="p-3">검토/사정 의견</th>
                          <th className="p-3 text-center">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSubHistory.map(sb => {
                          return (
                            <tr key={sb.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3 font-extrabold text-indigo-700 text-sm">
                                {sb.billingRound}차 기성
                              </td>
                              <td className="p-3 text-slate-600 whitespace-nowrap">
                                {sb.targetPeriodStart} ~ {sb.targetPeriodEnd}
                              </td>
                              <td className="p-3 text-slate-600 whitespace-nowrap">
                                {sb.claimDate}
                              </td>
                              <td className="p-3 text-right font-bold text-slate-600">
                                {formatKRW(sb.currentClaimAmt)}
                              </td>
                              <td className="p-3 text-right font-extrabold text-emerald-600 bg-emerald-50/20">
                                {formatKRW(sb.finalApprovedAmt)}
                              </td>
                              <td className="p-3 text-right">
                                <div className="font-bold text-blue-700">{formatKRW(sb.actualPaidAmt)}</div>
                                <div className="text-[10px] text-rose-500 font-semibold">미지급: {formatKRW(sb.currentClaimAmt - (sb.actualPaidAmt || 0))}</div>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  sb.status === '지급완료' || sb.status === '승인'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : sb.status === '반려'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {sb.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 text-[11px] max-w-[200px] truncate" title={sb.remarks}>
                                {sb.remarks || '-'}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex gap-2 justify-center">
                                  <button onClick={() => handleEditSubBilling(sb)} className="text-blue-600 hover:text-blue-800 font-bold">수정</button>
                                  <button onClick={() => handleDeleteSubBilling(sb.id)} className="text-rose-600 hover:text-rose-800 font-bold">삭제</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-slate-400 font-bold">
                      선택한 업체 또는 해당 프로젝트에 등록된 기성 청구 이력이 없습니다.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}

      {/* ---------------------------------------------------- */}
      {/* 8. 월마감 & 감사로그 (TAB 8) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-lg font-bold text-slate-900 mb-2">월별 기성/외주 데이터 마감 관리 (Monthly Closing)</h2>
            <p className="text-xs text-slate-500 mb-6">월 마감 처리 시 데이터 수정이 잠기며, 권한 승인 시에만 해제됩니다.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {closings.map(c => (
                <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{c.yearMonth}월</h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {c.isClosed ? `마감일: ${c.closedAt} (${c.closedBy})` : '미마감 상태'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleClosing(c.yearMonth)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      c.isClosed ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {c.isClosed ? '마감 해제' : '월 마감 실행'}
                  </button>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-3">시스템 변경 및 승인 감사 로그 (Audit History)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
                    <th className="p-3">일시</th>
                    <th className="p-3">작업자</th>
                    <th className="p-3">구분 모듈</th>
                    <th className="p-3">수행 작업</th>
                    <th className="p-3">상세 내역</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500">{log.timestamp}</td>
                      <td className="p-3 font-bold">{log.user}</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-[10px]">{log.module}</span></td>
                      <td className="p-3 font-semibold text-blue-600">{log.action}</td>
                      <td className="p-3 text-slate-600">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 발주처 최초 계약 정보 수정 모달 */}
      {isInitialContractModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Building size={20} />
                <h3 className="text-base font-black text-slate-900">발주처 최초 계약 정보 수정</h3>
              </div>
              <button
                onClick={() => setIsInitialContractModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInitialContract} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-blue-700 font-semibold">안내</span>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  최초 계약금액을 수정하면 변경 차수(설계 변경 등)에 따른 증감액이 합산되어 현재 계약금액이 자동으로 업데이트됩니다.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  최초 계약금액 (원) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="예: 45000000000"
                  value={initialContractForm.initialAmount || ''}
                  onChange={e => setInitialContractForm({ ...initialContractForm, initialAmount: Number(e.target.value) })}
                  className="w-full p-2.5 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  입력값: {formatKRW(Number(initialContractForm.initialAmount || 0))}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">선급금 (원)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={initialContractForm.advancePayment || ''}
                    onChange={e => setInitialContractForm({ ...initialContractForm, advancePayment: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {formatKRW(Number(initialContractForm.advancePayment || 0))}
                  </span>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">유보금 (원)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={initialContractForm.retentionMoney || ''}
                    onChange={e => setInitialContractForm({ ...initialContractForm, retentionMoney: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {formatKRW(Number(initialContractForm.retentionMoney || 0))}
                  </span>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">계약보증금 (원)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={initialContractForm.performanceBond || ''}
                    onChange={e => setInitialContractForm({ ...initialContractForm, performanceBond: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {formatKRW(Number(initialContractForm.performanceBond || 0))}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInitialContractModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} />
                  최초 계약 정보 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 발주처 계약 변경 이력 수정 모달 */}
      {isEditHistoryModalOpen && editingHistoryItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Edit size={20} />
                <h3 className="text-base font-black text-slate-900">
                  계약 변경 이력 수정 ({editingHistoryItem.round}차)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditHistoryModalOpen(false);
                  setEditingHistoryItem(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditHistory} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    변경 일자 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editingHistoryItem.date}
                    onChange={e =>
                      setEditingHistoryItem({ ...editingHistoryItem, date: e.target.value })
                    }
                    className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    계약 변경 증감액 (원)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={editingHistoryItem.changeAmount}
                    onChange={e =>
                      setEditingHistoryItem({
                        ...editingHistoryItem,
                        changeAmount: Number(e.target.value)
                      })
                    }
                    className="w-full p-2.5 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    입력값: {formatKRW(editingHistoryItem.changeAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  변경 사유 및 내용 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={editingHistoryItem.reason}
                  onChange={e =>
                    setEditingHistoryItem({ ...editingHistoryItem, reason: e.target.value })
                  }
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">승인자 / 관리자</label>
                <input
                  type="text"
                  value={editingHistoryItem.approvedBy}
                  onChange={e =>
                    setEditingHistoryItem({ ...editingHistoryItem, approvedBy: e.target.value })
                  }
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditHistoryModalOpen(false);
                    setEditingHistoryItem(null);
                  }}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} />
                  수정 사항 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 발주처 계약 변경 등록 (차수 추가) 모달 */}
      {isContractModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Building size={20} />
                <h3 className="text-base font-black text-slate-900">
                  발주처 계약 변경 등록 ({(clientContract.history?.length || 0) + 1}차 변경 추가)
                </h3>
              </div>
              <button
                onClick={() => setIsContractModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveContractAmendment} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-blue-700 font-semibold">
                    현재 도급 계약금액 {clientContract.amendmentRound > 0 ? `(${clientContract.amendmentRound}차 변경)` : '(최초 계약)'}
                  </span>
                  <div className="text-lg font-black text-blue-900">{formatKRW(clientContract.currentAmount)}</div>
                </div>
                <div className="text-right">
                  <span className="text-blue-700 font-semibold">변경 후 예상 금액</span>
                  <div className="text-lg font-black text-emerald-700">
                    {formatKRW(clientContract.currentAmount + Number(amendmentForm.changeAmount || 0))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    변경 일자 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={amendmentForm.date}
                    onChange={e => setAmendmentForm({ ...amendmentForm, date: e.target.value })}
                    className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    계약 변경 증감액 (원) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="예: 2000000000 (증액) 또는 -500000000 (감액)"
                    value={amendmentForm.changeAmount || ''}
                    onChange={e => setAmendmentForm({ ...amendmentForm, changeAmount: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    입력값: {formatKRW(Number(amendmentForm.changeAmount || 0))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">설계 변경 금액 (원)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={amendmentForm.designChangeAmount || ''}
                    onChange={e => setAmendmentForm({ ...amendmentForm, designChangeAmount: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">물가 변동 금액 (원)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={amendmentForm.priceFluctuationAmount || ''}
                    onChange={e => setAmendmentForm({ ...amendmentForm, priceFluctuationAmount: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">기타 공사 금액 (원)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={amendmentForm.extraWorkAmount || ''}
                    onChange={e => setAmendmentForm({ ...amendmentForm, extraWorkAmount: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  변경 사유 및 내용 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="예: 지상층 골조 사양 변경 및 지하 증축에 따른 설계 변경승인 건"
                  value={amendmentForm.reason}
                  onChange={e => setAmendmentForm({ ...amendmentForm, reason: e.target.value })}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">승인자 / 관리자</label>
                  <input
                    type="text"
                    value={amendmentForm.approvedBy}
                    onChange={e => setAmendmentForm({ ...amendmentForm, approvedBy: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">첨부 문서파일명</label>
                  <input
                    type="text"
                    placeholder="예: 변경도급계약서_3차.pdf"
                    value={amendmentForm.attachment}
                    onChange={e => setAmendmentForm({ ...amendmentForm, attachment: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} />
                  계약 변경 저장 (차수 추가)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 발주처 기성 청구 등록 모달 */}
      {isClientBillingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <FileText size={20} />
                <h3 className="text-base font-black text-slate-900">
                  신규 발주처 기성 청구 등록 ({clientBillings.length + 1}차)
                </h3>
              </div>
              <button
                onClick={() => setIsClientBillingModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveClientBilling} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">기성 대상 시작일</label>
                  <input
                    type="date"
                    required
                    value={newClientBilling.targetPeriodStart}
                    onChange={e => setNewClientBilling({ ...newClientBilling, targetPeriodStart: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">기성 대상 종료일</label>
                  <input
                    type="date"
                    required
                    value={newClientBilling.targetPeriodEnd}
                    onChange={e => setNewClientBilling({ ...newClientBilling, targetPeriodEnd: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  금회 기성 청구액 (공급가액, 원) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="예: 5000000000"
                  value={newClientBilling.currentClaimAmt || ''}
                  onChange={e => {
                    const val = Number(e.target.value);
                    const advRatio = clientContract.currentAmount > 0 ? (clientContract.advancePayment / clientContract.currentAmount) : 0.1;
                    const adv = Math.round(val * advRatio);
                    const ret = Math.round(val * 0.05);
                    const vat = 0; // 부가세 미반영
                    setNewClientBilling({
                      ...newClientBilling,
                      currentClaimAmt: val,
                      advanceDeductionAmt: adv,
                      retentionAmt: ret,
                      vatAmt: vat,
                      netClaimAmt: val - adv - ret
                    });
                  }}
                  className="w-full p-2.5 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  입력값: {formatKRW(Number(newClientBilling.currentClaimAmt || 0))}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">선급금 정산 공제액</label>
                  <input
                    type="number"
                    value={newClientBilling.advanceDeductionAmt || ''}
                    onChange={e => setNewClientBilling({ ...newClientBilling, advanceDeductionAmt: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">유보금 공제액</label>
                  <input
                    type="number"
                    value={newClientBilling.retentionAmt || ''}
                    onChange={e => setNewClientBilling({ ...newClientBilling, retentionAmt: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고 및 추진사항</label>
                <input
                  type="text"
                  placeholder="예: 4차 기성청구 준비 완료건"
                  value={newClientBilling.remarks || ''}
                  onChange={e => setNewClientBilling({ ...newClientBilling, remarks: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClientBillingModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} />
                  기성 청구 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 발주처 기성 청구 수정 모달 */}
      {isEditClientBillingModalOpen && editingClientBilling && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <FileText size={20} />
                <h3 className="text-base font-black text-slate-900">
                  발주처 {editingClientBilling.billingRound}차 기성 청구 정보 수정
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsEditClientBillingModalOpen(false);
                  setEditingClientBilling(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateClientBilling} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">기성 대상 시작일</label>
                  <input
                    type="date"
                    required
                    value={editingClientBilling.targetPeriodStart}
                    onChange={e => setEditingClientBilling({ ...editingClientBilling, targetPeriodStart: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">기성 대상 종료일</label>
                  <input
                    type="date"
                    required
                    value={editingClientBilling.targetPeriodEnd}
                    onChange={e => setEditingClientBilling({ ...editingClientBilling, targetPeriodEnd: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">청구 예정일</label>
                  <input
                    type="date"
                    value={editingClientBilling.billingExpectedDate || ''}
                    onChange={e => setEditingClientBilling({ ...editingClientBilling, billingExpectedDate: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">수금 예정일</label>
                  <input
                    type="date"
                    value={editingClientBilling.collectionExpectedDate || ''}
                    onChange={e => setEditingClientBilling({ ...editingClientBilling, collectionExpectedDate: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  금회 기성 청구액 (공급가액, 원) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="예: 5000000000"
                  value={editingClientBilling.currentClaimAmt}
                  onChange={e => {
                    const val = Number(e.target.value);
                    const advRatio = clientContract.currentAmount > 0 ? (clientContract.advancePayment / clientContract.currentAmount) : 0.1;
                    const adv = Math.round(val * advRatio);
                    const ret = Math.round(val * 0.05);
                    const vat = 0; // 부가세 미반영
                    const net = val - adv - ret;
                    const col = editingClientBilling.collectedAmt || 0;
                    setEditingClientBilling({
                      ...editingClientBilling,
                      currentClaimAmt: val,
                      advanceDeductionAmt: adv,
                      retentionAmt: ret,
                      vatAmt: vat,
                      netClaimAmt: net,
                      receivableAmt: Math.max(0, net - col)
                    });
                  }}
                  className="w-full p-2.5 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  입력값: {formatKRW(editingClientBilling.currentClaimAmt)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">선급금 정산 공제액</label>
                  <input
                    type="number"
                    value={editingClientBilling.advanceDeductionAmt}
                    onChange={e => {
                      const adv = Number(e.target.value);
                      const claim = editingClientBilling.currentClaimAmt;
                      const ret = editingClientBilling.retentionAmt;
                      const oth = editingClientBilling.otherDeductionsAmt;
                      const net = claim - adv - ret - oth;
                      const col = editingClientBilling.collectedAmt;
                      setEditingClientBilling({
                        ...editingClientBilling,
                        advanceDeductionAmt: adv,
                        netClaimAmt: net,
                        receivableAmt: Math.max(0, net - col)
                      });
                    }}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">유보금 공제액</label>
                  <input
                    type="number"
                    value={editingClientBilling.retentionAmt}
                    onChange={e => {
                      const ret = Number(e.target.value);
                      const claim = editingClientBilling.currentClaimAmt;
                      const adv = editingClientBilling.advanceDeductionAmt;
                      const oth = editingClientBilling.otherDeductionsAmt;
                      const net = claim - adv - ret - oth;
                      const col = editingClientBilling.collectedAmt;
                      setEditingClientBilling({
                        ...editingClientBilling,
                        retentionAmt: ret,
                        netClaimAmt: net,
                        receivableAmt: Math.max(0, net - col)
                      });
                    }}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">기타 공제액</label>
                  <input
                    type="number"
                    value={editingClientBilling.otherDeductionsAmt}
                    onChange={e => {
                      const oth = Number(e.target.value);
                      const claim = editingClientBilling.currentClaimAmt;
                      const adv = editingClientBilling.advanceDeductionAmt;
                      const ret = editingClientBilling.retentionAmt;
                      const net = claim - adv - ret - oth;
                      const col = editingClientBilling.collectedAmt;
                      setEditingClientBilling({
                        ...editingClientBilling,
                        otherDeductionsAmt: oth,
                        netClaimAmt: net,
                        receivableAmt: Math.max(0, net - col)
                      });
                    }}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                <div>
                  <label className="block font-bold text-emerald-800 mb-1">실수금 완료 금액 (원)</label>
                  <input
                    type="number"
                    value={editingClientBilling.collectedAmt}
                    onChange={e => {
                      const col = Number(e.target.value);
                      const net = editingClientBilling.netClaimAmt;
                      const rec = Math.max(0, net - col);
                      setEditingClientBilling({
                        ...editingClientBilling,
                        collectedAmt: col,
                        receivableAmt: rec,
                        status: col >= net && net > 0 ? '완료' : col > 0 ? '수금대기' : editingClientBilling.status
                      });
                    }}
                    className="w-full p-2 border rounded-lg font-bold text-emerald-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">진행 상태</label>
                  <select
                    value={editingClientBilling.status}
                    onChange={e => setEditingClientBilling({ ...editingClientBilling, status: e.target.value as any })}
                    className="w-full p-2 border rounded-lg font-bold"
                  >
                    <option value="임시저장">임시저장</option>
                    <option value="검토중">검토중</option>
                    <option value="승인요청">승인요청</option>
                    <option value="수금대기">수금대기</option>
                    <option value="완료">완료</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고 및 추진사항</label>
                <input
                  type="text"
                  placeholder="예: 3차 기성 수정건"
                  value={editingClientBilling.remarks || ''}
                  onChange={e => setEditingClientBilling({ ...editingClientBilling, remarks: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditClientBillingModalOpen(false);
                    setEditingClientBilling(null);
                  }}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} />
                  기성 청구 정보 수정 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 신규 외주계약 등록 모달 */}
      {isSubContractModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Briefcase size={20} />
                <h3 className="text-base font-black text-slate-900">
                  {editingSubContractId ? '외주 하도급 계약 정보 수정' : '신규 외주 하도급 계약 등록'}
                </h3>
              </div>
              <button
                onClick={() => setIsSubContractModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSubContract} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    외주 업체명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: (주)삼우전설"
                    value={newSubContract.contractorName || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, contractorName: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">사업자등록번호</label>
                  <input
                    type="text"
                    placeholder="000-00-00000"
                    value={newSubContract.businessRegNo || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, businessRegNo: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">대표자명</label>
                  <input
                    type="text"
                    placeholder="예: 홍길동"
                    value={newSubContract.representative || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, representative: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">담당자 연락처</label>
                  <input
                    type="text"
                    placeholder="예: 010-0000-0000"
                    value={newSubContract.contactPhone || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, contactPhone: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">계약 시작일</label>
                  <input
                    type="date"
                    value={newSubContract.startDate || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, startDate: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">계약 종료일</label>
                  <input
                    type="date"
                    value={newSubContract.endDate || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, endDate: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">공종 분야</label>
                  <select
                    value={newSubContract.discipline || (disciplinesList[0] || '건축')}
                    onChange={e => setNewSubContract({ ...newSubContract, discipline: e.target.value as Category })}
                    className="w-full p-2.5 border rounded-xl font-bold"
                  >
                    {disciplinesList.map(disc => (
                      <option key={disc} value={disc}>{disc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    계약 금액 (원) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="예: 2500000000"
                    value={newSubContract.currentAmount || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, currentAmount: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">선급금 (원)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newSubContract.advancePayment || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, advancePayment: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">보증서 유효기간</label>
                  <input
                    type="date"
                    value={newSubContract.bondExpirationDate || ''}
                    onChange={e => setNewSubContract({ ...newSubContract, bondExpirationDate: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">노무비 구분</label>
                  <select
                    value={newSubContract.laborCostType || '직접노무비'}
                    onChange={e => setNewSubContract({ ...newSubContract, laborCostType: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  >
                    <option value="직접노무비">직접노무비</option>
                    <option value="간접노무비">간접노무비</option>
                    <option value="기타노무비">기타노무비</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">하도급 직불동의</label>
                  <div className="flex items-center gap-2 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={!!newSubContract.directPaymentStatus}
                        onChange={e => setNewSubContract({ ...newSubContract, directPaymentStatus: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      하도급 직불동의 체결
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubContractModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} />
                  {editingSubContractId ? '수정 내용 저장' : '외주계약 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 외주 기성 청구 접수 모달 */}
      {isSubBillingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <DollarSign size={20} />
                <h3 className="text-base font-black text-slate-900">외주 기성 청구 접수 및 검토</h3>
              </div>
              <button
                onClick={() => setIsSubBillingModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSubBilling} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">대상 외주업체 선택</label>
                <select
                  value={newSubBilling.subcontractorContractId || subContracts[0]?.id || ''}
                  onChange={e => setNewSubBilling({ ...newSubBilling, subcontractorContractId: e.target.value })}
                  className="w-full p-2.5 border rounded-xl font-bold text-slate-800"
                >
                  {subContracts.map(sc => (
                    <option key={sc.id} value={sc.id}>
                      [{sc.discipline}] {sc.contractorName} - 계약금액: {formatKRW(sc.currentAmount)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    업체 청구 금액 (원) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="예: 500000000"
                    value={newSubBilling.currentClaimAmt || ''}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setNewSubBilling({
                        ...newSubBilling,
                        currentClaimAmt: val,
                        finalApprovedAmt: val
                      });
                    }}
                    className="w-full p-2.5 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">최종 승인액 (원)</label>
                  <input
                    type="number"
                    value={newSubBilling.finalApprovedAmt || ''}
                    onChange={e => setNewSubBilling({ ...newSubBilling, finalApprovedAmt: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-xl font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">검토 의견</label>
                <input
                  type="text"
                  placeholder="예: 현장 실측 검측 완료 및 정상 기성 인정"
                  value={newSubBilling.remarks}
                  onChange={e => setNewSubBilling({ ...newSubBilling, remarks: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubBillingModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} />
                  외주 기성 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 외주 기성 이력 수정 모달 */}
      {isEditSubBillingModalOpen && editingSubBilling && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <DollarSign size={20} />
                <h3 className="text-base font-black text-slate-900">
                  외주 기성 이력 수정 ({editingSubBilling.subcontractorName} - {editingSubBilling.billingRound}차)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditSubBillingModalOpen(false);
                  setEditingSubBilling(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubBilling} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">기성 차수</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editingSubBilling.billingRound}
                    onChange={e => setEditingSubBilling({ ...editingSubBilling, billingRound: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">청구 일자</label>
                  <input
                    type="date"
                    value={editingSubBilling.claimDate || ''}
                    onChange={e => setEditingSubBilling({ ...editingSubBilling, claimDate: e.target.value })}
                    className="w-full p-2.5 border rounded-xl font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">대상 기간 시작일</label>
                  <input
                    type="date"
                    value={editingSubBilling.targetPeriodStart || ''}
                    onChange={e => setEditingSubBilling({ ...editingSubBilling, targetPeriodStart: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">대상 기간 종료일</label>
                  <input
                    type="date"
                    value={editingSubBilling.targetPeriodEnd || ''}
                    onChange={e => setEditingSubBilling({ ...editingSubBilling, targetPeriodEnd: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">금회 청구액 (원)</label>
                  <input
                    type="number"
                    required
                    value={editingSubBilling.currentClaimAmt || ''}
                    onChange={e => setEditingSubBilling({ ...editingSubBilling, currentClaimAmt: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">최종 승인액 (원)</label>
                  <input
                    type="number"
                    value={editingSubBilling.finalApprovedAmt || ''}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setEditingSubBilling({ ...editingSubBilling, finalApprovedAmt: val });
                    }}
                    className="w-full p-2.5 border rounded-xl font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">실지급 완료액 (원)</label>
                  <input
                    type="number"
                    value={editingSubBilling.actualPaidAmt || ''}
                    onChange={e => setEditingSubBilling({ ...editingSubBilling, actualPaidAmt: Number(e.target.value) })}
                    className="w-full p-2.5 border rounded-xl font-bold text-blue-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">지급 상태</label>
                  <select
                    value={editingSubBilling.status}
                    onChange={e => setEditingSubBilling({ ...editingSubBilling, status: e.target.value as SubcontractorBillingStatus })}
                    className="w-full p-2.5 border rounded-xl font-bold text-slate-800"
                  >
                    <option value="청구">청구</option>
                    <option value="검토">검토</option>
                    <option value="승인">승인</option>
                    <option value="지급완료">지급완료</option>
                    <option value="반려">반려</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">검토/사정 의견</label>
                <input
                  type="text"
                  placeholder="의견 입력"
                  value={editingSubBilling.remarks || ''}
                  onChange={e => setEditingSubBilling({ ...editingSubBilling, remarks: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditSubBillingModalOpen(false);
                    setEditingSubBilling(null);
                  }}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check size={16} />
                  수정 사항 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">월 마감 잠금 해제 요청 (관리자 권한)</h3>
            <p className="text-xs text-slate-500 mb-4">마감 해제 사유를 사유서로 입력하십시오.</p>
            <textarea
              value={unlockReason}
              onChange={e => setUnlockReason(e.target.value)}
              placeholder="마감 해제 사유 입력..."
              className="w-full p-3 border rounded-xl text-xs mb-4 h-24 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowUnlockModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">
                취소
              </button>
              <button
                onClick={() => {
                  setIsAdminUnlocked(true);
                  setShowUnlockModal(false);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
              >
                잠금 해제 승인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 삭제 확인/알림 모달 (window.confirm / alert 대체) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  confirmModal.type === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : confirmModal.type === 'warning'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                {confirmModal.type === 'danger' ? (
                  <Trash2 size={22} />
                ) : confirmModal.type === 'warning' ? (
                  <AlertTriangle size={22} />
                ) : (
                  <Building size={22} />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{confirmModal.title}</h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {confirmModal.onConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ isOpen: false, title: '', message: '' })}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const action = confirmModal.onConfirm;
                      setConfirmModal({ isOpen: false, title: '', message: '' });
                      if (action) action();
                    }}
                    className={`px-4 py-2 rounded-xl font-bold text-xs text-white shadow-md transition-all ${
                      confirmModal.type === 'danger'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    확인 (삭제)
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, title: '', message: '' })}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  확인
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
