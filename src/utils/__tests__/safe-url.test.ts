import { afterEach, describe, expect, it } from 'vitest';
import { assertSafeProviderUrl, isBlockedIp } from '../safe-url.js';

describe('assertSafeProviderUrl', () => {
  const original = process.env.PROVIDER_URL_ALLOWLIST;

  afterEach(() => {
    if (original === undefined) delete process.env.PROVIDER_URL_ALLOWLIST;
    else process.env.PROVIDER_URL_ALLOWLIST = original;
  });

  it('allows loopback local endpoints', () => {
    expect(() => assertSafeProviderUrl('http://localhost:11434', 'local')).not.toThrow();
    expect(() => assertSafeProviderUrl('http://127.0.0.1:1234/v1', 'local')).not.toThrow();
  });

  it('rejects private LAN hosts for local providers', () => {
    expect(() => assertSafeProviderUrl('http://192.168.1.10:11434', 'local')).toThrow(/not allowed/);
    expect(() => assertSafeProviderUrl('http://10.0.0.5/v1', 'local')).toThrow(/not allowed/);
  });

  it('rejects metadata and credentials', () => {
    expect(() => assertSafeProviderUrl('http://169.254.169.254/latest/meta-data', 'local')).toThrow();
    expect(() => assertSafeProviderUrl('http://user:pass@localhost:11434', 'local')).toThrow(/credentials/);
    expect(() => assertSafeProviderUrl('file:///etc/passwd', 'local')).toThrow(/http/);
  });

  it('allows public https OpenAI-compatible hosts', () => {
    expect(() => assertSafeProviderUrl('https://api.openai.com/v1', 'openai')).not.toThrow();
  });

  it('rejects private or http cloud endpoints', () => {
    expect(() => assertSafeProviderUrl('http://api.openai.com/v1', 'openai')).toThrow(/https/);
    expect(() => assertSafeProviderUrl('https://192.168.0.8/v1', 'openai')).toThrow(/not allowed/);
  });

  it('honors PROVIDER_URL_ALLOWLIST', () => {
    process.env.PROVIDER_URL_ALLOWLIST = 'host.docker.internal';
    expect(() => assertSafeProviderUrl('http://host.docker.internal:11434', 'local')).not.toThrow();
  });

  it('detects blocked IPs', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('10.1.2.3')).toBe(true);
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('169.254.169.254')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
  });
});
