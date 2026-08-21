import { config } from './config';

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);

export const baseDomainFor = () =>
  config.caddyBaseDomain === 'localhost' ? 'localhost:80' : config.caddyBaseDomain;

export const routeNamesFor = (projectName: string | null, projectId: string | null, deploymentId: string) => {
  const slug = slugify(projectName || projectId || deploymentId);
  return {
    slug,
    hostname: `${slug}.${baseDomainFor()}`,
    routeFile: `${slug}.caddy`,
  };
};