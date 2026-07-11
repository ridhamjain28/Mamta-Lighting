const testPrices = [300, 301, 302, 1000, 199, 99999];
let failures = 0;
for (let listPrice of testPrices) {
  for (let preGst = 1; preGst < listPrice; preGst++) {
    const discountPct = ((listPrice - preGst) / listPrice) * 100;
    const discountAmount = listPrice * (discountPct / 100);
    
    // original logic
    const val = listPrice - discountAmount;
    const netPrice = Math.ceil(val);
    
    // fixed logic
    const fixedVal = Number(val.toFixed(10));
    const fixedNetPrice = Math.ceil(fixedVal);

    if (fixedNetPrice !== preGst) {
      console.log(`Failed! listPrice=${listPrice}, preGst=${preGst}, fixedNetPrice=${fixedNetPrice}, val=${val}`);
      failures++;
    }
  }
}
console.log('Failures:', failures);
