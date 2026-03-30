import { supabase } from '../lib/supabase';
import { Project, ScheduleItem, AppSettings, User } from '../types';

export const supabaseService = {
  // Projects
  async getProjects() {
    const { data, error } = await supabase.from('projects').select('*');
    if (error) throw error;
    return data as Project[];
  },

  async saveProject(project: Project) {
    const { data, error } = await supabase.from('projects').upsert(project).select();
    if (error) throw error;
    return data[0] as Project;
  },

  async deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },

  // Schedules
  async getSchedules(projectId: string) {
    const { data, error } = await supabase.from('schedules').select('*').eq('projectId', projectId);
    if (error) throw error;
    return data as ScheduleItem[];
  },

  async saveSchedule(item: ScheduleItem) {
    const { data, error } = await supabase.from('schedules').upsert(item).select();
    if (error) throw error;
    return data[0] as ScheduleItem;
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
    const { data, error } = await supabase.from('users').upsert(user).select();
    if (error) throw error;
    return data[0] as User;
  },

  async getUserByEmail(email: string) {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
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
    const { data, error } = await supabase.from('daily_reports').upsert(report).select();
    if (error) throw error;
    return data[0];
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
