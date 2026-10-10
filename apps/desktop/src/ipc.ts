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
  CONNECTION_ERROR: 'Ứng dụng không phản hồi. Hãy đóng rồi mở lại ứng dụng.',
};

export function normalizeIpcError(reason: unknown): IpcError {
  if (reason instanceof IpcError) return reason;
  if (typeof reason === 'object' && reason !== null && 'code' in reason) {
    const code = (reason as { code: unknown }).code;
    if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(messages, code)) {
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
};

type Command = 'health' | 'get_operator' | 'create_operator' | 'update_operator'
  | 'list_master_data' | 'create_master_item' | 'rename_master_item'
  | 'set_master_active' | 'create_master_link' | 'end_master_link';
type NativeRequest = OperatorInput | NewMasterItem | NewMasterLink
  | { kind: MasterKind; id: string; name: string }
  | { kind: MasterKind; id: string; active: boolean }
  | { kind: MasterLinkKind; id: string; effectiveTo: string };
async function call<T>(command: Command, args?: { request: NativeRequest }): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (cause: unknown) {
    throw normalizeIpcError(cause);
  }
}
