import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ctenchhzlnewhivauumk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0ZW5jaGh6bG5ld2hpdmF1dW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjUzNTYsImV4cCI6MjEwNDM0MTM1Nn0.V65m3c8GTQSrMBaWdG40DBq4LIq7RZnx7igcipYkH1k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
