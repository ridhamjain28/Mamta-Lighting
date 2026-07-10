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
      phone_number, 
      project_name, 
      items, 
      subtotal, 
      discount_amount, 
      gst_amount, 
      grand_total,
      gst_included,
      hide_list_price,
      quote_type
    } = req.body;

    const escapeHTML = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/[&<>'"]/g, 
        tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag] || tag)
      );
    };

    const safe_customer_name = escapeHTML(customer_name);
    const safe_phone_number = escapeHTML(phone_number);
    const safe_project_name = escapeHTML(project_name);

    // Helper to fetch external images as Base64 to bypass headless browser blocking
    const fetchBase64Image = async (url) => {
      if (!url) return null;
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      } catch (e) {
        console.error('Fetch image error:', e.message);
        return null;
      }
    };

    // Validate math AND pre-fetch images in one unified pass.
    // Previously these were two separate arrays (validatedItems vs itemsWithBase64Images)
    // which caused images to never show up. Now everything lives in validatedItems.
    let serverSubtotal = 0;
    const validatedItems = await Promise.all(items.map(async (item) => {
      const customOverride = (item.custom_price_override !== null && item.custom_price_override !== undefined && item.custom_price_override !== '') 
        ? Number(item.custom_price_override) 
        : Number(item.base_price || 0);
      const discountPercentage = Number(item.discount_override || 0);
      const netPrice = Math.ceil(customOverride - (customOverride * (discountPercentage / 100)));
      const quantity = Number(item.quantity || 0);
      const total = netPrice * quantity;
      
      serverSubtotal += total;

      // Fetch image as base64 right here so it's part of the same object
      let base64Image = null;
      if (item.primary_image_url) {
        base64Image = await fetchBase64Image(item.primary_image_url);
      }
      
      return { 
        ...item, 
        serverNetPrice: netPrice, 
        serverTotal: total, 
        serverCustomOverride: customOverride,
        _base64_image: base64Image,
        safe_name: escapeHTML(item.name),
        safe_model: escapeHTML(item.model_number),
        safe_brand: escapeHTML(item.brands?.name)
      };
    }));

    // Recalculate serverSubtotal from the resolved items (Promise.all returns resolved array)
    serverSubtotal = validatedItems.reduce((acc, item) => acc + item.serverTotal, 0);

    if (Math.abs(serverSubtotal - subtotal) > 1) {
       return res.status(400).json({ error: 'Math verification failed: Subtotal mismatch.' });
    }

    let serverGst = gst_included ? Math.ceil(serverSubtotal * 0.18) : 0;
    if (gst_included && Math.abs(serverGst - (gst_amount || 0)) > 1) {
       return res.status(400).json({ error: 'Math verification failed: GST mismatch.' });
    }

    let serverGrandTotal = Math.ceil(serverSubtotal + serverGst);
    if (Math.abs(serverGrandTotal - grand_total) > 1) {
       return res.status(400).json({ error: 'Math verification failed: Grand total mismatch.' });
    }

    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const quoteNumber = `MAMTA-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // Build items HTML based on quote type
    const isManualQuote = quote_type === 'Manual Quote';
    const isImageQuote = quote_type === 'Image Quote';

    let switchBrandStr = 'Switch';
    if (quote_type === 'Switch Quote' && validatedItems && validatedItems.length > 0) {
      const firstSwitch = validatedItems.find(i => i.product_type === 'Switch Product' || i.product_type === 'Manual Product');
      if (firstSwitch) {
        const brandName = firstSwitch.safe_brand || '';
        const subBrand = escapeHTML(firstSwitch.sub_brand) || '';
        const color = escapeHTML(firstSwitch.color) || '';
        switchBrandStr = `${brandName} ${subBrand} ${color}`.trim() || 'Switch';
      }
    }

    const itemsHtml = validatedItems.map((item, index) => {
      const listPrice = Number(item.base_price || 0);
      const customOverride = item.serverCustomOverride;
      const discountPercentage = Number(item.discount_override || 0);
      const netPrice = item.serverNetPrice;
      const total = item.serverTotal;
      
      const productName = item.safe_model ? `${item.safe_name} - ${item.safe_model}` : item.safe_name;
      const baseDisplayName = item.selected_wattage ? `${productName} (${escapeHTML(item.selected_wattage)})` : productName;
      const displayProductName = (isImageQuote && item.safe_brand) ? `${baseDisplayName} - ${item.safe_brand}` : baseDisplayName;
      const unit = escapeHTML(item.unit_type) || 'N';
      const isUnitN = unit === 'N';
      const formattedQty = isUnitN ? `${item.quantity} N` : item.quantity;
      const formattedRate = isUnitN ? `${customOverride.toFixed(2)} each` : `${customOverride.toFixed(2)} / ${unit}`;
      const formattedNetPrice = isUnitN ? `${netPrice.toLocaleString()} each` : `${netPrice.toLocaleString()} / ${unit}`;
      
      if (isManualQuote) {
        return `
          <tr>
            <td class="text-center font-bold">${index + 1}</td>
            <td class="font-bold">${displayProductName}</td>
            <td class="text-center font-bold highlight-qty">${formattedQty}</td>
            <td class="text-right font-bold">${formattedRate}</td>
            <td class="text-right font-bold">${discountPercentage > 0 ? discountPercentage + '%' : '-'}</td>
            <td class="text-right font-bold highlight-total">${total.toLocaleString()}</td>
          </tr>
        `;
      } else if (isImageQuote) {
        const imageUrl = item._base64_image 
          ? `<img src="${item._base64_image}" class="product-img" />` 
          : (logos.na ? `<img src="${logos.na}" class="product-img" />` : '');

        return `
          <tr>
            <td class="text-center font-bold">${index + 1}</td>
            <td class="text-center">${imageUrl}</td>
            <td class="font-bold">${displayProductName}</td>
            <td class="text-center font-bold highlight-qty">${formattedQty}</td>
            ${hide_list_price ? '' : `<td class="text-right font-bold">${listPrice.toFixed(2)}</td>`}
            <td class="text-right font-bold">${formattedNetPrice}</td>
            <td class="text-right font-bold highlight-total">${total.toLocaleString()}</td>
          </tr>
        `;
      } else {
        return `
          <tr>
            <td class="text-center font-bold">${index + 1}</td>
            <td class="font-bold">${displayProductName}</td>
            <td class="text-center font-bold highlight-qty">${formattedQty}</td>
            ${hide_list_price ? '' : `<td class="text-right font-bold">${listPrice.toFixed(2)}</td>`}
            <td class="text-right font-bold">${formattedNetPrice}</td>
            <td class="text-right font-bold highlight-total">${total.toLocaleString()}</td>
          </tr>
        `;
      }
    }).join('');

    // One empty row between items and totals
    let emptyRowsHtml = '';
    if (isManualQuote) {
       emptyRowsHtml = `<tr><td><br><br></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    } else if (isImageQuote) {
       emptyRowsHtml = `<tr><td><br><br></td><td></td><td></td><td></td>${hide_list_price ? '' : '<td></td>'}<td></td><td></td></tr>`;
    } else {
       emptyRowsHtml = `<tr><td><br><br></td><td></td><td></td>${hide_list_price ? '' : '<td></td>'}<td></td><td></td></tr>`;
    }

    // Puppeteer Header Template
    const headerTemplate = `<span></span>`;

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
    const projPart = safe_project_name ? ` - ${safe_project_name}` : '';
    const namePart = safe_customer_name ? safe_customer_name : 'Walk-in';
    const documentTitle = `Quotation - ${namePart}${projPart}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${documentTitle}</title>
        <style>
          html, body { height: 100%; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 14px; color: #000; display: flex; flex-direction: column; min-height: 100vh; }
          
          .page-content { flex: 1 0 auto; }
          .page-footer { flex-shrink: 0; margin-top: auto; }
          
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
          .highlight-qty { border-left: 2px solid #000; border-right: 2px solid #000; font-weight: bold; }
          .highlight-total { border-left: 2px solid #000; border-right: 2px solid #000; font-weight: bold; }
          
          .product-img { max-width: 100px; max-height: 100px; object-fit: contain; display: block; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="page-content">
        <div style="display: flex; justify-content: flex-end; align-items: flex-start; margin-bottom: 20px;">
          <div style="text-align: right;">
            ${logos.mamta ? `<img src="${logos.mamta}" style="width: 250px; display: inline-block;" />` : `<div style="font-size: 32px; font-weight: bold; color: #3b82f6;">MAMTA</div>`}
            <div style="font-size: 11px; line-height: 1.4; color: #000; margin-top: 5px;">
              12, Kashyap Chambers, Opp. Mudit Palace,<br>
              Station Road, Bardoli - 394601
            </div>
          </div>
        </div>

        <div class="customer-info">
          <div class="customer-info-left">
            To: ${safe_customer_name || 'N/A'}<br>
            Phone: ${safe_phone_number || 'N/A'}
          </div>
          <div class="customer-info-right">
            Date: ${dateStr}<br>
            ${quote_type === 'Wire Quote' ? 'Wire' : quote_type === 'Switch Quote' ? switchBrandStr : 'Lighting'}
          </div>
        </div>

        <div class="quotation-title">QUOTATION</div>

        <table>
          <thead>
            ${isManualQuote ? `
              <tr>
                <th width="5%">S.No</th>
                <th width="45%">Description</th>
                <th width="10%" class="highlight-qty">Qty</th>
                <th width="12%">Rate</th>
                <th width="12%">Discount</th>
                <th width="16%" class="highlight-total">Amount</th>
              </tr>
            ` : isImageQuote ? `
              <tr>
                <th width="5%">S.No</th>
                <th width="${hide_list_price ? '24%' : '12%'}">Image</th>
                <th width="35%">Product</th>
                <th width="8%" class="highlight-qty">Qty</th>
                ${hide_list_price ? '' : '<th width="12%">List Price</th>'}
                <th width="12%">Net Price</th>
                <th width="16%" class="highlight-total">Total</th>
              </tr>
            ` : `
              <tr>
                <th width="5%">S.No</th>
                <th width="47%">Product</th>
                <th width="8%" class="highlight-qty">Qty</th>
                ${hide_list_price ? '' : '<th width="12%">List Price</th>'}
                <th width="12%">Net Price</th>
                <th width="16%" class="highlight-total">Total</th>
              </tr>
            `}
          </thead>
          <tbody>
            ${itemsHtml}
            ${emptyRowsHtml}
            <tr>
              ${isManualQuote ? `
                <td style="border-bottom: none; border-left: none;"></td>
                <td style="border-bottom: none;"></td>
                <td style="border-bottom: none;"></td>
                <td style="border-bottom: none;"></td>
              ` : isImageQuote ? `
                <td style="border-bottom: none; border-left: none;"></td>
                <td style="border-bottom: none;"></td>
                <td style="border-bottom: none;"></td>
                <td style="border-bottom: none;"></td>
                ${hide_list_price ? '' : '<td style="border-bottom: none;"></td>'}
              ` : `
                <td style="border-bottom: none; border-left: none;"></td>
                <td style="border-bottom: none;"></td>
                <td style="border-bottom: none;"></td>
                ${hide_list_price ? '' : '<td style="border-bottom: none;"></td>'}
              `}
              <td class="text-right font-bold">Subtotal</td>
              <td class="text-right font-bold highlight-total">${Math.ceil(parseFloat(subtotal)).toLocaleString()}</td>
            </tr>
            ${gst_included ? `
            <tr>
              ${isManualQuote ? `
                <td style="border-bottom: none; border-top: none; border-left: none;"></td>
                <td style="border-bottom: none; border-top: none;"></td>
                <td style="border-bottom: none; border-top: none;"></td>
                <td style="border-bottom: none; border-top: none;"></td>
              ` : isImageQuote ? `
                <td style="border-bottom: none; border-top: none; border-left: none;"></td>
                <td style="border-bottom: none; border-top: none;"></td>
                <td style="border-bottom: none; border-top: none;"></td>
                <td style="border-bottom: none; border-top: none;"></td>
                ${hide_list_price ? '' : '<td style="border-bottom: none; border-top: none;"></td>'}
              ` : `
                <td style="border-bottom: none; border-top: none; border-left: none;"></td>
                <td style="border-bottom: none; border-top: none;"></td>
                <td style="border-bottom: none; border-top: none;"></td>
                ${hide_list_price ? '' : '<td style="border-bottom: none; border-top: none;"></td>'}
              `}
              <td class="text-right font-bold">18% GST</td>
              <td class="text-right font-bold highlight-total">${Math.ceil(parseFloat(gst_amount)).toLocaleString()}</td>
            </tr>
            ` : ''}
            <tr style="background-color: #d9ead3;">
              ${isManualQuote ? `
                <td style="border-top: none; border-left: none; background-color: #fff;"></td>
                <td style="border-top: none; background-color: #fff;"></td>
                <td style="border-top: none; background-color: #fff;"></td>
                <td style="border-top: none; background-color: #fff;"></td>
              ` : isImageQuote ? `
                <td style="border-top: none; border-left: none; background-color: #fff;"></td>
                <td style="border-top: none; background-color: #fff;"></td>
                <td style="border-top: none; background-color: #fff;"></td>
                <td style="border-top: none; background-color: #fff;"></td>
                ${hide_list_price ? '' : '<td style="border-top: none; background-color: #fff;"></td>'}
              ` : `
                <td style="border-top: none; border-left: none; background-color: #fff;"></td>
                <td style="border-top: none; background-color: #fff;"></td>
                <td style="border-top: none; background-color: #fff;"></td>
                ${hide_list_price ? '' : '<td style="border-top: none; background-color: #fff;"></td>'}
              `}
              <td class="text-right font-bold">Total</td>
              <td class="text-right font-bold highlight-total">${Math.ceil(grand_total).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <!-- Terms and conditions -->
        <div style="margin-top: 15px; padding-bottom: 0px; page-break-inside: avoid;">
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
        </div><!-- end .page-content -->

        <!-- Footer block — pushed to bottom of page via flexbox -->
        <div class="page-footer" style="font-family: Arial, sans-serif; width: 100%; box-sizing: border-box; -webkit-print-color-adjust: exact; padding-top: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; border-top: 1px solid #eee; padding-top: 15px;">
            ${logos.havells ? `<img src="${logos.havells}" style="height: 45px;" />` : `<span style="font-size: 14px; font-weight: bold;">HAVELLS</span>`}
            ${logos.norisys ? `<img src="${logos.norisys}" style="height: 55px;" />` : `<span style="font-size: 14px; font-weight: bold;">norisys</span>`}
            ${logos.beton ? `<img src="${logos.beton}" style="height: 45px;" />` : `<span style="font-size: 14px; font-weight: bold; color: #1976d2;">BETON</span>`}
            ${logos.crabtree ? `<img src="${logos.crabtree}" style="height: 45px;" />` : `<span style="font-size: 14px; font-weight: bold; color: #388e3c;">Crabtree</span>`}
            ${logos.finolex ? `<img src="${logos.finolex}" style="height: 35px;" />` : `<span style="font-size: 14px; font-weight: bold; color: #1976d2;">Finolex Cables Limited</span>`}
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
      await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
    } catch (e) {
      console.log('Timeout waiting for network idle, but proceeding to generate PDF anyway.');
    }
    
    // Generate PDF (without repeating headers/footers to keep footer on last page)
    const pdfBuffer = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      margin: { 
        top: '15mm',    
        bottom: '15mm', 
        right: '10mm', 
        left: '10mm' 
      }
    });
    await browser.close();

    // Return PDF directly
    const fileName = `${quoteNumber}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Filename', fileName);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Quotation Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
