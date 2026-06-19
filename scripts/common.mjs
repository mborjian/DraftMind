import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = path.resolve(scriptDirectory, '..');
const windowsShellCommands = new Set(['npm', 'npx', 'pnpm', 'pnpm-store', 'corepack']);

const packageJsonPath = path.join(workspaceRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

export function assertNodeVersion(minimumMajor = 22) {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < minimumMajor) {
    throw new Error(`Node.js ${minimumMajor}+ is required. Current version: ${process.versions.node}.`);
  }
}

export function resolveFromWorkspaceRoot(...segments) {
  return path.join(workspaceRoot, ...segments);
}

export function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function resolveConfiguredPath(configuredValue, fallbackValue) {
  const value = (configuredValue?.trim() || fallbackValue).replace(/^\.\//, '');
  return path.isAbsolute(value) ? value : path.join(workspaceRoot, value);
}

export function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    values[key] = value;
  }

  return values;
}

export function loadEnvFileIntoProcess(filePath) {
  const values = readEnvFile(filePath);
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return values;
}

function resolveExecutable(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (path.extname(command)) {
    return command;
  }

  if (['npm', 'npx', 'pnpm', 'pnpm-store', 'corepack'].includes(command)) {
    return `${command}.cmd`;
  }

  return command;
}

function shouldUseWindowsCommandShell(command) {
  return process.platform === 'win32' && windowsShellCommands.has(command);
}

function quoteWindowsArg(value) {
  if (!/[ \t"&()^<>|]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/gu, '""')}"`;
}

function createInvocation(command, args) {
  if (shouldUseWindowsCommandShell(command)) {
    const script = [resolveExecutable(command), ...args].map(quoteWindowsArg).join(' ');
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', script],
    };
  }

  return {
    command: resolveExecutable(command),
    args,
  };
}

function canRun(command, args) {
  try {
    const invocation = createInvocation(command, args);
    const result = spawnSync(invocation.command, invocation.args, {
      cwd: workspaceRoot,
      stdio: 'ignore',
      shell: false,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

export function resolvePnpmCommand() {
  if (canRun('pnpm', ['--version'])) {
    return { command: 'pnpm', argsPrefix: [], label: 'pnpm' };
  }

  if (canRun('corepack', ['--version'])) {
    const packageManager = String(packageJson.packageManager || 'pnpm');
    return { command: 'corepack', argsPrefix: [packageManager.split('@')[0]], label: 'corepack pnpm' };
  }

  throw new Error('pnpm is required. Install Node.js with Corepack support or install pnpm manually.');
}

export function runCommand(command, args, options = {}) {
  const invocation = createInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${command} ${args.join(' ')}`);
  }
}

export function spawnCommand(command, args, options = {}) {
  const invocation = createInvocation(command, args);
  return spawn(invocation.command, invocation.args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
}

export function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
