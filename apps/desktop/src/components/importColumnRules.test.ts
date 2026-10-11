import { describe, expect, it } from 'vitest';
import { appearsToBePriceList, missingFields, suggestColumns } from './importColumnRules';

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
    expect(appearsToBePriceList(['SKU', 'Đơn giá', 'Ngày bán', 'Số lượng'])).toBe(false);
  });
});
