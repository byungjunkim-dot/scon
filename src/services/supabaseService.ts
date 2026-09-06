import { supabase } from '../lib/supabase';
import { Project, ScheduleItem, AppSettings, User, DailyReport, Drawing, Category, Status, Allocation, ProductionConfig, ProductionDayData } from '../types';


export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export type AiReportType =
  | 'monthly_summary'
  | 'schedule_analysis'
  | 'manpower_analysis'
  | 'custom';

export type AiReportRequest = {
  question: string;
  projectId?: string | null;
  reportType?: AiReportType;
};

export type AiReportResponse = {
  ok: boolean;
  plan?: {
    intent: 'weekly_daily_status' | 'monthly_project_summary';
    scope: 'selected_project' | 'all_projects';
    startDate: string;
    endDate: string;
    reason: string;
    projectId?: string | null;
  };
  rows: any[];
  answer: string;
  result?: any;
  error?: string;
};

export type AiRiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AiRiskCategory =
  | 'schedule'
  | 'baseline'
  | 'daily_report'
  | 'resource'
  | 'document'
  | 'quality'
  | 'safety';

export type AiRiskItem = {
  id: string;
  title: string;
  category: AiRiskCategory;
  severity: AiRiskSeverity;
  description: string;
  evidence: string[];
  recommendation: string;
};

export type AiRiskScanRequest = {
  projectId?: string | null;
  projectName?: string;
  overallRiskLevel: AiRiskSeverity;
  risks: AiRiskItem[];
  stats?: {
    totalRiskCount: number;
    highRiskCount: number;
    scheduleCount: number;
    dailyReportCount: number;
  };
};

export type AiRiskScanResponse = {
  ok: boolean;
  result?: {
    overallRiskLevel: AiRiskSeverity;
    summary: string;
    risks: AiRiskItem[];
  };
  error?: string;
  receivedKeys?: string[];
};

type ScheduleRow = {
  id: string;
  projectId: string;
  category: string | null;
  subCategory: string | null;
  taskName: string | null;
  contractor: string | null;
  startDate: string | null;
  endDate: string | null;
  progress: number | null;
  status: string | null;
  isBaseline: boolean | null;
  dongBlock: string | null;
  floor: string | null;
  zone: string | null;
  amount: string | null;
  memo: string | null;
  siteName: string | null;
  detailLocation: string | null;
  duration: number | null;
  predecessor: string | null;
  sortOrder: number | null;
  sourceScheduleId: string | null;
};

type ScheduleItemWithExtra = ScheduleItem & {
  amount?: string;
  sortOrder?: number;
  sourceScheduleId?: string | null;
};

const toScheduleRow = (item: ScheduleItemWithExtra): ScheduleRow => {
  return {
    id: item.id,
    projectId: item.projectId,
    category: item.category ?? null,
    subCategory: item.subCategory ?? null,
    taskName: item.taskName ?? null,
    contractor: item.contractor ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    progress: item.progress ?? 0,
    status: item.status ?? null,
    isBaseline: item.isBaseline ?? false,
    dongBlock: item.dongBlock ?? null,
    floor: item.floor ?? null,
    zone: item.zone ?? null,
    amount: item.amount ?? null,
    memo: item.memo ?? null,
    siteName: item.siteName ?? null,
    detailLocation: item.detailLocation ?? null,
    duration: item.duration ?? null,
    predecessor: item.predecessor ?? null,
    sortOrder: item.sortOrder ?? 0,
    sourceScheduleId: item.sourceScheduleId ?? null,
  };
};

const fromScheduleRow = (row: ScheduleRow): ScheduleItemWithExtra => {
  return {
    id: row.id,
    projectId: row.projectId,
    category: (row.category ?? '공통관리') as Category,
    subCategory: row.subCategory ?? '',
    taskName: row.taskName ?? '',
    contractor: row.contractor ?? '',
    startDate: row.startDate ?? '',
    endDate: row.endDate ?? '',
    progress: row.progress ?? 0,
    status: (row.status ?? '예정') as Status,
    isBaseline: row.isBaseline ?? false,
    dongBlock: row.dongBlock ?? '',
    floor: row.floor ?? '',
    zone: row.zone ?? '',
    memo: row.memo ?? '',
    siteName: row.siteName ?? '',
    detailLocation: row.detailLocation ?? '',
    duration: row.duration ?? 0,
    predecessor: row.predecessor ?? '',
    amount: row.amount ?? '',
    sortOrder: row.sortOrder ?? 0,
    sourceScheduleId: row.sourceScheduleId ?? null,
  };
};

const fromProjectRow = (row: any): Project => {
  if (!row) return {} as Project;
  return {
    id: row.id,
    name: row.name ?? '',
    projectCode: row.projectCode ?? row.project_code ?? undefined,
    location: row.location ?? undefined,
    resolvedAddress: row.resolvedAddress ?? row.resolved_address ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    description: row.description ?? '',
    imageUrl: row.imageUrl ?? row.image_url ?? undefined,
    totalArea: row.totalArea ?? row.total_area ?? undefined,
    floorsUnderground: row.floorsUnderground ?? row.floors_underground ?? undefined,
    floorsAboveground: row.floorsAboveground ?? row.floors_aboveground ?? undefined,
    totalBudget: row.totalBudget ?? row.total_budget ?? undefined,
    startDate: row.startDate ?? row.start_date ?? undefined,
    endDate: row.endDate ?? row.end_date ?? undefined,
    status: row.status ?? '진행',
    color: row.color ?? undefined,
    user_id: row.user_id ?? undefined,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toLocaleDateString(),
    settings: row.settings ?? undefined,
  };
};

export const supabaseService = {
// Projects
async getProjects() {
  const { data, error } = await supabase.from('projects').select('*');
  if (error) throw error;
  return (data || []).map(fromProjectRow);
},

async saveProject(project: Project) {
  const primaryPayload = {
    id: project.id,
    name: project.name ?? '',
    projectCode: project.projectCode ?? null,
    location: project.location ?? null,
    resolvedAddress: project.resolvedAddress ?? null,
    latitude: project.latitude ?? null,
    longitude: project.longitude ?? null,
    description: project.description ?? null,
    imageUrl: project.imageUrl ?? null,
    totalArea: project.totalArea ?? null,
    floorsUnderground: project.floorsUnderground ?? null,
    floorsAboveground: project.floorsAboveground ?? null,
    totalBudget: project.totalBudget ?? null,
    startDate: project.startDate ?? null,
    endDate: project.endDate ?? null,
    status: project.status ?? '진행',
    color: project.color ?? null,
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const { data, error } = await supabase
    .from('projects')
    .upsert(primaryPayload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (!error && data) {
    return fromProjectRow(data);
  }

  console.warn('[saveProject] Primary upsert failed, trying fallback payloads...', error);

  // Fallback 1: snake_case
  const snakePayload = {
    id: project.id,
    name: project.name ?? '',
    project_code: project.projectCode ?? null,
    location: project.location ?? null,
    resolved_address: project.resolvedAddress ?? null,
    latitude: project.latitude ?? null,
    longitude: project.longitude ?? null,
    description: project.description ?? null,
    image_url: project.imageUrl ?? null,
    total_area: project.totalArea ?? null,
    floors_underground: project.floorsUnderground ?? null,
    floors_aboveground: project.floorsAboveground ?? null,
    total_budget: project.totalBudget ?? null,
    start_date: project.startDate ?? null,
    end_date: project.endDate ?? null,
    status: project.status ?? '진행',
    color: project.color ?? null,
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const res2 = await supabase
    .from('projects')
    .upsert(snakePayload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (!res2.error && res2.data) {
    return fromProjectRow(res2.data);
  }

  // Fallback 2: minimal payload if extended schema is missing
  const minimalPayload = {
    id: project.id,
    name: project.name ?? '',
    description: project.description ?? '',
    status: project.status ?? '진행',
    color: project.color ?? null,
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const res3 = await supabase
    .from('projects')
    .upsert(minimalPayload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (!res3.error && res3.data) {
    return fromProjectRow(res3.data);
  }

  // Fallback 3: ultra minimal payload without 'color' column in case 'color' is missing in schema
  const ultraMinimalPayload = {
    id: project.id,
    name: project.name ?? '',
    description: project.description ?? '',
    status: project.status ?? '진행',
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const res4 = await supabase
    .from('projects')
    .upsert(ultraMinimalPayload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (!res4.error && res4.data) {
    return fromProjectRow(res4.data);
  }

  // Fallback 4: payload without 'status' or 'color' (id, name, description, user_id, settings)
  const noStatusPayload = {
    id: project.id,
    name: project.name ?? '',
    description: project.description ?? '',
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const res5 = await supabase
    .from('projects')
    .upsert(noStatusPayload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (!res5.error && res5.data) {
    return fromProjectRow(res5.data);
  }

  // Fallback 5: absolute barebones payload (id, name)
  const barebonesPayload = {
    id: project.id,
    name: project.name ?? '',
  };

  const res6 = await supabase
    .from('projects')
    .upsert(barebonesPayload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (!res6.error && res6.data) {
    return fromProjectRow(res6.data);
  }

  const finalErr = error || res2.error || res3.error || res4.error || res5.error || res6.error;
  console.error('[saveProject] All payload attempts failed:', finalErr);
  throw finalErr;
},

async updateProject(project: Project) {
  const primaryPayload = {
    name: project.name ?? '',
    projectCode: project.projectCode ?? null,
    location: project.location ?? null,
    resolvedAddress: project.resolvedAddress ?? null,
    latitude: project.latitude ?? null,
    longitude: project.longitude ?? null,
    description: project.description ?? null,
    imageUrl: project.imageUrl ?? null,
    totalArea: project.totalArea ?? null,
    floorsUnderground: project.floorsUnderground ?? null,
    floorsAboveground: project.floorsAboveground ?? null,
    totalBudget: project.totalBudget ?? null,
    startDate: project.startDate ?? null,
    endDate: project.endDate ?? null,
    status: project.status ?? '진행',
    color: project.color ?? null,
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const { data, error } = await supabase
    .from('projects')
    .update(primaryPayload)
    .eq('id', project.id)
    .select()
    .maybeSingle();

  if (!error && data) {
    return fromProjectRow(data);
  }

  // Fallback 1: snake_case
  const snakePayload = {
    name: project.name ?? '',
    project_code: project.projectCode ?? null,
    location: project.location ?? null,
    resolved_address: project.resolvedAddress ?? null,
    latitude: project.latitude ?? null,
    longitude: project.longitude ?? null,
    description: project.description ?? null,
    image_url: project.imageUrl ?? null,
    total_area: project.totalArea ?? null,
    floors_underground: project.floorsUnderground ?? null,
    floors_aboveground: project.floorsAboveground ?? null,
    total_budget: project.totalBudget ?? null,
    start_date: project.startDate ?? null,
    end_date: project.endDate ?? null,
    status: project.status ?? '진행',
    color: project.color ?? null,
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const res2 = await supabase
    .from('projects')
    .update(snakePayload)
    .eq('id', project.id)
    .select()
    .maybeSingle();

  if (!res2.error && res2.data) {
    return fromProjectRow(res2.data);
  }

  // Fallback 2: minimal payload
  const minimalPayload = {
    name: project.name ?? '',
    description: project.description ?? '',
    status: project.status ?? '진행',
    color: project.color ?? null,
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const res3 = await supabase
    .from('projects')
    .update(minimalPayload)
    .eq('id', project.id)
    .select()
    .maybeSingle();

  if (!res3.error && res3.data) {
    return fromProjectRow(res3.data);
  }

  // Fallback 3: ultra minimal without 'color'
  const ultraMinimalPayload = {
    name: project.name ?? '',
    description: project.description ?? '',
    status: project.status ?? '진행',
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const res4 = await supabase
    .from('projects')
    .update(ultraMinimalPayload)
    .eq('id', project.id)
    .select()
    .maybeSingle();

  if (!res4.error && res4.data) {
    return fromProjectRow(res4.data);
  }

  // Fallback 4: payload without 'status' or 'color' (name, description, user_id, settings)
  const noStatusPayload = {
    name: project.name ?? '',
    description: project.description ?? '',
    user_id: project.user_id ?? null,
    settings: project.settings ?? null,
  };

  const res5 = await supabase
    .from('projects')
    .update(noStatusPayload)
    .eq('id', project.id)
    .select()
    .maybeSingle();

  if (!res5.error && res5.data) {
    return fromProjectRow(res5.data);
  }

  // Fallback 5: absolute barebones payload (name)
  const barebonesPayload = {
    name: project.name ?? '',
  };

  const res6 = await supabase
    .from('projects')
    .update(barebonesPayload)
    .eq('id', project.id)
    .select()
    .maybeSingle();

  if (!res6.error && res6.data) {
    return fromProjectRow(res6.data);
  }

  const finalErr = error || res2.error || res3.error || res4.error || res5.error || res6.error;
  if (finalErr) {
    console.error('[updateProject] Supabase error:', finalErr);
    throw finalErr;
  }

  throw new Error(`프로젝트 수정 실패: id=${project.id} 와 일치하는 projects row가 없습니다.`);
},

  async updateProjectSettings(projectId: string, settings: AppSettings) {
    const { data, error } = await supabase
      .from('projects')
      .update({ settings: settings })
      .eq('id', projectId)
      .select()
      .single();
    if (error) {
      console.error("Supabase Update Error Details:", error);
      throw error;
    }
    return data;
  },

  async deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },

  // Schedules
  async getSchedules(projectId: string) {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('projectId', projectId)
      .order('sortOrder', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => fromScheduleRow(row as ScheduleRow)) as ScheduleItem[];
  },

  async saveSchedule(item: ScheduleItemWithExtra) {
    const row = toScheduleRow(item);
    const { data, error } = await supabase.from('schedules').upsert(row).select().single();
    if (error) throw error;
    return fromScheduleRow(data as ScheduleRow) as ScheduleItem;
  },

  async deleteSchedule(id: string) {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) throw error;
  },

  // Users
  async getUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data as User[];
  },

  async saveUser(user: User) {
    const { data, error } = await supabase.from('users').upsert(user).select().single();
    if (error) throw error;
    return data as User;
  },

  async getUserByEmail(email: string) {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data as User | null;
  },

  async deleteUser(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  // Settings
  async getSettings() {
    const { data, error } = await supabase.from('settings').select('*').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.settings as AppSettings | null;
  },

  async saveSettings(settings: AppSettings) {
    const { error } = await supabase.from('settings').upsert({ id: 'global', settings }).select();
    if (error) throw error;
  },

  // Daily Reports
  async getDailyReports(projectId: string) {
    const { data, error } = await supabase.from('daily_reports').select('*').eq('projectId', projectId);
    if (error) throw error;
    return data as any[];
  },

  async saveDailyReport(report: any) {
  const user = await getCurrentUser();

  const isUpdate = !!report.id;

  const newReport = {
    ...report,
    ...(isUpdate
      ? {
          updated_by: user?.id,
          updated_at: new Date()
        }
      : {
          created_by: user?.id
        })
  };

  const { data, error } = await supabase
    .from('daily_reports')
    .upsert(newReport)
    .select()
    .single();

  if (error) throw error;
  return data;
  },

  async deleteDailyReport(id: string) {
    const { error } = await supabase.from('daily_reports').delete().eq('id', id);
    if (error) throw error;
  },

  // Inspection Requests
  async getInspectionRequests(projectId: string) {
    const { data, error } = await supabase.from('inspection_requests').select('*').eq('projectId', projectId);
    if (error) throw error;
    return data as any[];
  },

  async saveInspectionRequest(request: any) {
    const { data, error } = await supabase.from('inspection_requests').upsert(request).select().single();
    if (error) throw error;
    return data;
  },

  async deleteInspectionRequest(id: string) {
    const { error } = await supabase.from('inspection_requests').delete().eq('id', id);
    if (error) throw error;
  },

  // Material Approvals
  async getMaterialApprovals(projectId: string) {
    const { data, error } = await supabase.from('material_approvals').select('*').eq('projectId', projectId);
    if (error) throw error;
    return data as any[];
  },

  async saveMaterialApproval(approval: any) {
    const { data, error } = await supabase.from('material_approvals').upsert(approval).select().single();
    if (error) throw error;
    return data;
  },

  async deleteMaterialApproval(id: string) {
    const { error } = await supabase.from('material_approvals').delete().eq('id', id);
    if (error) throw error;
  },

  // Concrete Plans
  async getConcretePlans(projectId: string) {
    const { data, error } = await supabase.from('concrete_plans').select('*').eq('projectId', projectId);
    if (error) throw error;
    return data as any[];
  },

  async saveConcretePlan(plan: any) {
    const { data, error } = await supabase.from('concrete_plans').upsert(plan).select().single();
    if (error) throw error;
    return data;
  },

  async deleteConcretePlan(id: string) {
    const { error } = await supabase.from('concrete_plans').delete().eq('id', id);
    if (error) throw error;
  },

  // 👉 Drawings (여기부터 도면 처리 로직입니다)
  async getDrawings(projectId: string) {
    const { data, error } = await supabase.from('drawings').select('*').eq('projectId', projectId);
    if (error) throw error;
    return data as Drawing[];
  },

  async saveDrawing(drawing: Drawing) {
    const { data, error } = await supabase.from('drawings').upsert(drawing).select().single();
    if (error) throw error;
    return data as Drawing;
  },

  async deleteDrawing(id: string) {
    const { error } = await supabase.from('drawings').delete().eq('id', id);
    if (error) throw error;
  },

// 👉 Storage (여기부터 이미지 업로드 로직입니다)
  async uploadImage(file: File | Blob, fileName: string) {
  const bucketName = 'photos';

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',

      // 현재 Storage 정책에 UPDATE가 없으므로 false가 안전합니다.
      // 파일명은 매번 고유하게 만들기 때문에 충돌 가능성이 낮습니다.
      upsert: true,
    });

  if (error) {
    console.error('Supabase Storage uploadImage error:', error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  if (!urlData?.publicUrl) {
    throw new Error('Storage Public URL 생성에 실패했습니다.');
  }

  return urlData.publicUrl;
},

 // 👉 Storage (사진 이미지 파일 삭제용)
  async deleteImage(fileName: string) {
    const bucketName = 'photos';
    
    // Supabase Storage에서 파일 삭제
    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) throw error;

    // 🚨 핵심: 에러는 안 났지만 권한 부족으로 삭제된 파일이 0개일 때를 잡아냅니다.
    if (!data || data.length === 0) {
      throw new Error('권한(RLS)이 없거나 파일을 찾을 수 없습니다.');
    }
  },

    // Supabase AiReport 함수
  async getAiReport(payload: AiReportRequest) {
    const { data, error } = await supabase.functions.invoke('ai-report', {
      body: payload,
    });

    if (error) throw error;
    return data as AiReportResponse;
  },

  // Supabase AI Risk Scan 함수
  async getAiRiskScan(payload: AiRiskScanRequest) {
    const { data, error } = await supabase.functions.invoke('ai-risk-scan', {
      body: payload,
    });

    if (error) throw error;
    return data as AiRiskScanResponse;
  },

    // Quick Memos
  async getQuickMemos(projectId: string) {
  const { data, error } = await supabase
    .from('quick_memos')
    .select('*')
    .eq('projectId', projectId)
    .order('date', { ascending: false })
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return data || [];
},

async getQuickMemosByDate(projectId: string, date: string) {
  const { data, error } = await supabase
    .from('quick_memos')
    .select('*')
    .eq('projectId', projectId)
    .eq('date', date)
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return data || [];
},

async saveQuickMemo(memo: any) {
  const user = await getCurrentUser();

  const payload = {
    ...memo,
    createdBy: memo.createdBy || user?.id || null,
    updatedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('quick_memos')
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
},

  async deleteQuickMemo(id: string) {
    const { error } = await supabase
      .from('quick_memos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
  
  async analyzeQuickMemo(payload: {
    projectId: string;
    rawText?: string;
    audioBase64?: string;
    imageUrls?: string[];
    date: string;
  }) {
    const { data, error } = await supabase.functions.invoke('ai-quick-memo', {
      body: payload,
    });

    if (error) throw error;
    return data;
  },

  async getPersonnelAllocations() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'personnel_allocations')
      .maybeSingle();

    if (error) throw error;
    return (data?.settings?.allocations || null) as Allocation[] | null;
  },

  async savePersonnelAllocations(allocations: Allocation[]) {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'personnel_allocations', settings: { allocations } });

    if (error) throw error;
  },

  // Billing
  async getBillingData(projectId: string) {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', `billing_data_${projectId}`)
      .maybeSingle();

    if (error) throw error;
    return (data?.settings || {}) as any;
  },

  async saveBillingData(projectId: string, billingData: any) {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: `billing_data_${projectId}`, settings: billingData });

    if (error) throw error;
  },

  async deleteBillingData(projectId: string) {
    const { error } = await supabase
      .from('settings')
      .delete()
      .eq('id', `billing_data_${projectId}`);

    if (error) throw error;
  },

  // -------------------------------------------------------------
  // 제작 / 출고 현황 (Production Status)
  // -------------------------------------------------------------
  async getProductionConfig(projectId: string): Promise<ProductionConfig | null> {
    let dedicatedConfig: ProductionConfig | null = null;
    let settingsConfig: ProductionConfig | null = null;

    try {
      // 1. 전용 테이블 production_configs 우선 조회 시도
      const { data: dedicatedData, error: dedicatedErr } = await supabase
        .from('production_configs')
        .select('*')
        .eq('projectId', projectId)
        .maybeSingle();

      if (!dedicatedErr && dedicatedData) {
        dedicatedConfig = {
          plannedVolumes: dedicatedData.plannedVolumes || dedicatedData.planned_volumes || { total: 5000, steel: 5000, single: 5000, moduleFrame: 5000, finished: 5000, shipped: 5000 },
          activeFactories: dedicatedData.activeFactories || dedicatedData.active_factories || ['진천공장'],
          activeFloors: dedicatedData.activeFloors || dedicatedData.active_floors || ['1층', '2층'],
        };
      }
    } catch (e) {
      // 전용 테이블 미존재 또는 로드 실패
    }

    try {
      // 2. settings 테이블 폴백 조회
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', `production_config_${projectId}`)
        .maybeSingle();

      if (!error && data?.settings) {
        settingsConfig = data.settings as ProductionConfig;
      }
    } catch (err) {
      console.warn('Failed to load production config from settings:', err);
    }

    // 양쪽 모두 존재하면, 데이터 정합성을 극대화하기 위해 settings 설정을 우선적으로 머지/복구
    if (dedicatedConfig && settingsConfig) {
      return {
        plannedVolumes: settingsConfig.plannedVolumes || dedicatedConfig.plannedVolumes || { total: 5000, steel: 5000, single: 5000, moduleFrame: 5000, finished: 5000, shipped: 5000 },
        activeFactories: settingsConfig.activeFactories || dedicatedConfig.activeFactories || ['진천공장'],
        activeFloors: settingsConfig.activeFloors || dedicatedConfig.activeFloors || ['1층', '2층'],
      };
    }

    return dedicatedConfig || settingsConfig || null;
  },

  async saveProductionConfig(projectId: string, config: ProductionConfig) {
    let saved = false;
    let lastErr = null;

    // 1. 전용 테이블에 저장 시도 (SnakeCase 컬럼 구조에 정확히 맞춤)
    try {
      const { error: err } = await supabase
        .from('production_configs')
        .upsert({
          id: projectId,
          projectId,
          planned_volumes: config.plannedVolumes,
          active_factories: config.activeFactories,
          active_floors: config.activeFloors,
          updated_at: new Date().toISOString()
        });
      if (!err) {
        saved = true;
      } else {
        lastErr = err;
        console.warn('[saveProductionConfig] Primary production_configs upsert error:', err);
      }
    } catch (e) {
      lastErr = e;
      console.warn('[saveProductionConfig] Primary production_configs upsert exception:', e);
    }

    if (!saved && lastErr) {
      console.warn('[saveProductionConfig] Dedicated table upsert failed, relying on settings synchronization. Error:', lastErr);
    }

    // 2. settings 테이블에 항상 동기화 백업 저장 (모든 기기에서 즉각 정합성을 유지하기 위함)
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          id: `production_config_${projectId}`,
          settings: config,
          updated_at: new Date().toISOString()
        });
      if (error) {
        if (!saved) throw error;
      }
    } catch (err) {
      if (!saved) {
        console.error('Failed to save production config to settings:', err);
        throw err;
      }
    }
  },

  async getProductionDays(projectId: string): Promise<Record<string, ProductionDayData> | null> {
    const result: Record<string, ProductionDayData> = {};

    // 1. 전용 테이블 production_reports 조회 시도
    try {
      const { data: dedicatedList, error: dedicatedErr } = await supabase
        .from('production_reports')
        .select('*')
        .eq('projectId', projectId);

      if (!dedicatedErr && dedicatedList && dedicatedList.length > 0) {
        dedicatedList.forEach((row: any) => {
          const dateStr = row.date || row.id;
          result[dateStr] = {
            id: dateStr,
            projectId,
            date: dateStr,
            steel: Number(row.steel) || 0,
            single: Number(row.single) || 0,
            moduleFrame: Number(row.module_frame ?? row.moduleFrame) || 0,
            finished: Number(row.finished) || 0,
            shipped: Number(row.shipped) || 0,
            photos: row.photos || [],
            notes: typeof row.notes === 'string' ? row.notes : JSON.stringify(row.notes || []),
            breakdowns: (row.breakdowns || []).map((b: any) => ({
              factory: b.factory || '공장',
              floor: b.floor || '1층',
              steel: Number(b.steel) || 0,
              single: Number(b.single) || 0,
              moduleFrame: Number(b.moduleFrame ?? b.module_frame) || 0,
              finished: Number(b.finished) || 0,
              shipped: Number(b.shipped) || 0,
            }))
          };
        });
      }
    } catch (e) {
      // 전용 테이블 조회 실패
    }

    // 2. settings 테이블 폴백 데이터 조회 및 완벽 병합 (Merge)
    // 기기 간, 테이블 간 누락 데이터를 완전히 교정함
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', `production_data_${projectId}`)
        .maybeSingle();

      if (!error && data?.settings?.days) {
        const settingsDays = data.settings.days as Record<string, ProductionDayData>;
        Object.keys(settingsDays).forEach((dateStr) => {
          // 전용 테이블에 해당 날짜 기록이 아예 없는 경우에만 복원/병합
          if (!result[dateStr]) {
            const sDay = settingsDays[dateStr];
            result[dateStr] = {
              ...sDay,
              steel: Number(sDay.steel) || 0,
              single: Number(sDay.single) || 0,
              moduleFrame: Number(sDay.moduleFrame) || 0,
              finished: Number(sDay.finished) || 0,
              shipped: Number(sDay.shipped) || 0,
              breakdowns: (sDay.breakdowns || []).map((b: any) => ({
                factory: b.factory || '공장',
                floor: b.floor || '1층',
                steel: Number(b.steel) || 0,
                single: Number(b.single) || 0,
                moduleFrame: Number(b.moduleFrame ?? b.module_frame) || 0,
                finished: Number(b.finished) || 0,
                shipped: Number(b.shipped) || 0,
              }))
            };
          }
        });
      }
    } catch (err) {
      console.warn('Failed to merge production days from settings fallback:', err);
    }

    if (Object.keys(result).length > 0) {
      return result;
    }
    return null;
  },

  async saveProductionDay(projectId: string, dayData: ProductionDayData, allDaysMap?: Record<string, ProductionDayData>) {
    let dedicatedSuccess = false;
    let primaryErr: any = null;

    const normalizedBreakdowns = (dayData.breakdowns || []).map(b => ({
      factory: b.factory,
      floor: b.floor,
      steel: Number(b.steel) || 0,
      single: Number(b.single) || 0,
      moduleFrame: Number(b.moduleFrame) || 0,
      module_frame: Number(b.moduleFrame) || 0,
      finished: Number(b.finished) || 0,
      shipped: Number(b.shipped) || 0,
    }));

    // 1. 전용 테이블 production_reports에 정확한 snake_case 컬럼(module_frame)으로 저장
    try {
      const payload = {
        id: `${projectId}_${dayData.date}`,
        projectId,
        date: dayData.date,
        steel: Number(dayData.steel) || 0,
        single: Number(dayData.single) || 0,
        module_frame: Number(dayData.moduleFrame) || 0,
        finished: Number(dayData.finished) || 0,
        shipped: Number(dayData.shipped) || 0,
        photos: dayData.photos || [],
        notes: typeof dayData.notes === 'string' ? dayData.notes : JSON.stringify(dayData.notes || ''),
        breakdowns: normalizedBreakdowns,
        updated_at: new Date().toISOString()
      };

      const { error: err } = await supabase
        .from('production_reports')
        .upsert(payload);

      if (!err) {
        dedicatedSuccess = true;
      } else {
        primaryErr = err;
        console.error('[saveProductionDay] production_reports upsert error:', err);
      }
    } catch (e) {
      primaryErr = e;
      console.error('[saveProductionDay] production_reports upsert exception:', e);
    }

    // 2. settings 테이블에 동기화 백업 저장
    let settingsSuccess = false;
    try {
      let daysMap = allDaysMap;
      if (!daysMap) {
        const existing = await this.getProductionDays(projectId);
        daysMap = existing || {};
      }
      daysMap[dayData.date] = {
        ...dayData,
        steel: Number(dayData.steel) || 0,
        single: Number(dayData.single) || 0,
        moduleFrame: Number(dayData.moduleFrame) || 0,
        finished: Number(dayData.finished) || 0,
        shipped: Number(dayData.shipped) || 0,
        breakdowns: normalizedBreakdowns
      };

      const { error: settingsErr } = await supabase
        .from('settings')
        .upsert({
          id: `production_data_${projectId}`,
          settings: { days: daysMap },
          updated_at: new Date().toISOString()
        });

      if (!settingsErr) {
        settingsSuccess = true;
      } else {
        console.warn('[saveProductionDay] settings backup upsert error:', settingsErr);
      }
    } catch (err) {
      console.warn('[saveProductionDay] settings backup upsert exception:', err);
    }

    // 전용 테이블과 settings 테이블 둘 다 실패한 경우에만 예외를 던져 UI에서 에러를 감지할 수 있도록 함
    if (!dedicatedSuccess && !settingsSuccess) {
      throw primaryErr || new Error('제작 현황 데이터 저장에 실패했습니다.');
    }
  },

  async saveAllProductionDays(projectId: string, daysMap: Record<string, ProductionDayData>) {
    // 1. settings 테이블에 즉시 저장
    const { error: settingsError } = await supabase
      .from('settings')
      .upsert({
        id: `production_data_${projectId}`,
        settings: { days: daysMap },
        updated_at: new Date().toISOString()
      });

    // 2. 전용 테이블 production_reports 동기화
    try {
      const rows = Object.values(daysMap).map(d => ({
        id: `${projectId}_${d.date}`,
        projectId,
        date: d.date,
        steel: Number(d.steel) || 0,
        single: Number(d.single) || 0,
        module_frame: Number(d.moduleFrame) || 0,
        finished: Number(d.finished) || 0,
        shipped: Number(d.shipped) || 0,
        photos: d.photos || [],
        notes: typeof d.notes === 'string' ? d.notes : JSON.stringify(d.notes || ''),
        breakdowns: (d.breakdowns || []).map(b => ({
          factory: b.factory,
          floor: b.floor,
          steel: Number(b.steel) || 0,
          single: Number(b.single) || 0,
          moduleFrame: Number(b.moduleFrame) || 0,
          module_frame: Number(b.moduleFrame) || 0,
          finished: Number(b.finished) || 0,
          shipped: Number(b.shipped) || 0,
        })),
        updated_at: new Date().toISOString()
      }));
      
      if (rows.length > 0) {
        const { error: reportErr } = await supabase.from('production_reports').upsert(rows);
        if (reportErr) {
          console.warn('[saveAllProductionDays] Upsert error to production_reports:', reportErr);
        }
      }
    } catch (e) {
      console.warn('[saveAllProductionDays] Exception syncing to production_reports:', e);
    }

    if (settingsError) throw settingsError;
  }

};
