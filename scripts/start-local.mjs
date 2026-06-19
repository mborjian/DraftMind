import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import {
  assertNodeVersion,
  ensureDirectory,
  loadEnvFileIntoProcess,
  resolveConfiguredPath,
  resolveFromWorkspaceRoot,
  resolvePnpmCommand,
  spawnCommand,
} from './common.mjs';

const envPath = resolveFromWorkspaceRoot('.env');

async function main() {
  assertNodeVersion();

  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env. Run `npm run first-start` first.');
  }

  const envValues = loadEnvFileIntoProcess(envPath);
  ensureValidEncryptionKey(envValues.APP_ENCRYPTION_KEY);
  ensureRuntimeDirectories(envValues);

  const pnpm = resolvePnpmCommand();
  const child = spawnCommand(pnpm.command, [...pnpm.argsPrefix, 'run', 'dev:services'], {
    env: {
      ...process.env,
      ...envValues,
    },
  });

  forwardSignals(child);
  const [exitCode] = await once(child, 'exit');
  process.exit(exitCode ?? 0);
}

function ensureValidEncryptionKey(configuredKey) {
  if (!configuredKey?.trim()) {
    throw new Error('APP_ENCRYPTION_KEY is missing from .env. Run `npm run first-start` again.');
  }

  if (!/^[0-9a-fA-F]{64}$/u.test(configuredKey.trim())) {
    throw new Error('APP_ENCRYPTION_KEY in .env must be 64 hexadecimal characters.');
  }
}

function ensureRuntimeDirectories(envValues) {
  const dataDirectory = resolveConfiguredPath(envValues.APP_DATA_DIRECTORY, './data');
  const databasePath = resolveConfiguredPath(envValues.DATABASE_PATH, './data/app.db');

  ensureDirectory(dataDirectory);
  ensureDirectory(path.dirname(databasePath));
  ensureDirectory(path.join(dataDirectory, 'backups'));
  ensureDirectory(path.join(dataDirectory, 'exports'));
  ensureDirectory(path.join(dataDirectory, 'logs'));
}

function forwardSignals(child) {
  const relay = (signal) => {
    if (child.exitCode === null) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => relay('SIGINT'));
  process.on('SIGTERM', () => relay('SIGTERM'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
