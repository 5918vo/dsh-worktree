/**
 * Action orchestration hook for the workbench board:
 * checkout/back switching, preflighted merge, cleanup, delete, stash restore/drop,
 * archive/unarchive, and native session launching.
 */

import { getJson, post, postLong } from '../context'
import { openNativeSession, sendSessionPrompt, startTask } from '../actions'
import { SYNC_BUSY, syncPromptText } from '../review-surfaces'
import type { BoardAction } from '../model'
import { cleanupPrimaryLabel, criteria, criteriaProgress, mergeGateMissing, switchConfirmText } from '../model'
import { copyText, downloadText } from '../format'
import { buildAcceptanceReport, reportFilename } from '../report'
import type { ProjectView, TaskDiff, TaskView } from '../../models'
import type { ConfirmState, StashViewState } from './dialogs'
import type { BoardTab } from '../stage'

export interface UseBoardActionsArgs {
  t: Record<string, any>
  remotes: any
  selectedTask: TaskView | null
  selectedProjectId: string
  projectOfTask: ProjectView | null
  /** Diff already loaded for the selected task; the report never refetches it. */
  diff: TaskDiff | null
  /** Localized status label for the report, matching the Stage chip. */
  statusLabel: string
  busy: string
  setBusy: (value: string) => void
  setConfirm: (state: ConfirmState | null) => void
  setStashView: (state: StashViewState | null) => void
  setPartialRestore: (state: { restoreFailed: boolean; reason: string } | null) => void
  setSelectedTaskId: (id: string) => void
  setTab: (tab: BoardTab) => void
  openPublish: (projectId?: string, parentId?: string) => void
  /** Cached merge preview, for warnings the server preflight does not repeat. */
  previewState?: any
  /** `sticky` false keeps a failure in the toast only (the blocker list already
   * shows the same sentences, so an inline banner would duplicate it). */
  say: (message: string, error?: boolean, sticky?: boolean) => void
  refresh: (manual?: boolean) => Promise<void>
}

export function useBoardActions(args: UseBoardActionsArgs) {
  const {
    t,
    remotes,
    selectedTask,
    selectedProjectId,
    projectOfTask,
    diff,
    statusLabel,
    busy,
    setBusy,
    setConfirm,
    setStashView,
    setPartialRestore,
    setSelectedTaskId,
    setTab,
    openPublish,
    previewState,
    say,
    refresh,
  } = args

  async function runAct(key: string, fn: () => Promise<any>, success: string) {
    if (busy) return
    setBusy(key)
    try {
      await fn()
      say(success)
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
    } finally {
      setBusy('')
      void refresh()
    }
  }

  async function executeSwitch(action: 'checkout' | 'back', strategy: string | undefined, pre: any) {
    if (!selectedTask) return
    const res: any = await postLong(action === 'checkout' ? 'task/checkout' : 'task/back', {
      id: selectedTask.task.id,
      strategy,
      expectedSha: pre && pre.targetSha ? pre.targetSha : undefined,
    })
    setConfirm(null)
    setTab('overview')
    say(action === 'checkout' ? t.checkoutDone : t.backDone)
    // `back` auto-restores the review stash; a record it could not apply is
    // reported once here so it cannot disappear silently.
    if (res && res.warning) say(String(res.warning), true)
    void refresh()
  }

  async function runSwitch(action: 'checkout' | 'back') {
    if (!selectedTask || busy) return
    setBusy(action)
    try {
      const r: any = await post(action === 'checkout' ? 'task/checkout-preflight' : 'task/back-preflight', { id: selectedTask.task.id })
      const pre = r && r.preflight
      if (!pre) throw new Error(t.failed)
      if (pre.safe && action !== 'checkout') {
        await executeSwitch(action, undefined, pre)
      } else {
        const count = (pre.obstacles || []).length
        setConfirm({
          title: action === 'checkout' ? t.checkoutTitle : t.backTitle,
          body: switchConfirmText(t, action, count),
          label: action === 'checkout' ? t.checkout : t.back,
          run: () => executeSwitch(action, pre.safe ? undefined : 'stash', pre),
        })
      }
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
    } finally {
      setBusy('')
    }
  }

  async function runMerge() {
    if (!selectedTask || busy) return
    const snap = selectedTask.snapshot
    // Project gate first: a blocked merge needs no Git preflight, and the toast
    // names the exact number of unchecked criteria.
    const gateMissing = mergeGateMissing(projectOfTask && projectOfTask.project, selectedTask.task, snap.status)
    if (gateMissing > 0) {
      say(String(t.mergeGateBlocked).replace('{n}', String(gateMissing)), true)
      return
    }
    const curOnBase = snap.repo.currentBranch === selectedTask.task.baseBranch
    setBusy('merge-pre')
    try {
      const r: any = await post('task/merge-preflight', { id: selectedTask.task.id, switchToBase: !curOnBase, restoreAfter: true })
      const pf = r && r.preflight
      if (!pf) throw new Error(t.failed)
      if (!pf.canMerge) {
        // Every blocker, not just the first: "repo dirty" and "agent running"
        // often come together and the user needs the whole list. The same
        // sentences are already in the stage's blocker list, so do not also
        // pin a red banner that survives after the blocker clears.
        const messages = (pf.blockers || []).map((b: any) => b && b.message).filter(Boolean)
        throw new Error(messages.length ? messages.join('；') : t.failed)
      }
      const task = selectedTask.task
      const ahead = Number(selectedTask.snapshot.worktree && selectedTask.snapshot.worktree.ahead) || 0
      const dirty = Number(selectedTask.snapshot.worktree && selectedTask.snapshot.worktree.dirtyCount) || 0
      const checklist = criteria(task, selectedTask.snapshot.status)
      const progress = criteriaProgress(checklist)
      const criteriaText = String(t.boardCriteriaProgress).replace('{n}', String(progress.checked)).replace('{total}', String(progress.total))
      const details = [
        { label: t.branchLabel, value: task.branch || '—', mono: true },
        { label: t.boardTargetBase, value: task.baseBranch || '—', mono: true },
        { label: t.commits, value: String(ahead) },
        { label: t.uncommitted, value: dirty ? `${dirty} ${t.changesUnit} · ${t.mergeNoAutoStash}` : t.clean },
      ]
      // Only tasks that actually carry a checklist get a progress row; "0/0"
      // would read like a broken counter.
      if (progress.total > 0) details.push({ label: t.acceptanceCriteria, value: criteriaText, mono: false })
      const cached = previewState && (previewState.preview || (previewState.previous && previewState.previous.preview))
      const overlapFiles = cached && Array.isArray(cached.overlapFiles) ? cached.overlapFiles.filter(Boolean) : []
      // The panel warned about overlapping files; the last dialog before the
      // merge must not be the quietest surface about them.
      if (overlapFiles.length) details.push({ label: t.mergeOverlapLabel, value: overlapFiles.join(', '), mono: true })
      const mergeBody = String(t.boardMergeConfirm).replace('{branch}', task.branch).replace('{base}', task.baseBranch)
        + (progress.missing > 0
          ? ` ${String(t.boardMergeCriteriaMissing).replace('{n}', String(progress.missing))}`
          : '')
      setConfirm({
        title: String(t.mergeTitle).replace('{base}', task.baseBranch),
        body: mergeBody,
        details,
        label: t.mergeConfirm,
        // Merging is additive and reversible with a revert; red reads as delete.
        danger: false,
        run: async () => {
          // The merge must lock exactly the tips the preflight inspected; the
          // cached preview may be older than this preflight result.
          const res: any = await postLong('task/merge', {
            id: task.id,
            switchToBase: !curOnBase,
            restoreTo: true,
            dirtyStrategy: 'refuse',
            expectedTip: pf.tipSha || undefined,
            expectedBase: pf.baseSha || undefined,
          })
          setConfirm(null)
          setPartialRestore(res && res.partial && res.partial.restoreFailed ? res.partial : null)
          say(String(t.mergeDone).replace('{base}', task.baseBranch))
          void refresh()
        },
      })
    } catch (e: any) {
      // Preflight refusals repeat the blocker list; keep them toast-only so a
      // stale red banner cannot outlive the blocker it describes.
      say(String((e && e.message) || t.failed), true, false)
    } finally {
      setBusy('')
    }
  }

  function runCleanup() {
    if (!selectedTask || busy) return
    const taskId = selectedTask.task.id
    const dirty = Number(selectedTask.snapshot.worktree && selectedTask.snapshot.worktree.dirtyCount) || 0
    const ahead = Number(selectedTask.snapshot.worktree && selectedTask.snapshot.worktree.ahead) || 0
    setConfirm({
      title: t.cleanup,
      body: t.boardCleanupConfirm,
      label: t.cleanup,
      details: ahead > 0
        ? [{ label: t.cleanupDiscardLabel, value: String(t.cleanupDiscardValue).replace('{n}', String(ahead)), mono: true }]
        : [],
      // Ticking "force delete branch" turns the action from "remove a worktree"
      // into "throw away commits"; the primary button must say so.
      labelFor: (values: Record<string, boolean>) => cleanupPrimaryLabel(t, values, ahead),
      danger: true,
      checks: [
        { key: 'force', label: t.force, hint: t.cleanupForceHint, disabled: dirty === 0 },
        { key: 'deleteBranch', label: t.deleteBranch, hint: t.cleanupBranchHint },
        { key: 'forceDeleteBranch', label: t.forceDeleteBranch, hint: t.forceDeleteBranchHint, dependsOn: 'deleteBranch' },
      ],
      run: async (values) => {
        await postLong('task/cleanup', {
          id: taskId,
          force: !!values.force,
          deleteBranch: !!values.deleteBranch,
          forceDeleteBranch: !!values.deleteBranch && !!values.forceDeleteBranch,
        })
        say(values.deleteBranch ? t.cleanupDoneBranch : t.cleanupDone)
        void refresh()
      },
    })
  }

  function runDeleteTask() {
    if (!selectedTask || busy) return
    const task = selectedTask.task
    const cleaned = selectedTask.snapshot.status === 'cleaned'
    setConfirm({
      title: t.deleteTaskTitle,
      body: cleaned ? t.boardDeleteConfirmCleaned : t.boardDeleteConfirm,
      label: t.deleteRecordConfirm,
      danger: true,
      run: async () => {
        await post('task/delete', { id: task.id })
        setSelectedTaskId('')
        setPartialRestore(null)
        say(t.recordDeleted)
        void refresh()
      },
    })
  }

  /**
   * Ask the session to merge the base into the task branch. The files shown in
   * the confirmation are the ones the preview flagged so the agent starts from
   * the same list the panel shows.
   */
  function runSyncBaseline(files: string[]) {
    if (!selectedTask || busy) return
    const task = selectedTask.task
    if (!task.sessionId) {
      say(t.syncNoSession, true)
      return
    }
    if (!remotes || !remotes.session) {
      say(t.failed, true)
      return
    }
    const text = syncPromptText(t, task, files)
    setConfirm({
      title: t.syncConfirmTitle,
      body: t.syncConfirmHint,
      pre: text,
      label: t.send,
      run: async () => {
        // Close first: the prompt is already decided, the toast reports the result.
        setConfirm(null)
        setBusy(SYNC_BUSY)
        try {
          await sendSessionPrompt(remotes, String(task.sessionId), text)
          say(t.syncPromptSent)
        } finally {
          setBusy('')
        }
      },
    })
  }

  function runMergeRestore() {
    if (!selectedTask || busy) return
    const id = selectedTask.task.id
    setBusy('merge-restore')
    postLong('task/merge-restore', { id })
      .then(() => {
        setPartialRestore(null)
        say(t.restoreOriginalBranch)
      })
      .catch((e: any) => say(String((e && e.message) || t.failed), true))
      .finally(() => { setBusy(''); void refresh() })
  }

  /**
   * Persist one criterion toggle. Success is silent: checking a list item by
   * item must not stack a toast per click; only failures speak up.
   */
  async function runCriterion(text: string, checked: boolean) {
    if (!selectedTask || busy) return
    setBusy('criteria')
    try {
      await post('task/criteria', { id: selectedTask.task.id, text, checked })
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
    } finally {
      setBusy('')
      void refresh()
    }
  }

  /**
   * Persist task metadata (tags / priority / notes) through one endpoint so the
   * server's atomic read-modify-write stays the only writer.
   */
  async function runSaveMeta(patch: { tags?: string[]; priority?: string; notes?: string }) {
    if (!selectedTask || busy) return
    const id = selectedTask.task.id
    setBusy('meta')
    try {
      await post('task/meta', { id, ...patch })
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
      throw e
    } finally {
      setBusy('')
      void refresh()
    }
  }

  /**
   * The report is generated from the current snapshot and the diff already in
   * memory, in the interface language. Both entry points share this text so a
   * copy and a download never diverge.
   */
  function reportMarkdown(view: TaskView): string {
    return buildAcceptanceReport({
      task: view.task,
      snapshot: view.snapshot,
      diff,
      projectName: projectOfTask ? projectOfTask.project.name : '',
      statusLabel,
      t,
    })
  }

  async function runCopyReport() {
    if (!selectedTask || busy) return
    setBusy('report')
    try {
      const ok = await copyText(reportMarkdown(selectedTask))
      if (!ok) throw new Error(t.reportFailed)
      say(t.reportCopied)
    } catch (e: any) {
      say(String((e && e.message) || t.reportFailed), true)
    } finally {
      setBusy('')
    }
  }

  async function runDownloadReport() {
    if (!selectedTask || busy) return
    const view = selectedTask
    setBusy('report')
    try {
      if (!downloadText(reportMarkdown(view), reportFilename(view.task))) throw new Error(t.reportFailed)
      say(t.reportDownloaded)
    } catch (e: any) {
      say(String((e && e.message) || t.reportFailed), true)
    } finally {
      setBusy('')
    }
  }

  const applyStash = (sha: string) => {
    if (!selectedTask || busy) return
    const id = selectedTask.task.id
    void runAct('stash-apply', () => postLong('task/stash', { id, sha }), t.stashRestored)
  }

  const dropStash = (sha: string) => {
    if (!selectedTask || busy) return
    const id = selectedTask.task.id
    setConfirm({
      title: t.stashDrop,
      body: t.boardStashDropConfirm,
      label: t.stashDrop,
      danger: true,
      run: async () => {
        await postLong('task/stash', { id, sha, action: 'drop' })
        say(t.stashDropped)
        void refresh()
      },
    })
  }

  const viewStash = async (sha: string) => {
    if (!selectedTask) return
    setStashView({ sha, patch: '', loading: true, error: '' })
    try {
      const d: any = await getJson('task/stash-diff?id=' + encodeURIComponent(selectedTask.task.id) + (sha ? '&sha=' + encodeURIComponent(sha) : ''))
      setStashView({ sha, patch: String((d && d.patch) || ''), loading: false, error: '' })
    } catch (e: any) {
      setStashView({ sha, patch: '', loading: false, error: String((e && e.message) || t.failed) })
    }
  }

  function runAction(action: BoardAction) {
    if (!selectedTask) return
    const task = selectedTask.task
    const projectName = projectOfTask ? projectOfTask.project.name : ''
    if (action === 'merge') { void runMerge(); return }
    if (action === 'checkout' || action === 'back') { void runSwitch(action); return }
    if (action === 'cleanup') { runCleanup(); return }
    if (action === 'continue') { openPublish(task.projectId || selectedProjectId, task.id); return }
    if (action === 'open') { if (!task.sessionId || !openNativeSession(task.sessionId)) say(t.openSessionFailed, true); return }
    if (action === 'logs') { setTab('live'); return }
    if (action === 'create' || action === 'start' || action === 'retry') {
      if (!remotes) { say(t.failed, true); return }
      setBusy(action)
      startTask(remotes, task, projectName)
        .then(() => { say(action === 'create' ? t.sessionCreated : t.sessionStarted); setTab('live'); void refresh() })
        .catch((e: any) => say(String((e && e.message) || t.openSessionFailed), true))
        .finally(() => setBusy(''))
    }
  }

  function archiveTask(archived: boolean) {
    if (!selectedTask || busy) return
    const id = selectedTask.task.id
    void runAct(
      archived ? 'unarchive' : 'archive',
      () => postLong(archived ? 'task/unarchive' : 'task/archive', { id }),
      archived ? t.unarchiveDone : t.archiveDone,
    )
  }

  /** Pin / unpin from the rail without opening the task. */
  async function runPin(taskId: string, pinned: boolean) {
    if (busy) return
    setBusy('pin')
    try {
      await post('task/pin', { id: taskId, pinned })
      say(pinned ? t.taskPinned : t.taskUnpinned)
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
    } finally {
      setBusy('')
      void refresh()
    }
  }

  /**
   * Send a free-form instruction into the selected task's session. The same
   * queue-mode prompt path as the sync action, so no new session is created and
   * the task binding stays untouched.
   */
  async function runPrompt(text: string) {
    const value = String(text || '').trim()
    if (!selectedTask || !selectedTask.task.sessionId) throw new Error(t.quickPromptNoSession)
    if (busy) throw new Error(t.failed)
    if (!remotes || !remotes.session) throw new Error(t.failed)
    if (!value) return
    setBusy('prompt')
    try {
      await sendSessionPrompt(remotes, String(selectedTask.task.sessionId), value)
      say(t.quickPromptSent)
    } catch (e: any) {
      say(String((e && e.message) || t.failed), true)
      throw e
    } finally {
      setBusy('')
      void refresh()
    }
  }

  return {
    runAction,
    runCriterion,
    runCopyReport,
    runDownloadReport,
    runSaveMeta,
    runCleanup,
    runDeleteTask,
    runMergeRestore,
    runSyncBaseline,
    runPin,
    runPrompt,
    applyStash,
    dropStash,
    viewStash,
    archiveTask,
  }
}
