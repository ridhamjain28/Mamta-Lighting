/**
 * Opens WhatsApp with a formatted quotation summary.
 * If phoneNumber is provided, opens direct chat with that number.
 * If phoneNumber is empty or not provided, opens general forward/picker screen.
 */
export function openWhatsAppQuotation(params = {}) {
  const customerName = params.customerName || params.customer?.name || '';
  const phoneNumber = params.phoneNumber || params.customer?.phone || '';
  const projectName = params.projectName || params.customer?.project || '';
  const grandTotal = params.grandTotal ?? params.totals?.grandTotal;
  const quoteType = params.quoteType || params.quoteMetadata?.quoteType || 'Lighting Quote';

  const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const nameStr = customerName?.trim() || 'Valued Customer';
  const projStr = projectName?.trim() ? `\nProject: ${projectName.trim()}` : '';
  const typeStr = quoteType ? `\nQuotation: ${quoteType}` : '';
  const totalStr = grandTotal !== undefined && grandTotal !== null 
    ? `\nGrand Total: ₹${Math.ceil(Number(grandTotal)).toLocaleString('en-IN')}` 
    : '';

  const text = `*MAMTA LIGHTING - QUOTATION*\nDate: ${dateStr}\nCustomer: ${nameStr}${projStr}${typeStr}${totalStr}\n\nThank you for choosing Mamta Lighting! Please let us know if you have any questions.`;
  const encodedText = encodeURIComponent(text);

  const cleanPhone = String(phoneNumber || '').replace(/\D/g, '');
  if (cleanPhone) {
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${fullPhone}?text=${encodedText}`, '_blank');
  } else {
    // Forward / Select Contact picker
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  }
}
