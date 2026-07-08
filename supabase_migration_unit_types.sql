-- Run this SQL in your Supabase SQL Editor to add the unit_types table.

CREATE TABLE IF NOT EXISTS unit_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default unit types
INSERT INTO unit_types (name) VALUES ('N'), ('per metre'), ('per kg')
ON CONFLICT (name) DO NOTHING;
