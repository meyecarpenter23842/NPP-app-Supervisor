import { invoke } from '@tauri-apps/api/core';

export type OperatorRole = 'SALES' | 'SUP' | 'ASM';
export interface OperatorInput {
  displayName: string;
  role: OperatorRole;
}
export type LocalOperator = Readonly<OperatorInput>;
export interface Health {
  status: 'ready';
  storageReady: boolean;
}
export type IpcErrorCode =
  | 'VALIDATION_ERROR'
  | 'OPERATOR_EXISTS'
  | 'OPERATOR_NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'MASTER_CONFLICT'
  | 'MASTER_NOT_FOUND'
  | 'IMPORT_INVALID'
  | 'IMPORT_CONFLICT'
  | 'CONNECTION_ERROR';

export class IpcError extends Error {
  readonly code: IpcErrorCode;
  constructor(code: IpcErrorCode, message: string) {
    super(message);
    this.name = 'IpcError';
    this.code = code;
  }
}

const messages: Record<IpcErrorCode, string> = {
  VALIDATION_ERROR: 'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra lại.',
  OPERATOR_EXISTS: 'Ứng dụng đã có một người sử dụng. Không thể tạo thêm.',
  OPERATOR_NOT_FOUND: 'Chưa có thông tin người sử dụng.',
  STORAGE_ERROR: 'Không thể đọc hoặc lưu dữ liệu trên máy. Vui lòng thử lại.',
  MASTER_CONFLICT: 'Mã đã được sử dụng hoặc thời gian phân công bị trùng. Hãy kiểm tra lại.',
  MASTER_NOT_FOUND: 'Không tìm thấy dữ liệu cần sửa.',
  IMPORT_INVALID: 'Tệp hoặc thông tin nhập chưa hợp lệ. Hãy kiểm tra lại.',
  IMPORT_CONFLICT: 'Có dữ liệu chưa khớp hoặc đã nhập cho kỳ này. Hãy kiểm tra lại trước khi xác nhận.',
  CONNECTION_ERROR: 'Ứng dụng không phản hồi. Hãy đóng rồi mở lại ứng dụng.',
};

export function normalizeIpcError(reason: unknown): IpcError {
  if (reason instanceof IpcError) return reason;
  if (typeof reason === 'object' && reason !== null && 'code' in reason) {
    const code = (reason as { code: unknown }).code;
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(messages, code)) {
      const userMessage = (reason as { message?: unknown }).message;
      if (code.startsWith('IMPORT_') && typeof userMessage === 'string' && userMessage.length < 250) {
        return new IpcError(code as IpcErrorCode, userMessage);
      }
      return new IpcError(code as IpcErrorCode, messages[code as IpcErrorCode]);
    }
  }
  return new IpcError('CONNECTION_ERROR', messages.CONNECTION_ERROR);
}

export type MasterKind = 'NPP' | 'FAMILY' | 'SKU' | 'EMPLOYEE' | 'ROUTE';
export type MasterLinkKind = 'SKU_ALIAS' | 'EMPLOYEE_ALIAS' | 'MANAGER' | 'NPP_STAFF' | 'ROUTE_STAFF' | 'SKU_UNIT';
export type MasterItem = { id: string; code: string; name: string; detail: string | null; parentId: string | null; active: boolean };
export type MasterLink = {
  id: string; kind: MasterLinkKind; subjectId: string; relatedId: string | null;
  distributorId: string | null; externalCode: string | null; unitCode: string | null;
  ratioNum: number | null; ratioDen: number | null; effectiveFrom: string | null; effectiveTo: string | null;
};
export type MasterSnapshot = {
  distributors: MasterItem[]; families: MasterItem[]; skus: MasterItem[];
  employees: MasterItem[]; routes: MasterItem[]; links: MasterLink[];
};
export type NewMasterItem = { kind: MasterKind; code: string; name: string; parentId?: string | null; detail?: string | null };
export type NewMasterLink = {
  kind: MasterLinkKind; subjectId: string; relatedId?: string | null; distributorId?: string | null;
  externalCode?: string | null; unitCode?: string | null; ratioNum?: number | null; ratioDen?: number | null;
  effectiveFrom?: string | null; effectiveTo?: string | null;
};
export type MasterMutation = { id: string };

export type ImportKind = 'SALES_IN' | 'SALES_OUT';
export interface ImportRequest {
  fileName: string;
  bytes: number[];
  kind: ImportKind;
  distributorId: string;
  periodFrom: string;
  periodTo: string;
  sheetName: string;
  headerRow: number;
  columns: Record<string, string>;
  fixedValues?: Record<string, string>;
  rowKind: 'INVOICE' | 'DELIVERED' | 'RETURN';
  mixedTransactions?: boolean;
  positiveValue?: string | null;
  returnValue?: string | null;
  cancelValue?: string | null;
}
export interface ImportMappingProfile {
  columns: Record<string, string>;
  fixedValues?: Record<string, string>;
  rowKind: 'INVOICE' | 'DELIVERED' | 'RETURN';
  positiveValue: string | null;
  returnValue: string | null;
  cancelValue: string | null;
}
export interface ImportMappingSaveRequest extends ImportMappingProfile {
  kind: ImportKind;
  distributorId: string;
  headers: string[];
}
export interface ImportRowView { row: number; values: string[] }
export interface ImportSheetView { name: string; rows: number; firstRows: ImportRowView[]; hasFormulas: boolean }
export interface ImportFileView { sheets: ImportSheetView[]; sha256: string }
export interface ImportIssue { row: number; column: string; severity: 'ERROR' | 'WARNING'; message: string }
export interface ImportPreview {
  sha256: string;
  totalRows: number; validRows: number; skippedRows: number; unknownEmployees: number; errorRows: number;
  issues: ImportIssue[]; sample: ImportRowView[];
  hasPrevious: boolean; sameFileAlreadyActive: boolean; preflightOnly: boolean;
}
export interface ImportResult { id: string; inserted: number; unresolved: number; replaced: boolean; alreadyImported: boolean }
export interface ImportHistory {
  id: string; kind: ImportKind; distributorName: string;
  periodFrom: string; periodTo: string; sourceFileName: string;
  sourceSheet: string | null; status: string; active: boolean;
  totalRows: number; validRows: number; errorRows: number; importedAtUtc: string;
}



// Native calls are allowlisted. No renderer SQL, file paths or process execution.
export const desktopApi = {
  health: () => call<Health>('health'),
  getOperator: () => call<LocalOperator | null>('get_operator'),
  createOperator: (request: OperatorInput) =>
    call<LocalOperator>('create_operator', { request }),
  updateOperator: (request: OperatorInput) =>
    call<LocalOperator>('update_operator', { request }),
  listMasterData: () => call<MasterSnapshot>('list_master_data'),
  createMasterItem: (request: NewMasterItem) => call<MasterMutation>('create_master_item', { request }),
  renameMasterItem: (request: { kind: MasterKind; id: string; name: string }) => call<MasterMutation>('rename_master_item', { request }),
  setMasterActive: (request: { kind: MasterKind; id: string; active: boolean }) => call<MasterMutation>('set_master_active', { request }),
  createMasterLink: (request: NewMasterLink) => call<MasterMutation>('create_master_link', { request }),
  endMasterLink: (request: { kind: MasterLinkKind; id: string; effectiveTo: string }) => call<MasterMutation>('end_master_link', { request }),
  inspectImportFile: (fileName: string, bytes: number[]) =>
    call<ImportFileView>('inspect_import_file', { fileName, bytes }),
  previewImport: (request: ImportRequest) =>
    call<ImportPreview>('preview_import', { request }),
  commitImport: (request: ImportRequest, expectedSha256: string, replaceExisting: boolean) =>
    call<ImportResult>('commit_import', { request, expectedSha256, replaceExisting }),
  listImportHistory: () => call<ImportHistory[]>('list_import_history'),
  getImportMappingProfile: (kind: ImportKind, distributorId: string, headers: string[]) =>
    call<ImportMappingProfile | null>('get_import_mapping_profile', { kind, distributorId, headers }),
  saveImportMappingProfile: (request: ImportMappingSaveRequest) =>
    call<void>('save_import_mapping_profile', { request }),
};

type Command = 'health' | 'get_operator' | 'create_operator' | 'update_operator'
  | 'list_master_data' | 'create_master_item' | 'rename_master_item'
  | 'set_master_active' | 'create_master_link' | 'end_master_link' | 'inspect_import_file' | 'preview_import' | 'commit_import' | 'list_import_history'
  | 'get_import_mapping_profile' | 'save_import_mapping_profile';
type NativeRequest = OperatorInput | NewMasterItem | NewMasterLink | ImportRequest | ImportMappingSaveRequest
  | { kind: MasterKind; id: string; name: string }
  | { kind: MasterKind; id: string; active: boolean }
  | { kind: MasterLinkKind; id: string; effectiveTo: string };
async function call<T>(command: Command, args?: { request?: NativeRequest; fileName?: string; bytes?: number[]; expectedSha256?: string; replaceExisting?: boolean;
  kind?: ImportKind; distributorId?: string; headers?: string[] }): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (cause: unknown) {
    throw normalizeIpcError(cause);
  }
}
