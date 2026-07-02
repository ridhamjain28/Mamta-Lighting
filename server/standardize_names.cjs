require('dotenv').config({ path: '../client/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function standardize(name) {
  const n = name.toLowerCase().trim();
  
  // 6A 1Way
  if ((n.includes('6a') && n.includes('1way') && !n.includes('bell') && !n.includes('ind') && !n.includes('mcb')) || 
      n.includes('6ax one way flat switch') || n.includes('6a flat 1way') || n === 'one way switch') {
    return 'Switch 6A One-way - 1 Module';
  }
  // 6A 2Way
  if ((n.includes('6a') && n.includes('2way') && !n.includes('bell')) || 
      n.includes('6a flat 2way') || n.includes('6ax two way flat switch')) {
    return 'Switch 6A Two-way - 1 Module';
  }
  // 16A 1Way
  if (n.includes('16a') && (n.includes('1way') || n.includes('one way')) && !n.includes('ind') && !n.includes('mcb')) {
    return 'Switch 16A One-way - 1 Module';
  }
  // 16A 1Way Ind
  if (n.includes('16a') && (n.includes('1way') || n.includes('one way')) && n.includes('ind')) {
    return 'Switch 16A One-way with Indicator - 1 Module';
  }
  // 16A 2Way
  if (n.includes('16a') && n.includes('2way')) {
    return 'Switch 16A Two-way - 1 Module';
  }
  
  // DP / High Amp Switches
  if (n.includes('20a dp switch 1way ind')) return 'Switch 20A DP One-way with Indicator - 2 Module';
  if (n.includes('32a dp switch 1way ind')) return 'Switch 32A DP One-way with Indicator - 2 Module';
  if (n.includes('32a dp switch 1way') && !n.includes('ind')) return 'Switch 32A DP One-way - 2 Module';
  if (n.includes('25a dp switch 1way')) return 'Switch 25A DP One-way - 2 Module';
  if (n.includes('25a switch 1way') || n.includes('25a one way switch')) return 'Switch 25A One-way - 1 Module';

  // Bell Push
  if (n.includes('6a') && n.includes('bell') && !n.includes('mega') && !n.includes('ind')) {
    return 'Switch 6A - Bell - 1 Module';
  }
  if (n.includes('mega bell') || (n.includes('bell') && n.includes('ind'))) {
    return 'Switch 6A - Mega Bell with Indicator - 2 Module';
  }

  // Sockets
  if (n.includes('6a 3 pin socket') || n.includes('socket 6a 3-pin-only')) {
    return 'Socket 6A 3-Pin-only Shuttered - 2 Module';
  }
  if (n.includes('6a/16a socket') || n.includes('universal socket') || n.includes('socket 16a and 6a')) {
    return 'Socket 16A and 6A 3-Pin Shuttered - 2 Module';
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
    if (n.includes('3m')) return 'Step Marker Lamp/Night Lamp - 3 Module';
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

  return null;
}

async function main() {
  const { data: products, error } = await supabase.from('products').select('*').eq('product_type', 'Manual Product');
  if (error) throw error;
  
  let updated = 0;
  for (const p of products) {
    const newName = standardize(p.name);
    if (newName && newName !== p.name) {
      console.log(`Renaming: "${p.name}" -> "${newName}"`);
      await supabase.from('products').update({ name: newName }).eq('id', p.id);
      updated++;
    }
  }
  console.log(`Finished renaming ${updated} products.`);
}

main().catch(console.error);
