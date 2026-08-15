/**
 * 解析模型输出的 JSON：去掉 markdown 围栏，失败时再取第一个完整对象。
 */

export function parseModelJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SyntaxError('Empty model JSON');
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    throw new SyntaxError('Model output is not valid JSON');
  }
}
