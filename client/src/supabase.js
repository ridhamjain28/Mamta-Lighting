import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bnsvykngnyvatkjvhiir.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_beOiG1Uo-Q0L1813BUBu3Q_Ggxbg6xm';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
