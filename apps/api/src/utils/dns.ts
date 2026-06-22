import { promises as dns } from 'node:dns';
import { config } from './config';

export const resolveServerIp = async (): Promise<string> => {
  try {
    const resp = await fetch('https://api.ipify.org');
    return (await resp.text()).trim();
  } catch {
    return '127.0.0.1';
  }
};

export type BaseDomainStatus = {
  ip: string;
  baseDomain: string;
  resolves: boolean;
  url: string;
};

export const checkBaseDomainStatus = async (): Promise<BaseDomainStatus> => {
  const ip = await resolveServerIp();
  const baseDomain = config.caddyBaseDomain;
  const isLocalhost = baseDomain === 'localhost';

  let resolves = false;
  if (!isLocalhost) {
    try {
      const addresses = await dns.resolve4(baseDomain);
      resolves = addresses.includes(ip);
    } catch {}
  } else {
    resolves = true;
  }

  const url = isLocalhost || resolves
    ? `${isLocalhost ? 'http' : 'https'}://${baseDomain}${isLocalhost ? ':80' : ''}`
    : `http://${ip}`;

  return { ip, baseDomain, resolves, url };
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
