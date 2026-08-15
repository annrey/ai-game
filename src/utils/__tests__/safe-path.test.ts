import { describe, expect, it } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { assertSaveId, resolveSaveFilePath } from '../safe-path.js';

describe('assertSaveId / resolveSaveFilePath', () => {
  const root = join(tmpdir(), 'ai-game-saves');
  const id = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts a UUID save id', () => {
    expect(assertSaveId(id)).toBe(id);
    expect(resolveSaveFilePath(root, id)).toMatch(/550e8400-e29b-41d4-a716-446655440000\.json$/);
  });

  it('rejects path traversal ids', () => {
    expect(() => assertSaveId('../../../package')).toThrow(/Invalid save id/);
    expect(() => resolveSaveFilePath(root, '../../../package')).toThrow(/Invalid save id/);
    expect(() => resolveSaveFilePath(root, '..\\..\\package')).toThrow(/Invalid save id/);
  });
});
