const { Client } = require('pg');

const connectionString = 'postgresql://postgres:VcIGECvfnrJ2vlls@db.bnsvykngnyvatkjvhiir.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
});

async function runSetup() {
  try {
    await client.connect();
    console.log('Connected to database.');

    const setupSql = `
      CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
      );

      INSERT INTO app_settings (key, value) VALUES 
      ('admin_pin', '319bd7bd97f7ef777353f86e3305de18420e64cd344799000a6c0ef4979e2730'),
      ('employee_pin', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
      ON CONFLICT (key) DO NOTHING;

      CREATE TABLE IF NOT EXISTS raw_components (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          stock_qty INT DEFAULT 0,
          sort_order INT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS manufacturing_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          quotation_id TEXT,
          title TEXT NOT NULL,
          notes TEXT,
          status TEXT DEFAULT 'Not Started',
          completed_by TEXT,
          approved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS manufacturing_job_components (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_id UUID REFERENCES manufacturing_jobs(id) ON DELETE CASCADE,
          component_id UUID,
          component_name TEXT,
          planned_qty NUMERIC,
          actual_qty NUMERIC,
          note TEXT,
          product_name TEXT,
          is_collected BOOLEAN DEFAULT FALSE,
          sort_order INT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS manufacturing_product_components (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
          component_id UUID REFERENCES raw_components(id) ON DELETE CASCADE,
          default_qty NUMERIC DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_image_quote BOOLEAN DEFAULT TRUE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_manufacturing BOOLEAN DEFAULT FALSE;
      ALTER TABLE manufacturing_jobs ADD COLUMN IF NOT EXISTS completed_by TEXT;
      ALTER TABLE manufacturing_jobs ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;
      ALTER TABLE manufacturing_job_components ADD COLUMN IF NOT EXISTS product_name TEXT;
    `;
    
    await client.query(setupSql);
    console.log('Tables created and products table updated successfully.');
    
    const tables = ['manufacturing_jobs', 'manufacturing_job_components', 'manufacturing_product_components'];
    for (const table of tables) {
        try {
            await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table};`);
            console.log(`Enabled realtime for ${table}`);
        } catch(e) {
            console.log(`Realtime already enabled or failed for ${table}: ` + e.message);
        }
    }

  } catch (err) {
    console.error('Error executing script:', err);
  } finally {
    await client.end();
  }
}

runSetup();
