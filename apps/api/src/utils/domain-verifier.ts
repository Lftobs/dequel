import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { config } from './config';
import { validateDomain, resolveServerIp } from './dns';
import { getDb } from '../db/db-provider';
import { domains } from '../db/schema';
import { getProjectById, listDomains, updateDomainValidation, listEnvironmentVariablesForDeploy } from '../db/repo';
import { reloadCaddy } from '../orchestrator/runtime';

const POLL_INTERVAL = 30_000;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);

let handle: ReturnType<typeof setInterval> | null = null;

export const startDomainPolling = () => {
  if (handle) return;
  poll();
  reconcileVerifiedDomains();
  handle = setInterval(poll, POLL_INTERVAL);
};

export const stopDomainPolling = () => {
  if (handle) { clearInterval(handle); handle = null; }
};

const reconcileVerifiedDomains = async () => {
  try {
    const db = await getDb();
    const rows = await db.select({
      id: domains.id,
      projectId: domains.projectId,
      domain: domains.domain,
    }).from(domains).where(eq(domains.validationStatus, 'verified')).execute();
    for (const row of rows) {
      try {
        const project = await getProjectById(row.projectId);
        await addToCaddyRoute(row.domain, row.projectId, project?.name ?? '');
      } catch (e) {
        console.error(`Caddy reconciliation failed for ${row.domain}:`, e);
      }
    }
  } catch (e) {
    console.error('Caddy reconciliation failed:', e);
  }
};

const poll = async () => {
  try {
    const db = await getDb();
    const rows = await db.select({
      id: domains.id,
      projectId: domains.projectId,
      domain: domains.domain,
    }).from(domains).where(
      sql`${domains.validationStatus} IN ('pending', 'failed')`
    ).execute();
    if (!rows.length) return;

    const serverIp = await resolveServerIp();
    if (!serverIp) return;

    for (const row of rows) {
      try {
        const project = await getProjectById(row.projectId);
        const valid = await validateDomain(row.domain, serverIp, project?.baseDomain);
        if (valid) {
          await updateDomainValidation(row.id, 'verified', 'provisioned');
          await addToCaddyRoute(row.domain, row.projectId, project?.name ?? '');
        }
      } catch (e) {
        console.error(`Domain verification failed for ${row.domain}:`, e);
      }
    }
  } catch (e) {
    console.error('Domain polling failed:', e);
  }
};

export interface CaddyRouteOpts {
  routesDir?: string;
  reloadFn?: () => Promise<void>;
}

export const addToCaddyRoute = async (
  domain: string,
  projectId: string,
  projectName: string,
  opts?: CaddyRouteOpts,
) => {
  const routesDir = opts?.routesDir ?? config.caddyRoutesDir;
  const reloadFn = opts?.reloadFn ?? reloadCaddy;
  const slug = slugify(projectName || projectId);
  const filePath = join(routesDir, `${slug}.caddy`);

  try {
    let content = readFileSync(filePath, 'utf8');
    const idx = content.indexOf(' {\n');
    if (idx === -1) return;

    const firstLine = content.slice(0, idx);
    if (firstLine.includes(domain)) return;

    const entry = domain.includes('localhost') ? `${domain}:80` : domain;
    content = `${firstLine}, ${entry}${content.slice(idx)}`;
    writeFileSync(filePath, content, 'utf8');
    await reloadFn();
  } catch (e) {
    console.warn(`Could not add ${domain} to Caddy route (deploy the project first):`, e instanceof Error ? e.message : e);
  }
};

export const removeFromCaddyRoute = async (
  domain: string,
  projectId: string,
  projectName: string,
  opts?: CaddyRouteOpts,
) => {
  const routesDir = opts?.routesDir ?? config.caddyRoutesDir;
  const reloadFn = opts?.reloadFn ?? reloadCaddy;
  const slug = slugify(projectName || projectId);
  const filePath = join(routesDir, `${slug}.caddy`);

  try {
    let content = readFileSync(filePath, 'utf8');
    const idx = content.indexOf(' {\n');
    if (idx === -1) return;

    const firstLine = content.slice(0, idx);
    if (!firstLine.includes(domain)) return;

    const ports = [':80', ':443', ''];
    let replaced = false;
    for (const port of ports) {
      const needle = `, ${domain}${port}`;
      if (firstLine.includes(needle)) {
        content = content.replace(needle, '');
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      const bare = domain;
      if (firstLine.includes(bare)) {
        content = content.replace(bare, '');
      }
    }
    writeFileSync(filePath, content, 'utf8');
    await reloadFn();
  } catch {
    // Caddy file doesn't exist yet
  }
};

export interface BuildSnippetOpts {
  baseDomain?: string;
  listEnvVarsFn?: typeof listEnvironmentVariablesForDeploy;
}

export const buildCaddySnippet = async (
  slug: string,
  containerName: string,
  projectId?: string,
  listDomainsFn: typeof listDomains = listDomains,
  appPort?: number,
  opts?: BuildSnippetOpts,
): Promise<string> => {
  const baseDomainRaw = opts?.baseDomain ?? config.caddyBaseDomain;
  const baseDomain = baseDomainRaw === 'localhost' ? `${baseDomainRaw}:80` : baseDomainRaw;
  const listEnvVars = opts?.listEnvVarsFn ?? listEnvironmentVariablesForDeploy;
  let defaultDomains = [`${slug}.${baseDomain}`];
  let port = appPort ?? config.appInternalPort;
  const customBlocks: string[] = [];

  if (projectId) {
    const projectDomains = await listDomainsFn(projectId);
    const verified = projectDomains.filter(d => d.validationStatus === 'verified');
    for (const d of verified) {
      const entryDomain = d.domain.includes('localhost') ? `${d.domain}:80` : d.domain;
      if (d.targetService || d.targetPort) {
        let targetContainer = containerName;
        if (d.targetService) {
          const parts = containerName.split('-');
          if (parts.length >= 3) {
            parts[parts.length - 2] = d.targetService;
            targetContainer = parts.join('-');
          }
        }
        const tPort = d.targetPort || port;
        customBlocks.push(`${entryDomain} {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy ${targetContainer}:${tPort} {\n    header_up Host {upstream_hostport}\n  }\n}\n`);
      } else {
        if (!defaultDomains.includes(entryDomain)) defaultDomains.push(entryDomain);
      }
    }

    try {
      const envVars = await listEnvVars(projectId);
      const portVar = envVars.find(v => v.key === 'PORT');
      if (portVar && portVar.value && !appPort) {
        const parsedPort = Number(portVar.value);
        if (!isNaN(parsedPort) && parsedPort > 0) {
          port = parsedPort;
        }
      }
    } catch (e) {
      console.warn(`Could not read environment variables for Caddy snippet for project ${projectId}:`, e);
    }
  }

  if (defaultDomains.length === 0 || defaultDomains.every(d => !d.trim())) {
    defaultDomains = [`${slug}.${baseDomain}`];
  }

  const primaryBlock = `${defaultDomains.join(', ')} {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy ${containerName}:${port} {\n    header_up Host {upstream_hostport}\n  }\n}\n`;

  return [primaryBlock, ...customBlocks].join('\n');
};
