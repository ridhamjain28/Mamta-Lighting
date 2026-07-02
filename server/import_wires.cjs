const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../client/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const wires = [
  { name: "HAVELLS 1 SQ MM - 90M", sub_brand: "HAVELLS 90M", base_price: 3150 },
  { name: "HAVELLS 1.5 SQ MM - 90M", sub_brand: "HAVELLS 90M", base_price: 4620 },
  { name: "HAVELLS 2.5 SQ MM - 90M", sub_brand: "HAVELLS 90M", base_price: 7375 },
  { name: "HAVELLS 4 SQ MM - 90M", sub_brand: "HAVELLS 90M", base_price: 10790 },
  { name: "HAVELLS 6 SQ MM - 90M", sub_brand: "HAVELLS 90M", base_price: 16070 },

  { name: "FINOLEX FRLS 0.75 SQ MM - 90MTR", sub_brand: "FINOLEX FRLS 90MTR", base_price: 1905 },
  { name: "FINOLEX FRLS 1 SQ MM - 90MTR", sub_brand: "FINOLEX FRLS 90MTR", base_price: 2425 },
  { name: "FINOLEX FRLS 1.5 SQ MM - 90 MTR", sub_brand: "FINOLEX FRLS 90MTR", base_price: 3580 },
  { name: "FINOLEX FRLS 2.5 SQ MM - 90MTR", sub_brand: "FINOLEX FRLS 90MTR", base_price: 5720 },
  { name: "FINOLEX FRLS 4 SQ MM - 90MTR", sub_brand: "FINOLEX FRLS 90MTR", base_price: 8685 },
  { name: "FINOLEX FRLS 6 SQ MM - 90MTR", sub_brand: "FINOLEX FRLS 90MTR", base_price: 13175 },

  { name: "FINOLEX ULTRA 0.75 SQ MM - 90MTR", sub_brand: "FINOLEX ULTRA 90MTR", base_price: 2040 },
  { name: "FINOLEX ULTRA 1 SQ MM - 90MTR", sub_brand: "FINOLEX ULTRA 90MTR", base_price: 2625 },
  { name: "FINOLEX ULTRA 1.5 SQ MM - 90MTR", sub_brand: "FINOLEX ULTRA 90MTR", base_price: 3820 },
  { name: "FINOLEX ULTRA 2.5 SQ MM - 90MTR", sub_brand: "FINOLEX ULTRA 90MTR", base_price: 6155 },
  { name: "FINOLEX ULTRA 4 SQ MM - 90MTR", sub_brand: "FINOLEX ULTRA 90MTR", base_price: 9545 },
  { name: "FINOLEX ULTRA 6 SQ MM - 90MTR", sub_brand: "FINOLEX ULTRA 90MTR", base_price: 14140 },

  { name: "HAVELLS 0.75 SQ MM - 180M", sub_brand: "HAVELLS 180M", base_price: 4865 },
  { name: "HAVELLS 1 SQ MM - 180M", sub_brand: "HAVELLS 180M", base_price: 6290 },
  { name: "HAVELLS 1.5 SQ MM - 180M", sub_brand: "HAVELLS 180M", base_price: 9215 },
  { name: "HAVELLS 2.5 SQ MM - 180M", sub_brand: "HAVELLS 180M", base_price: 14760 },
  { name: "HAVELLS 4 SQ MM - 180M", sub_brand: "HAVELLS 180M", base_price: 22790 },
  { name: "HAVELLS 6 SQ MM - 180M", sub_brand: "HAVELLS 180M", base_price: 34130 },

  { name: "FINOLEX FRLS 0.75 SQ MM - 300MTR", sub_brand: "FINOLEX FRLS 300MTR", base_price: 0 },
  { name: "FINOLEX FRLS 1 SQ MM - 300MTR", sub_brand: "FINOLEX FRLS 300MTR", base_price: 8170 },
  { name: "FINOLEX FRLS 1.5 SQ MM - 300MTR", sub_brand: "FINOLEX FRLS 300MTR", base_price: 11820 },
  { name: "FINOLEX FRLS 2.5 SQ MM - 300MTR", sub_brand: "FINOLEX FRLS 300MTR", base_price: 19495 },

  { name: "FINOLEX FRLS 4 SQ MM - 200MTR", sub_brand: "FINOLEX FRLS 200MTR", base_price: 20255 },
  { name: "FINOLEX FRLS 6 SQ MM - 200MTR", sub_brand: "FINOLEX FRLS 200MTR", base_price: 30425 },

  { name: "cat 6", sub_brand: "Other Wires", base_price: 17710 },
  { name: "RJ6", sub_brand: "Other Wires", base_price: 0 },
  { name: "Speaker Wire", sub_brand: "Other Wires", base_price: 0 },
  { name: "RJ20", sub_brand: "Other Wires", base_price: 30030 }
].map(w => ({ ...w, product_type: 'Wire Product' }));

async function run() {
  console.log('Deleting existing Wire Products...');
  await supabase.from('products').delete().eq('product_type', 'Wire Product');
  
  console.log('Inserting new wires...');
  const { data, error } = await supabase.from('products').insert(wires);
  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Successfully inserted', wires.length, 'wires');
  }
}

run();
