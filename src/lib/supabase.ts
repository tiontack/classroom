import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AdminRecord {
  id?: string;
  room: string;
  title: string;
  department: string;
  user_name: string;
  start_time: string;
  end_time: string;
  created_at?: string;
  status: string;
}

export async function fetchAdminRecords(): Promise<AdminRecord[]> {
  const { data, error } = await supabase
    .from('admin_records')
    .select('*')
    .order('start_time', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function insertAdminRecord(record: Omit<AdminRecord, 'id' | 'created_at'>): Promise<AdminRecord> {
  const { data, error } = await supabase
    .from('admin_records')
    .insert([record])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAdminRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('admin_records')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
