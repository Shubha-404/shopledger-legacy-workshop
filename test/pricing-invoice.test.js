const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice figures match the amounts billed by pricing for an HSN-rated order', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(printed.subtotal, billed.subtotal);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 32);
});

test('invoice matches pricing discount and GST figures for a percentage coupon', () => {
  const items = [{ id: 1, name: 'Tea', hsn: '0902', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = { items, coupon: 'SAVE10', total: billed.total, tax: billed.tax };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 100, tax: 162, total: 1062 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice matches pricing GST and total after a flat coupon discount', () => {
  const items = [{ id: 2, name: 'Tea', hsn: '0902', price: 500, qty: 1 }];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' });

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 50, tax: 81, total: 531 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice matches pricing when given an expired coupon code', () => {
  const items = [{ id: 3, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];

  assert.equal(require('../lib/coupons').validate('DIWALI20', 1000).valid, false);
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'DIWALI20' });

  const billed = pricing.computeTotals(items, 'DIWALI20');
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('reconciliation reports a match when the order uses HSN-rated pricing', () => {
  const items = [{ id: 4, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const order = {
    id: 42,
    date: '01/01/2026',
    customer: 'Test Customer',
    coupon: '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total,
    items
  };
  const result = reports.getGstReconciliation({ orders: [order], products: [], customers: [] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
});
