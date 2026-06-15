# Mamta Lighting Quotation System

A full-stack, automated quotation generation system for Mamta Lighting. This platform allows the team to build a visual-first catalog, manage products, generate custom discounts, and output fully-branded, multi-page PDF invoices seamlessly.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Zustand (State Management)
- **Backend**: Node.js 22, Express, Puppeteer (PDF Engine)
- **Database & Storage**: Supabase (PostgreSQL & Storage Buckets)
- **Hosting Architecture**: Vercel (Frontend), Render / Docker (Backend), GitHub Actions (Automation)

## Core Features
1. **Visual Catalog & Smart Cart**: Dynamic product search, category/brand filtering, image-based product display, and intelligent discount fallback logic (apply specific per-item discounts or default global discounts).
2. **Product Management System**: Full CRUD (Create, Read, Update, Delete) capabilities for the inventory with direct cloud image uploads to Supabase Storage. Includes inline Category and Brand management.
3. **Puppeteer PDF Engine**: High-fidelity, multi-page PDF generation supporting native repeating headers/footers, huge branding logos (Mamta, Havells, Norisys, etc.), and precision layouts.
4. **Quotation History & Cleanup**: View past quotations, download PDFs securely in the background (masking cloud URLs), and permanently delete past quotes. Automatic cleanup removes associated PDF files from cloud storage when history is deleted.
5. **Modern UI/UX**: Fully mobile-responsive, utilizing elegant non-intrusive Toast notifications (with 10-second Undo for deletions) and smart loading states ("Waking up server...").
6. **Cloud Automation**: An organic, randomized GitHub Action stealth-pings the backend periodically. This keeps the free Supabase tier "active" forever without human intervention.

## Security & Safety (Public Repo)
This repository is perfectly safe to be Public. 
All sensitive information, passwords, and API keys are strictly excluded from the codebase. The `.gitignore` file effectively blocks all `.env` files and `keys.txt` files from ever being uploaded or exposed in the GitHub history.

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
