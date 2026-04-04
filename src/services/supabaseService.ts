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
    const { data, error } = await supabase
      .from('projects')
      .upsert(project)
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  async updateProjectSettings(projectId: string, settings: AppSettings) {
    const { error } = await supabase
      .from('projects')
      .update({ settings: settings })
      .eq('id', projectId);

    if (error) throw error;
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

    const { data, error } = await supabase
      .from('schedules')
      .upsert(row)
      .select()
      .single();

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
    const { data, error } = await supabase
      .from('users')
      .upsert(user)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  },

  async getUserByEmail(email: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

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
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'global', settings })
      .select();

    if (error) throw error;
  },

  // Daily Reports
  async getDailyReports(projectId: string) {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('projectId', projectId);

    if (error) throw error;
    return data as any[];
  },

  async saveDailyReport(report: any) {
    const { data, error } = await supabase
      .from('daily_reports')
      .upsert(report)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

// Drawings (도면 데이터 DB 저장/불러오기)
  async getDrawings(projectId: string) {
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .eq('projectId', projectId);

    if (error) throw error;
    return data as Drawing[];
  },

  async saveDrawing(drawing: Drawing) {
    const { data, error } = await supabase
      .from('drawings')
      .upsert(drawing)
      .select()
      .single();

    if (error) throw error;
    return data as Drawing;
  },

  async deleteDrawing(id: string) {
    const { error } = await supabase.from('drawings').delete().eq('id', id);
    if (error) throw error;
  },

  // Storage (도면 및 사진 이미지 파일 업로드용)
  async uploadImage(blob: Blob, fileName: string, bucketName: string = 'photos') {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, blob, {
        cacheControl: '3600',
        upsert: false // 덮어쓰기 방지
      });

    if (error) throw error;

    // 업로드된 파일의 공개 URL(Public URL) 가져오기
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return publicUrl;
  },

  // Connection Test
  async testConnection() {
    try {
      const { error } = await supabase.from('projects').select('id').limit(1);
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error };
    }
  }
};
