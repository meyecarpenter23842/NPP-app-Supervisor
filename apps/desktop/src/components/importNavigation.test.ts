import { describe, expect, it } from 'vitest';
import { getDefaultView, getPage } from './pageModel';

describe('Excel import one-screen navigation', () => {
  it('puts mapping and confirmation in one business view, with history separate', () => {
    const views = getPage('imports').views;
    expect(views).toEqual(['Nhập Excel', 'Lịch sử nhập']);
    expect(getDefaultView('imports')).toBe('Nhập Excel');
  });
});
