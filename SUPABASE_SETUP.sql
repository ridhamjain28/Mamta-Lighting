-- Run this in the Supabase SQL Editor for your project: bnsvykngnyvatkjvhiir
-- Note: If you already ran the first setup, this script safely creates the new tables 
-- and registers only them to the realtime publication.

-- 1. Create manufactured products (Recipes)
CREATE TABLE IF NOT EXISTS manufacturing_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Links manufactured products to raw components
CREATE TABLE IF NOT EXISTS manufacturing_product_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES manufacturing_products(id) ON DELETE CASCADE,
    component_id UUID REFERENCES raw_components(id) ON DELETE CASCADE,
    default_qty NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Realtime for ONLY the new tables
-- (If you get an error that they are already registered, you can ignore it safely)
ALTER PUBLICATION supabase_realtime ADD TABLE manufacturing_products;
ALTER PUBLICATION supabase_realtime ADD TABLE manufacturing_product_components;
