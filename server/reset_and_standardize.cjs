require('dotenv').config({ path: '../client/.env' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const FILE_PATH = 'D:\\\\Github Repos\\\\Mamta-quotation-system\\\\Switch Quotation System.xlsx';
const brandMap = {
  'Norisys': { brand: 'Norisys', subBrand: '' },
  'Magnus': { brand: 'Havells', subBrand: 'Magnus' },
  'Signia': { brand: 'Havells', subBrand: 'Signia' },
  'Fabio': { brand: 'Havells', subBrand: 'Fabio' },
  'Apogee': { brand: 'Havells', subBrand: 'Apogee' }
};

function standardize(name) {
  const n = name.toLowerCase().trim();
  
  const tokens = n.split(/[ \\-]+/); 
  
  const has = (word) => {
    if (word.includes(' ')) return ` ${n} `.includes(` ${word} `);
    return tokens.includes(word);
  };
  
  // DP / High Amp Switches (Do this first so 20A DP doesn't match normal 1-way)
  if (has('20a') && has('dp')) return 'Switch 20A DP One-way with Indicator - 2 Module';
  if (has('32a') && has('dp') && has('ind')) return 'Switch 32A DP One-way with Indicator - 2 Module';
  if (has('32a') && has('dp') && !has('ind')) return 'Switch 32A DP One-way - 2 Module';
  if (has('25a') && has('dp')) return 'Switch 25A DP One-way - 2 Module';
  if (has('25a') && (has('1way') || has('one') || n.includes('one way'))) return 'Switch 25A One-way - 1 Module';

  // Bell Push
  if (has('6a') && has('bell') && !has('mega') && !has('ind')) {
    return 'Switch 6A - Bell - 1 Module';
  }
  if (has('mega') || (has('bell') && has('ind'))) {
    return 'Switch 6A - Mega Bell with Indicator - 2 Module';
  }

  // Sockets
  if ((has('6a') && has('socket')) || n.includes('6a 3 pin socket') || n.includes('socket 6a 3-pin-only')) {
    if (!has('16a')) return 'Socket 6A 3-Pin-only Shuttered - 2 Module';
  }
  if (n.includes('6a/16a socket') || n.includes('universal socket') || n.includes('socket 16a and 6a')) {
    return 'Socket 16A and 6A 3-Pin Shuttered - 2 Module';
  }

  // 16A Switches
  if (has('16a') && (has('1way') || n.includes('one way') || n.includes('one-way')) && has('ind')) {
    return 'Switch 16A One-way with Indicator - 1 Module';
  }
  if (has('16a') && (has('1way') || n.includes('one way') || n.includes('one-way')) && !has('ind') && !has('mcb')) {
    return 'Switch 16A One-way - 1 Module';
  }
  if (has('16a') && (has('2way') || n.includes('two way') || n.includes('two-way'))) {
    return 'Switch 16A Two-way - 1 Module';
  }

  // 6A Switches (Be very specific about 1way vs 2way so '2 module' doesn't trigger 2way)
  if ((has('6a') && (has('2way') || n.includes('two way') || n.includes('two-way')) && !has('bell')) || 
      n.includes('6a flat 2way') || n.includes('6ax two way flat switch')) {
    return 'Switch 6A Two-way - 1 Module';
  }
  if ((has('6a') && (has('1way') || n.includes('one way') || n.includes('one-way')) && !has('bell') && !has('ind') && !has('mcb')) || 
      n.includes('6ax one way flat switch') || n.includes('6a flat 1way') || n.includes('one way switch')) {
    return 'Switch 6A One-way - 1 Module';
  }

  // Fan Regulators
  if (n.includes('2m fan regulator') || n.includes('led fan regulator') || n.includes('fan regulator for 120w')) {
    return 'Fan Regulator for 120W fan - 2 Module';
  }
  if (n.includes('1m fan regulator')) {
    return 'Fan Regulator - 1 Module';
  }

  // Indicators / Footlight
  if (n.includes('indicator light') || n.includes('indicator lamp')) {
    return 'Indicator Light - 1 Module';
  }
  if (n.includes('footlight') || n.includes('foot light') || n.includes('step marker')) {
    if (has('3m')) return 'Step Marker Lamp/Night Lamp - 3 Module';
    return 'Step Marker Lamp/Night Lamp - 2 Module';
  }

  // Communication / USB
  if (n.includes('usb') || n.includes('type c')) {
    return 'USB Charger Socket Outlet A+C Type - 1 Module';
  }
  if (n.includes('telephone')) return 'Telephone Socket - 1 Module';
  if (n.includes('tv socket')) return 'TV Socket - 1 Module';
  if (n.includes('computer')) return 'Computer Jack RJ45 - 1 Module';

  // Blank Plate
  if (n.includes('blank') || n.includes('dummy')) {
    return 'Blanking Plate - 1 Module';
  }

  // Buzzer
  if (n.includes('buzzer')) {
    return 'Buzzer - 2 Module';
  }

  // MCBs / Motor Starters
  if (n.includes('mcb')) {
    const match = n.match(/(\\d+)a/);
    const amp = match ? match[1] : '6';
    return `Mini MCB SP 'C' ${amp}A - 1 Module`;
  }
  if (n.includes('motor starter') || n.includes('ac starter')) {
    const match = n.match(/(\\d+)a/);
    if (match) return `AC STARTER ${match[1]}A`;
    return 'AC STARTER';
  }
  
  // Plates just return themselves but capitalized correctly
  if (n.match(/^\\d+m/)) {
    return name.toUpperCase();
  }

  return name;
}

async function main() {
  console.log("Deleting all Manual Products...");
  const { error: delErr } = await supabase.from('products').delete().eq('product_type', 'Manual Product');
  if (delErr) throw delErr;
  
  const { data: existingBrands } = await supabase.from('brands').select('*');
  const brandDict = {};
  for (const b of existingBrands) brandDict[b.name.toLowerCase()] = b.id;

  const workbook = xlsx.readFile(FILE_PATH);
  const productsToInsert = [];
  const seenMap = new Set(); // To deduplicate standardized products within the same variant
  
  for (const sheetName of workbook.SheetNames) {
    if (['Quotation', 'Preview', 'T&C'].includes(sheetName)) continue;
    const parts = sheetName.split('-');
    if (parts.length !== 2) continue;
    const brandInfo = brandMap[parts[0]];
    if (!brandInfo) continue;
    
    const brandId = brandDict[brandInfo.brand.toLowerCase()];
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (!row || !row[0] || isNaN(parseFloat(row[1]))) continue;
      
      const stdName = standardize(row[0]);
      const key = `${brandId}|${brandInfo.subBrand}|${parts[1]}|${stdName}`;
      
      if (seenMap.has(key)) {
        console.log(`Skipping duplicate product: ${stdName} (${brandInfo.brand} - ${brandInfo.subBrand} - ${parts[1]})`);
        continue;
      }
      seenMap.add(key);

      productsToInsert.push({
        name: stdName,
        product_type: 'Manual Product',
        brand_id: brandId,
        sub_brand: brandInfo.subBrand,
        color: parts[1],
        base_price: parseFloat(row[1]),
        created_at: new Date().toISOString()
      });
    }
  }
  
  console.log(`Inserting ${productsToInsert.length} cleanly deduplicated products...`);
  for (let i = 0; i < productsToInsert.length; i += 100) {
    const chunk = productsToInsert.slice(i, i + 100);
    const { error: insErr } = await supabase.from('products').insert(chunk);
    if (insErr) console.error("Insertion error:", insErr);
  }
  console.log("Database reset, standardized, and deduplicated successfully!");
}

main().catch(console.error);
