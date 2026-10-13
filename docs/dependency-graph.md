# Dependency Graph

## Core Systems & Logic
- **`src/App.jsx`**: The root component. Handles layout, navigation, and rendering active tabs based on `useQuoteStore`.
- **`src/store/useQuoteStore.js`**: Global Zustand state. Manages cart `items`, `systemMode`, pricing calculations (`getTotals`), and saving quotes to the database (`saveQuoteToDatabase`).
- **`src/store/useToastStore.js`**: Manages global toast notifications.
- **`src/supabase.js`**: Initializes and exports the Supabase client.

## Frontend UI Components
- **`src/components/Catalog.jsx`**: Displays products, interacts with `useQuoteStore` to add items to cart.
- **`src/components/Cart.jsx`**: Manages current quotation cart, triggers PDF generation API.
- **`src/components/History.jsx`**: Fetches and displays past quotations from Supabase.
- **`src/components/ProductManagement.jsx`**: Admin UI for managing products (Image Quote).
- **`src/components/SwitchProductManagement.jsx`**: Admin UI for managing switch products.
- **`src/components/WireProductManagement.jsx`**: Admin UI for managing wire products.
- **`src/components/SwitchQuotePage.jsx`**: Dedicated quotation builder for switch components.
- **`src/components/WireQuotePage.jsx`**: Dedicated quotation builder for wires.
- **`src/components/QuotePreview.jsx`**: Previews the quote before generating PDF.

## Backend Dependencies (`server/index.js`)
- `express`: Web server framework.
- `puppeteer`: Headless Chrome for rendering HTML to PDF.
- `multer`: Middleware for handling multipart/form-data (image uploads).
- `@supabase/supabase-js`: Backend Supabase client for database/storage operations.
