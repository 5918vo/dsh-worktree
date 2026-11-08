// src/config.ts
function asRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function str(v, fallback) {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}
function normalizeConfig(raw) {
  const r = asRecord(raw);
  return {
    dirName: str(r.dirName, ".dsh-worktrees"),
    branchPrefix: str(r.branchPrefix, "dsh-wt/"),
    gitPath: str(r.gitPath, "git")
  };
}

// src/store.ts
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
function stateDir() {
  const explicit = process.env.DSH_WORKTREE_STATE_DIR;
  if (explicit) return explicit;
  const profileDir = process.env.DSH_PROFILE_DIR;
  if (profileDir) return join(profileDir, "deepseek-worktree");
  return join(homedir(), ".dsh", "worktree-tasks");
}
async function readJson(file, fallback) {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
async function writeJson(file, value) {
  await fs.mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 384 });
  for (let i = 0; i < 5; i++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch {
      await new Promise((resolve2) => setTimeout(resolve2, 50 * (i + 1)));
    }
  }
  try {
    await fs.writeFile(file, JSON.stringify(value, null, 2), { encoding: "utf8" });
  } catch {
  }
  try {
    await fs.rm(tmp, { force: true });
  } catch {
  }
}
var Store = class {
  dir;
  projects = /* @__PURE__ */ new Map();
  tasks = /* @__PURE__ */ new Map();
  recents = [];
  saveTimer = null;
  constructor(dir = stateDir()) {
    this.dir = dir;
  }
  file(name) {
    return join(this.dir, name);
  }
  async load() {
    const projects = await readJson(this.file("projects.json"), {});
    this.projects = new Map(Object.entries(projects));
    const tasks = await readJson(this.file("tasks.json"), {});
    this.tasks = new Map(Object.entries(tasks));
    this.recents = await readJson(this.file("recents.json"), []);
  }
  directory() {
    return this.dir;
  }
  // ---- projects ----
  listProjects() {
    return [...this.projects.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  getProject(id) {
    return this.projects.get(id);
  }
  findProjectByRepo(repoPath) {
    const norm = repoPath.replace(/[\\/]+$/, "").toLowerCase();
    return this.listProjects().find((p) => p.repoPath.replace(/[\\/]+$/, "").toLowerCase() === norm);
  }
  putProject(project) {
    this.projects.set(project.id, project);
    this.scheduleSave();
  }
  deleteProject(id) {
    const ok = this.projects.delete(id);
    if (ok) this.scheduleSave();
    return ok;
  }
  // ---- tasks ----
  listTasks() {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
  }
  listTasksOfProject(projectId) {
    return this.listTasks().filter((t) => t.projectId === projectId);
  }
  getTask(id) {
    return this.tasks.get(id);
  }
  putTask(task) {
    task.updatedAt = Date.now();
    this.tasks.set(task.id, task);
    this.scheduleSave();
  }
  deleteTask(id) {
    const ok = this.tasks.delete(id);
    if (ok) this.scheduleSave();
    return ok;
  }
  // ---- misc ----
  listRecents() {
    return [...this.recents];
  }
  addRecent(dir) {
    const norm = dir.replace(/[\\/]+$/, "");
    this.recents = [norm, ...this.recents.filter((d) => d !== norm)].slice(0, 10);
    this.scheduleSave();
  }
  clearRecents() {
    this.recents = [];
    this.scheduleSave();
  }
  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.flush();
    }, 300);
  }
  async flush() {
    try {
      const projects = Object.fromEntries(this.projects);
      const tasks = Object.fromEntries(this.tasks);
      await Promise.all([
        writeJson(this.file("projects.json"), projects),
        writeJson(this.file("tasks.json"), tasks),
        writeJson(this.file("recents.json"), this.recents)
      ]);
    } catch {
    }
  }
  dispose() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    void this.flush();
  }
};

// src/runtime.ts
import { randomUUID } from "node:crypto";
import { promises as fs3 } from "node:fs";
import { basename, isAbsolute, join as join3, resolve } from "node:path";

// src/gitx.ts
import { execFile } from "node:child_process";
import { promises as fs2 } from "node:fs";
import { dirname as dirname2, join as join2 } from "node:path";
var GitError = class extends Error {
  args;
  stderr;
  exitCode;
  constructor(args, stderr, exitCode) {
    super(`git ${args.join(" ")} failed: ${stderr.trim() || "(no stderr)"}`);
    this.name = "GitError";
    this.args = args;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
};
function run(gitPath, cwd, args, timeoutMs = 12e4) {
  return new Promise((resolve2, reject) => {
    execFile(
      gitPath,
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          const code = typeof error.code === "number" ? error.code : null;
          reject(new GitError(args, String(stderr || error.message || ""), code));
          return;
        }
        resolve2({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      }
    );
  });
}
async function tryRun(gitPath, cwd, args) {
  try {
    return await run(gitPath, cwd, args);
  } catch {
    return null;
  }
}
async function isRepo(gitPath, dir) {
  const r = await tryRun(gitPath, dir, ["rev-parse", "--is-inside-work-tree"]);
  return r?.stdout.trim() === "true";
}
async function gitCommonDir(gitPath, dir) {
  const r = await tryRun(gitPath, dir, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const out = r?.stdout.trim();
  return out ? out : null;
}
async function currentBranch(gitPath, dir) {
  const r = await tryRun(gitPath, dir, ["branch", "--show-current"]);
  const out = r?.stdout.trim();
  return out ? out : null;
}
async function branchExists(gitPath, dir, branch) {
  const r = await tryRun(gitPath, dir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
  return !!r && r.stdout.trim().length > 0;
}
async function isDirty(gitPath, dir, includeUntracked = true) {
  const args = ["status", "--porcelain"];
  if (!includeUntracked) args.push("--untracked-files=no");
  const r = await tryRun(gitPath, dir, args);
  if (!r) return 0;
  return r.stdout.split("\n").filter((l) => l.trim().length > 0).length;
}
async function listBranches(gitPath, dir) {
  const r = await tryRun(gitPath, dir, ["branch", `--format=%(refname:short)	%(HEAD)`]);
  if (!r) return { branches: [], current: null, default: null };
  const branches = [];
  let current = null;
  for (const line of r.stdout.split("\n")) {
    if (!line.trim()) continue;
    const [name, head] = line.split("	");
    if (!name) continue;
    const isCurrent = (head || "").trim() === "*";
    branches.push({ name, current: isCurrent });
    if (isCurrent) current = name;
  }
  const fallback = branches.find((b) => b.name === "main")?.name ?? branches.find((b) => b.name === "master")?.name ?? branches[0]?.name ?? null;
  const sym = await tryRun(gitPath, dir, ["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"]);
  const remoteDefault = sym?.stdout.trim().replace(/^origin\//, "") ?? null;
  return { branches, current, default: remoteDefault && branches.some((b) => b.name === remoteDefault) ? remoteDefault : fallback };
}
async function uniqueBranchName(gitPath, dir, want) {
  let name = want;
  for (let i = 2; await branchExists(gitPath, dir, name); i += 1) {
    name = `${want}-${i}`;
    if (i > 200) throw new Error(`cannot find a free branch name similar to ${want}`);
  }
  return name;
}
async function worktreeAdd(gitPath, repoDir, worktreePath, newBranch, baseBranch) {
  await run(gitPath, repoDir, ["worktree", "add", "-b", newBranch, worktreePath, baseBranch]);
}
async function worktreeRemove(gitPath, repoDir, worktreePath, force) {
  const args = ["worktree", "remove"];
  if (force) args.push("--force");
  args.push(worktreePath);
  await run(gitPath, repoDir, args);
}
async function switchBranch(gitPath, repoDir, branch) {
  try {
    await run(gitPath, repoDir, ["switch", branch]);
  } catch (error) {
    const msg = error instanceof GitError ? error.stderr : String(error);
    if (/used by worktree|already checked out/i.test(msg)) {
      await run(gitPath, repoDir, ["switch", "--ignore-other-worktrees", branch]);
      return;
    }
    throw error;
  }
}
async function mergeNoFF(gitPath, repoDir, branch) {
  try {
    await run(gitPath, repoDir, ["merge", "--no-ff", "--no-edit", branch]);
  } catch (error) {
    await tryRun(gitPath, repoDir, ["merge", "--abort"]);
    throw error;
  }
}
async function logOneline(gitPath, dir, range, limit = 30) {
  const r = await tryRun(gitPath, dir, ["log", "--oneline", "--no-decorate", `-n`, String(limit), range]);
  if (!r) return [];
  const out = [];
  for (const line of r.stdout.split("\n")) {
    if (!line.trim()) continue;
    const sp = line.indexOf(" ");
    if (sp <= 0) continue;
    out.push({ hash: line.slice(0, sp), subject: line.slice(sp + 1) });
  }
  return out;
}
async function countCommits(gitPath, dir, range) {
  const r = await tryRun(gitPath, dir, ["rev-list", "--count", range]);
  const n = Number.parseInt((r?.stdout ?? "0").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}
async function lastCommitTime(gitPath, dir, ref = "HEAD") {
  const r = await tryRun(gitPath, dir, ["log", "-1", "--format=%ct", ref]);
  const n = Number.parseInt((r?.stdout ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n * 1e3 : null;
}
async function isAncestor(gitPath, dir, ancestor, descendant) {
  const r = await tryRun(gitPath, dir, ["merge-base", "--is-ancestor", ancestor, descendant]);
  return !!r;
}
async function sameCommit(gitPath, dir, a, b) {
  const [ra, rb] = await Promise.all([
    tryRun(gitPath, dir, ["rev-parse", "--verify", "--quiet", a]),
    tryRun(gitPath, dir, ["rev-parse", "--verify", "--quiet", b])
  ]);
  if (!ra || !rb) return false;
  return ra.stdout.trim() === rb.stdout.trim();
}
async function ensureExclude(gitPath, dir, dirName) {
  const common = await gitCommonDir(gitPath, dir);
  if (!common) return;
  const file = join2(common, "info", "exclude");
  const entry = `/${dirName}/`;
  let text = "";
  try {
    text = await fs2.readFile(file, "utf8");
  } catch {
    text = "";
  }
  const already = text.split("\n").some((l) => l.trim() === entry);
  if (already) return;
  const sep = text.length > 0 && !text.endsWith("\n") ? "\n" : "";
  await fs2.mkdir(dirname2(file), { recursive: true });
  await fs2.writeFile(file, `${text}${sep}# added by dsh-deepseek-worktree
${entry}
`, "utf8");
}
async function removeBranch(gitPath, repoDir, branch, force) {
  await run(gitPath, repoDir, ["branch", force ? "-D" : "-d", branch]);
}

// src/runtime.ts
var TaskError = class extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.name = "TaskError";
    this.status = status;
  }
};
function id8(id) {
  return id.replace(/-/g, "").slice(0, 8);
}
function assertTaskBranchName(name) {
  const valid = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(name);
  if (!valid || name.includes("..") || name.includes("@{") || name.endsWith("/") || name.endsWith(".") || name.endsWith(".lock")) {
    throw new TaskError("\u4EFB\u52A1\u5206\u652F\u53EA\u80FD\u4F7F\u7528\u82F1\u6587\u3001\u6570\u5B57\u3001\u70B9\u3001\u4E0B\u5212\u7EBF\u548C\u659C\u6760");
  }
}
function buildFirstPrompt(task) {
  return [
    "\u8FD9\u662F\u4E00\u4E2A git worktree \u4EFB\u52A1\u3002",
    "",
    `\u4EFB\u52A1\uFF1A${task.title}`,
    `\u63CF\u8FF0\uFF1A${task.description.trim()}`,
    "",
    "\u73AF\u5883\uFF1A",
    `- worktree\uFF1A${task.worktreePath}`,
    `  \u5206\u652F ${task.branch}\uFF0C\u57FA\u4E8E ${task.baseBranch} \u2190 \u6240\u6709\u5F00\u53D1\u90FD\u5728\u8FD9\u91CC\u8FDB\u884C`,
    `- \u4E3B\u4ED3\u5E93\uFF1A${task.repoPath}\uFF08\u53EA\u8BFB\uFF0C\u4E0D\u8981\u4FEE\u6539\u5176\u4E2D\u4EFB\u4F55\u6587\u4EF6\uFF09`,
    "",
    "\u5F00\u59CB\u524D\uFF1A",
    "1. \u5982\u679C\u5F53\u524D\u76EE\u5F55\u4E0D\u662F\u4E0A\u9762\u7684 worktree\uFF0C\u7528 working_directory \u5DE5\u5177\u5207\u6362\u8FC7\u53BB\u3002",
    "2. \u8FD0\u884C git rev-parse --show-toplevel \u548C git branch --show-current\uFF0C",
    "   \u786E\u8BA4\u8DEF\u5F84\u548C\u5206\u652F\u6B63\u786E\uFF1B\u4E0D\u4E00\u81F4\u65F6\u505C\u4E0B\u5E76\u544A\u8BC9\u6211\u3002",
    "",
    "\u5F00\u53D1\u8981\u6C42\uFF1A",
    "- \u6587\u4EF6\u8BFB\u5199\u4F18\u5148\u4F7F\u7528 worktree \u5185\u7684\u7EDD\u5BF9\u8DEF\u5F84\u3002",
    "- \u6309\u9636\u6BB5 commit\uFF0C\u63D0\u4EA4\u4FE1\u606F\u5199\u6E05\u695A\u6539\u4E86\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u6539\u3002",
    "- \u4E0D\u8981\u5207\u6362\u5206\u652F\u3001merge\u3001rebase\u3001push\uFF0C\u4E0D\u8981\u5220\u9664 worktree\uFF1B",
    "  \u9A8C\u6536\u548C\u5408\u5E76\u7531\u5DE5\u4F5C\u53F0\u5B8C\u6210\u3002",
    "- \u9047\u5230\u9700\u6C42\u4E0D\u660E\u786E\u6216\u9700\u8981\u53D6\u820D\u65F6\uFF0C\u76F4\u63A5\u95EE\u6211\u3002",
    "",
    "\u5B8C\u6210\u540E\u603B\u7ED3\uFF1A",
    "- \u6539\u52A8\u7684\u6587\u4EF6\u548C\u8981\u70B9",
    "- \u63D0\u4EA4\u5217\u8868",
    "- \u8FD0\u884C\u8FC7\u7684\u9A8C\u8BC1\uFF08\u4F8B\u5982 npm run typecheck / npm run build\uFF09\u53CA\u7ED3\u679C",
    "- \u6CA1\u9A8C\u8BC1\u7684\u90E8\u5206\u548C\u9057\u7559\u98CE\u9669"
  ].join("\n");
}
var Runtime = class {
  store;
  config;
  gitPath;
  constructor(deps) {
    this.store = deps.store;
    this.config = deps.config;
    this.gitPath = deps.config.gitPath;
  }
  abs(p) {
    const expanded = p.startsWith("~") ? join3(process.env.USERPROFILE || process.env.HOME || ".", p.slice(1)) : p;
    return isAbsolute(expanded) ? expanded : resolve(expanded);
  }
  async repoInfo(dir) {
    if (!await isRepo(this.gitPath, dir)) {
      throw new TaskError(`\u76EE\u5F55\u4E0D\u662F git \u4ED3\u5E93\u5DE5\u4F5C\u533A\uFF1A${dir}`);
    }
    const { current, default: def } = await listBranches(this.gitPath, dir);
    return { current, default: def };
  }
  async branches(dir) {
    const d = this.abs(dir);
    if (!await isRepo(this.gitPath, d)) {
      throw new TaskError(`\u76EE\u5F55\u4E0D\u662F git \u4ED3\u5E93\u5DE5\u4F5C\u533A\uFF1A${d}`);
    }
    return listBranches(this.gitPath, d);
  }
  /** Effective per-project worktree knobs (project override > global config). */
  effective(project) {
    return {
      dirName: project?.dirName?.trim() || this.config.dirName,
      branchPrefix: project?.branchPrefix?.trim() || this.config.branchPrefix
    };
  }
  // ---- projects ----
  async addProject(input) {
    const repoPath = this.abs(input.repoPath);
    if (!await isRepo(this.gitPath, repoPath)) {
      throw new TaskError(`\u76EE\u6807\u76EE\u5F55\u4E0D\u662F git \u4ED3\u5E93\u5DE5\u4F5C\u533A\uFF1A${repoPath}`);
    }
    const existing = this.store.findProjectByRepo(repoPath);
    if (existing) return existing;
    const { current, default: defaultBranch } = await listBranches(this.gitPath, repoPath);
    const base = (input.baseBranch || current || defaultBranch || "").trim();
    const project = {
      id: randomUUID(),
      name: (input.name || basename(repoPath) || "project").trim(),
      repoPath,
      baseBranch: base,
      ...input.dirName?.trim() ? { dirName: input.dirName.trim() } : {},
      ...input.branchPrefix?.trim() ? { branchPrefix: input.branchPrefix.trim() } : {},
      createdAt: Date.now()
    };
    this.store.putProject(project);
    this.store.addRecent(repoPath);
    return project;
  }
  updateProject(id, patch) {
    const project = this.store.getProject(id);
    if (!project) throw new TaskError(`\u9879\u76EE\u4E0D\u5B58\u5728\uFF1A${id}`, 404);
    if (typeof patch.name === "string" && patch.name.trim()) project.name = patch.name.trim();
    if (typeof patch.baseBranch === "string" && patch.baseBranch.trim()) {
      const b = patch.baseBranch.trim();
      if (!branchExists(this.gitPath, project.repoPath, b)) throw new TaskError(`\u57FA\u7EBF\u5206\u652F\u4E0D\u5B58\u5728\uFF1A${b}`);
      project.baseBranch = b;
    }
    if (typeof patch.dirName === "string") project.dirName = patch.dirName.trim() || void 0;
    if (typeof patch.branchPrefix === "string") project.branchPrefix = patch.branchPrefix.trim() || void 0;
    this.store.putProject(project);
    return project;
  }
  deleteProject(id, opts) {
    const project = this.store.getProject(id);
    if (!project) throw new TaskError(`\u9879\u76EE\u4E0D\u5B58\u5728\uFF1A${id}`, 404);
    const tasks = this.store.listTasksOfProject(id);
    if (tasks.length > 0 && !opts.withTasks) {
      throw new TaskError(`\u9879\u76EE\u4E0B\u8FD8\u6709 ${tasks.length} \u4E2A\u4EFB\u52A1\uFF1B\u52FE\u9009\u300C\u8FDE\u540C\u4EFB\u52A1\u5220\u9664\u300D\u540E\u91CD\u8BD5`);
    }
    for (const t of tasks) this.store.deleteTask(t.id);
    this.store.deleteProject(id);
    return { deletedTasks: tasks.length };
  }
  /** Resolve the owning project for a publish: explicit id, repo match, or create. */
  async ensureProject(input) {
    if (input.projectId) {
      const project = this.store.getProject(input.projectId);
      if (!project) throw new TaskError(`\u9879\u76EE\u4E0D\u5B58\u5728\uFF1A${input.projectId}`, 404);
      return project;
    }
    const repoPath = this.abs(input.repoPath || "");
    if (!input.repoPath) throw new TaskError("\u7F3A\u5C11 projectId \u6216 repoPath");
    const found = this.store.findProjectByRepo(repoPath);
    if (found) return found;
    return this.addProject({ repoPath });
  }
  /** Aggregate the board's left column: every project with its task views. */
  async projectViews() {
    const views = await this.views();
    const byId = /* @__PURE__ */ new Map();
    const orphans = [];
    for (const p of this.store.listProjects()) {
      byId.set(p.id, { project: p, stats: { tasks: 0, byStatus: {}, running: 0 }, tasks: [] });
    }
    for (const v of views) {
      let bucket = v.task.projectId ? byId.get(v.task.projectId) : void 0;
      if (bucket) bucket.tasks.push(v);
      else orphans.push(v);
    }
    for (const v of orphans) {
      const key = "repo:" + v.task.repoPath.toLowerCase();
      let bucket = byId.get(key);
      if (!bucket) {
        const synth = {
          id: key,
          name: basename(v.task.repoPath) || v.task.repoPath,
          repoPath: v.task.repoPath,
          baseBranch: v.task.baseBranch,
          createdAt: v.task.createdAt
        };
        bucket = { project: synth, stats: { tasks: 0, byStatus: {}, running: 0 }, tasks: [] };
        byId.set(key, bucket);
      }
      bucket.tasks.push(v);
    }
    const out = [...byId.values()];
    for (const b of out) {
      b.tasks.sort((x, y) => y.task.createdAt - x.task.createdAt);
      b.stats.tasks = b.tasks.length;
      for (const v of b.tasks) {
        const s = v.snapshot.status;
        b.stats.byStatus[s] = (b.stats.byStatus[s] || 0) + 1;
      }
      b.stats.running = b.tasks.filter((v) => v.snapshot.status === "developing").length;
    }
    return out.sort((a, b) => a.project.name.localeCompare(b.project.name));
  }
  async publish(input) {
    if (!input.title?.trim()) throw new TaskError("\u4EFB\u52A1\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    if (!input.description?.trim()) throw new TaskError("\u4EFB\u52A1\u63CF\u8FF0\u4E0D\u80FD\u4E3A\u7A7A");
    const project = await this.ensureProject(input);
    const repoPath = project.repoPath;
    if (!await isRepo(this.gitPath, repoPath)) {
      throw new TaskError(`\u76EE\u6807\u76EE\u5F55\u4E0D\u662F git \u4ED3\u5E93\u5DE5\u4F5C\u533A\uFF1A${repoPath}`);
    }
    const { current, default: defaultBranch } = await listBranches(this.gitPath, repoPath);
    const base = (input.baseBranch || project.baseBranch || current || defaultBranch || "").trim();
    if (!base || !await branchExists(this.gitPath, repoPath, base)) {
      throw new TaskError(`\u57FA\u7EBF\u5206\u652F\u4E0D\u5B58\u5728\uFF1A${base || "(\u672A\u6307\u5B9A)"}`);
    }
    const eff = this.effective(project);
    const id = randomUUID();
    const short = id8(id);
    const wanted = (input.branchName?.trim() || `${eff.branchPrefix}${short}`).trim();
    assertTaskBranchName(wanted);
    const branch = await uniqueBranchName(this.gitPath, repoPath, wanted);
    const worktreePath = join3(repoPath, eff.dirName, short);
    await worktreeAdd(this.gitPath, repoPath, worktreePath, branch, base);
    await ensureExclude(this.gitPath, repoPath, eff.dirName);
    const now = Date.now();
    const task = {
      id,
      projectId: project.id,
      title: input.title.trim(),
      description: input.description,
      repoPath,
      baseBranch: base,
      branch,
      worktreePath,
      sessionId: null,
      firstPrompt: "",
      startOnBind: input.start !== false && input.autoBind !== false,
      createdAt: now,
      updatedAt: now
    };
    task.firstPrompt = buildFirstPrompt(task);
    this.store.putTask(task);
    this.store.addRecent(repoPath);
    return task;
  }
  async snapshot(task) {
    const snap = {
      worktree: { exists: false, branch: null, dirtyCount: 0, ahead: 0, commits: [], lastCommitAt: null },
      repo: { exists: false, currentBranch: null, dirtyCount: 0 },
      branchExists: false,
      merged: false,
      status: "broken"
    };
    try {
      const [repoIsRepo, wtStat] = await Promise.all([
        isRepo(this.gitPath, task.repoPath),
        fs3.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false)
      ]);
      snap.repo.exists = repoIsRepo;
      snap.worktree.exists = wtStat;
      snap.branchExists = repoIsRepo ? await branchExists(this.gitPath, task.repoPath, task.branch) : false;
      if (repoIsRepo) {
        const [cur, dirty] = await Promise.all([
          currentBranch(this.gitPath, task.repoPath),
          // Untracked files in the main repo do not belong to the task branch and
          // must not block checkout or merge. Tracked edits still do.
          isDirty(this.gitPath, task.repoPath, false)
        ]);
        snap.repo.currentBranch = cur;
        snap.repo.dirtyCount = dirty;
        if (cur && snap.branchExists) {
          const [anc, same] = await Promise.all([
            isAncestor(this.gitPath, task.repoPath, task.branch, task.baseBranch),
            sameCommit(this.gitPath, task.repoPath, task.branch, task.baseBranch)
          ]);
          snap.merged = anc && !same;
        }
      }
      if (wtStat) {
        const [wtBranch, wtDirty, ahead, commits, lastAt] = await Promise.all([
          currentBranch(this.gitPath, task.worktreePath),
          isDirty(this.gitPath, task.worktreePath),
          countCommits(this.gitPath, task.worktreePath, `${task.baseBranch}..HEAD`),
          logOneline(this.gitPath, task.worktreePath, `${task.baseBranch}..HEAD`, 20),
          lastCommitTime(this.gitPath, task.worktreePath)
        ]);
        snap.worktree.branch = wtBranch;
        snap.worktree.dirtyCount = wtDirty;
        snap.worktree.ahead = ahead;
        snap.worktree.commits = commits;
        snap.worktree.lastCommitAt = lastAt;
      }
      snap.status = this.statusOf(task, snap);
    } catch (error) {
      snap.status = "broken";
      snap.error = error instanceof Error ? error.message : String(error);
    }
    return snap;
  }
  /**
   * Git state is the source of truth; the record only carries metadata.
   * Precedence: cleaned → broken → merged → reviewing → developing/review/ready.
   */
  statusOf(task, snap) {
    if (task.cleanedAt) return "cleaned";
    if (snap.error) return "broken";
    if (snap.merged) return "merged";
    if (snap.repo.currentBranch && snap.repo.currentBranch === task.branch) return "reviewing";
    if (snap.worktree.exists && (snap.worktree.ahead > 0 || snap.worktree.dirtyCount > 0)) return "review";
    if (task.sessionId) return "developing";
    return "ready";
  }
  async view(task) {
    return { task, snapshot: await this.snapshot(task) };
  }
  async views() {
    const tasks = this.store.listTasks();
    return Promise.all(tasks.map((t) => this.view(t)));
  }
  needTask(id) {
    const task = this.store.getTask(id);
    if (!task) throw new TaskError(`\u4EFB\u52A1\u4E0D\u5B58\u5728\uFF1A${id}`, 404);
    return task;
  }
  async refuseDirty(dir, what, includeUntracked = true) {
    const dirty = await isDirty(this.gitPath, dir, includeUntracked);
    if (dirty > 0) throw new TaskError(`${what}\u6709 ${dirty} \u5904\u672A\u63D0\u4EA4\u6539\u52A8\uFF0C\u8BF7\u5148\u5904\u7406\u540E\u518D\u64CD\u4F5C`);
  }
  async checkout(id) {
    const task = this.needTask(id);
    if (task.cleanedAt) throw new TaskError("worktree \u5DF2\u6E05\u7406\uFF0C\u65E0\u6CD5\u9A8C\u6536\u5207\u6362");
    await this.refuseDirty(task.repoPath, "\u4E3B\u4ED3\u5E93", false);
    const cur = await currentBranch(this.gitPath, task.repoPath);
    if (cur !== task.branch) {
      task.originalBranch = cur ?? task.originalBranch;
      await switchBranch(this.gitPath, task.repoPath, task.branch);
      this.store.putTask(task);
    }
    return task;
  }
  async back(id) {
    const task = this.needTask(id);
    if (!task.originalBranch) throw new TaskError("\u6CA1\u6709\u8BB0\u5F55\u9A8C\u6536\u524D\u7684\u5206\u652F");
    if (!await branchExists(this.gitPath, task.repoPath, task.originalBranch)) {
      throw new TaskError(`\u539F\u5206\u652F\u5DF2\u4E0D\u5B58\u5728\uFF1A${task.originalBranch}`);
    }
    await this.refuseDirty(task.repoPath, "\u4E3B\u4ED3\u5E93", false);
    const cur = await currentBranch(this.gitPath, task.repoPath);
    if (cur !== task.originalBranch) {
      await switchBranch(this.gitPath, task.repoPath, task.originalBranch);
    }
    return task;
  }
  async merge(id) {
    const task = this.needTask(id);
    if (task.cleanedAt) throw new TaskError("worktree \u5DF2\u6E05\u7406\uFF0C\u5206\u652F\u82E5\u4ECD\u5728\u53EF\u624B\u52A8\u5408\u5E76");
    if (!await branchExists(this.gitPath, task.repoPath, task.branch)) {
      throw new TaskError(`\u4EFB\u52A1\u5206\u652F\u4E0D\u5B58\u5728\uFF1A${task.branch}`);
    }
    await this.refuseDirty(task.repoPath, "\u4E3B\u4ED3\u5E93", false);
    const cur = await currentBranch(this.gitPath, task.repoPath);
    if (cur !== task.baseBranch) {
      await switchBranch(this.gitPath, task.repoPath, task.baseBranch);
    }
    await mergeNoFF(this.gitPath, task.repoPath, task.branch);
    if (cur && cur !== task.branch && !task.originalBranch) task.originalBranch = cur;
    this.store.putTask(task);
    return task;
  }
  async cleanup(id, opts) {
    const task = this.needTask(id);
    const wtExists = await fs3.stat(task.worktreePath).then((s) => s.isDirectory()).catch(() => false);
    if (wtExists) {
      if (!opts.force) await this.refuseDirty(task.worktreePath, "worktree");
      await worktreeRemove(this.gitPath, task.repoPath, task.worktreePath, !!opts.force);
    }
    if (opts.deleteBranch && await branchExists(this.gitPath, task.repoPath, task.branch)) {
      const cur = await currentBranch(this.gitPath, task.repoPath);
      if (cur === task.branch && task.originalBranch) {
        await switchBranch(this.gitPath, task.repoPath, task.originalBranch);
      }
      await removeBranch(this.gitPath, task.repoPath, task.branch, true);
    }
    task.cleanedAt = Date.now();
    this.store.putTask(task);
    return task;
  }
  delete(id) {
    this.store.deleteTask(id);
  }
  bind(id, sessionId) {
    const task = this.needTask(id);
    task.sessionId = sessionId;
    task.startOnBind = false;
    this.store.putTask(task);
    return task;
  }
  unbindBySession(sessionId) {
    const task = this.store.listTasks().find((t) => t.sessionId === sessionId);
    if (!task) return null;
    task.sessionId = null;
    task.startOnBind = false;
    this.store.putTask(task);
    return task;
  }
};

// src/tools.ts
function outDef() {
  return {
    schema: { type: "object", additionalProperties: true },
    render(_args, value) {
      let text;
      try {
        text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      } catch {
        text = String(value);
      }
      if (text.length > 12e3) text = text.slice(0, 12e3) + "\u2026[truncated]";
      return [{ type: "text", text }];
    }
  };
}
function clean(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { error: "unserializable result" };
  }
}
function brief(v) {
  return {
    id: v.task.id,
    title: v.task.title,
    repoPath: v.task.repoPath,
    baseBranch: v.task.baseBranch,
    branch: v.task.branch,
    worktreePath: v.task.worktreePath,
    sessionId: v.task.sessionId,
    status: v.snapshot.status,
    ahead: v.snapshot.worktree.ahead,
    dirtyWorktree: v.snapshot.worktree.dirtyCount,
    mainRepoBranch: v.snapshot.repo.currentBranch
  };
}
function registerTools(app) {
  return app.ctx.inject(["tools"], (host) => {
    const tools = host.tools;
    const offs = [];
    const reg = (def) => offs.push(tools.register(def, { when: () => true }));
    reg({
      name: "worktree_publish",
      description: "Publish a git-worktree task: create a worktree + task branch from a base branch in the target repo, record it on the workbench board. Pass project_id to pin it to a registered project (inherits repo path and default base branch); otherwise the repo is auto-registered. The user (or the workbench) binds a DSH session to the worktree; the session does the actual development.",
      output: outDef(),
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Registered project id from worktree_projects. Omit when passing repository." },
          repository: { type: "string", description: "Absolute path of the target git repo working tree (required when project_id is omitted)." },
          base_branch: { type: "string", description: "Base branch. Defaults to the project base or the repo current branch." },
          title: { type: "string", description: "Short task title." },
          task: { type: "string", description: "Full task description for the session that will develop it." },
          branch_name: { type: "string", description: "Optional task branch name; auto-generated when omitted." },
          start: { type: "boolean", description: "Auto-start the bound session with the task prompt (default true)." }
        },
        required: ["title", "task"]
      },
      async execute(args) {
        try {
          if (!args.project_id && !args.repository) return clean({ ok: false, error: "project_id \u6216 repository \u81F3\u5C11\u63D0\u4F9B\u4E00\u4E2A" });
          const task = await app.runtime.publish({
            projectId: args.project_id ? String(args.project_id) : void 0,
            repoPath: args.repository ? String(args.repository) : void 0,
            baseBranch: args.base_branch ? String(args.base_branch) : void 0,
            title: String(args.title || ""),
            description: String(args.task || ""),
            branchName: args.branch_name ? String(args.branch_name) : void 0,
            start: args.start === false ? false : true
          });
          return clean({
            ok: true,
            taskId: task.id,
            projectId: task.projectId,
            worktreePath: task.worktreePath,
            branch: task.branch,
            baseBranch: task.baseBranch,
            note: "\u4EFB\u52A1\u5DF2\u4E0A\u5DE5\u4F5C\u53F0\uFF1B\u5DE5\u4F5C\u53F0\u6253\u5F00\u65F6\u4F1A\u81EA\u52A8\u521B\u5EFA\u7ED1\u5B9A\u8BE5 worktree \u7684\u4F1A\u8BDD\u5E76\u5F00\u59CB\u5F00\u53D1\u3002"
          });
        } catch (error) {
          return clean({ ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    });
    reg({
      name: "worktree_projects",
      description: "List registered worktree projects (target repos) with their default base branch and task counts.",
      output: outDef(),
      parameters: { type: "object", properties: {} },
      async execute() {
        const views = await app.runtime.projectViews();
        return clean({
          projects: views.map((v) => ({
            id: v.project.id,
            name: v.project.name,
            repoPath: v.project.repoPath,
            baseBranch: v.project.baseBranch,
            tasks: v.stats.tasks,
            byStatus: v.stats.byStatus
          }))
        });
      }
    });
    reg({
      name: "worktree_tasks",
      description: "List published worktree tasks with their git-derived status (ahead commits, dirty state, review/merged state).",
      output: outDef(),
      parameters: { type: "object", properties: {} },
      async execute() {
        const views = await app.runtime.views();
        return clean({ tasks: views.map(brief) });
      }
    });
    reg({
      name: "worktree_act",
      description: "Act on a worktree task: checkout (switch the main repo to the task branch for acceptance), back (switch back to the recorded original branch), merge (merge --no-ff into the base branch), cleanup (remove the worktree, optionally delete the branch), delete (remove the record).",
      output: outDef(),
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task id from worktree_tasks." },
          action: { type: "string", enum: ["checkout", "back", "merge", "cleanup", "delete"], description: "Operation." },
          force: { type: "boolean", description: "For cleanup: remove even with uncommitted changes." },
          delete_branch: { type: "boolean", description: "For cleanup: also delete the task branch." }
        },
        required: ["id", "action"]
      },
      async execute(args) {
        const id = String(args.id || "");
        const action = String(args.action || "");
        try {
          if (action === "checkout") return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.checkout(id))) });
          if (action === "back") return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.back(id))) });
          if (action === "merge") return clean({ ok: true, task: brief(await app.runtime.view(await app.runtime.merge(id))) });
          if (action === "cleanup") {
            const t = await app.runtime.cleanup(id, { force: !!args.force, deleteBranch: !!args.delete_branch });
            return clean({ ok: true, task: brief(await app.runtime.view(t)) });
          }
          if (action === "delete") {
            app.runtime.delete(id);
            return clean({ ok: true });
          }
          return clean({ ok: false, error: `unknown action ${action}` });
        } catch (error) {
          return clean({ ok: false, error: error instanceof TaskError || error instanceof Error ? error.message : String(error) });
        }
      }
    });
    return () => {
      for (const off of offs) {
        try {
          off();
        } catch {
        }
      }
    };
  });
}

// src/http.ts
import { randomBytes } from "node:crypto";
var PREFIX = "/dsh-worktree/api";
var MAX_BODY = 64 * 1024;
var BOARD_CLIENT = "worktree-board";
function header(req, name) {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}
function readJson2(req) {
  return new Promise((resolve2, reject) => {
    const type = String(header(req, "content-type") || "").toLowerCase();
    if (!type.includes("application/json")) {
      reject(Object.assign(new Error("json required"), { status: 415 }));
      return;
    }
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("too large"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve2(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(Object.assign(new Error("bad json"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}
function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function registerHttp(app) {
  const table = /* @__PURE__ */ new Map();
  const trusted = (req) => {
    if ((header(req, "sec-fetch-site") || "").toLowerCase() === "cross-site") return false;
    const origin = header(req, "origin");
    if (origin === void 0) return true;
    try {
      return new URL(origin).host === header(req, "host");
    } catch {
      return false;
    }
  };
  const requireToken = (req) => {
    const token = header(req, "x-dsh-worktree-token");
    if (!token || !app.tokens.has(token)) throw Object.assign(new Error("bad token"), { status: 403, code: "bad-token" });
  };
  const q = (req, name) => {
    try {
      return new URL(req.url, "http://localhost").searchParams.get(name) || "";
    } catch {
      return "";
    }
  };
  const route = (path, method, handler) => {
    let m = table.get(path);
    if (!m) {
      m = /* @__PURE__ */ new Map();
      table.set(path, m);
    }
    m.set(method, handler);
  };
  route("session", "POST", async (req, res) => {
    const body = await readJson2(req);
    const clientId = String(body.sessionId || BOARD_CLIENT);
    if (clientId !== BOARD_CLIENT) return send(res, 403, { error: "unknown client" });
    const token = randomBytes(24).toString("hex");
    app.tokens.set(token, clientId);
    send(res, 200, { token });
  });
  route("config", "GET", async (_req, res) => send(res, 200, { config: app.config }));
  route("recents", "GET", async (_req, res) => send(res, 200, { dirs: app.store.listRecents() }));
  route("recents/clear", "POST", async (_req, res) => {
    app.store.clearRecents();
    send(res, 200, { ok: true });
  });
  route("branches", "GET", async (req, res) => {
    const dir = q(req, "path");
    if (!dir) return send(res, 400, { error: "path required" });
    try {
      const info = await app.runtime.branches(dir);
      send(res, 200, info);
    } catch (error) {
      send(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  route("publish", "POST", async (req, res) => {
    requireToken(req);
    const body = await readJson2(req);
    try {
      const task = await app.runtime.publish({
        projectId: body.projectId ? String(body.projectId) : void 0,
        repoPath: body.repoPath ? String(body.repoPath) : void 0,
        baseBranch: body.baseBranch ? String(body.baseBranch) : void 0,
        title: String(body.title || ""),
        description: String(body.description || ""),
        branchName: body.branchName ? String(body.branchName) : void 0,
        start: body.start !== false,
        autoBind: false
      });
      send(res, 200, { task });
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message });
      send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  route("projects", "GET", async (req, res) => {
    requireToken(req);
    const views = await app.runtime.projectViews();
    send(res, 200, { projects: views });
  });
  route("projects/add", "POST", async (req, res) => {
    requireToken(req);
    const body = await readJson2(req);
    try {
      const project = await app.runtime.addProject({
        repoPath: String(body.repoPath || ""),
        name: body.name ? String(body.name) : void 0,
        baseBranch: body.baseBranch ? String(body.baseBranch) : void 0,
        dirName: body.dirName ? String(body.dirName) : void 0,
        branchPrefix: body.branchPrefix ? String(body.branchPrefix) : void 0
      });
      send(res, 200, { project });
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message });
      send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  route("projects/update", "POST", async (req, res) => {
    requireToken(req);
    const body = await readJson2(req);
    try {
      const project = app.runtime.updateProject(String(body.id || ""), {
        name: body.name === void 0 ? void 0 : String(body.name),
        baseBranch: body.baseBranch === void 0 ? void 0 : String(body.baseBranch),
        dirName: body.dirName === void 0 ? void 0 : String(body.dirName),
        branchPrefix: body.branchPrefix === void 0 ? void 0 : String(body.branchPrefix)
      });
      send(res, 200, { project });
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message });
      send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  route("projects/delete", "POST", async (req, res) => {
    requireToken(req);
    const body = await readJson2(req);
    try {
      send(res, 200, app.runtime.deleteProject(String(body.id || ""), { withTasks: !!body.withTasks }));
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message });
      send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  route("tasks", "GET", async (req, res) => {
    requireToken(req);
    const views = await app.runtime.views();
    send(res, 200, { tasks: views });
  });
  route("bind", "POST", async (req, res) => {
    requireToken(req);
    const body = await readJson2(req);
    const id = String(body.id || "");
    const sessionId = String(body.sessionId || "");
    if (!id || !sessionId) return send(res, 400, { error: "id and sessionId required" });
    try {
      send(res, 200, { task: await app.runtime.bind(id, sessionId) });
    } catch (error) {
      if (error instanceof TaskError) return send(res, error.status, { error: error.message });
      send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  const act = (name, fn) => {
    route(`task/${name}`, "POST", async (req, res) => {
      requireToken(req);
      const body = await readJson2(req);
      try {
        await fn(String(body.id || ""), body);
        const id = String(body.id || "");
        const task = app.store.getTask(id);
        if (!task) return send(res, 200, { ok: true, deleted: true });
        send(res, 200, { ok: true, view: await app.runtime.view(task) });
      } catch (error) {
        if (error instanceof TaskError) return send(res, error.status, { error: error.message });
        send(res, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    });
  };
  act("checkout", async (id) => app.runtime.checkout(id));
  act("back", async (id) => app.runtime.back(id));
  act("merge", async (id) => app.runtime.merge(id));
  act("cleanup", async (id, body) => app.runtime.cleanup(id, { force: !!body.force, deleteBranch: !!body.deleteBranch }));
  act("delete", async (id) => app.runtime.delete(id));
  const routes = [];
  for (const [path, methods] of table) {
    routes.push({
      kind: "exact",
      path: `${PREFIX}/${path}`,
      async handler(req, res) {
        try {
          if (!trusted(req)) return send(res, 403, { error: "untrusted-origin" });
          const fn = methods.get(req.method);
          if (!fn) return send(res, 405, { error: "method-not-allowed" });
          await fn(req, res);
        } catch (error) {
          send(res, error?.status || 500, { error: error?.code || "internal", message: error instanceof Error ? error.message : String(error) });
        }
      }
    });
  }
  return app.ctx.inject(["webServer"], (host) => {
    const ws = host.webServer;
    if (!ws || typeof ws.register !== "function") return () => {
    };
    const offs = [];
    for (const r of routes) {
      try {
        offs.push(ws.register(r));
      } catch {
      }
    }
    return () => {
      for (const off of offs) {
        try {
          off();
        } catch {
        }
      }
    };
  });
}

// src/index.ts
function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig);
  const store = new Store();
  const runtime = new Runtime({ store, config });
  const logger = {
    info: (m) => {
      try {
        ctx.get("logger")?.info?.(m);
      } catch {
      }
    },
    warn: (m) => {
      try {
        ctx.get("logger")?.warn?.(m);
      } catch {
      }
    },
    error: (m) => {
      try {
        ctx.get("logger")?.error?.(m);
      } catch {
      }
    }
  };
  const app = { ctx, store, config, runtime, tokens: /* @__PURE__ */ new Map(), logger };
  ctx.effect(() => {
    void store.load();
    return () => store.dispose();
  }, "deepseek-worktree: store");
  ctx.inject(["sessions"], (host) => {
    const sessions = host.sessions;
    if (!sessions || typeof sessions.on !== "function") return () => {
    };
    const off = sessions.on("session/disposed", (session) => {
      const id = session?.id;
      if (!id) return;
      const t = runtime.unbindBySession(String(id));
      if (t) logger.info(`worktree task unbound: ${t.id}`);
    });
    return () => {
      try {
        off();
      } catch {
      }
    };
  });
  registerTools(app);
  registerHttp(app);
  try {
    if (typeof ctx.provide === "function") ctx.provide("worktreeTasks", { app });
  } catch {
  }
}
export {
  apply
};
