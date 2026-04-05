import { supabase } from '../lib/supabase';
import { Project, ScheduleItem, AppSettings, User, DailyReport, Drawing, Category, Status } from '../types';

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

export const supabaseService = {
  // Projects
  async getProjects() {
    const { data, error } = await supabase.from('projects').select('*');
    if (error) throw error;
    return data as Project[];
  },

  async saveProject(project: Project) {
    const { data, error } = await supabase.from('projects').upsert(project).select().single();
    if (error) throw error;
    return data as Project;
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
    const { data, error } = await supabase.from('daily_reports').upsert(report).select().single();
    if (error) throw error;
    return data;
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
  async uploadImage(file: Blob, fileName: string) {
    // 버킷 이름을 기존에 설정하신 'photos'로 맞춥니다.
    const bucketName = 'photos'; 

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false // 덮어쓰기 방지
      });

    if (error) throw error;

    // 업로드 성공 후 Public URL 가져오기
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

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
  }
};