import React from 'react';
import { useQuoteStore } from '../store/useQuoteStore';

export default function QuotePreview() {
  const { 
    items, 
    customer, 
    globalDiscount, 
    gstIncluded, 
    hideListPrice, 
    quoteType,
    getTotals
  } = useQuoteStore();

  const { subtotal, gst_amount, grand_total } = getTotals();
  const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

  const isManualQuote = quoteType === 'Manual Quote';
  const isImageQuote = quoteType === 'Lighting Quote' || quoteType === 'Image Quote';

  const activeItems = items.filter(item => Number(item.quantity) > 0);

  return (
    <div className="bg-gray-100 py-8 px-4 min-h-screen flex justify-center">
      {/* Paper Container (A4 Ratio styling) */}
      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[15mm] shadow-lg border border-gray-200 flex flex-col font-sans text-black relative">
        
        {/* Company Header */}
        <div className="flex justify-between items-start mb-6">
          <div></div> {/* Spacer */}
          <div className="text-right">
            <img src="/mamta.png" alt="Mamta Logo" className="w-[250px] inline-block mb-1" onError={(e) => e.target.style.display = 'none'} />
            <h2 className="text-xl font-bold text-blue-600 hidden" id="logo-fallback">MAMTA</h2>
            <div className="text-[11px] leading-relaxed text-gray-700">
              12, Kashyap Chambers, Opp. Mudit Palace,<br />
              Station Road, Bardoli - 394601
            </div>
          </div>
        </div>

        {/* Customer & Quote Metadata */}
        <div className="flex justify-between items-start border-t border-b border-gray-200 py-3 mb-6 text-sm font-semibold">
          <div className="space-y-1">
            <div>To: {customer.name || 'N/A'}</div>
            <div>Phone: {customer.phone || 'N/A'}</div>
            {customer.project && <div>Project: {customer.project}</div>}
          </div>
          <div className="text-right space-y-1">
            <div>Date: {dateStr}</div>
            <div>Type: {quoteType === 'Wire Quote' ? 'Wire' : quoteType === 'Switch Quote' ? 'Switch' : 'Lighting'}</div>
          </div>
        </div>

        {/* Quotation Title */}
        <h3 className="text-center text-xl font-bold underline mb-6 tracking-wide">QUOTATION</h3>

        {/* Items Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse border-2 border-black text-xs">
            <thead>
              {isManualQuote ? (
                <tr className="border-b-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-center w-[5%]">S.No</th>
                  <th className="border border-black p-2 text-left w-[45%]">Description</th>
                  <th className="border border-black p-2 text-center w-[10%]">Qty</th>
                  <th className="border border-black p-2 text-right w-[12%]">Rate (₹)</th>
                  <th className="border border-black p-2 text-right w-[12%]">Discount</th>
                  <th className="border border-black p-2 text-right w-[16%]">Amount (₹)</th>
                </tr>
              ) : isImageQuote ? (
                <tr className="border-b-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-center w-[5%]">S.No</th>
                  <th className="border border-black p-2 text-center w-[15%]">Image</th>
                  <th className="border border-black p-2 text-left w-[35%]">Product</th>
                  <th className="border border-black p-2 text-center w-[10%]">Qty</th>
                  {!hideListPrice && <th className="border border-black p-2 text-right w-[12%]">List Price (₹)</th>}
                  <th className="border border-black p-2 text-right w-[12%]">Net Price (₹)</th>
                  <th className="border border-black p-2 text-right w-[16%]">Total (₹)</th>
                </tr>
              ) : (
                <tr className="border-b-2 border-black bg-gray-50">
                  <th className="border border-black p-2 text-center w-[5%]">S.No</th>
                  <th className="border border-black p-2 text-left w-[47%]">Product</th>
                  <th className="border border-black p-2 text-center w-[10%]">Qty</th>
                  {!hideListPrice && <th className="border border-black p-2 text-right w-[12%]">List Price (₹)</th>}
                  <th className="border border-black p-2 text-right w-[12%]">Net Price (₹)</th>
                  <th className="border border-black p-2 text-right w-[16%]">Total (₹)</th>
                </tr>
              )}
            </thead>
            <tbody>
              {activeItems.length === 0 ? (
                <tr>
                  <td colSpan={isManualQuote ? 6 : (hideListPrice ? 5 : 6)} className="border border-black p-6 text-center text-gray-500 italic">
                    No active items. Add products in the "New Quote" tab.
                  </td>
                </tr>
              ) : (
                activeItems.map((item, index) => {
                  const listPrice = item.base_price || 0;
                  const customOverride = item.custom_price_override !== null ? item.custom_price_override : item.base_price;
                  const discountPercentage = item.discount_override || 0;
                  const netPrice = Math.ceil(Number((customOverride - (customOverride * (discountPercentage / 100))).toFixed(10)));
                  const total = netPrice * item.quantity;
                  
                  const brandName = item.brands?.name || item.brand_name || '';
                  const productName = item.model_number ? `${item.name} - ${item.model_number}` : item.name;
                  const baseDisplayName = item.selected_wattage ? `${productName} (${item.selected_wattage})` : productName;
                  const nameWithDesc = item.description ? `${baseDisplayName} (${item.description})` : baseDisplayName;
                  const variantInfo = [item.sub_brand, item.color].filter(Boolean).join(' ');
                  const fullVariantDesc = variantInfo ? `${nameWithDesc} (${variantInfo})` : nameWithDesc;
                  const displayProductName = brandName ? `${fullVariantDesc} - ${brandName}` : fullVariantDesc;
                  const unit = item.unit_type || 'N';
                  const isUnitN = unit === 'N';
                  const formattedQty = isUnitN ? `${item.quantity} N` : item.quantity;
                  const formattedRate = isUnitN ? customOverride.toFixed(2) : `${customOverride.toFixed(2)} ${unit}`;
                  const formattedNetPrice = isUnitN ? netPrice.toFixed(2) : `${netPrice.toFixed(2)} ${unit}`;

                  if (isManualQuote) {
                    return (
                      <tr key={item.cartItemId || item.id}>
                        <td className="border border-black p-2 text-center font-bold">{index + 1}</td>
                        <td className="border border-black p-2 font-bold">{displayProductName}</td>
                        <td className="border border-black p-2 text-center font-bold">{formattedQty}</td>
                        <td className="border border-black p-2 text-right font-bold">{formattedRate}</td>
                        <td className="border border-black p-2 text-right font-bold">{discountPercentage > 0 ? `${discountPercentage}%` : '-'}</td>
                        <td className="border border-black p-2 text-right font-bold">{total.toFixed(2)}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.cartItemId || item.id}>
                      <td className="border border-black p-2 text-center font-bold">{index + 1}</td>
                      {isImageQuote && (
                        <td className="border border-black p-2 text-center">
                          {item.primary_image_url ? (
                            <img src={item.primary_image_url} alt={item.name} className="max-w-[80px] max-h-[80px] object-contain mx-auto" />
                          ) : (
                            <img src="/na.png" alt="N/A" className="max-w-[80px] max-h-[80px] object-contain mx-auto" onError={(e) => e.target.src = ''} />
                          )}
                        </td>
                      )}
                      <td className="border border-black p-2 font-bold">{displayProductName}</td>
                      <td className="border border-black p-2 text-center font-bold">{formattedQty}</td>
                      {!hideListPrice && <td className="border border-black p-2 text-right font-bold">{listPrice.toFixed(2)}</td>}
                      <td className="border border-black p-2 text-right font-bold">{formattedNetPrice}</td>
                      <td className="border border-black p-2 text-right font-bold">{total.toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
              {/* Spacer Row */}
              <tr>
                <td className="border border-black p-4" colSpan={isManualQuote ? 6 : (hideListPrice ? 5 : 6)}></td>
              </tr>
              {/* Totals */}
              <tr>
                <td className="border-t border-black p-2 text-right font-bold" colSpan={isManualQuote ? 4 : (hideListPrice ? 3 : 4)}>Subtotal</td>
                <td className="border border-black p-2 text-right font-bold" colSpan={2}>₹{Math.ceil(subtotal).toLocaleString()}</td>
              </tr>
              {gstIncluded && (
                <tr>
                  <td className="border-t border-black p-2 text-right font-bold" colSpan={isManualQuote ? 4 : (hideListPrice ? 3 : 4)}>18% GST</td>
                  <td className="border border-black p-2 text-right font-bold" colSpan={2}>₹{Math.ceil(gst_amount).toLocaleString()}</td>
                </tr>
              )}
              <tr className="bg-green-50">
                <td className="border-t-2 border-black p-2 text-right font-bold text-sm" colSpan={isManualQuote ? 4 : (hideListPrice ? 3 : 4)}>Total</td>
                <td className="border border-black p-2 text-right font-bold text-sm" colSpan={2}>₹{Math.ceil(grand_total).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* T&C Section */}
        <div className="mt-8 text-[11px] leading-relaxed border-t border-gray-100 pt-4">
          <h4 className="font-bold text-xs mb-1">Terms & Conditions:</h4>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Prices are subject to change without prior notice.</li>
            <li>Goods once sold will not be taken back.</li>
            <li>Delivery subject to stock availability.</li>
            <li>The quotation is only valid till 3 days from the date provided.</li>
            <li>This is inclusive of all the charges (GST, Freight Charges if any).</li>
          </ol>
          <div className="text-center font-bold text-xs mt-4">Looking Forward To Your Valuable Order!</div>
        </div>

        {/* Repeating Brands Footer (at bottom of sheet) */}
        <div className="mt-auto pt-6 border-t border-gray-200 flex justify-between items-center opacity-85">
          <img src="/havells.png" alt="Havells" className="h-[24px] object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <img src="/norisys.png" alt="Norisys" className="h-[32px] object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <img src="/beton.png" alt="Beton" className="h-[24px] object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <img src="/crabtree.png" alt="Crabtree" className="h-[24px] object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <img src="/finolex.png" alt="Finolex" className="h-[18px] object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
        </div>
      </div>
    </div>
  );
}
