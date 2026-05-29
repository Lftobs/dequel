import { mkdir, rm, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../utils/config';

const ensureSingleRoot = async (root: string): Promise<string> => {
  const entries = await readdir(root, { withFileTypes: true });
  const valid = entries.filter((e) => !e.name.startsWith('.') && e.name !== '__MACOSX');

  if (valid.length === 1 && valid[0].isDirectory()) {
    return join(root, valid[0].name);
  }
  return root;
};

const run = (cmd: string, args: string[], cwd?: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
      }
    });
  });

export const prepareSourceWorkspace = async (deploymentId: string, gitUrl: string, branch?: string) => {
  const root = join(config.workspaceRoot, deploymentId);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const args = ['clone', '--depth', '1'];
  if (branch) args.push('--branch', branch);
  args.push(gitUrl, root);
  await run('git', args);
  return root;
};

export const prepareUploadWorkspace = async (deploymentId: string, archivePath: string) => {
  const root = join(config.workspaceRoot, deploymentId);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });

  if (archivePath.endsWith('.zip')) {
    await run('unzip', ['-q', archivePath, '-d', root]);
    return ensureSingleRoot(root);
  }

  if (
    archivePath.endsWith('.tar') ||
    archivePath.endsWith('.tar.gz') ||
    archivePath.endsWith('.tgz')
  ) {
    await run('tar', ['-xf', archivePath, '-C', root]);
    return ensureSingleRoot(root);
  }

  throw new Error('Unsupported archive format. Use .zip, .tar, .tar.gz, or .tgz');
};

export const getHeadSha = async (repoPath: string): Promise<string | null> => {
  try {
    let output = '';
    const child = spawn('git', ['rev-parse', 'HEAD'], { cwd: repoPath });
    for await (const chunk of child.stdout) output += String(chunk);
    await new Promise<void>((resolve, reject) => child.on('close', code => code === 0 ? resolve() : reject()));
    return output.trim() || null;
  } catch { return null; }
};

export const getRemoteSha = async (gitUrl: string, branch?: string): Promise<string | null> => {
  try {
    let output = '';
    const ref = branch ? `refs/heads/${branch}` : 'HEAD';
    const child = spawn('git', ['ls-remote', gitUrl, ref]);
    for await (const chunk of child.stdout) output += String(chunk);
    await new Promise<void>((resolve, reject) => child.on('close', code => code === 0 ? resolve() : reject()));
    const match = output.trim().split(/\s+/)[0];
    return match || null;
  } catch { return null; }
};

export const cleanupWorkspace = async (workspacePath: string) => {
  await rm(workspacePath, { recursive: true, force: true });

  const parent = dirname(workspacePath);
  const rel = relative(config.workspaceRoot, parent);
  if (rel && !rel.startsWith('..') && !rel.includes('/')) {
    await rm(parent, { recursive: true, force: true });
  }
};
