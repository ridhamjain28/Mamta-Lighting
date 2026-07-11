const fs = require('fs');

async function generateQuote(type, data) {
  try {
    console.log(`Generating ${type} quotation...`);
    const response = await fetch('http://localhost:5000/api/quotation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Error generating ${type} quotation:`, response.status, errText);
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(`test_${type}.pdf`, Buffer.from(buffer));
    console.log(`Success: test_${type}.pdf generated. Size: ${buffer.byteLength} bytes.`);
    return true;
  } catch (error) {
    console.error(`Fetch error for ${type}:`, error);
    return false;
  }
}

async function runTests() {
  // Wait a second for server to fully start
  await new Promise(r => setTimeout(r, 1000));

  const items = [
    {
      id: 1,
      name: 'Test Product 1',
      price: 100,
      quantity: 2,
      discount_override: 10,
      discountPercentage: 10,
      primary_image_url: 'https://via.placeholder.com/150'
    },
    {
      id: 2,
      name: 'Test Product 2',
      price: 200,
      quantity: 1,
      custom_price_override: 180,
      customOverride: 180,
      primary_image_url: 'https://via.placeholder.com/150'
    }
  ];

  const commonData = {
    customerName: 'Test Customer',
    companyName: 'Test Company',
    customerPhone: '1234567890',
    globalDiscount: 0,
    gstIncluded: true,
    note: 'Test note',
    items: items,
    itemsWithBase64Images: items
  };

  const tests = [
    { type: 'manual', data: { ...commonData, items: items } }, // manual is actually quoteType: 'manual'
    { type: 'image', data: { ...commonData, quoteType: 'image' } },
    { type: 'switch', data: { ...commonData, quoteType: 'switch' } }
  ];

  let successCount = 0;
  for (const test of tests) {
    const success = await generateQuote(test.type, test.data);
    if (success) successCount++;
  }

  console.log(`\nResults: ${successCount}/${tests.length} passed.`);
  process.exit(successCount === tests.length ? 0 : 1);
}

runTests();
