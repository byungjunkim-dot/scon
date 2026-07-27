export type Category = 
  | '공통관리'
  | '건축' 
  | '토목' 
  | '전기' 
  | '통신' 
  | '기계' 
  | '조경' 
  | '구조' 
  | '소방' 
  | '철거' 
  | '인테리어';

export type Status = '예정' | '진행' | '완료' | '지연';

export interface ScheduleItem {
  id: string;
  projectId: string;
  category: Category;
  subCategory: string;
  taskName: string;
  siteName: string;
  dongBlock: string;
  zone: string;
  floor: string;
  detailLocation: string;
  startDate: string; // ISO format YYYY-MM-DD
  endDate: string;   // ISO format YYYY-MM-DD
  periods?: { startDate: string; endDate: string }[]; // 추가된 필드
  duration: number;
  progress: number; // 0-100
  status: Status;
  predecessor: string;
  contractor: string;
  memo: string;
  isBaseline?: boolean; // For comparison
  sortOrder?: number;
  sourceScheduleId?: string | null;
}

export interface Drawing {
  id: string;
  projectId: string;
  type: '배치도' | '평면도' | '입면도' | '단면도' | '기타';
  floor: string;
  name: string;
  imageUrl: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  projectCode?: string;
  location?: string;
  resolvedAddress?: string;
  latitude?: number;
  longitude?: number;
  description: string;
  imageUrl?: string;
  totalArea?: number;
  floorsUnderground?: number;
  floorsAboveground?: number;
  totalBudget?: number;
  startDate?: string;
  endDate?: string;
  status?: '준비' | '진행' | '완료' | '홀딩';
  color?: string;
  user_id?: string;
  createdAt: string;
  settings?: AppSettings;
}

export interface AppSettings {
  categories: Category[];
  categoryColors: Record<string, string>;
  categoryTextColors: Record<string, string>;
  taskMaster: Record<string, Record<string, string[]>>;
  dongBlocks: string[];
  floors: string[];
  zones: string[];
  contractors: Record<string, string[]>;
  equipmentMaster?: string[];
}

export interface DailyTask {
  id: string;
  category: string;
  subCategory: string;
  taskName: string;
  location: string;
  dongBlock?: string[];
  floor?: string[];
  zone?: string[];
  amount: string;
  status?: string; // 진행, 연기
  reason?: string;
}

export interface DailyEquipment {
  id: string;
  discipline?: string;
  type: string;
  capacity: string;
  quantity: number;
  note: string;
}

export interface DailyIssue {
  id: string;
  type:
    | '안전'
    | '품질'
    | '공정'
    | '설계'
    | '자재'
    | '장비'
    | '민원'
    | '기타';
  description: string;
}

export interface DailyPhoto {
  id: string;
  url: string;
  title?: string;
  category?: string;
  subCategory?: string;
  description?: string;
}

export interface User {
  id: string;
  name: string;
  contact: string;
  email: string;
  password?: string;
  affiliation: string;
  discipline: string;
  signupCode: string;
  role: 'admin' | 'user';
  userRole: '골드' | '실버' | '브론즈';
  createdAt: string;
}

export interface ApprovalRecord {
  status: '작성중' | '승인요청' | '검토완료' | '승인' | '재작성요청';
  timestamp: string;
  user: string;
  comment?: string;
}

export interface DailyPersonnel {
  id: string;
  discipline: string;
  direct: number;
  outsourced: number;
  other: number;
}

export interface DailyReport {
  id: string;
  projectId: string;
  date: string;
  author: string;
  reviewer: string;
  approver: string;
  approvalStatus: '작성중' | '승인요청' | '검토완료' | '승인' | '재작성요청';
  approvalHistory?: ApprovalRecord[];
  weather: {
    temperature: string;
    maxTemp?: string;
    minTemp?: string;
    precipitation: string;
    windSpeed: string;
    status: string;
  };
  todayTasks: DailyTask[];
  tomorrowTasks: DailyTask[];
  personnel: {
    direct: number;
    outsourced: number;
    other: number;
    details?: DailyPersonnel[];
  };
  equipment: DailyEquipment[];
  issues: DailyIssue[];
  photos: DailyPhoto[];
  progressRate?: {
    planned: number;
    actual: number;
  };
}

export interface ConcretePlan {
  id: string;
  projectId: string;
  date: string;
  location: string;
  concreteType: string;
  plannedVolume: number;
  startTime: string;
  endTime: string;
  status: string;
  photos: DailyPhoto[];
  author: string;
}

export interface InspectionRequest {
  id: string;
  projectId: string;
  date: string;
  category: string;
  subCategory: string;
  taskName: string;
  location: string;
  description: string;
  status: string;
  photos: DailyPhoto[];
  author: string;
  reviewer: string;
  approver: string;
}

export interface MaterialApproval {
  id: string;
  projectId: string;
  date: string;
  materialName: string;
  specification: string;
  manufacturer: string;
  supplier: string;
  quantity: string;
  status: string;
  photos: DailyPhoto[];
  author: string;
  approver: string;
}

export type QuickMemoCategory =
  | '안전'
  | '품질'
  | '공정'
  | '설계'
  | '자재'
  | '장비'
  | '민원'
  | '기타';

export type QuickMemoSeverity =
  | '낮음'
  | '중간'
  | '높음'
  | '긴급';

export interface QuickMemoPhoto {
  id: string;
  url: string;
  title?: string;
  description?: string;
  category?: string;
  subCategory?: string;
}

export interface QuickMemo {
  id: string;
  projectId: string;
  date: string;

  rawText: string;
  audioUrl?: string;
  photos: QuickMemoPhoto[];

  aiTitle: string;
  aiSummary: string;
  category: QuickMemoCategory;
  severity: QuickMemoSeverity;

  location?: string;
  dongBlock?: string;
  floor?: string;
  zone?: string;

  recommendedAction?: string;
  designFeedback?: string;
  dailyIssueText?: string;

  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';

  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AllocationPeriod {
  startDate: string;
  endDate: string;
}

export interface Allocation {
  id: string;
  projectId: string;
  projectName: string;
  userName: string;
  workType: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  periods?: AllocationPeriod[];
}

export interface ClientContract {
  id: string;
  projectId: string;
  contractDate?: string; // 계약일
  constructionStartDate?: string; // 공사 시작일
  constructionEndDate?: string; // 공사 완료일
  initialAmount: number;
  amendedAmount: number;
  currentAmount: number;
  amendmentRound: number;
  changeAmount: number; // 증감액
  changeReason: string;
  advancePayment: number; // 선급금
  retentionMoney: number; // 유보금
  performanceBond: number; // 계약보증금
  designChangeAmount: number; // 설계변경 금액
  priceFluctuationAmount: number; // 물가변동 금액
  extraWorkAmount: number; // 추가공사 금액
  contractBalance: number; // 계약 잔액
  status: '작성중' | '승인요청' | '승인' | '반려';
  attachments?: string[];
  history?: ClientContractHistory[];
}

export interface ClientContractHistory {
  id: string;
  round: number;
  contractDate: string; // 계약 변경일
  constructionStartDate?: string; // 변경 공사 시작일
  constructionEndDate?: string; // 변경 공사 완료일
  changeAmount: number;
  contractAmountAfter: number;
  reason: string;
  approvedBy: string;
}

export type ClientBillingStatus = 
  | '임시저장'
  | '승인요청'
  | '검토중'
  | '보완요청'
  | '반려'
  | '승인'
  | '세금계산서대기'
  | '수금대기'
  | '완료';

export interface ClientBilling {
  id: string;
  projectId: string;
  contractId: string;
  billingRound: number;
  targetPeriodStart: string;
  targetPeriodEnd: string;
  referenceDate: string;
  createdDate: string;
  submittedDate?: string;
  approvedDate?: string;
  billingExpectedDate: string;
  taxInvoiceDate?: string;
  collectionExpectedDate: string;
  actualCollectionDate?: string;

  // Amounts
  prevCumulativeAmt: number;
  currentClaimAmt: number;
  cumulativeBillingAmt: number;
  billingRate: number; // %
  advanceDeductionAmt: number; // 선급금 공제
  retentionAmt: number; // 유보금
  otherDeductionsAmt: number; // 기타 공제
  vatAmt: number; // 부가세 (미반영 / 0)
  netClaimAmt: number; // 실청구액 (금회 - 선급 - 유보 - 기타)
  collectedAmt: number; // 수금액
  receivableAmt: number; // 미수금 (누계 실청구액 - 누계 수금액)

  status: ClientBillingStatus;
  remarks?: string;
  attachments?: string[];
}

export interface ClientBillingItem {
  id: string;
  billingId: string;
  majorCategory: Category; // 공종 대분류
  middleCategory: string; // 중분류
  minorCategory: string; // 소분류
  itemCode: string;
  itemName: string;
  spec: string;
  unit: string;
  contractQty: number;
  contractUnitPrice: number;
  contractAmount: number;

  prevCumulativeQty: number;
  currentQty: number;
  cumulativeQty: number;

  prevCumulativeAmt: number;
  currentBillingAmt: number; // currentQty * contractUnitPrice
  cumulativeBillingAmt: number;
  remainingAmt: number; // contractAmount - cumulativeBillingAmt

  currentProgressRate: number; // %
  cumulativeProgressRate: number; // %
  calcBasis?: string;
  remarks?: string;
}

export interface SubcontractorContract {
  id: string;
  projectId: string;
  contractorName: string;
  businessRegNo: string;
  representative: string;
  contactPerson: string;
  contactPhone: string;
  discipline: Category;
  contractDate: string;
  startDate: string;
  endDate: string;

  initialAmount: number;
  amendedAmount: number;
  currentAmount: number;

  advancePayment: number;
  warrantyBondRate: number; // 하자보증률 %
  performanceBondRate: number; // 계약이행보증률 %
  retentionRate: number; // 유보금률 %
  paymentTerms: string;
  paymentDueDate: string;
  laborCostType: '직접노무비' | '간접노무비';
  directPaymentStatus: boolean; // 노무비/장비대/자재비 직불 여부
  bondExpirationDate: string; // 보증서 유효기간
  status: '작성중' | '계약체결' | '변경계약' | '해지' | '완료';
  attachments?: string[];
  history?: SubcontractorContractHistory[];
}

export interface SubcontractorContractHistory {
  id: string;
  round: number;
  date: string;
  changeAmount: number;
  amountAfter: number;
  reason: string;
}

export type SubcontractorBillingStatus =
  | '청구'
  | '검토'
  | '승인'
  | '지급완료'
  | '반려';

export interface SubcontractorBilling {
  id: string;
  projectId: string;
  subcontractorContractId: string;
  subcontractorName: string;
  discipline: Category;
  billingRound: number;
  targetPeriodStart: string;
  targetPeriodEnd: string;
  claimDate: string;
  reviewDate?: string;
  approvalDate?: string;
  paymentScheduledDate: string;
  actualPaymentDate?: string;

  // Amounts
  prevCumulativeAmt: number;
  currentClaimAmt: number; // 업체 청구액
  fieldReviewedAmt: number; // 현장 검토액
  finalApprovedAmt: number; // 최종 승인액
  cumulativeApprovedAmt: number;
  executionRate: number; // % (누계 / 외주계약금액)

  advanceDeductionAmt: number;
  retentionAmt: number;
  warrantyDeductionAmt: number; // 하자보증금
  laborCostAmt: number;
  equipmentCostAmt: number;
  materialCostAmt: number;
  otherDeductionsAmt: number;
  vatAmt: number; // 부가세 (미반영 / 0)
  netPayableAmt: number; // 실지급액 (금회승인 - 선급 - 유보 - 하자 - 기타)
  actualPaidAmt: number; // 실제 지급 완료액
  unpaidAmt: number; // 미지급액

  paymentType: '현금' | '어음';
  taxInvoiceIssued: boolean;
  directPaymentStatus: boolean;
  status: SubcontractorBillingStatus;
  remarks?: string;
  attachments?: string[];
}

export interface SubcontractorBillingItem {
  id: string;
  subcontractorBillingId: string;
  subcontractorContractId: string;
  itemCode: string;
  discipline: Category;
  itemName: string;
  spec: string;
  unit: string;
  contractQty: number;
  contractUnitPrice: number;
  contractAmount: number;

  prevCumulativeQty: number;
  currentQty: number;
  cumulativeQty: number;

  currentApprovedAmt: number;
  cumulativeApprovedAmt: number;
  remainingContractAmt: number;
  progressRate: number; // %
  inspectionResult: '합격' | '불합격' | '조건부합격';
  reviewerOpinion?: string;
  isOverContractApproved?: boolean;
  overApprovalReason?: string;
}

export interface SiteExecutionBudget {
  id: string;
  projectId: string;
  discipline: Category;
  executionBudgetAmt: number; // 실행예산
  subcontractCost: number; // 외주비
  materialCost: number; // 자재비
  laborCost: number; // 노무비
  equipmentCost: number; // 장비비
  expenseCost: number; // 경비
  siteOverheadAmt: number; // 현장관리비

  accumulatedIncurredCost: number; // 누적 발생원가
  estimatedRemainingCost: number; // 잔여공사 예상원가
  expectedFinalCost: number; // 예상 최종원가 = 누적 + 잔여예상
  costExecutionRate: number; // 원가 집행률 (%) = 누적발생 / 실행예산 * 100
  expectedProfit: number; // 예상 손익 = 현재 도급계약금액 - 예상 최종원가
  expectedProfitMargin: number; // 예상 손익률 (%) = 예상손익 / 현재 도급계약금액 * 100
  remainingBudget: number; // 잔여 예산
  varianceReason?: string;
}

export interface MonthlyClosing {
  id: string;
  projectId: string;
  yearMonth: string; // YYYY-MM
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
  unlockedAt?: string;
  unlockedBy?: string;
  unlockReason?: string;
}

export interface BillingAuditLog {
  id: string;
  projectId: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  details: string;
}

export interface BillingComment {
  id: string;
  targetId: string; // Billing or Contract ID
  projectId: string;
  author: string;
  content: string;
  createdAt: string;
}

