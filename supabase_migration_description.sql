-- Run this SQL in your Supabase SQL Editor to add the description column to quotation_items.

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS description TEXT;
