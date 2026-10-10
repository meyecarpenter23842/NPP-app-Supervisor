import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
import { desktopApi, IpcError, normalizeIpcError } from './ipc';

beforeEach(() => invokeMock.mockReset());

describe('allowlisted typed desktop IPC', () => {
  it('uses exactly the expected command and shape', async () => {
    invokeMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ displayName: 'One', role: 'SALES' });
    expect(await desktopApi.getOperator()).toBeNull();
    const input = { displayName: 'One', role: 'SALES' as const };
    expect(await desktopApi.createOperator(input)).toEqual(input);
    expect(invokeMock.mock.calls).toEqual([
      ['get_operator', undefined],
      ['create_operator', { request: input }],
    ]);
    expect(Object.keys(desktopApi)).toEqual(['health', 'getOperator', 'createOperator', 'updateOperator',
      'listMasterData', 'createMasterItem', 'renameMasterItem', 'setMasterActive', 'createMasterLink', 'endMasterLink']);
  });

  it('normalizes structured Rust errors without exposing internals', async () => {
    invokeMock.mockRejectedValueOnce({ code: 'OPERATOR_EXISTS', message: 'sqlite: UNIQUE /private/path' });
    await expect(desktopApi.createOperator({ displayName: 'Two', role: 'ASM' }))
      .rejects.toMatchObject({ code: 'OPERATOR_EXISTS', message: expect.not.stringContaining('sqlite') });
  });

  it('uses typed master-data commands and hides database errors', async () => {
    invokeMock.mockResolvedValueOnce({ id: 'row' });
    await desktopApi.createMasterItem({ kind: 'NPP', code: 'N1', name: 'NPP 1' });
    expect(invokeMock).toHaveBeenCalledWith('create_master_item', {
      request: { kind: 'NPP', code: 'N1', name: 'NPP 1' },
    });
    invokeMock.mockRejectedValueOnce({ code: 'MASTER_CONFLICT', message: 'SQL internals' });
    await expect(desktopApi.listMasterData())
      .rejects.toMatchObject({ code: 'MASTER_CONFLICT', message: expect.not.stringContaining('SQL') });
  });

  it('maps unknown/native errors to a sanitized connection problem', () => {
    const error = normalizeIpcError(new Error('C:\\secret\\db.sqlite'));
    expect(error).toBeInstanceOf(IpcError);
    expect(error.code).toBe('CONNECTION_ERROR');
    expect(error.message).not.toContain('secret');
  });
});
