-- Run this in the Supabase SQL Editor for your project: bnsvykngnyvatkjvhiir
-- This links the manufacturing recipes directly to the main products catalog of the site.

-- 1. Drop the redundant products table and recreate the link table
DROP TABLE IF EXISTS manufacturing_product_components;
DROP TABLE IF EXISTS manufacturing_products;

-- 2. Recreate the link table referencing the main 'products' table (product_id is INTEGER to match products.id)
CREATE TABLE IF NOT EXISTS manufacturing_product_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    component_id UUID REFERENCES raw_components(id) ON DELETE CASCADE,
    default_qty NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add product_name grouping support to manufacturing_job_components
ALTER TABLE manufacturing_job_components ADD COLUMN IF NOT EXISTS product_name TEXT;

-- 3a. Store the actual finished-product ID with each job component. This keeps
-- components from different products separate even when they share a name or
-- raw components (e.g. Product A: a,b,c and Product B: a,c,d).
ALTER TABLE manufacturing_job_components
    ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS manufacturing_job_components_job_product_idx
    ON manufacturing_job_components (job_id, product_id);

-- 4. Add completed_by tracking to manufacturing_jobs
ALTER TABLE manufacturing_jobs ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- 5. Add approval and stock deduction tracking to manufacturing_jobs
ALTER TABLE manufacturing_jobs ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;

-- 6. Add visibility filters to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_image_quote BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_manufacturing BOOLEAN DEFAULT FALSE;

-- 7. Enable Realtime for the link table
ALTER PUBLICATION supabase_realtime ADD TABLE manufacturing_product_components;
