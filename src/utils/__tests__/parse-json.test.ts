import { describe, expect, it } from 'vitest';
import { parseModelJson } from '../parse-json.js';

describe('parseModelJson', () => {
  it('parses raw JSON', () => {
    expect(parseModelJson('{"consult":["world-keeper"]}')).toEqual({ consult: ['world-keeper'] });
  });

  it('strips markdown fences', () => {
    const raw = '```json\n{"ok":true}\n```';
    expect(parseModelJson(raw)).toEqual({ ok: true });
  });

  it('takes the first object when wrapped in prose', () => {
    expect(parseModelJson('here you go\n{"a":1}\nthanks')).toEqual({ a: 1 });
  });

  it('rejects empty or non-json output', () => {
    expect(() => parseModelJson('')).toThrow();
    expect(() => parseModelJson('not json at all')).toThrow();
  });
});
