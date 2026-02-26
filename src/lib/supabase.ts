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
  // 메인화면 파일 업로드 시 배치 ID (NULL = 관리자 직접 입력)
  // Supabase SQL: ALTER TABLE admin_records ADD COLUMN upload_batch TEXT;
  upload_batch?: string;
}

export interface UploadBatch {
  batch_id: string;
  filename: string;
  count: number;
  uploaded_at: string;
}

export async function fetchUploadBatches(): Promise<UploadBatch[]> {
  const { data, error } = await supabase
    .from('admin_records')
    .select('upload_batch, created_at')
    .not('upload_batch', 'is', null);
  if (error) throw error;

  const map: Record<string, { count: number; uploaded_at: string }> = {};
  for (const rec of data || []) {
    if (!rec.upload_batch) continue;
    if (!map[rec.upload_batch]) map[rec.upload_batch] = { count: 0, uploaded_at: rec.created_at || '' };
    map[rec.upload_batch].count++;
  }

  return Object.entries(map)
    .map(([batch_id, info]) => ({
      batch_id,
      filename: batch_id.split('_').slice(1).join('_') || batch_id,
      count: info.count,
      uploaded_at: info.uploaded_at,
    }))
    .sort((a, b) => b.batch_id.localeCompare(a.batch_id));
}

export async function deleteUploadBatch(batchId: string): Promise<void> {
  const { error } = await supabase
    .from('admin_records')
    .delete()
    .eq('upload_batch', batchId);
  if (error) throw error;
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

export async function updateAdminRecord(id: string, record: Omit<AdminRecord, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase
    .from('admin_records')
    .update(record)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAdminRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('admin_records')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function insertAdminRecords(records: Omit<AdminRecord, 'id' | 'created_at'>[]): Promise<void> {
  const { error } = await supabase
    .from('admin_records')
    .insert(records);
  if (error) throw error;
}
