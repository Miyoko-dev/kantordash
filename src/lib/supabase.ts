import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://grgyufmdylyumgfkkikn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZ3l1Zm1keWx5dW1nZmtraWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDE3NjMsImV4cCI6MjA4ODg3Nzc2M30.EbQ0miZCHhokGIHu3Drmuskobx52RDBrvHVmfT9vRNY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Save a specific data key for the current user
export async function saveUserData(userId: string, dataKey: string, dataValue: any) {
  const { error } = await supabase
    .from('user_data')
    .upsert(
      { user_id: userId, data_key: dataKey, data_value: dataValue },
      { onConflict: 'user_id,data_key' }
    );
  if (error) console.error(`Error saving ${dataKey}:`, error);
  return error;
}

// Load all data keys for the current user
export async function loadAllUserData(userId: string): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from('user_data')
    .select('data_key, data_value')
    .eq('user_id', userId);
  if (error) {
    console.error('Error loading user data:', error);
    return {};
  }
  const result: Record<string, any> = {};
  (data || []).forEach((row: any) => {
    result[row.data_key] = row.data_value;
  });
  return result;
}

// Load or create profile
export async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.error('Error loading profile:', error);
  return data;
}

export async function upsertProfile(userId: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });
  if (error) console.error('Error saving profile:', error);
  return error;
}
