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
  duration: number;
  progress: number; // 0-100
  status: Status;
  predecessor: string;
  contractor: string;
  memo: string;
  isBaseline?: boolean; // For comparison
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
  description: string;
  imageUrl?: string;
  totalArea?: number;
  floorsUnderground?: number;
  floorsAboveground?: number;
  totalBudget?: number;
  startDate?: string;
  endDate?: string;
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
  dongBlock?: string;
  floor?: string;
  zone?: string;
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
  type: '안전' | '품질' | '민원';
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
