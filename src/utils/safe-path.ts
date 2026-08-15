/**
 * 存档路径约束：只允许 UUID 文件名，且解析后必须落在 saves 目录内。
 */

import { isAbsolute, relative, resolve, sep } from 'path';

const SAVE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertSaveId(id: unknown): string {
  if (typeof id !== 'string' || !SAVE_ID_RE.test(id)) {
    throw new Error('Invalid save id');
  }
  return id;
}

export function resolveSaveFilePath(saveRoot: string, id: unknown): string {
  const safeId = assertSaveId(id);
  const dir = resolve(saveRoot, 'saves');
  const filePath = resolve(dir, `${safeId}.json`);
  const rel = relative(dir, filePath);
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw new Error('Invalid save path');
  }
  return filePath;
}
