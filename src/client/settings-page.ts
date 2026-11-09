import { React, h, useStyles } from './ui'
import { Btn, Card, CardHead, Icon, IconBtn, KV, Modal, Spinner, Toast } from './primitives'
import { useToast } from './hooks'
import { getJson, post } from './context'
import { copyText } from './format'

export function SettingsPage(props: any) {
    const t = props.__t
    useStyles()
    const [cfg, setCfg] = React.useState(null)
    const [recents, setRecents] = React.useState([])
    const [criteria, setCriteria] = React.useState([] as string[])
    const [newCriterion, setNewCriterion] = React.useState('')
    const [criteriaBusy, setCriteriaBusy] = React.useState(false)
    const [clearing, setClearing] = React.useState(false)
    const [clearOpen, setClearOpen] = React.useState(false)
    const [err, setErr] = React.useState('')
    const { toast, notify } = useToast()
    const clearRef = React.useRef(false)

    React.useEffect(() => {
      getJson('config').then((d: any) => setCfg(d.config)).catch((e: any) => setErr((e && e.message) || t.loadFailed))
      getJson('recents').then((d: any) => setRecents(d.dirs || [])).catch(() => {})
      getJson('acceptance-criteria').then((d: any) => setCriteria(Array.isArray(d.items) ? d.items : [])).catch(() => {})
    }, [])

    const addCriterion = async () => {
      const text = newCriterion.trim()
      if (!text || criteriaBusy) return
      setCriteriaBusy(true)
      setErr('')
      try {
        const d: any = await post('acceptance-criteria/add', { text })
        setCriteria(Array.isArray(d.items) ? d.items : [])
        setNewCriterion('')
        notify(t.criterionAdded)
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        setCriteriaBusy(false)
      }
    }

    const removeCriterion = async (text: string) => {
      if (criteriaBusy) return
      setCriteriaBusy(true)
      setErr('')
      try {
        const d: any = await post('acceptance-criteria/delete', { text })
        setCriteria(Array.isArray(d.items) ? d.items : [])
        notify(t.criterionRemoved)
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        setCriteriaBusy(false)
      }
    }

    const clearRecents = async () => {
      if (clearRef.current || clearing) return
      clearRef.current = true
      setClearing(true)
      setErr('')
      try {
        await post('recents/clear', {})
        setRecents([])
        setClearOpen(false)
        notify(t.recentsCleared)
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        clearRef.current = false
        setClearing(false)
      }
    }

    const clearModal = clearOpen
      ? h(Modal, {
        t,
        title: t.clearRecentsTitle,
        subtitle: t.clearRecentsSub,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: clearing,
        onClose: () => { if (!clearing) setClearOpen(false) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setClearOpen(false), disabled: clearing, 'data-autofocus': true }, t.cancel),
          h(Btn, { key: 'ok', variant: 'danger', disabled: clearing, onClick: () => void clearRecents() },
            clearing ? h(Spinner) : null, clearing ? t.deleting : t.clearRecents),
        ],
      },
        h('div', { className: 'dshw-danger-list' },
          h('div', { className: 'dshw-danger-title' }, h(Icon, { name: 'alert' }), String(t.clearRecentsDanger).replace('{n}', String(recents.length))),
          recents.map((dir: string) => h('div', { key: dir, className: 'dshw-danger-item' }, h(Icon, { name: 'folder' }), h('span', null, dir)))),
        h('div', { className: 'dshw-hint' }, t.clearRecentsHint),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null)
      : null

    return h('div', { className: 'dshw-scope dshw-shell', style: { overflow: 'auto' } },
      h('div', { className: 'dshw-settings' },
        h('div', { className: 'dshw-page-head' },
          h('div', { className: 'dshw-page-icon' }, h(Icon, { name: 'settings' })),
          h('div', { className: 'dshw-page-head-copy' },
            h('h1', null, t.title),
            h('div', { className: 'dshw-page-sub' }, t.settingsSub))),
        err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null,
        h(Card, null,
          h(CardHead, { icon: 'checkCircle', title: t.acceptanceLibrary }),
          h('p', { className: 'dshw-card-sub' }, t.acceptanceLibraryHint),
          h('div', { className: 'dshw-criteria-add' },
            h('input', {
              className: 'dshw-input',
              value: newCriterion,
              placeholder: t.criterionInputPlaceholder,
              onChange: (e: any) => setNewCriterion(e.target.value),
              onKeyDown: (e: any) => { if (e.key === 'Enter') { e.preventDefault(); void addCriterion() } },
            }),
            h(Btn, { variant: 'primary', disabled: !newCriterion.trim() || criteriaBusy, onClick: () => void addCriterion() },
              criteriaBusy ? h(Spinner) : null, t.addCriterion)),
          criteria.length
            ? h('div', { className: 'dshw-criteria-lib' }, criteria.map((item: string) =>
              h('div', { key: item, className: 'dshw-criteria-lib-row' },
                h(Icon, { name: 'check' }),
                h('span', { className: 'dshw-criteria-lib-text' }, item),
                h(IconBtn, { size: 'sm', icon: 'x', label: t.removeCriterion, onClick: () => void removeCriterion(item) }))))
            : h('div', { className: 'dshw-hint' }, t.acceptanceLibraryEmpty)),
        h(Card, null,
          h(CardHead, {
            icon: 'clock',
            title: t.recents,
            right: h('span', { className: 'dshw-hint', style: { margin: 0 } }, recents.length + ' ' + t.dirUnit),
          }),
          recents.length
            ? h('div', { className: 'dshw-recent-list' }, recents.map((dir: string) =>
              h('div', { key: dir, className: 'dshw-recent-row' },
                h(Icon, { name: 'folder' }),
                h('div', { className: 'dshw-recent-main' },
                  h('div', { className: 'dshw-recent-path', title: dir }, dir)),
                h(IconBtn, {
                  size: 'sm',
                  icon: 'copy',
                  label: t.copyPath,
                  onClick: () => { void copyText(dir).then((ok) => notify(ok ? t.copied : t.copyFailed, ok ? 'ok' : 'error')) },
                }))))
            : h('div', { className: 'dshw-hint' }, t.recentsEmpty),
          h('div', { className: 'dshw-hint', style: { marginTop: '10px' } }, t.recentsHint),
          h('div', { className: 'dshw-danger-row' },
            h(Icon, { name: 'trash' }),
            h('span', null, t.clearRecentsShortHint),
            h(Btn, {
              size: 'sm',
              variant: 'danger',
              disabled: recents.length === 0,
              onClick: () => setClearOpen(true),
            }, t.clearRecents))),
        h(Card, null,
          h(CardHead, { icon: 'sliders', title: t.config }),
          h('p', { className: 'dshw-card-sub' }, t.configHint),
          h('div', { className: 'dshw-kv' },
            h(KV, { label: t.worktreeDirName }, h('code', null, cfg ? String(cfg.dirName) : '…')),
            h(KV, { label: t.branchPrefix }, h('code', null, cfg ? String(cfg.branchPrefix) : '…')),
            h(KV, { label: t.gitPath }, h('code', null, cfg ? String(cfg.gitPath) : '…')))),
        clearModal),
      h(Toast, { toast }))
  }


