import { WorktreeConfig } from './models.js'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback
}

export function normalizeConfig(raw: unknown): WorktreeConfig {
  const r = asRecord(raw)
  return {
    dirName: str(r.dirName, '.dsh-worktrees'),
    branchPrefix: str(r.branchPrefix, 'dsh-wt/'),
    gitPath: str(r.gitPath, 'git'),
  }
}
