import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import {
  assertNodeVersion,
  ensureDirectory,
  loadEnvFileIntoProcess,
  readEnvFile,
  resolveConfiguredPath,
  resolveFromWorkspaceRoot,
  resolvePnpmCommand,
  runCommand,
  spawnCommand,
  wait,
} from './common.mjs';

const envPath = resolveFromWorkspaceRoot('.env');
const envExamplePath = resolveFromWorkspaceRoot('.env.example');

async function main() {
  assertNodeVersion();

  console.log('Preparing DraftMind first start...');
  ensureEnvironmentFile();
  const envValues = loadEnvFileIntoProcess(envPath);
  ensureValidEncryptionKey(envValues);
  ensureRuntimeDirectories(envValues);
  maybeCopyExampleDatabase(envValues);

  const pnpm = resolvePnpmCommand();
  console.log(`Installing dependencies with ${pnpm.label}...`);
  runCommand(pnpm.command, [...pnpm.argsPrefix, 'install']);

  console.log('Building backend...');
  runCommand(pnpm.command, [...pnpm.argsPrefix, '--filter', '@draftmind/backend', 'build']);

  console.log('Initializing SQLite schema and default records...');
  await initializeDatabase(envValues);

  console.log('');
  console.log('DraftMind is ready for local use.');
  console.log('Next command: npm run start');
  console.log('Frontend URL: http://localhost:3000');
  console.log(`Backend URL: ${envValues.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1'}`);
}

function ensureEnvironmentFile() {
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('Created .env from .env.example.');
    } else {
      fs.writeFileSync(envPath, '', 'utf8');
      console.log('Created empty .env file.');
    }
  }

  const templateValues = readEnvFile(envExamplePath);
  const currentValues = readEnvFile(envPath);
  let content = fs.readFileSync(envPath, 'utf8');
  let changed = false;

  for (const [key, value] of Object.entries(templateValues)) {
    if (currentValues[key] !== undefined) {
      continue;
    }

    content = appendEnvValue(content, key, value);
    changed = true;
  }

  const currentKey = currentValues.APP_ENCRYPTION_KEY?.trim();
  if (!currentKey || currentKey === 'replace-with-a-64-character-hex-key') {
    content = upsertEnvValue(content, 'APP_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(envPath, normalizeTrailingNewline(content), 'utf8');
  }
}

function ensureValidEncryptionKey(envValues) {
  const configuredKey = envValues.APP_ENCRYPTION_KEY?.trim();
  if (!configuredKey) {
    throw new Error('APP_ENCRYPTION_KEY is missing from .env.');
  }

  if (!/^[0-9a-fA-F]{64}$/u.test(configuredKey)) {
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

function maybeCopyExampleDatabase(envValues) {
  const databasePath = resolveConfiguredPath(envValues.DATABASE_PATH, './data/app.db');
  if (fs.existsSync(databasePath)) {
    console.log(`Database already exists at ${databasePath}.`);
    return;
  }

  const exampleCandidates = [
    resolveFromWorkspaceRoot('data', 'app.example.db'),
    resolveFromWorkspaceRoot('data', 'example.db'),
    resolveFromWorkspaceRoot('data', 'app.template.db'),
  ];

  const exampleDatabasePath = exampleCandidates.find((candidate) => fs.existsSync(candidate));
  if (!exampleDatabasePath) {
    console.log('No committed example database was found. A fresh SQLite database will be created during backend bootstrap.');
    return;
  }

  fs.copyFileSync(exampleDatabasePath, databasePath);
  console.log(`Copied example database from ${exampleDatabasePath}.`);
}

async function initializeDatabase(envValues) {
  const bootstrapPort = await findAvailablePort();
  const child = spawnCommand('node', ['apps/backend/dist/main.js'], {
    env: {
      ...process.env,
      ...envValues,
      BACKEND_PORT: String(bootstrapPort),
    },
  });

  try {
    await waitForHealth(child, bootstrapPort);
  } finally {
    await stopProcess(child);
  }
}

async function waitForHealth(child, port) {
  const healthUrl = `http://127.0.0.1:${port}/api/v1/health`;
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Backend bootstrap exited before becoming healthy (exit code ${child.exitCode}).`);
    }

    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the backend starts or times out.
    }

    await wait(1000);
  }

  throw new Error(`Backend bootstrap did not become healthy within 60 seconds at ${healthUrl}.`);
}

async function stopProcess(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');
  const exitedGracefully = await Promise.race([
    once(child, 'exit').then(() => true),
    wait(5000).then(() => false),
  ]);

  if (exitedGracefully) {
    return;
  }

  if (process.platform === 'win32') {
    try {
      runCommand('taskkill', ['/pid', String(child.pid), '/t', '/f']);
    } catch {
      child.kill('SIGKILL');
    }
  } else {
    child.kill('SIGKILL');
  }

  await once(child, 'exit').catch(() => undefined);
}

function appendEnvValue(content, key, value) {
  const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  return `${content}${prefix}${key}=${value}\n`;
}

function upsertEnvValue(content, key, value) {
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, 'mu');
  if (pattern.test(content)) {
    return content.replace(pattern, `${key}=${value}`);
  }

  return appendEnvValue(content, key, value);
}

function normalizeTrailingNewline(content) {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a bootstrap port.')));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
