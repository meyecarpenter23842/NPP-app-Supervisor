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
  VALIDATION_ERROR: 'Thông tin người sử dụng không hợp lệ.',
  OPERATOR_EXISTS: 'Ứng dụng đã có một người sử dụng. Không thể tạo thêm.',
  OPERATOR_NOT_FOUND: 'Chưa có thông tin người sử dụng.',
  STORAGE_ERROR: 'Không thể truy cập dữ liệu cục bộ. Vui lòng thử lại.',
  CONNECTION_ERROR: 'Không kết nối được với ứng dụng desktop. Vui lòng mở ứng dụng Windows.',
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

// Only these four native operations are callable through the application API.
// No renderer access to database paths, SQL, process execution or filesystem.
export const desktopApi = {
  health: () => call<Health>('health'),
  getOperator: () => call<LocalOperator | null>('get_operator'),
  createOperator: (request: OperatorInput) =>
    call<LocalOperator>('create_operator', { request }),
  updateOperator: (request: OperatorInput) =>
    call<LocalOperator>('update_operator', { request }),
};

type Command = 'health' | 'get_operator' | 'create_operator' | 'update_operator';
async function call<T>(command: Command, args?: { request: OperatorInput }): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (cause: unknown) {
    throw normalizeIpcError(cause);
  }
}
