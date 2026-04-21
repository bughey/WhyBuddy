import fs from 'fs';
import path from 'path';

import {
  ensureAgentWorkspace,
  getAgentWorkspaceScopeDir,
  type AgentWorkspaceScope,
} from '../memory/workspace.js';

function isAbsoluteWorkspacePath(candidatePath: string): boolean {
  return (
    path.isAbsolute(candidatePath) ||
    path.win32.isAbsolute(candidatePath) ||
    /^[a-zA-Z]:/.test(candidatePath)
  );
}

function normalizeWorkspaceRelativePath(relativePath: string): string {
  const normalizedInput = relativePath.trim();
  if (!normalizedInput) {
    throw new Error('Workspace path is required');
  }

  if (isAbsoluteWorkspacePath(normalizedInput)) {
    throw new Error(`Absolute workspace paths are not allowed: ${relativePath}`);
  }

  const safeSegments: string[] = [];

  for (const segment of normalizedInput.split(/[\\/]+/)) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (safeSegments.length === 0) {
        throw new Error(`Workspace path escapes the agent workspace: ${relativePath}`);
      }

      safeSegments.pop();
      continue;
    }

    safeSegments.push(segment);
  }

  if (safeSegments.length === 0) {
    throw new Error(`Workspace path must reference a file: ${relativePath}`);
  }

  return path.join(...safeSegments);
}

function assertInsideBaseDir(baseDir: string, candidatePath: string): void {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidatePath);

  if (
    resolvedCandidate !== resolvedBase &&
    !resolvedCandidate.startsWith(`${resolvedBase}${path.sep}`)
  ) {
    throw new Error(`Workspace access denied: ${candidatePath}`);
  }
}

export function resolveAgentWorkspacePath(
  agentId: string,
  relativePath: string,
  scope: AgentWorkspaceScope = 'root'
): string {
  ensureAgentWorkspace(agentId);
  const baseDir = getAgentWorkspaceScopeDir(agentId, scope);
  const safeRelativePath = normalizeWorkspaceRelativePath(relativePath);
  const resolvedPath = path.resolve(baseDir, safeRelativePath);
  assertInsideBaseDir(baseDir, resolvedPath);
  return resolvedPath;
}

export function readAgentWorkspaceFile(
  agentId: string,
  relativePath: string,
  scope: AgentWorkspaceScope = 'root'
): string | null {
  const filePath = resolveAgentWorkspacePath(agentId, relativePath, scope);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf-8');
}

export function writeAgentWorkspaceFile(
  agentId: string,
  relativePath: string,
  content: string,
  scope: AgentWorkspaceScope = 'root'
): string {
  const filePath = resolveAgentWorkspacePath(agentId, relativePath, scope);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function appendAgentWorkspaceFile(
  agentId: string,
  relativePath: string,
  content: string,
  scope: AgentWorkspaceScope = 'root'
): string {
  const filePath = resolveAgentWorkspacePath(agentId, relativePath, scope);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function agentWorkspaceFileExists(
  agentId: string,
  relativePath: string,
  scope: AgentWorkspaceScope = 'root'
): boolean {
  const filePath = resolveAgentWorkspacePath(agentId, relativePath, scope);
  return fs.existsSync(filePath);
}
