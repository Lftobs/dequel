import { spawn } from 'node:child_process';

export const run = (cmd: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('close', (code) => {
      if (code === 0) resolve((stdout + '\n' + stderr).trim());
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${code}): ${stderr}`));
    });
  });

export const tryRun = (cmd: string, args: string[]) =>
  run(cmd, args).catch(() => '');
