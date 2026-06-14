import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupDB() {
  console.log("Setting up database...");
  
  // Create quotations table using RPC or raw SQL? 
  // Wait, Supabase REST API doesn't support raw SQL natively unless via RPC.
  // Instead of SQL, we will instruct the user or we will assume it works if they run the script.
  // Actually, we can just log a message that we need the table. 
  console.log("To create the quotations table, please run this in the Supabase SQL Editor:");
  console.log(`
    CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        customer_name TEXT,
        customer_phone TEXT,
        project_name TEXT,
        items JSONB,
        subtotal NUMERIC,
        discount_amount NUMERIC,
        gst_amount NUMERIC,
        grand_total NUMERIC,
        pdf_url TEXT
    );
  `);
}
setupDB();
