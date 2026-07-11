# System Architecture

## Overview
Mamta Lighting Quotation System is a full-stack, automated quotation generation system.

### Frontend
- **Framework**: React with Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Hosting**: Vercel

### Backend
- **Framework**: Node.js 22, Express
- **PDF Engine**: Puppeteer (Headless Chrome)
- **Hosting**: Render (Docker containerized)

### Database & Storage
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage Buckets (product-images, quotations)

### Automation
- **Keepalive**: GitHub Actions (hits `/api/keepalive` to prevent Render/Supabase free tier from pausing)

## Architecture Map

```text
User (Browser) 
  ↓ [Vite React App Hosted on Vercel]
Frontend (React, Zustand, Tailwind) 
  ↓ [REST API Calls / Supabase JS Client]
Backend / Database
  ├─ API Layer (Node.js/Express on Render)
  │   ├─ /api/upload-image (Multer)
  │   ├─ /api/quotation (Puppeteer PDF Gen)
  │   └─ /api/keepalive (Ping)
  └─ Database Layer (Supabase / PostgreSQL)
      ├─ Tables: products, categories, brands, quotations, quotation_items
      └─ Storage: product-images, quotations
```
