import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://hqvcwrkhqyeyufdnxryu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxdmN3cmtocXlleXVmZG54cnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMjkzMzUsImV4cCI6MjEwMDcwNTMzNX0.bquPPhz1SBSZbydIYfDYokdrJrouhxA5H6xdtdldzy0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
