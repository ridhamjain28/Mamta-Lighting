-- Run this in the Supabase SQL Editor for your project: bnsvykngnyvatkjvhiir
-- This links the manufacturing recipes directly to the main products catalog of the site.

-- 1. Drop the redundant products table and recreate the link table
DROP TABLE IF EXISTS manufacturing_product_components;
DROP TABLE IF EXISTS manufacturing_products;

-- 2. Recreate the link table referencing the main 'products' table
CREATE TABLE IF NOT EXISTS manufacturing_product_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    component_id UUID REFERENCES raw_components(id) ON DELETE CASCADE,
    default_qty NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Realtime for the link table
-- (If it's already in the publication, it might throw a warning, which you can ignore)
ALTER PUBLICATION supabase_realtime ADD TABLE manufacturing_product_components;
