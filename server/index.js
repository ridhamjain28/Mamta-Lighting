import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const upload = multer({ storage: multer.memoryStorage() });

// --- Load Logos as Base64 strings for PDF ---
const getBase64 = (filename) => {
  try {
    const filePath = path.join(__dirname, filename);
    if (fs.existsSync(filePath)) {
      const bitmap = fs.readFileSync(filePath);
      return `data:image/png;base64,${bitmap.toString('base64')}`;
    }
  } catch (e) {
    console.error(`Error loading image ${filename}:`, e.message);
  }
  return '';
};

// Cache them on startup
const logos = {
  mamta: getBase64('mamta.png'),
  havells: getBase64('havells.png'),
  norisys: getBase64('norisys.png'),
  beton: getBase64('beton.png'),
  crabtree: getBase64('crabtree.png'),
  finolex: getBase64('finolex.png'),
  na: getBase64('na.png')
};
// --------------------------------------------

app.get('/api/keepalive', async (req, res) => {
  try {
    // Simple query to keep Supabase project active
    const { data, error } = await supabase.from('categories').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'active', message: 'Supabase and Render are awake!' });
  } catch (error) {
    console.error('Keepalive Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    res.json({ url: publicUrlData.publicUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quotation', async (req, res) => {
  try {
    const { 
      customer_name, 
      customer_phone, 
      project_name, 
      items, 
      subtotal, 
      discount_amount, 
      gst_amount, 
      grand_total,
      gst_included,
      hide_list_price
    } = req.body;

    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const quoteNumber = `MAMTA-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // Build items HTML with the image column
    const itemsHtml = items.map((item, index) => {
      const listPrice = item.base_price || 0;
      const customOverride = item.custom_price_override !== null ? item.custom_price_override : item.base_price;
      const discountPercentage = item.discount_override || 0;
      const netPrice = customOverride - (customOverride * (discountPercentage / 100));
      const total = netPrice * item.quantity;
      
      const productName = item.model_number ? `${item.name} - ${item.model_number}` : item.name;
      const displayProductName = item.selected_wattage ? `${productName} (${item.selected_wattage})` : productName;
      const imageUrl = item.primary_image_url 
        ? `<img src="${item.primary_image_url}" class="product-img" />` 
        : (logos.na ? `<img src="${logos.na}" class="product-img" />` : '');

      return `
        <tr>
          <td class="text-center font-bold">${index + 1}</td>
          <td class="text-center">${imageUrl}</td>
          <td class="font-bold">${displayProductName}</td>
          <td class="text-center font-bold">${item.quantity}</td>
          ${hide_list_price ? '' : `<td class="text-right font-bold">${listPrice.toFixed(2)}</td>`}
          <td class="text-right font-bold">${netPrice.toFixed(2)}</td>
          <td class="text-right font-bold">${total.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    // One empty row between items and totals
    let emptyRowsHtml = `<tr><td><br><br></td><td></td><td></td><td></td>${hide_list_price ? '' : '<td></td>'}<td></td><td></td></tr>`;

    // Puppeteer Header Template
    const headerTemplate = `
      <div style="font-family: Arial, sans-serif; width: 100%; box-sizing: border-box; padding: 0 15mm; display: flex; justify-content: flex-end; align-items: flex-start; -webkit-print-color-adjust: exact;">
        <div style="text-align: right;">
          ${logos.mamta ? `<img src="${logos.mamta}" style="width: 250px; display: inline-block;" />` : `<div style="font-size: 32px; font-weight: bold; color: #3b82f6;">MAMTA</div>`}
          <div style="font-size: 11px; line-height: 1.4; color: #000; margin-top: 5px;">
            12, Kashyap Chambers, Opp. Mudit Palace,<br>
            Station Road, Bardoli - 394601
          </div>
        </div>
      </div>
    `;

    // Puppeteer Footer Template (Now includes brand logos on every page)
    const footerTemplate = `
      <div style="font-family: Arial, sans-serif; width: 100%; box-sizing: border-box; padding: 0 15mm; -webkit-print-color-adjust: exact;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          ${logos.havells ? `<img src="${logos.havells}" style="height: 45px;" />` : `<span style="font-size: 14px; font-weight: bold;">HAVELLS</span>`}
          ${logos.norisys ? `<img src="${logos.norisys}" style="height: 55px;" />` : `<span style="font-size: 14px; font-weight: bold;">norisys</span>`}
          ${logos.beton ? `<img src="${logos.beton}" style="height: 45px;" />` : `<span style="font-size: 14px; font-weight: bold; color: #1976d2;">BETON</span>`}
          ${logos.crabtree ? `<img src="${logos.crabtree}" style="height: 45px;" />` : `<span style="font-size: 14px; font-weight: bold; color: #388e3c;">Crabtree</span>`}
          ${logos.finolex ? `<img src="${logos.finolex}" style="height: 35px;" />` : `<span style="font-size: 14px; font-weight: bold; color: #1976d2;">Finolex Cables Limited</span>`}
        </div>
        <div style="font-size: 10px; width: 100%; text-align: right; color: #666; padding-top: 5px; border-top: 1px solid #eee;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      </div>
    `;

    // Exact layout based on the user's provided PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; font-size: 14px; margin: 0; padding: 0; color: #000; }
          
          .customer-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; font-size: 14px; font-weight: bold; margin-top: 20px;}
          .customer-info-left { line-height: 1.6; }
          .customer-info-right { text-align: right; line-height: 1.6; }
          
          .quotation-title { text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; text-decoration: underline;}
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 0px; border: 2px solid #000; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #000; padding: 8px 10px; font-size: 13px; }
          th { font-weight: bold; text-align: center; border-bottom: 2px solid #000; border-top: 2px solid #000; font-size: 14px; }
          th:nth-child(3) { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          
          .product-img { max-width: 100px; max-height: 100px; object-fit: contain; display: block; margin: 0 auto; }
        </style>
      </head>
      <body>

        <div class="customer-info">
          <div class="customer-info-left">
            To: ${customer_name || 'N/A'}<br>
            Phone: ${customer_phone || 'N/A'}
          </div>
          <div class="customer-info-right">
            Date: ${dateStr}<br>
            Lighting
          </div>
        </div>

        <div class="quotation-title">QUOTATION</div>

        <table>
          <thead>
            <tr>
              <th width="5%">S.No</th>
              <th width="${hide_list_price ? '24%' : '12%'}">Image</th>
              <th width="35%">Product</th>
              <th width="8%">Qty</th>
              ${hide_list_price ? '' : '<th width="12%">List Price</th>'}
              <th width="12%">Net Price</th>
              <th width="16%">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            ${emptyRowsHtml}
            <tr>
              <td style="border-bottom: none; border-left: none;"></td>
              <td style="border-bottom: none;"></td>
              <td style="border-bottom: none;"></td>
              <td style="border-bottom: none;"></td>
              ${hide_list_price ? '' : '<td style="border-bottom: none;"></td>'}
              <td class="text-right font-bold">Subtotal</td>
              <td class="text-right font-bold">${parseFloat(subtotal).toFixed(2)}</td>
            </tr>
            ${gst_included ? `
            <tr>
              <td style="border-bottom: none; border-top: none; border-left: none;"></td>
              <td style="border-bottom: none; border-top: none;"></td>
              <td style="border-bottom: none; border-top: none;"></td>
              <td style="border-bottom: none; border-top: none;"></td>
              ${hide_list_price ? '' : '<td style="border-bottom: none; border-top: none;"></td>'}
              <td class="text-right font-bold">18% GST</td>
              <td class="text-right font-bold">${parseFloat(gst_amount).toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr style="background-color: #d9ead3;">
              <td style="border-top: none; border-left: none; background-color: #fff;"></td>
              <td style="border-top: none; background-color: #fff;"></td>
              <td style="border-top: none; background-color: #fff;"></td>
              <td style="border-top: none; background-color: #fff;"></td>
              ${hide_list_price ? '' : '<td style="border-top: none; background-color: #fff;"></td>'}
              <td class="text-right font-bold">Total</td>
              <td class="text-right font-bold">${Math.round(grand_total).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <!-- Terms and conditions appended at the end of the document -->
        <div style="page-break-inside: avoid; margin-top: 15px; padding-bottom: 0px;">
          <div style="font-size: 11px; line-height: 1.5; margin-bottom: 10px;">
            <h4 style="font-size: 12px; margin: 0 0 5px 0; font-weight: bold;">Terms & Conditions:</h4>
            <ol style="padding-left: 20px; margin: 0;">
              <li>Prices are subject to change without prior notice.</li>
              <li>Goods once sold will not be taken back.</li>
              <li>Delivery subject to stock availability.</li>
              <li>The quotation is only valid till 3 days from the date provided.</li>
              <li>This is inclusive of all the charges (GST, Freight Charges if any).</li>
            </ol>
            <div style="text-align: center; font-weight: bold; margin-top: 15px; font-size: 12px;">Looking Forward To Your Valuable Order!</div>
          </div>
        </div>

      </body>
      </html>
    `;

    // Generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    try {
      await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 10000 });
    } catch (e) {
      console.log('Timeout waiting for network idle, but proceeding to generate PDF anyway.');
    }
    
    // Generate PDF with repeating headers and footers
    const pdfBuffer = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate,
      footerTemplate: footerTemplate,
      margin: { 
        top: '145px',    
        bottom: '100px', 
        right: '15mm', 
        left: '15mm' 
      }
    });
    await browser.close();

    // Upload PDF
    const fileName = `${quoteNumber}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('quotations')
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('quotations')
      .getPublicUrl(fileName);
      
    const pdfUrl = publicUrlData.publicUrl;

    // Save to Database mapping exactly to user's schema
    const { data: quotationData, error: quoteDbError } = await supabase.from('quotations').insert([{
      quote_number: quoteNumber,
      customer_name,
      phone_number: customer_phone,
      project_name,
      global_discount: discount_amount || 0,
      gst_included,
      gst_rate: 18.0,
      subtotal,
      total_discount: discount_amount || 0,
      tax_amount: gst_amount,
      grand_total,
      pdf_url: pdfUrl
    }]).select();

    if (quoteDbError) throw quoteDbError;

    const quotationId = quotationData[0].id;

    // Save items to quotation_items table
    const itemInserts = items.map(item => {
      const listPrice = item.base_price || 0;
      const customOverride = item.custom_price_override !== null ? item.custom_price_override : item.base_price;
      const discountPercentage = item.discount_override || 0;
      const netPrice = customOverride - (customOverride * (discountPercentage / 100));
      const total = netPrice * item.quantity;

      return {
        quotation_id: quotationId,
        product_id: item.id,
        quantity: item.quantity,
        base_price: listPrice,
        discount_override: discountPercentage,
        custom_price_override: item.custom_price_override,
        final_unit_price: netPrice,
        line_total: total
      };
    });

    const { error: itemsDbError } = await supabase.from('quotation_items').insert(itemInserts);
    if (itemsDbError) console.error("Error saving quotation items:", itemsDbError);

    res.json({ success: true, pdfUrl });

  } catch (error) {
    console.error('Quotation Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
