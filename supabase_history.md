# Supabase Schema History — Mamta Lighting System

> **IMPORTANT FOR ALL AGENTS:** This is the authoritative record of every table in the Supabase PostgreSQL database. If you add, modify, or delete a table, update this file immediately.

---

## Connection Details

- **Platform:** Supabase (PostgreSQL)
- **Client library:** `@supabase/supabase-js`
- **Frontend uses:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon key, respects RLS)
- **Backend server uses:** `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS — never expose to browser)

---

## Existing Tables (Pre-Manufacturing Feature)

### `products`
Stores all product details across Image Quote, Switch Quote, and Wire Quote systems.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | Product name |
| `model_number` | TEXT | Optional |
| `base_price` | NUMERIC | List price |
| `unit_type` | TEXT | Default `'N'` (units). `'per metre'` for strips/cables |
| `primary_image_url` | TEXT | URL from `product-images` storage bucket |
| `category_id` | UUID | FK to categories |
| `brand_id` | UUID | FK to brands |
| `product_type` | TEXT | `'Image Product'` / `'Manual Product'` / `'Wire Product'` |
| `sub_brand` | TEXT | Switch sub-brand |
| `color` | TEXT | Switch color variant |
| `selected_wattage` | TEXT | For multi-wattage products |
| `description` | TEXT | Optional notes |
| `created_at` | TIMESTAMPTZ | Auto |

### `categories`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | Category name |
| `created_at` | TIMESTAMPTZ | Auto |

### `brands`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | Brand name |
| `created_at` | TIMESTAMPTZ | Auto |

### `unit_types`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | e.g. 'N', 'per metre', 'per coil' |

### `quotations`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `quote_number` | TEXT | e.g. QT-123456 |
| `customer_name` | TEXT | |
| `phone_number` | TEXT | |
| `project_name` | TEXT | |
| `subtotal` | NUMERIC | Before GST |
| `tax_amount` | NUMERIC | GST amount |
| `total_discount` | NUMERIC | Total discount applied |
| `grand_total` | NUMERIC | Final amount |
| `quote_type` | TEXT | 'Image Quote' / 'Switch Quote' / 'Wire Quote' / 'Comparison' |
| `status` | TEXT | 'Draft' / 'Sent' / 'Accepted' / 'Rejected' |
| `pdf_url` | TEXT | URL from quotations storage bucket |
| `gst_included` | BOOLEAN | Prices include GST |
| `hide_list_price` | BOOLEAN | Hide list price on PDF |
| `global_discount` | NUMERIC | Global discount % |
| `is_deleted` | BOOLEAN | Soft delete flag |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Updated on save |

### `quotation_items`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `quotation_id` | UUID | FK to quotations |
| `product_id` | UUID | FK to products |
| `quantity` | NUMERIC | Ordered qty |
| `base_price` | NUMERIC | Snapshot of list price |
| `discount_override` | NUMERIC | Item-level discount % |
| `custom_price_override` | NUMERIC | Custom list price override |
| `final_unit_price` | NUMERIC | Computed net price |
| `line_total` | NUMERIC | final_unit_price x quantity |
| `description` | TEXT | Optional item note |

---

## Storage Buckets

| Bucket | Access | Purpose |
|---|---|---|
| `product-images` | Public | Product photo uploads |
| `quotations` | Public | Generated PDF quotations |

---

## New Tables (Added: Manufacturing Feature — 2026-08-09)

### `app_settings`
PIN storage for role-based access control.

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT | Primary key. 'admin_pin' or 'employee_pin' |
| `value` | TEXT | SHA-256 hash of the PIN |

Current PINs: admin=2897, employee=1234

### `raw_components`
Global catalog of raw parts. Admin-managed. Employees pick from this when building a job.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | e.g. 'Body', 'LED Chip', 'Driver', 'Face Ring' |
| `description` | TEXT | Optional |
| `sort_order` | INT | Display order |
| `created_at` | TIMESTAMPTZ | Auto |

### `manufacturing_jobs`
Each manufacturing work order.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `quotation_id` | UUID | Soft ref to quotations — plain UUID, NO FK constraint |
| `title` | TEXT | Job title |
| `notes` | TEXT | General notes |
| `status` | TEXT | 'Not Started' / 'In Progress' / 'Completed' |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

Realtime enabled on this table.

### `manufacturing_job_components`
Components picked for each job.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `job_id` | UUID | FK to manufacturing_jobs |
| `component_id` | UUID | Soft ref to raw_components — NO FK constraint |
| `component_name` | TEXT | Denormalized — survives if component deleted |
| `planned_qty` | NUMERIC | Qty needed |
| `actual_qty` | NUMERIC | Qty actually taken |
| `note` | TEXT | Reason for difference |
| `is_collected` | BOOLEAN | Checkbox state |
| `sort_order` | INT | Display order |
| `created_at` | TIMESTAMPTZ | Auto |

Realtime enabled on this table.

---

## Migration History

| Date | File / Description |
|---|---|
| Initial | products, categories, brands, quotations, quotation_items — created via Supabase dashboard |
| Unknown | supabase_migration.sql — added unit_type to products |
| Unknown | supabase_migration_description.sql — added description to quotation_items |
| Unknown | supabase_migration_unit_types.sql — created unit_types table |
| 2026-08-09 | Manufacturing feature — app_settings, raw_components, manufacturing_jobs, manufacturing_job_components |
