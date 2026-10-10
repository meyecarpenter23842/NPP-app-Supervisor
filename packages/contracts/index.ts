/** Typed business DTO baseline. Rust serde DTOs must use the exact same contract keys. */
export type Role = 'SUP' | 'ASM';
export type DataKind = 'SALES_IN' | 'SALES_OUT' | 'XNT' | 'TARGET' | 'NPP' | 'SKU' | 'EMPLOYEE' | 'OUTLET';
export type DataState = 'VALID' | 'PARTIAL' | 'MISSING' | 'STALE' | 'CONFLICT';
export type ImportStatus = 'STAGED' | 'VALIDATED' | 'COMMITTED' | 'REJECTED' | 'SUPERSEDED';
export type Id = string;
/** ISO date YYYY-MM-DD; validated in Rust before using as storage/query input. */
export type BusinessDate = string;
/** Monetary and high-precision integer values move across IPC as decimal TEXT to avoid JS precision loss. */
export type IntegerText = string;
export interface DateRange { from: BusinessDate; to: BusinessDate }
export interface QueryScope { period: DateRange; distributorIds: Id[] }
export interface PageRequest { offset: number; limit: number; sortBy: string; sortDir: 'asc' | 'desc' }
export interface Page<T> { rows: T[]; totalRows: number; }
export interface KPIValue {
  metric: 'SALES_IN' | 'SALES_OUT' | 'DOH' | 'ACHIEVEMENT';
  amountVnd?: IntegerText;
  quantityMicro?: IntegerText;
  percentBp?: IntegerText; // basis points, 100.00% => 10000
  label?: string;
  state: DataState;
  asOfDate?: BusinessDate;
  sourceBatchIds: Id[];
}
export interface DashboardResponse {
  scope: QueryScope;
  cards: KPIValue[];
  distributorRows: Array<{ distributorId: Id; distributorCode: string; salesOutVnd: IntegerText | null; state: DataState }>;
  issues: Array<{ code: string; message: string; severity: 'ERROR' | 'WARNING'; distributorId?: Id }>;
}
export interface ImportIssue {
  sourceRow?: number;
  column?: string;
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}
export interface ImportValidationResult {
  stagedImportId: Id;
  kind: DataKind;
  totalRows: number;
  validRows: number;
  errorRows: number;
  issues: ImportIssue[];
  sourceHashSha256: string;
  canCommit: boolean;
  supersededBatchIds: Id[];
}
