# Mamta Lighting - Project Journey & Documentation

This document serves as a comprehensive log of the entire development process for the **Mamta Lighting Quotation System**, from the initial idea to the fully deployed, enterprise-ready cloud application.

## 1. The Initial Idea
The goal was to build a custom, easy-to-use quotation generation system for **Mamta Lighting**. The primary user is the business owner (the developer's father), who needed a highly intuitive, fast, and reliable way to create professional PDF quotations for customers without dealing with complex software. 

## 2. Technology Stack & Architecture
To ensure the app was modern, fast, and completely free to host, we chose the following stack:
*   **Frontend:** React.js with Vite, styled using Tailwind CSS for a modern, responsive, and premium UI. Hosted on **Vercel**.
*   **Backend:** Node.js with Express. Hosted on **Render** (Free Tier).
*   **Database & Storage:** **Supabase** (PostgreSQL) for storing product data, quotation history, and cloud storage buckets for images and PDFs.
*   **PDF Engine:** **Puppeteer** (headless Chrome) running on the backend to render pixel-perfect, branded PDF documents.

## 3. Core Features & Development Steps

### Step 1: Database & Foundation
*   Designed the Supabase schema: `products`, `categories`, `brands`, `quotations`, and `quotation_items`.
*   Set up Supabase Storage buckets for `product-images` and `quotations` (PDFs).
*   Implemented `ON DELETE CASCADE` and `ON DELETE SET NULL` constraints to ensure database integrity when deleting linked categories or brands.

### Step 2: Product Management System
*   Built a comprehensive UI to Add, Edit, and Delete products.
*   Integrated image uploading directly to Supabase storage.
*   Added inline management features to allow adding/editing/deleting Categories and Brands dynamically without leaving the page.
*   Implemented an elegant Toast Notification system (`useToastStore.js`) to replace ugly browser alerts with premium, non-intrusive popups.

### Step 3: The Quotation Cart & Math Logic
*   Developed a Zustand global state store (`useQuoteStore.js`) to handle cart logic.
*   Implemented dynamic pricing: base price, custom price overrides, specific item discounts, and a **Default Global Discount** fallback.
*   Calculated Subtotal, 18% GST (optional inclusion), and Grand Total.

### Step 4: PDF Generation (Puppeteer)
*   Created a custom HTML template for the PDF inside the backend (`server/index.js`).
*   Added custom branding: **MAMTA** header, and footer logos for **HAVELLS, norisys, BETON, Crabtree, and Finolex**.
*   Added a fallback image (`na.png`) for products without images.
*   Configured Puppeteer to launch a headless browser, render the HTML into an A4 PDF, and securely upload it to Supabase.

### Step 5: Quotation History & Security
*   Built a Quotation History dashboard to view past quotes.
*   Implemented a secure, silent background download feature so users can download PDFs without ever exposing the raw Supabase cloud URLs to the public.
*   Added a Delete feature with a **10-second Undo Toast** to prevent accidental deletions. If not undone, it automatically cleans up the database row *and* the PDF file in cloud storage to save space.

### Step 6: UX Polish & Responsiveness
*   Refactored the layout to be fully responsive on mobile devices using Tailwind `flex-col` and `md:` breakpoints.
*   Refined the discount logic so that empty boxes correctly fall back to the default discount, and explicit `0` inputs enforce a 0% discount.

### Step 7: Cloud Automation & Stability
*   **Keepalive Automation:** Built a secret `/api/keepalive` backdoor and an automated **GitHub Action** to ping the database. We randomized the cron job (pinging roughly once every 1.5 days at unpredictable times) to organically keep the Supabase free tier active forever while the owner is on vacation.
*   **Engine Upgrade:** Handled a sudden Supabase deprecation error by successfully upgrading the Docker backend container from Node 18 to **Node 22**, ensuring native WebSocket support and long-term stability.
*   **Cold Start Handling:** Added a smart UI loader that detects if the Render backend is "sleeping" and informs the user ("Waking up cloud server...") if generation takes longer than 5 seconds.

## 4. Final Result
The result is a highly polished, fully automated, self-maintaining quotation system. It requires zero monthly maintenance costs, operates entirely on robust free tiers, and provides a premium, branded experience for Mamta Lighting's daily business operations.
