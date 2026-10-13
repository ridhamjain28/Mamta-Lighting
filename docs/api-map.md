# API Map

## External Endpoints (Backend Node.js)

### 1. Keepalive
- **Method**: GET
- **Route**: `/api/keepalive`
- **Purpose**: A backdoor route triggered by a GitHub Action cron job to ping the Supabase database. Keeps the free tier of both Render and Supabase active.
- **Used By**: GitHub Actions

### 2. Upload Image
- **Method**: POST
- **Route**: `/api/upload-image`
- **Purpose**: Accepts multipart/form-data with an `image` file. Uploads the image to the Supabase `product-images` bucket.
- **Input**: FormData (file)
- **Output**: JSON containing the public URL of the uploaded image (`{ url: '...' }`).
- **Used By**: Frontend Product Management components.

### 3. Generate Quotation PDF
- **Method**: POST
- **Route**: `/api/quotation`
- **Purpose**: Generates a branded PDF document from cart data using Puppeteer.
- **Input**: JSON payload containing `customer_name`, `phone_number`, `project_name`, `items`, `subtotal`, `discount_amount`, `gst_amount`, `grand_total`, `gst_included`, `hide_list_price`, `quote_type`.
- **Output**: PDF File (application/pdf).
- **Used By**: Frontend Cart component when a user clicks "Generate PDF".

## Database Interactions (Supabase JS Client)
The frontend communicates directly with the Supabase PostgreSQL database for CRUD operations using the `@supabase/supabase-js` client.

- **Tables**: `products`, `categories`, `brands`, `quotations`, `quotation_items`
- **Operations**: Select, Insert, Update, Delete for managing the catalog and saving quotation history.
