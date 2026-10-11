import { describe, expect, it } from 'vitest';
import { appearsToBePriceList, hasSourceFinancialEvidence, invalidFixedFields, missingFields, pickHeaderRow, SOURCE_ROW_DOCUMENT, suggestColumns } from './importColumnRules';

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
      .toContain('Ngày bán / ngày chứng từ');
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
