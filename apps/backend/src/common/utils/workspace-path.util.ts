import { existsSync } from 'node:fs';
import path from 'node:path';

export function findWorkspaceRoot(startDirectory: string = process.cwd()): string {
  let current = path.resolve(startDirectory);

  while (!existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(current);
    if (parent === current) {
      return startDirectory;
    }
    current = parent;
  }

  return current;
}

export function resolveFromWorkspaceRoot(...segments: string[]): string {
  return path.join(findWorkspaceRoot(), ...segments);
}
