# Mamta Lighting Quotation System

A full-stack, automated quotation generation system for Mamta Lighting. This platform allows the team to build a visual-first catalog, manage products, generate custom discounts, and output fully-branded, multi-page PDF invoices seamlessly.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Zustand (State Management)
- **Backend**: Node.js, Express, Puppeteer (PDF Engine)
- **Database & Storage**: Supabase (PostgreSQL & Storage Buckets)
- **Hosting Architecture**: Vercel (Frontend), Render / Docker (Backend)

## Core Features
1. **Visual Catalog**: Dynamic product search, category filtering, and image-based product display.
2. **Advanced Cart Management**: Adjust quantities, apply specific per-item discounts (%), and set global subtotal discounts.
3. **Product Management System**: Full CRUD (Create, Read, Update, Delete) capabilities for the inventory with direct cloud image uploads.
4. **Puppeteer PDF Engine**: High-fidelity, multi-page PDF generation supporting native repeating headers/footers, huge branding logos, and precise layout constraints.
5. **Secure Cloud Architecture**: Full separation of concerns between client UI and heavy Node backend tasks.

## Local Setup

### 1. Database
Make sure you have your Supabase URL and Keys ready.

### 2. Frontend (`/client`)
Create a `.env` file inside the `/client` folder:
```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
VITE_API_URL=http://localhost:5000
```
Run:
```bash
cd client
npm install
npm run dev
```

### 3. Backend (`/server`)
Create a `.env` file inside the `/server` folder:
```
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
PORT=5000
```
Run:
```bash
cd server
npm install
npm run dev
```
