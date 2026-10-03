// Invoice Generator for Market Koro Admin & Customer Orders
export function generatePDFInvoice(order) {
  if (!order) return;

  const rawId = order.id || 'N/A';
  const prefix = order.invoicePrefix || 'MK-';
  const orderId = rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
  const cleanId = orderId.replace(/[^a-zA-Z0-9]/g, '');

  let orderDateStr = 'N/A';
  if (order.createdAt) {
    if (order.createdAt.seconds) {
      orderDateStr = new Date(order.createdAt.seconds * 1000).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } else if (typeof order.createdAt === 'string' || typeof order.createdAt === 'number') {
      orderDateStr = new Date(order.createdAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    }
  } else {
    orderDateStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHTML = items.map((item, idx) => {
    const itemImg = item.image || (item.images && item.images[0]) || 'https://via.placeholder.com/60?text=No+Image';
    const unitPrice = Number(item.price || 0);
    const qty = Number(item.quantity || 1);
    const itemTotal = unitPrice * qty;

    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center; width: 40px; font-weight: bold; color: #6B7280;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; width: 60px;">
          <img src="${itemImg}" alt="${item.name || 'Product'}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid #E5E7EB; display: block; margin: 0 auto;" />
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; vertical-align: middle;">
          <div style="font-weight: 600; font-size: 14px; color: #111827; line-height: 1.3;">${item.name || 'Unnamed Item'}</div>
          ${item.id && item.id !== 'N/A' ? `<div style="font-size: 11px; color: #6B7280; margin-top: 2px;">SKU / ID: ${item.id}</div>` : ''}
          ${item.variant ? `<div style="font-size: 11px; color: #F5820A; margin-top: 2px; font-weight: 500;">Option / Variant: ${item.variant}</div>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center; vertical-align: middle; font-weight: 600; font-size: 13px;">৳${unitPrice.toLocaleString('bn-BD')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: center; vertical-align: middle; font-weight: 700; font-size: 14px; color: #0B4D3C;">${qty}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right; vertical-align: middle; font-weight: 700; font-size: 14px; color: #0B4D3C;">৳${itemTotal.toLocaleString('bn-BD')}</td>
      </tr>
    `;
  }).join('');

  const custName = order.customerInfo?.name || 'Not provided';
  const custPhone = order.customerInfo?.phone || 'Not provided';
  const custEmail = order.customerInfo?.email || 'Not provided';

  const division = order.shippingAddress?.division || 'Not provided';
  const district = order.shippingAddress?.district || 'Not provided';
  const thana = order.shippingAddress?.thana || order.shippingAddress?.upazila || 'Not provided';
  const union = order.shippingAddress?.union || 'Not provided';
  const village = order.shippingAddress?.village || 'Not provided';
  const notes = order.shippingAddress?.notes || null;

  const subtotal = Number(order.subtotal || items.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0));
  const deliveryCharge = Number(order.deliveryCharge || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const couponCode = order.couponCode || null;
  const finalTotal = Number(order.totalAmount || Math.max(0, subtotal + deliveryCharge - discountAmount));

  const paymentMethod = (order.paymentMethod || 'cod').toUpperCase();
  const bKashTxnId = order.bKashTxnId || null;
  const orderStatus = order.orderStatus || 'Pending';

  const filenameTitle = `Order-${orderId.length > 8 ? orderId.substring(0, 8) : orderId}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${filenameTitle}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1F2937; background: #F3F4F6; padding: 20px; line-height: 1.5; }
        .invoice-card { max-width: 820px; margin: 0 auto; background: #FFFFFF; padding: 32px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #E5E7EB; }
        .top-action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #E5E7EB; }
        .btn-print { background-color: #0B4D3C; color: #FFFFFF; border: none; padding: 10px 22px; font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 5px rgba(11,77,60,0.2); transition: background 0.2s; }
        .btn-print:hover { background-color: #08382c; }
        .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #0B4D3C; }
        .brand-logo-area h1 { font-size: 26px; font-weight: 800; color: #0B4D3C; letter-spacing: -0.5px; }
        .brand-logo-area .tagline { font-size: 12px; font-weight: 800; color: #F5820A; letter-spacing: 1px; text-transform: uppercase; display: block; margin-top: 2px; }
        .brand-logo-area p { font-size: 12px; color: #4B5563; margin-top: 6px; line-height: 1.4; }
        .invoice-title-area { text-align: right; }
        .invoice-title-area h2 { font-size: 24px; font-weight: 800; color: #111827; letter-spacing: 1px; }
        .status-pill { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #E0F2FE; color: #0369A1; margin-top: 6px; text-transform: uppercase; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; margin-bottom: 24px; background: #F9FAFB; padding: 18px; border-radius: 8px; border: 1px solid #F3F4F6; }
        .info-box h3 { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0B4D3C; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; }
        .info-box p { font-size: 13px; color: #374151; margin-bottom: 4px; word-break: break-word; }
        .info-box strong { color: #111827; }
        table.items-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 24px; }
        table.items-table th { background-color: #0B4D3C; color: #FFFFFF; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 10px; text-align: left; }
        .summary-section { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 20px; padding-top: 16px; border-top: 2px solid #E5E7EB; }
        .payment-info-box { flex: 1; background: #FFFBEB; border: 1px solid #FCD34D; padding: 14px; border-radius: 8px; font-size: 13px; }
        .payment-info-box h4 { font-size: 12px; font-weight: 800; color: #92400E; text-transform: uppercase; margin-bottom: 6px; }
        .totals-table { width: 280px; font-size: 13px; }
        .totals-table td { padding: 5px 0; }
        .totals-table .grand-row { border-top: 2px solid #0B4D3C; border-bottom: 2px solid #0B4D3C; font-weight: 800; font-size: 16px; color: #0B4D3C; padding: 8px 0; }
        .invoice-footer { margin-top: 36px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        @media print {
          body { background: #FFFFFF; padding: 0; }
          .invoice-card { box-shadow: none; border: none; padding: 0; max-width: 100%; }
          .top-action-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="top-action-bar">
          <span style="font-size: 13px; font-weight: 600; color: #6B7280;">Official Invoice / Order Slip</span>
          <button class="btn-print" onclick="window.print()">
            🖨️ Print / Save PDF
          </button>
        </div>

        <div class="invoice-header">
          <div class="brand-logo-area">
            <h1>Market Koro</h1>
            <span class="tagline">Online Shopping in Kushtia</span>
            <p>
              Kushtia, Khulna, Bangladesh<br />
              <strong>Hotline:</strong> +8809658183506 | <strong>Mobile:</strong> 01342697743<br />
              <strong>Email:</strong> saripofficialsupport@gmail.com
            </p>
          </div>
          <div class="invoice-title-area">
            <h2>INVOICE</h2>
            <p style="font-size: 13px; font-weight: bold; color: #374151; margin-top: 4px;">Order #${orderId}</p>
            <p style="font-size: 12px; color: #6B7280; margin-top: 2px;">Date: ${orderDateStr}</p>
            <span class="status-pill">${orderStatus}</span>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${custName}</p>
            <p><strong>Mobile:</strong> ${custPhone}</p>
            <p><strong>Email:</strong> ${custEmail}</p>
          </div>
          <div class="info-box">
            <h3>Delivery Address</h3>
            <p><strong>Division:</strong> ${division}</p>
            <p><strong>District:</strong> ${district}</p>
            <p><strong>Upazila / Thana:</strong> ${thana}</p>
            <p><strong>Union / Ward:</strong> ${union}</p>
            <p><strong>Village / Street / Area:</strong> ${village}</p>
            ${notes ? `<p style="margin-top: 4px; font-style: italic; color: #6B7280;"><strong>Notes:</strong> ${notes}</p>` : ''}
          </div>
        </div>

        <h3 style="font-size: 14px; font-weight: 800; color: #0B4D3C; text-transform: uppercase; margin-bottom: 10px;">Purchased Items</h3>

        <table class="items-table">
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th style="text-align: center; width: 60px;">Image</th>
              <th>Product Details</th>
              <th style="text-align: center;">Price</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML.length > 0 ? itemsHTML : '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #777;">No products in order</td></tr>'}
          </tbody>
        </table>

        <div class="summary-section">
          <div class="payment-info-box">
            <h4>Payment Information</h4>
            <p><strong>Payment Method:</strong> ${paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : paymentMethod}</p>
            <p><strong>Payment Status:</strong> ${order.paymentStatus || (paymentMethod === 'COD' ? 'Pending' : 'Submitted')}</p>
            ${bKashTxnId ? `<p style="margin-top: 4px; color: #B45309;"><strong>bKash TrxID:</strong> <code style="background:#FEF3C7; padding: 2px 6px; border-radius:4px; font-family:monospace; font-weight:bold;">${bKashTxnId}</code></p>` : ''}
          </div>

          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right; font-weight: 600;">৳${subtotal.toLocaleString('bn-BD')}</td>
            </tr>
            ${discountAmount > 0 ? `
            <tr style="color: #059669;">
              <td>Discount ${couponCode ? `(${couponCode})` : ''}:</td>
              <td style="text-align: right; font-weight: 600;">-৳${discountAmount.toLocaleString('bn-BD')}</td>
            </tr>` : ''}
            <tr>
              <td>Delivery Charge:</td>
              <td style="text-align: right; font-weight: 600;">৳${deliveryCharge.toLocaleString('bn-BD')}</td>
            </tr>
            <tr class="grand-row">
              <td>Grand Total:</td>
              <td style="text-align: right;">৳${finalTotal.toLocaleString('bn-BD')}</td>
            </tr>
          </table>
        </div>

        <div class="invoice-footer">
          <p style="font-weight: 600; color: #0B4D3C;">Thank you for shopping with Market Koro!</p>
          <p style="margin-top: 2px;">For order updates or queries, please contact Hotline +8809658183506 or WhatsApp 01342697743.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=900,height=950');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
