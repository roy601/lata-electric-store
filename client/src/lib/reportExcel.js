/**
 * Report export: one Excel workbook (a sheet per section) or a CSV per table.
 * ExcelJS is loaded only when an export runs.
 */
const STATUS = { pending: 'New', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', return_requested: 'Return requested', returned: 'Returned' };
const dhakaDateTime = (iso) => new Date(new Date(iso).getTime() + 6 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

/** The tables of a report, as plain rows — shared by Excel and CSV. */
export function reportTables(r) {
  const s = r.summary, p = r.previous_summary;
  const change = (a, b) => (b ? Math.round((a - b) / b * 100) / 100 : null);
  return {
    Summary: {
      columns: [['Measure', 30], ['This period', 16, 'money'], ['Previous period', 16, 'money'], ['Change', 10, 'pct']],
      rows: [
        ['Sales (booked revenue, ৳)', s.booked.revenue, p.booked.revenue, change(s.booked.revenue, p.booked.revenue)],
        ['Orders (booked)', s.booked.orders, p.booked.orders, change(s.booked.orders, p.booked.orders)],
        ['Average order value (৳)', s.booked.avg_order_value, p.booked.avg_order_value, change(s.booked.avg_order_value, p.booked.avg_order_value)],
        ['Units sold', s.booked.units_sold, p.booked.units_sold, change(s.booked.units_sold, p.booked.units_sold)],
        ['Product sales (৳)', s.booked.product_sales, p.booked.product_sales, null],
        ['Delivery charges (৳)', s.booked.delivery_charges, p.booked.delivery_charges, null],
        ['Coupon discounts (৳)', s.booked.coupon_discounts, p.booked.coupon_discounts, null],
        ['Delivered revenue (৳)', s.delivered.revenue, p.delivered.revenue, change(s.delivered.revenue, p.delivered.revenue)],
        ['Not yet paid (৳)', s.not_marked_paid.amount, null, null],
        ['Orders placed (all statuses)', s.orders_placed, p.orders_placed, null],
        ['Cancelled orders', r.returns.cancelled.orders, null, null],
        ['Returned orders', r.returns.returned.orders, null, null],
        ['New customers', r.customers.new_customers, null, null],
        ['Returning customers', r.customers.returning_customers, null, null],
      ],
    },
    'Sales by day': {
      columns: [[r.trend[0]?.period?.length === 10 ? 'Date' : 'Week starting', 14], ['Orders', 10], ['Units', 10], ['Sales ৳', 14, 'money'], ['Delivered ৳', 14, 'money']],
      rows: r.trend.map(t => [t.period, t.orders, t.units, t.booked_revenue, t.delivered_revenue]),
    },
    Products: {
      columns: [['Product', 48], ['Category', 24], ['Units sold', 11], ['Orders', 9], ['Sales ৳', 14, 'money'], ['Stock now', 11]],
      rows: r.products.map(x => [x.name, x.category || '', x.units_sold, x.orders, x.revenue, x.in_catalogue === false ? 'Deleted' : x.current_stock]),
    },
    Categories: {
      columns: [['Category', 36], ['Products', 10], ['Units sold', 11], ['Sales ৳', 14, 'money']],
      rows: r.categories.map(c => [c.category, c.products, c.units_sold, c.revenue]),
    },
    Customers: {
      columns: [['Customer', 28], ['Phone', 16], ['City', 16], ['Orders', 9], ['Spent ৳', 14, 'money'], ['Last order', 12]],
      rows: r.customers.top_customers.map(c => [c.name, c.phone, c.city || '', c.orders, c.spent, c.last_order]),
    },
    Orders: {
      columns: [['Order', 13], ['Date & time', 17], ['Status', 16], ['Customer', 24], ['Phone', 14], ['City', 14], ['Items', 7], ['Subtotal ৳', 12, 'money'], ['Delivery ৳', 11, 'money'], ['Discount ৳', 11, 'money'], ['Total ৳', 12, 'money'], ['Payment', 18], ['Paid', 7], ['Coupon', 12]],
      rows: r.orders.map(o => [o.order_id, dhakaDateTime(o.created_at), STATUS[o.status] || o.status, o.customer, o.phone, o.city, o.items, o.subtotal, o.delivery, o.discount, o.total, o.payment, o.paid ? 'Yes' : 'No', o.coupon]),
    },
    Inventory: {
      columns: [['Product', 48], ['Category', 24], ['Stock', 9], ['Price ৳', 12, 'money'], ['Stock value ৳', 14, 'money'], ['Sold last 30 days', 16], ['Days of stock', 13], ['Status', 14]],
      rows: r.inventory.rows.map(x => [x.name, x.category || '', x.stock, x.price, x.stock_value, x.units_sold_last_30d ?? 0, x.days_of_cover ?? '', x.status === 'out_of_stock' ? 'Out of stock' : x.status === 'low' ? 'Running low' : 'OK']),
    },
  };
}

const fileName = (r, ext) => `Lata-Electric-report_${r.period.from}_to_${r.period.to}.${ext}`;
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Whole report as an .xlsx workbook */
export async function downloadReportExcel(r) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lata Electric admin';
  const tables = reportTables(r);
  Object.entries(tables).forEach(([name, t]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: name === 'Summary' ? 3 : 1 }] });
    if (name === 'Summary') {
      ws.addRow([`Lata Electric — report ${r.period.from} to ${r.period.to}`]).font = { bold: true, size: 14 };
      ws.addRow([`Compared with ${r.previous_period.from} to ${r.previous_period.to}. Sales exclude cancelled and returned orders.`]).font = { italic: true, color: { argb: 'FF64748B' } };
    }
    const head = ws.addRow(t.columns.map(c => c[0]));
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; c.alignment = { vertical: 'middle' }; });
    t.rows.forEach(row => ws.addRow(row));
    t.columns.forEach(([, width, kind], i) => {
      const col = ws.getColumn(i + 1);
      col.width = width;
      if (kind === 'money') col.numFmt = '#,##0';
      if (kind === 'pct') col.numFmt = '+0%;-0%;0%';
    });
    if (t.rows.length) ws.autoFilter = { from: { row: head.number, column: 1 }, to: { row: head.number, column: t.columns.length } };
  });
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName(r, 'xlsx'));
}

/** One table as CSV (opens in Excel; UTF-8 with BOM so Bangla names show correctly) */
export function downloadReportCsv(r, tableName) {
  const t = reportTables(r)[tableName];
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [t.columns.map(c => c[0]), ...t.rows].map(row => row.map(esc).join(',')).join('\r\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), fileName(r, `${tableName.toLowerCase().replace(/\s+/g, '-')}.csv`));
}
