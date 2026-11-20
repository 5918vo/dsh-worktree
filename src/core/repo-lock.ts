import { TaskError } from './errors.js'

export function normalizeRepoKey(repoPath: string): string {
  return repoPath.replace(/[\\/]+$/, '').toLowerCase()
}

/**
 * 仓库级 Git 写操作互斥锁。
 * 同一主仓库下同时只允许一个写操作（merge/checkout/back/cleanup），防止钩子执行期间并发损坏工作区。
 */
export class RepoLockManager {
  private readonly activeOps = new Map<string, string>()

  isLocked(repoPath: string): boolean {
    return this.activeOps.has(normalizeRepoKey(repoPath))
  }

  getActiveLabel(repoPath: string): string | undefined {
    return this.activeOps.get(normalizeRepoKey(repoPath))
  }

  async run<T>(repoPath: string, label: string, fn: () => Promise<T>): Promise<T> {
    const key = normalizeRepoKey(repoPath)
    const active = this.activeOps.get(key)
    if (active) {
      throw new TaskError(`主仓库正在执行「${active}」，请等待完成后再操作`, 409, 'repo-busy')
    }
    this.activeOps.set(key, label)
    try {
      return await fn()
    } finally {
      if (this.activeOps.get(key) === label) {
        this.activeOps.delete(key)
      }
    }
  }
}
