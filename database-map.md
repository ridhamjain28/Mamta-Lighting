# Database Map

## Database Overview
The system uses PostgreSQL hosted on Supabase.

### Tables

#### 1. `products`
- **Purpose**: Stores all product details across different systems (Image, Switch, Wire).
- **Fields**: `id`, `name`, `model_number`, `base_price`, `unit_type`, `primary_image_url`, `category_id`, `brand_id`, `product_type`, `sub_brand`, `color`, `selected_wattage`, etc. (Inferred from usage).

#### 2. `categories`
- **Purpose**: Organizes products into categories.
- **Relationships**: Referenced by `products`.

#### 3. `brands`
- **Purpose**: Tracks product brands.
- **Relationships**: Referenced by `products`.

#### 4. `quotations`
- **Purpose**: Stores metadata and totals for generated quotations.
- **Fields**: `id`, `created_at`, `customer_name`, `customer_phone`, `project_name`, `subtotal`, `discount_amount`, `gst_amount`, `grand_total`, `quote_type`, `status`, `pdf_url`, `updated_at`, `quote_number`.

#### 5. `quotation_items`
- **Purpose**: Stores the specific line items associated with a quotation.
- **Fields**: `quotation_id`, `product_id`, `quantity`, `base_price`, `discount_override`, `custom_price_override`, `final_unit_price`, `line_total`.
- **Relationships**: Parent is `quotations` (`quotation_id`), refers to `products` (`product_id`).

## Entity Relationships
`categories` (1) ---> (M) `products`
`brands` (1) ---> (M) `products`
`quotations` (1) ---> (M) `quotation_items`
`products` (1) ---> (M) `quotation_items`

## Storage Buckets
- `product-images`: Public bucket for product images.
- `quotations`: Bucket for generated PDF quotations.
