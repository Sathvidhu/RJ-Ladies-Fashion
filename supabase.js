// Supabase connection
const SUPABASE_URL = 'https://dolcjuranluxhousoheb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WsBhOjM75vM7dk_zSNeVdQ_Y-gQOhk6';

// Create a unique client variable to avoid conflicts
window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);