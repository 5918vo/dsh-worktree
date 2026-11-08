import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** Create an isolated temp directory (cleaned up by each test's after() hook). */
export async function mkTempDir(prefix = 'dshw-test-'): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), prefix))
}

export async function rmrf(dir: string): Promise<void> {
  // maxRetries/retryDelay handle the brief Windows ENOTEMPTY/EBUSY window when a
  // debounced store flush is still writing into the temp directory.
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
}

/** Run git with an args array (no shell quoting) and resolve stdout. */
export function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, ...(env || {}) } },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`git ${args.join(' ')} failed: ${String(stderr || error.message)}`))
        else resolve(String(stdout ?? ''))
      },
    )
  })
}

/** Create a real git repo on `main` with one initial commit. */
export async function initRepo(dir: string, branch = 'main'): Promise<void> {
  await git(dir, ['init', '-b', branch])
  await git(dir, ['config', 'user.email', 'test@example.com'])
  await git(dir, ['config', 'user.name', 'DSHW Test'])
  await git(dir, ['config', 'commit.gpgsign', 'false'])
  await fs.writeFile(join(dir, 'README.md'), '# test repo\n', 'utf8')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'init'])
}

/** Write a file and commit it — used to simulate agent work in a worktree. */
export async function commitFile(dir: string, rel: string, content: string, message = 'change'): Promise<void> {
  const abs = join(dir, rel)
  await fs.mkdir(dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, 'utf8')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', message])
}

export async function exists(dir: string): Promise<boolean> {
  try {
    await fs.stat(dir)
    return true
  } catch {
    return false
  }
}
