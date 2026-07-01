require('dotenv').config({ path: '../client/.env' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: brands, error } = await supabase.from('brands').select('*');
  if (error) {
    console.error(error);
    return;
  }
  console.log("Brands in DB:", brands);
  
  // also fetch products to see what exists
  const { data: products } = await supabase.from('products').select('id, name, brand_id, sub_brand, color, base_price').limit(5);
  console.log("Sample products:", products);
}

main();
