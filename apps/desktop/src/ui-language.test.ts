import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { businessPages } from './components/pageModel';

// Scan files that own Vietnamese screen copy, not API enums or SQL.
const visibleCopyFiles = [
  './components/pageModel.ts',
  './components/BusinessContent.tsx',
  './components/MasterDataContent.tsx',
  './components/Workspace.tsx',
  './App.tsx',
  './ipc.ts',
];

describe('Business language for Sales, SUP and ASM (Issue #21)', () => {
  it('preserves ten business tabs and understandable navigation', () => {
    expect(businessPages).toHaveLength(10);
    const imports = businessPages.find((p) => p.id === 'imports');
    expect(imports?.title).toBe('Nhập dữ liệu');
    expect(imports?.views).toEqual(['Nhập Excel', 'Lịch sử nhập']);
    expect(businessPages.find((p) => p.id === 'sales-out')?.views).toContain('Chưa xác định nhân viên');
    expect(businessPages.find((p) => p.id === 'inventory')?.views).toContain('Kiểm tra chênh lệch');
    expect(businessPages.find((p) => p.id === 'team')?.views).toContain('Sơ đồ quản lý');
  });

  it('prevents common technical jargon in user-facing screen copy', () => {
    const terms = [
      /Ánh xạ/i, /Tử số/i, /Mẫu số/i,
      /\bBatch\b/i, /profile ánh xạ/i, /\bEngine\b/i,
      /\bBackup\b/i, /\bLicense\b/i, /\bSQLite\b/i,
      /\bM2\/M3\b/i, /\bM2\.\d+\b/, /\bM4\.\d+\b/,
    ];
    for (const name of visibleCopyFiles) {
      const source = readFileSync(new URL(name, import.meta.url), 'utf8');
      for (const term of terms) {
        expect(source, name + ' contains developer jargon: ' + term).not.toMatch(term);
      }
    }
  });

  it('keeps quantity conversion explained in FMCG language', () => {
    const src = readFileSync(new URL('./components/MasterDataContent.tsx', import.meta.url), 'utf8');
    expect(src).toContain('1 thùng = 24 lon');
    expect(src).toContain('Áp dụng đến hết ngày');
    expect(src).toContain('Mã hàng trong tệp NPP');
  });
});
