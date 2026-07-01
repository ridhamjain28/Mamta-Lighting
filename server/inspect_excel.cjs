const xlsx = require('xlsx');

const workbook = xlsx.readFile('D:\\\\Github Repos\\\\Mamta-quotation-system\\\\Switch Quotation System.xlsx');

for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  for (let i = 0; i < Math.min(10, json.length); i++) {
    console.log(`Row ${i + 1}:`, json[i]);
  }
}
