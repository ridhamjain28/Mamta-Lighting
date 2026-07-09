import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in server/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching products...");
  const { data: products, error } = await supabase.from('products').select('sub_brand, color');
  if (error) {
    console.error("Error fetching products:", error);
    return;
  }

  const subBrands = new Set(products.map(p => p.sub_brand).filter(Boolean).map(s => s.trim()));
  const colors = new Set(products.map(p => p.color).filter(Boolean).map(c => c.trim()));

  console.log("Found unique sub-brands:", Array.from(subBrands));
  console.log("Found unique colors:", Array.from(colors));

  for (const name of subBrands) {
    const { error } = await supabase.from('sub_brands').insert([{ name }]);
    if (error) {
       if (error.code === '23505') {
         console.log(`Sub-brand ${name} already exists.`);
       } else {
         console.error(`Error inserting sub-brand ${name}:`, error.message);
       }
    } else {
      console.log(`Inserted sub-brand: ${name}`);
    }
  }

  for (const name of colors) {
    const { error } = await supabase.from('colors').insert([{ name }]);
    if (error) {
       if (error.code === '23505') {
         console.log(`Color ${name} already exists.`);
       } else {
         console.error(`Error inserting color ${name}:`, error.message);
       }
    } else {
      console.log(`Inserted color: ${name}`);
    }
  }

  console.log("Migration complete.");
}

run();
