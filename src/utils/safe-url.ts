/**
 * Provider URL 校验，防止 SSRF。
 * 本地类端点仅允许 loopback 或 PROVIDER_URL_ALLOWLIST。
 * OpenAI 兼容云端点允许公网 https，拒绝私网 / link-local / metadata。
 */

export type ProviderUrlKind = 'local' | 'openai';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function allowlist(): string[] {
  return (process.env.PROVIDER_URL_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function ipv4FromMapped(host: string): string | null {
  const m = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  return m ? m[1] : null;
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

/** 字面量 IP 是否为不可对公网开放的地址 */
export function isBlockedIp(host: string): boolean {
  const mapped = ipv4FromMapped(host);
  if (mapped) return isBlockedIp(mapped);

  const v4 = parseIpv4(host);
  if (v4) {
    const [a, b] = v4;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (host === '::1' || host === '::') return true;
  if (host.startsWith('fe80:') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')) {
    return true;
  }
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  return false;
}

function isLoopbackHost(host: string): boolean {
  if (LOOPBACK_HOSTS.has(host)) return true;
  const mapped = ipv4FromMapped(host);
  if (mapped) return isLoopbackHost(mapped);
  const v4 = parseIpv4(host);
  return !!v4 && v4[0] === 127;
}

function isAllowlisted(host: string, origin: string): boolean {
  const list = allowlist();
  return list.includes(host) || list.includes(origin.toLowerCase());
}

function isMetadataHost(host: string): boolean {
  return host === 'metadata.google.internal'
    || host === 'metadata.google.com'
    || host.endsWith('.internal')
    || host === 'metadata';
}

export function assertSafeProviderUrl(raw: string, kind: ProviderUrlKind = 'local'): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid provider URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Provider URL must be http or https');
  }
  if (url.username || url.password) {
    throw new Error('Provider URL must not include credentials');
  }

  const host = normalizeHost(url.hostname);
  if (!host) {
    throw new Error('Provider URL host is required');
  }

  if (isAllowlisted(host, url.origin)) {
    return url.toString();
  }

  if (isMetadataHost(host) || host === '169.254.169.254') {
    throw new Error('Provider URL host is not allowed');
  }

  if (isLoopbackHost(host)) {
    return url.toString();
  }

  if (kind === 'openai') {
    if (url.protocol !== 'https:') {
      throw new Error('Cloud provider URL must use https');
    }
    if (isBlockedIp(host)) {
      throw new Error('Provider URL host is not allowed');
    }
    return url.toString();
  }

  throw new Error(
    `Provider URL host "${host}" is not allowed. Use loopback or set PROVIDER_URL_ALLOWLIST.`,
  );
}

export function assertOptionalProviderUrl(
  raw: string | undefined,
  kind: ProviderUrlKind = 'local',
): string | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  return assertSafeProviderUrl(raw.trim(), kind);
}
