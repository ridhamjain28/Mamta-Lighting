require('dotenv').config({ path: '../client/.env' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const FILE_PATH = 'D:\\\\Github Repos\\\\Mamta-quotation-system\\\\Switch Quotation System.xlsx';

const brandMap = {
  'Norisys': { brand: 'Norisys', subBrand: '' },
  'Magnus': { brand: 'L&T', subBrand: 'Magnus' },
  'Signia': { brand: 'Havells', subBrand: 'Signia' },
  'Fabio': { brand: 'Havells', subBrand: 'Fabio' },
  'Apogee': { brand: 'L&T', subBrand: 'Apogee' }
};

async function main() {
  const workbook = xlsx.readFile(FILE_PATH);
  
  // 1. Ensure brands exist
  const { data: existingBrands, error: err1 } = await supabase.from('brands').select('*');
  if (err1) throw err1;
  
  const brandDict = {};
  for (const b of existingBrands) brandDict[b.name.toLowerCase()] = b.id;
  
  const requiredBrands = ['Norisys', 'Havells', 'L&T'];
  for (const rb of requiredBrands) {
    if (!brandDict[rb.toLowerCase()]) {
      const { data: newBrand, error: err2 } = await supabase.from('brands').insert([{ name: rb }]).select();
      if (err2) throw err2;
      brandDict[rb.toLowerCase()] = newBrand[0].id;
      console.log(`Created brand: ${rb}`);
    }
  }

  // 2. Read each sheet and collect products
  const productsToUpsert = [];
  
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === 'Quotation' || sheetName === 'Preview' || sheetName === 'T&C') continue;
    
    // e.g. "Signia-White"
    const parts = sheetName.split('-');
    if (parts.length !== 2) continue;
    
    const prefix = parts[0];
    const color = parts[1];
    
    const brandInfo = brandMap[prefix];
    if (!brandInfo) {
      console.warn(`Unknown prefix: ${prefix} for sheet ${sheetName}`);
      continue;
    }
    
    const brandId = brandDict[brandInfo.brand.toLowerCase()];
    const subBrand = brandInfo.subBrand;
    
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    // First row is usually header: ['Product Name', 'Price']
    // We start from row 1 (second row)
    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (!row || row.length === 0) continue;
      
      const productName = row[0];
      const price = parseFloat(row[1]);
      
      if (!productName || isNaN(price)) continue;
      
      productsToUpsert.push({
        name: productName.trim(),
        product_type: 'Manual Product',
        brand_id: brandId,
        sub_brand: subBrand,
        color: color,
        base_price: price,
        // Using created_at so they stay ordered
        created_at: new Date().toISOString()
      });
    }
  }
  
  console.log(`Found ${productsToUpsert.length} products to import.`);

  // 3. Delete existing products for these specific combinations to avoid duplicates
  // OR we can fetch existing and update. Since we want a clean import, we'll fetch existing manual products
  // and update base_price if matched, otherwise insert.
  
  const { data: existingManuals, error: err3 } = await supabase.from('products').select('*').eq('product_type', 'Manual Product');
  if (err3) throw err3;
  
  let inserted = 0;
  let updated = 0;

  for (const p of productsToUpsert) {
    const existing = existingManuals.find(e => 
      e.name.toLowerCase() === p.name.toLowerCase() && 
      e.brand_id === p.brand_id && 
      (e.sub_brand || '') === p.sub_brand &&
      (e.color || '') === p.color
    );
    
    if (existing) {
      // Update price if changed
      if (existing.base_price !== p.base_price) {
        await supabase.from('products').update({ base_price: p.base_price }).eq('id', existing.id);
        updated++;
      }
    } else {
      await supabase.from('products').insert([p]);
      inserted++;
    }
  }
  
  console.log(`Import complete! Inserted: ${inserted}, Updated: ${updated}`);
}

main().catch(console.error);
