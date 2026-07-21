import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiqcxklultqjlmmmlve.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaXFjeGtsdWx0cWpsbW1tbHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Njk4MTIsImV4cCI6MjA5OTA0NTgxMn0.A1PyeQG_tgpcMBPwIxXg8bMCOP2YO3d911NSDKMI3Fw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error(error);
    return;
  }
  console.log("Recent 5 orders:");
  for (const o of orders) {
    const timestamp = new Date(o.created_at).getTime();
    const dateStr = new Date(timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    const utcDateStr = new Date(o.created_at).toISOString().split('T')[0];
    console.log(`ID: ${o.id}, Status: ${o.status}, created_at: ${o.created_at}, timestamp: ${timestamp}, dateStr(Taipei): ${dateStr}, dateStr(UTC): ${utcDateStr}`);
  }
}
run();
