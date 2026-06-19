import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config';
import { validateDomain, resolveServerIp } from './dns';
import { getDb } from '../db/client';
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
    const rows = db.query(
      "SELECT id, project_id, domain FROM domains WHERE validation_status = 'verified'"
    ).all() as { id: string; project_id: string; domain: string }[];
    for (const row of rows) {
      try {
        const project = await getProjectById(row.project_id);
        await addToCaddyRoute(row.domain, row.project_id, project?.name ?? '');
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
    const rows = db.query(
      "SELECT id, project_id, domain FROM domains WHERE validation_status IN ('pending', 'failed')"
    ).all() as { id: string; project_id: string; domain: string }[];
    if (!rows.length) return;

    const serverIp = await resolveServerIp();
    if (!serverIp) return;

    for (const row of rows) {
      try {
        const project = await getProjectById(row.project_id);
        const valid = await validateDomain(row.domain, serverIp, project?.baseDomain);
        if (valid) {
          await updateDomainValidation(row.id, 'verified', 'provisioned');
          await addToCaddyRoute(row.domain, row.project_id, project?.name ?? '');
        }
      } catch (e) {
        console.error(`Domain verification failed for ${row.domain}:`, e);
      }
    }
  } catch (e) {
    console.error('Domain polling failed:', e);
  }
};

export const addToCaddyRoute = async (domain: string, projectId: string, projectName: string) => {
  const slug = slugify(projectName || projectId);
  const filePath = join(config.caddyRoutesDir, `${slug}.caddy`);

  try {
    let content = await readFile(filePath, 'utf8');
    const idx = content.indexOf(' {\n');
    if (idx === -1) return;

    const firstLine = content.slice(0, idx);
    if (firstLine.includes(domain)) return;

    content = `${firstLine}, ${domain}:80${content.slice(idx)}`;
    await writeFile(filePath, content, 'utf8');
    await reloadCaddy();
  } catch (e) {
    console.warn(`Could not add ${domain} to Caddy route (deploy the project first):`, e instanceof Error ? e.message : e);
  }
};

export const removeFromCaddyRoute = async (domain: string, projectId: string, projectName: string) => {
  const slug = slugify(projectName || projectId);
  const filePath = join(config.caddyRoutesDir, `${slug}.caddy`);

  try {
    let content = await readFile(filePath, 'utf8');
    const idx = content.indexOf(' {\n');
    if (idx === -1) return;

    const firstLine = content.slice(0, idx);
    if (!firstLine.includes(domain)) return;

    content = content.replace(`, ${domain}:80`, '').replace(`, ${domain}`, '').replace(domain, '');
    await writeFile(filePath, content, 'utf8');
    await reloadCaddy();
  } catch {
    // Caddy file doesn't exist yet
  }
};

export const buildCaddySnippet = async (
  slug: string,
  containerName: string,
  projectId?: string,
  listDomainsFn: typeof listDomains = listDomains,
  appPort?: number,
): Promise<string> => {
  const baseDomain = config.caddyBaseDomain === 'localhost' ? `${config.caddyBaseDomain}:80` : config.caddyBaseDomain;
  let domains = [`${slug}.${baseDomain}`];
  let port = appPort ?? config.appInternalPort;

  if (projectId) {
    const projectDomains = await listDomainsFn(projectId);
    const verified = projectDomains.filter(d => d.validationStatus === 'verified');
    for (const d of verified) {
      const withPort = `${d.domain}:80`;
      if (!domains.includes(withPort)) domains.push(withPort);
    }

    try {
      const envVars = await listEnvironmentVariablesForDeploy(projectId);
      const portVar = envVars.find(v => v.key === 'PORT');
      if (portVar && portVar.value) {
        const parsedPort = Number(portVar.value);
        if (!isNaN(parsedPort) && parsedPort > 0) {
          port = parsedPort;
        }
      }
    } catch (e) {
      console.warn(`Could not read environment variables for Caddy snippet for project ${projectId}:`, e);
    }
  }

  return `${domains.join(', ')} {\n  log {\n    output stdout\n    format json\n  }\n  reverse_proxy ${containerName}:${port}\n}\n`;
};
