import type { ImportKind } from '../ipc';

// The renderer exposes only fields the Rust Sales In/Out importer can actually persist.
export const STANDARD_FIELDS = [
  { key: 'date', name: 'Ngày bán / ngày chứng từ', required: true },
  { key: 'document', name: 'Số chứng từ', required: true },
  { key: 'line', name: 'Dòng chứng từ', required: false },
  { key: 'sku', name: 'Mã SKU của NPP', required: true },
  { key: 'unit', name: 'Đơn vị tính', required: true },
  { key: 'quantity', name: 'Số lượng', required: true },
  { key: 'amount', name: 'Doanh số / giá trị (VND)', required: true },
  { key: 'employee', name: 'Mã nhân viên của NPP', required: false },
  { key: 'type', name: 'Loại chứng từ', required: false },
  { key: 'outlet', name: 'Mã điểm bán', required: false },
  { key: 'route', name: 'Mã tuyến', required: false },
] as const;

export function fieldsFor(kind: ImportKind) {
  return STANDARD_FIELDS.filter(f => kind === 'SALES_OUT' || !['employee', 'outlet', 'route'].includes(f.key));
}
export function missingFields(kind: ImportKind, selections: Record<string, string>): string[] {
  return fieldsFor(kind).filter(f => f.required && !selections[f.key]).map(f => f.name);
}

export function cleanHeader(header: string): string {
  return header.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

const ALIASES: Record<string, string[]> = {
  date: ['ngay ban', 'ngay giao', 'ngay gh', 'ngay chung tu', 'ngay hd', 'business date'],
  document: ['so chung tu', 'so hoa don', 'so hd', 'ma chung tu', 'chung tu', 'document no'],
  line: ['dong chung tu', 'so dong', 'dong hoa don', 'line no'],
  sku: ['sku', 'ma sku', 'ma hang', 'ma san pham', 'ma vat tu', 'sku code'],
  unit: ['dvt', 'don vi tinh', 'don vi ban', 'raw unit'],
  quantity: ['so luong', 'sl', 'sl ban', 'sl giao', 'qty', 'quantity'],
  amount: ['doanh so', 'doanh thu', 'doanh so vnd', 'doanh thu vnd', 'thanh tien', 'net amount vnd', 'gia tri vnd'],
  employee: ['ma nhan vien', 'ma nvkd', 'ma nv', 'ma sales', 'emp code'],
  type: ['loai chung tu', 'loai giao dich', 'doc type'],
  outlet: ['ma diem ban', 'ma khach hang', 'outlet code'],
  route: ['ma tuyen', 'route code'],
};

export function suggestColumns(headers: string[], kind: ImportKind): Record<string, string> {
  const allowed = new Set(fieldsFor(kind).map(f => f.key));
  const candidate = new Map<string, number[]>();
  headers.forEach((raw, index) => {
    const normalized = cleanHeader(raw);
    if (!normalized) return;
    const matches = Object.entries(ALIASES)
      .filter(([key, names]) => allowed.has(key) && names.includes(normalized));
    if (matches.length !== 1) return;
    const key = matches[0][0];
    candidate.set(key, [...(candidate.get(key) ?? []), index]);
  });
  return Object.fromEntries([...candidate].filter(([,indices]) => indices.length === 1)
    .map(([key,indices]) => [key, '@col:' + indices[0]]));
}

export function appearsToBePriceList(headers: string[]): boolean {
  const names = headers.map(cleanHeader);
  const price = names.some(x => ['don gia', 'gia ban', 'bang gia', 'gia niem yet', 'gia si', 'unit price'].includes(x));
  if (!price) return false;
  const transactional = names.some(x =>
    ['ngay ban', 'ngay giao', 'ngay chung tu', 'so chung tu', 'so hoa don', 'so luong', 'sl ban',
      'sl giao', 'doanh so', 'thanh tien', 'quantity', 'qty'].includes(x));
  return !transactional;
}
