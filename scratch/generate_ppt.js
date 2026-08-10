const PptxGenJS = require('pptxgenjs');
let pptx = new PptxGenJS();

// Slide 1: Title
let slide1 = pptx.addSlide();
slide1.addText("Mamta Quotation System\nDatabase Schema Overview", {
    x: 1, y: 2, w: 8, h: 2, fontSize: 36, bold: true, align: "center", color: "363636"
});

// Slide 2: Overview
let slide2 = pptx.addSlide();
slide2.addText("Database Overview", { x: 0.5, y: 0.5, fontSize: 24, bold: true });
slide2.addText(
    "1. Built on PostgreSQL (hosted via Supabase)\n" +
    "2. Consists of 5 main tables\n" +
    "3. Divided into Inventory (products, brands, categories)\n" +
    "   and Sales (quotations, quotation_items)\n" +
    "4. Uses Object Storage for images and PDFs",
    { x: 0.5, y: 1.5, w: 9, h: 3, fontSize: 18, bullet: true }
);

// Slide 3: Categories & Brands
let slide3 = pptx.addSlide();
slide3.addText("Categories & Brands (Inventory)", { x: 0.5, y: 0.5, fontSize: 24, bold: true });
slide3.addText(
    "Purpose: Used to categorize products and link them to brands.\n" +
    "Relationship: 1:M with Products.",
    { x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 16 }
);
slide3.addText(
    "SQL Example:\n" +
    "CREATE TABLE categories (\n" +
    "  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n" +
    "  name TEXT NOT NULL UNIQUE\n" +
    ");",
    { x: 0.5, y: 2.8, w: 9, h: 2, fontSize: 14, fill: "F1F1F1", fontFace: "Courier New" }
);

// Slide 4: Products
let slide4 = pptx.addSlide();
slide4.addText("Products Table", { x: 0.5, y: 0.5, fontSize: 24, bold: true });
slide4.addText(
    "Purpose: Stores details for every quotable item.",
    { x: 0.5, y: 1.5, w: 9, h: 0.5, fontSize: 16 }
);
slide4.addText(
    "SQL Example:\n" +
    "CREATE TABLE products (\n" +
    "  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n" +
    "  name TEXT NOT NULL,\n" +
    "  base_price DECIMAL(10,2),\n" +
    "  category_id UUID REFERENCES categories(id),\n" +
    "  brand_id UUID REFERENCES brands(id)\n" +
    ");",
    { x: 0.5, y: 2.3, w: 9, h: 3, fontSize: 14, fill: "F1F1F1", fontFace: "Courier New" }
);

// Slide 5: Quotations
let slide5 = pptx.addSlide();
slide5.addText("Quotations Table (Sales Header)", { x: 0.5, y: 0.5, fontSize: 24, bold: true });
slide5.addText(
    "Purpose: High-level quote metadata (customer, totals).",
    { x: 0.5, y: 1.5, w: 9, h: 0.5, fontSize: 16 }
);
slide5.addText(
    "SQL Example:\n" +
    "CREATE TABLE quotations (\n" +
    "  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n" +
    "  quote_number TEXT UNIQUE NOT NULL,\n" +
    "  customer_name TEXT,\n" +
    "  grand_total DECIMAL(12,2)\n" +
    ");",
    { x: 0.5, y: 2.3, w: 9, h: 3, fontSize: 14, fill: "F1F1F1", fontFace: "Courier New" }
);

// Slide 6: Quotation Items
let slide6 = pptx.addSlide();
slide6.addText("Quotation Items (Sales Details)", { x: 0.5, y: 0.5, fontSize: 24, bold: true });
slide6.addText(
    "Purpose: Junction table storing specific products per quote.",
    { x: 0.5, y: 1.5, w: 9, h: 0.5, fontSize: 16 }
);
slide6.addText(
    "SQL Example:\n" +
    "CREATE TABLE quotation_items (\n" +
    "  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n" +
    "  quotation_id UUID REFERENCES quotations(id),\n" +
    "  product_id UUID REFERENCES products(id),\n" +
    "  quantity INTEGER DEFAULT 1,\n" +
    "  line_total DECIMAL(12,2)\n" +
    ");",
    { x: 0.5, y: 2.3, w: 9, h: 3, fontSize: 14, fill: "F1F1F1", fontFace: "Courier New" }
);

// Slide 7: Relationships Summary
let slide7 = pptx.addSlide();
slide7.addText("Entity Relationships Summary", { x: 0.5, y: 0.5, fontSize: 24, bold: true });
slide7.addText(
    "1. Categories (1) ---> (M) Products\n" +
    "2. Brands (1) ---> (M) Products\n" +
    "3. Quotations (1) ---> (M) Quotation Items\n" +
    "4. Products (1) ---> (M) Quotation Items",
    { x: 0.5, y: 1.5, w: 9, h: 3, fontSize: 18, color: "0000FF", fontFace: "Courier New" }
);

pptx.writeFile({ fileName: '../guide-ppt.pptx' }).then(fileName => {
    console.log(`Created file: ${fileName}`);
});
