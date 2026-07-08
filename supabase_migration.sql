-- Run this SQL in your Supabase SQL Editor to add the unit_type column and update existing products.

-- 1. Add the unit_type column with 'N' as the default value (Numbers/Units)
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'N';

-- 2. Update existing 'strip' and 'profile' products to 'per metre' unit type
UPDATE products 
SET unit_type = 'per metre' 
WHERE name ILIKE '%strip%' 
   OR name ILIKE '%profile%';
