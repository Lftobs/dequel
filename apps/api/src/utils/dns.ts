import { promises as dns } from 'node:dns';

export const resolveServerIp = async (): Promise<string> => {
  try {
    const resp = await fetch('https://api.ipify.org');
    return (await resp.text()).trim();
  } catch {
    return '127.0.0.1';
  }
};

export const validateDomain = async (
  domain: string,
  serverIp: string,
  baseDomain?: string | null,
): Promise<boolean> => {
  if (baseDomain) {
    try {
      const cnames = await dns.resolveCname(domain);
      for (const cname of cnames) {
        if (cname.toLowerCase().includes(baseDomain.toLowerCase())) return true;
      }
    } catch {}
  }

  try {
    const addresses = await dns.resolve4(domain);
    if (addresses.length > 0) return true;
  } catch {}

  return false;
};
