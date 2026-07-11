# Mamta Lighting Quotation System - Project Memory

## Project Overview
The Mamta Lighting Quotation System is a fully-automated, cloud-based application that allows for the creation of professional PDF quotations for customers. It streamlines the quoting process for decorative lights, switches, and wires, featuring a dynamic visual catalog, an intelligent cart with per-item and global discounting, and automated PDF generation with precise layouts and branding.

## Business Purpose
1. **Business Problem Solved**: Manual quotation creation is slow and error-prone. This system provides a fast, reliable, and branded way to generate quotations.
2. **Primary Users**: The business owner/employees of Mamta Lighting.
3. **Major Features**: 
   - Visual catalog and smart cart.
   - Separate systems for Image Quotes, Switch Quotes, and Wire Quotes.
   - Product management (CRUD).
   - Puppeteer-powered PDF generation.
   - Quotation history tracking.
4. **User Workflow**: 
   - Select system (Image, Switch, Wire).
   - Add items from the catalog.
   - Adjust quantities, discounts, and prices in the cart.
   - Generate and download a branded PDF.
   - Manage past quotations in the History tab.

## Tech Stack
- **Frontend**: React.js, Vite, TailwindCSS, Zustand
- **Backend**: Node.js 22, Express, Puppeteer
- **Database & Storage**: PostgreSQL (Supabase), Supabase Storage
- **Hosting**: Vercel (Frontend), Render/Docker (Backend)
- **Automation**: GitHub Actions (Keepalive cron job)

## Repository Structure
- `/client`: Frontend React application using Vite.
- `/server`: Backend Express server handling image uploads and Puppeteer PDF rendering.
- `PROJECT_HISTORY.md`: Developer log detailing feature evolution.
- `README.md`: Project setup instructions and overview.
- `supabase_migration.sql`: Database schema updates.

## System Architecture
For an in-depth view, see [architecture.md](file:///d:/Github%20Repos/Mamta-quotation-system/architecture.md).
- **Client**: Single Page Application (React) making REST calls to the backend and using the Supabase client directly for DB operations.
- **Backend**: Microservice for computationally heavy tasks (PDF generation via headless Chrome) and file proxying.
- **Database**: Supabase PostgreSQL database acting as the primary source of truth.

## Routing Map
For an in-depth view, see [routes.md](file:///d:/Github%20Repos/Mamta-quotation-system/routes.md).
- The frontend operates purely on local state (`activeTab` and `systemMode` in `App.jsx`) instead of traditional browser routing.

## Frontend Architecture
- **State Management**: Handled via `zustand` in `useQuoteStore.js`. Manages the cart state, calculations (`getTotals`), system mode toggling, and caching mechanism.
- **Components**: Separated by responsibility (e.g., `Catalog.jsx`, `Cart.jsx`, `History.jsx`, `ProductManagement.jsx`).
- **Data Fetching**: Direct Supabase client calls within React components (useEffect) or Zustand actions (`saveQuoteToDatabase`).

## Backend Architecture
- **Entry Point**: `server/index.js`
- **Responsibilities**:
  - `/api/quotation`: Validates cart math, constructs an HTML template, uses Puppeteer to render a PDF, and returns the PDF buffer.
  - `/api/upload-image`: Utilizes `multer` and `@supabase/supabase-js` to upload product images directly to Supabase Storage.
  - `/api/keepalive`: A simple health check endpoint.

## Database Architecture
For an in-depth view, see [database-map.md](file:///d:/Github%20Repos/Mamta-quotation-system/database-map.md).
- Key tables: `products`, `categories`, `brands`, `quotations`, `quotation_items`.

## Authentication Flow
- **Current State**: There is currently NO explicit user authentication (login/session flow) implemented in the app layer. The system relies on obscured URLs and environment variables. The Supabase service role key is used in the backend.

## API Inventory
For an in-depth view, see [api-map.md](file:///d:/Github%20Repos/Mamta-quotation-system/api-map.md).

## Data Flow Diagrams
**Generate Quotation Flow:**
User Action (Click "Generate PDF") ↓ 
Frontend Cart Component ↓ 
`saveQuoteToDatabase` (Zustand action saves metadata/items to Supabase) ↓ 
POST `/api/quotation` (Sends cart JSON to Backend) ↓ 
Backend (Express) validates math ↓ 
Backend builds HTML string & launches Puppeteer ↓ 
Puppeteer renders PDF ↓ 
Backend returns PDF Buffer as attachment ↓ 
Browser downloads PDF.

## Environment Variables
- **Frontend (`/client/.env`)**:
  - `VITE_SUPABASE_URL`: Supabase project URL.
  - `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key.
  - `VITE_API_URL`: Backend URL for generating PDFs and uploading images.
- **Backend (`/server/.env`)**:
  - `SUPABASE_URL`: Supabase project URL.
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service key (admin access).
  - `PORT`: Server port.

## Dependency Graph
For an in-depth view, see [dependency-graph.md](file:///d:/Github%20Repos/Mamta-quotation-system/dependency-graph.md).

## Performance Notes
- **Cold Starts**: Render free tier goes to sleep after inactivity. The frontend implements a smart loader ("Waking up server...") to handle cold starts.
- **PDF Generation**: Puppeteer is resource-intensive. The backend uses `--no-sandbox` flags. To avoid blocking the headless browser, images are pre-fetched and injected as Base64 strings into the HTML template.
- **State Caching**: When switching between systems (Image/Switch/Wire), `useQuoteStore` caches the state so users don't lose their cart.

## Technical Debt / Known Risks
- **No Authentication**: The lack of authentication means anyone with the frontend URL can access and modify the database.
- **Supabase Free Tier Limits**: Heavily reliant on Supabase's free tier, requiring a GitHub action ping script to prevent pausing.
- **Monolithic Backend File**: `server/index.js` contains route definitions, PDF HTML templates, and business logic all in one file, which could become hard to maintain as it grows.

## Development Workflow
- The project is split into `/client` and `/server`.
- Run `npm run dev` in both directories concurrently during local development.

## Deployment Process
- **Frontend**: Automatically deployed via Vercel upon pushing to the main branch.
- **Backend**: Deployed on Render using a Dockerfile.

## Future Recommendations
- Implement a lightweight authentication wrapper (e.g., a simple hardcoded password screen or Supabase Auth) to prevent unauthorized access.
- Refactor `server/index.js` to extract the massive HTML template into a separate file/module.
- Implement server-side pagination for the `History.jsx` and Catalog views to handle scaling.
