import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Handle both possible naming conventions for the Anon Key
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_API || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("BINGO X ERROR: Missing Supabase Environment Variables!");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "")
