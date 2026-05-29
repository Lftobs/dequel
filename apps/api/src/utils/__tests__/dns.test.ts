import { describe, it, expect, mock, afterEach } from 'bun:test';

const mockResolveCname = mock();
const mockResolve4 = mock();

mock.module('node:dns', () => ({
  promises: {
    resolveCname: mockResolveCname,
    resolve4: mockResolve4,
  },
}));

const { validateDomain, resolveServerIp } = await import('../dns');

describe('validateDomain', () => {
  afterEach(() => {
    mockResolveCname.mockReset();
    mockResolve4.mockReset();
  });

  it('returns true when CNAME matches baseDomain', async () => {
    mockResolveCname.mockResolvedValue(['app.dequel.sh.']);
    const result = await validateDomain('app.example.com', '1.2.3.4', 'dequel.sh');
    expect(result).toBe(true);
    expect(mockResolveCname).toHaveBeenCalledWith('app.example.com');
    expect(mockResolve4).not.toHaveBeenCalled();
  });

  it('returns true when CNAME contains baseDomain (case insensitive)', async () => {
    mockResolveCname.mockResolvedValue(['APP.DEQUEL.SH.']);
    const result = await validateDomain('app.example.com', '1.2.3.4', 'dequel.sh');
    expect(result).toBe(true);
  });

  it('skips CNAME check when baseDomain is null', async () => {
    mockResolve4.mockResolvedValue(['5.6.7.8']);
    const result = await validateDomain('app.example.com', '1.2.3.4', null);
    expect(result).toBe(true);
    expect(mockResolveCname).not.toHaveBeenCalled();
    expect(mockResolve4).toHaveBeenCalled();
  });

  it('skips CNAME check when baseDomain is undefined', async () => {
    mockResolve4.mockResolvedValue(['5.6.7.8']);
    const result = await validateDomain('app.example.com', '1.2.3.4');
    expect(result).toBe(true);
    expect(mockResolveCname).not.toHaveBeenCalled();
  });

  it('falls back to A record check when CNAME does not match', async () => {
    mockResolveCname.mockResolvedValue(['other-domain.com.']);
    mockResolve4.mockResolvedValue(['1.2.3.4']);
    const result = await validateDomain('app.example.com', '1.2.3.4', 'dequel.sh');
    expect(result).toBe(true);
  });

  it('returns true when A records exist (no baseDomain)', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.1', '10.0.0.2']);
    const result = await validateDomain('app.example.com', '1.2.3.4');
    expect(result).toBe(true);
  });

  it('returns true when A records exist with baseDomain', async () => {
    mockResolveCname.mockRejectedValue(new Error('No CNAME'));
    mockResolve4.mockResolvedValue(['10.0.0.1']);
    const result = await validateDomain('app.example.com', '10.0.0.1', 'dequel.sh');
    expect(result).toBe(true);
  });

  it('returns false when CNAME and A record checks both fail', async () => {
    mockResolveCname.mockRejectedValue(new Error('No CNAME'));
    mockResolve4.mockRejectedValue(new Error('No A records'));
    const result = await validateDomain('app.example.com', '1.2.3.4', 'dequel.sh');
    expect(result).toBe(false);
  });

  it('returns false when CNAME resolves but does not match and no A records', async () => {
    mockResolveCname.mockResolvedValue(['other.com.']);
    mockResolve4.mockRejectedValue(new Error('No A records'));
    const result = await validateDomain('app.example.com', '1.2.3.4', 'dequel.sh');
    expect(result).toBe(false);
  });

  it('returns false when no DNS records at all', async () => {
    mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
    const result = await validateDomain('nonexistent.domain', '1.2.3.4');
    expect(result).toBe(false);
  });

  it('returns true when A records exist even if CNAME errors', async () => {
    mockResolveCname.mockRejectedValue(new Error('queryCname ENODATA'));
    mockResolve4.mockResolvedValue(['1.2.3.4']);
    const result = await validateDomain('app.example.com', '1.2.3.4', 'dequel.sh');
    expect(result).toBe(true);
  });
});

describe('resolveServerIp', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns IP from api.ipify.org', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({ text: () => Promise.resolve('203.0.113.42') })
    ) as typeof fetch;
    const ip = await resolveServerIp();
    expect(ip).toBe('203.0.113.42');
  });

  it('falls back to 127.0.0.1 on fetch failure', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as typeof fetch;
    const ip = await resolveServerIp();
    expect(ip).toBe('127.0.0.1');
  });
});
