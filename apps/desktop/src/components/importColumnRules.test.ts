import { describe, expect, it } from 'vitest';
import { appearsToBePriceList, fieldsAvailableForColumn, hasSourceFinancialEvidence, invalidFixedFields, isTransactionSource, missingFields, pickHeaderRow, SOURCE_ROW_DOCUMENT, suggestColumns } from './importColumnRules';

describe('Excel standard field selection', () => {
  it('maps two NPP header formats into the same standard fields', () => {
    const first = suggestColumns(['Ngày GH', 'Mã hàng', 'SL bán', 'Thành tiền', 'Số HD', 'DVT'], 'SALES_OUT');
    const second = suggestColumns(['Ngày giao', 'SKU', 'Qty', 'Doanh số', 'Số chứng từ', 'Đơn vị tính'], 'SALES_OUT');
    expect(Object.keys(first).sort()).toEqual(Object.keys(second).sort());
    expect(first.sku).toBe('@col:1');
    expect(second.sku).toBe('@col:1');
  });
  it('does not guess a field when two source columns could both match', () => {
    expect(suggestColumns(['SKU', 'Mã hàng', 'Số lượng'], 'SALES_OUT')).toEqual({ quantity: '@col:2' });
  });
  it('restricts employee, route and outlet to Sales Out and reports missing fields', () => {
    expect(suggestColumns(['Mã NV', 'Mã tuyến', 'Mã điểm bán'], 'SALES_IN')).toEqual({});
    expect(missingFields('SALES_OUT', {sku:'@col:0'}).length).toBe(5);
  });
  it('recognizes a price-only workbook but not a transactional file with unit price', () => {
    expect(appearsToBePriceList(['SKU', 'Đơn giá', 'Giá bán'])).toBe(true);
    expect(appearsToBePriceList(['Mã SP', 'Tên SP', 'SKU', 'Quy cách', 'ĐVT', 'Giá nền', 'GT01 - Bảng Giá Đại Lý'])).toBe(true);
    expect(appearsToBePriceList(['SKU', 'Đơn giá', 'Ngày bán', 'Số lượng'])).toBe(false);
  });
});

describe('fixed metadata for Excel import', () => {
  it('accepts explicitly provided date/unit/document for the whole file', () => {
    const columns = { sku: '@col:0', quantity: '@col:1', amount: '@col:2' };
    const fixed = { date: '2026-10-01', unit: 'THUNG', document: SOURCE_ROW_DOCUMENT };
    expect(missingFields('SALES_OUT', columns, fixed)).toEqual([]);
    expect(invalidFixedFields('SALES_OUT', fixed)).toEqual([]);
    expect(hasSourceFinancialEvidence(columns)).toBe(true);
  });
  it('never treats blank or bad constants as complete, and refuses synthetic sales', () => {
    expect(missingFields('SALES_IN', { sku:'@col:0' }, { date: '', document:'X' }))
      .toContain('Ngày giao dịch');
    expect(invalidFixedFields('SALES_OUT', { date:'2026-02-30', amount:'1,000', quantity:'one' }))
      .toHaveLength(3);
    expect(hasSourceFinancialEvidence({ sku:'@col:0' })).toBe(false);
  });
  it('keeps source document codes as text without coercion', () => {
    expect(invalidFixedFields('SALES_IN', { document:'000045', unit:'LON' })).toEqual([]);
  });
});

describe('header selection without a row picker', () => {
  it('takes the first populated row and preserves its Excel row index', () => {
    expect(pickHeaderRow([
      { row: 1, values: ['', '', ''] },
      { row: 2, values: ['Mã SP', 'SKU', 'ĐVT'] },
      { row: 3, values: ['0007', '0007', 'HỘP'] },
    ])).toEqual({ row: 2, values: ['Mã SP', 'SKU', 'ĐVT'] });
  });
  it('does not fabricate a heading for an empty workbook', () => {
    expect(pickHeaderRow([{row:1,values:['','']}])).toBeUndefined();
  });
});

describe('One source for every business field', () => {
  it('hides shared values and fields already assigned to another Excel column', () => {
    const columns = { sku: '@col:0', amount: '@col:2' };
    const fixed = { date: '2026-10-01', unit: 'THUNG', document: 'INV001' };
    const labels = fieldsAvailableForColumn('SALES_OUT', columns, fixed, 1, false).map(x => x.key);
    expect(labels).toContain('quantity');
    expect(labels).not.toContain('date');
    expect(labels).not.toContain('document');
    expect(labels).not.toContain('unit');
    expect(labels).not.toContain('sku');
    expect(labels).not.toContain('amount');
    expect(labels).not.toContain('type');
    expect(fieldsAvailableForColumn('SALES_OUT', columns, fixed, 0, false).map(x => x.key))
      .toContain('sku');
  });
  it('shows the transaction-type column only with explicit mixed-sale selection', () => {
    expect(fieldsAvailableForColumn('SALES_IN', {}, {}, 0, false).map(x=>x.key)).not.toContain('type');
    expect(fieldsAvailableForColumn('SALES_IN', {}, {}, 0, true).map(x=>x.key)).toContain('type');
  });
  it('requires actual transaction evidence rather than a price alone', () => {
    expect(isTransactionSource({amount:'@col:4'})).toBe(false);
    expect(isTransactionSource({document:'@col:1', amount:'@col:4'})).toBe(true);
    expect(isTransactionSource({quantity:'@col:2'})).toBe(true);
  });
  it('uses user-facing Vietnamese field names rather than SQL terms', () => {
    const found = fieldsAvailableForColumn('SALES_OUT', {}, {}, 0, true);
    expect(found.find(x=>x.key==='sku')?.name).toBe('Mã hàng');
    expect(found.find(x=>x.key==='document')?.name).toBe('Số đơn / chứng từ');
    expect(found.find(x=>x.key==='amount')?.name).toBe('Thành tiền (VND)');
  });
});
