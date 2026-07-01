require('dotenv').config({ path: '../client/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  // Get Havells ID
  const { data: havellsData } = await supabase.from('brands').select('id').eq('name', 'Havells').single();
  const havellsId = havellsData.id;

  // Get L&T ID
  const { data: ltData } = await supabase.from('brands').select('id').eq('name', 'L&T').single();
  
  if (ltData) {
    const ltId = ltData.id;
    
    // Update products
    const { data: updated, error: err1 } = await supabase.from('products')
      .update({ brand_id: havellsId })
      .eq('brand_id', ltId)
      .eq('product_type', 'Manual Product')
      .select();
      
    console.log(`Updated ${updated ? updated.length : 0} products from L&T to Havells.`);
    
    // Delete L&T brand
    const { error: err2 } = await supabase.from('brands').delete().eq('id', ltId);
    if (err2) {
      console.error("Could not delete L&T brand:", err2);
    } else {
      console.log("Deleted L&T brand.");
    }
  } else {
    console.log("L&T brand not found.");
  }
}

main().catch(console.error);
