import { React, h, useStyles } from './ui'
import { Btn, Card, CardHead, Icon, IconBtn, KV, Modal, Spinner, TextInput, Toast } from './primitives'
import { useToast } from './hooks'
import { getJson, post } from './context'
import { copyText } from './format'
import type { TaskTemplate } from '../models'

export function SettingsPage(props: any) {
    const t = props.__t
    useStyles()
    const [cfg, setCfg] = React.useState(null)
    const [recents, setRecents] = React.useState([])
    const [criteria, setCriteria] = React.useState([] as string[])
    const [newCriterion, setNewCriterion] = React.useState('')
    const [criteriaBusy, setCriteriaBusy] = React.useState(false)
    const [criteriaSearch, setCriteriaSearch] = React.useState('')
    const [templates, setTemplates] = React.useState([] as TaskTemplate[])
    const [templateEdit, setTemplateEdit] = React.useState('')
    const [templateName, setTemplateName] = React.useState('')
    const [templateTitle, setTemplateTitle] = React.useState('')
    const [templateDesc, setTemplateDesc] = React.useState('')
    const [templateCriteria, setTemplateCriteria] = React.useState('')
    const [templateBusy, setTemplateBusy] = React.useState(false)
    const [templateDelete, setTemplateDelete] = React.useState(null as TaskTemplate | null)
    const [editingText, setEditingText] = React.useState('')
    const [editingValue, setEditingValue] = React.useState('')
    const [clearing, setClearing] = React.useState(false)
    const [clearOpen, setClearOpen] = React.useState(false)
    const [err, setErr] = React.useState('')
    const { toast, notify, dismiss } = useToast()
    const clearRef = React.useRef(false)

    React.useEffect(() => {
      getJson('config').then((d: any) => setCfg(d.config)).catch((e: any) => setErr((e && e.message) || t.loadFailed))
      getJson('recents').then((d: any) => setRecents(d.dirs || [])).catch(() => {})
      getJson('acceptance-criteria').then((d: any) => setCriteria(Array.isArray(d.items) ? d.items : [])).catch(() => {})
      getJson('templates').then((d: any) => setTemplates(Array.isArray(d.templates) ? d.templates : [])).catch(() => {})
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

    const saveCriteriaList = async (next: string[]) => {
      if (criteriaBusy) return
      setCriteriaBusy(true)
      setErr('')
      try {
        const d: any = await post('acceptance-criteria/set', { items: next })
        setCriteria(Array.isArray(d.items) ? d.items : [])
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        setCriteriaBusy(false)
      }
    }
    const moveCriterion = (text: string, dir: number) => {
      const index = criteria.indexOf(text)
      const target = index + dir
      if (index < 0 || target < 0 || target >= criteria.length) return
      const next = [...criteria]
      ;[next[index], next[target]] = [next[target], next[index]]
      void saveCriteriaList(next)
    }
    const saveEdit = () => {
      const value = editingValue.trim()
      if (!value || criteriaBusy) return
      const next = criteria.map((item: string) => (item === editingText ? value : item))
      void saveCriteriaList(next).then(() => { setEditingText(''); setEditingValue('') })
    }

    // ----- Publish templates: locked read-modify-write on the host ----------
    const resetTemplate = () => {
      setTemplateEdit('')
      setTemplateName('')
      setTemplateTitle('')
      setTemplateDesc('')
      setTemplateCriteria('')
    }

    const editTemplate = (item: TaskTemplate) => {
      setTemplateEdit(item.id)
      setTemplateName(item.name)
      setTemplateTitle(item.title || '')
      setTemplateDesc(item.description || '')
      setTemplateCriteria((item.criteria || []).join('\n'))
    }

    const saveTemplate = async () => {
      const name = templateName.trim()
      if (!name || templateBusy) return
      setTemplateBusy(true)
      setErr('')
      try {
        const d: any = await post('templates/save', {
          id: templateEdit || undefined,
          name,
          title: templateTitle.trim(),
          description: templateDesc.trim(),
          criteria: templateCriteria.split('\n').map((line: string) => line.trim()).filter(Boolean),
        })
        setTemplates(Array.isArray(d.templates) ? d.templates : [])
        resetTemplate()
        notify(t.templateSaved)
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        setTemplateBusy(false)
      }
    }

    const removeTemplate = async (id: string) => {
      if (templateBusy) return
      setTemplateBusy(true)
      setErr('')
      try {
        const d: any = await post('templates/delete', { id })
        setTemplates(Array.isArray(d.templates) ? d.templates : [])
        setTemplateDelete(null)
        if (templateEdit === id) resetTemplate()
        notify(t.templateDeleted)
      } catch (e: any) {
        setErr((e && e.message) || t.failed)
      } finally {
        setTemplateBusy(false)
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
          h(Btn, { key: 'c', onClick: () => setClearOpen(false), disabled: clearing, 'data-modal-autofocus': true }, t.cancel),
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

    const templateModal = templateDelete
      ? h(Modal, {
        t,
        title: t.templateDelete,
        subtitle: templateDelete.name,
        icon: 'trash',
        tone: 'danger',
        size: 'sm',
        busy: templateBusy,
        onClose: () => { if (!templateBusy) setTemplateDelete(null) },
        footer: [
          h(Btn, { key: 'c', onClick: () => setTemplateDelete(null), disabled: templateBusy, 'data-modal-autofocus': true }, t.cancel),
          h(Btn, { key: 'ok', variant: 'danger', disabled: templateBusy, onClick: () => { if (templateDelete) void removeTemplate(templateDelete.id) } },
            templateBusy ? h(Spinner) : null, t.templateDelete),
        ],
      }, h('div', { className: 'dshw-hint' }, t.templateDeleteConfirm))
      : null

    return h('div', { className: 'dshw-scope dshw-shell', style: { overflow: 'auto' } },
      h('div', { className: 'dshw-stage dshw-settings' },
        h('div', { className: 'dshw-topbar' },
          h('div', { className: 'dshw-topbar-left' },
            h('div', { className: 'dshw-breadcrumb' },
              h(Icon, { name: 'settings' }),
              h('strong', null, t.title)))),
        h('header', { className: 'dshw-stage-head' },
          h('div', { className: 'dshw-stage-title-row' },
            h('div', { style: { minWidth: 0 } },
              h('h1', { className: 'dshw-stage-title' }, t.title),
              h('div', { className: 'dshw-stage-sub' }, h('span', null, t.settingsSub))))),
        h('div', { className: 'dshw-stage-body' },
          h('div', { className: 'dshw-measure' },
            err ? h('div', { className: 'dshw-err', role: 'alert' }, h(Icon, { name: 'alert' }), h('span', null, err)) : null,
        h(Card, null,
          h(CardHead, { icon: 'checkCircle', title: t.acceptanceLibrary }),
          h('p', { className: 'dshw-card-sub' }, t.acceptanceLibraryHint),
          h('div', { className: 'dshw-criteria-add' },
            h(TextInput, {

              value: newCriterion,
              placeholder: t.criterionInputPlaceholder,
              onChange: (e: any) => setNewCriterion(e.target.value),
              onKeyDown: (e: any) => { if (e.key === 'Enter') { e.preventDefault(); void addCriterion() } },
            }),
            h(Btn, { variant: 'primary', disabled: !newCriterion.trim() || criteriaBusy, onClick: () => void addCriterion() },
              criteriaBusy ? h(Spinner) : null, t.addCriterion)),
          criteria.length
            ? h(TextInput, {

              value: criteriaSearch,
              placeholder: t.criteriaSearch,
              style: { marginTop: '8px' },
              onChange: (e: any) => setCriteriaSearch(e.target.value),
            })
            : null,
          criteria.length
            ? h('div', { className: 'dshw-criteria-lib' }, criteria
              .filter((item: string) => !criteriaSearch.trim() || item.toLowerCase().includes(criteriaSearch.trim().toLowerCase()))
              .map((item: string) => h('div', { key: item, className: 'dshw-criteria-lib-row' },
                h(Icon, { name: 'check' }),
                editingText === item
                  ? h(TextInput, {

                    value: editingValue,
                    placeholder: t.criteriaEditPlaceholder,
                    onChange: (e: any) => setEditingValue(e.target.value),
                    onKeyDown: (e: any) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit() } },
                  })
                  : h('span', { className: 'dshw-criteria-lib-text' }, item),
                editingText === item
                  ? [
                    h(Btn, { key: 's', size: 'sm', variant: 'primary', disabled: criteriaBusy, onClick: () => saveEdit() }, t.criteriaSave),
                    h(Btn, { key: 'c', size: 'sm', disabled: criteriaBusy, onClick: () => { setEditingText(''); setEditingValue('') } }, t.cancel),
                  ]
                  : [
                    h(IconBtn, { key: 'up', size: 'sm', icon: 'arrowUp', label: t.criteriaMoveUp, disabled: criteria.indexOf(item) === 0, onClick: () => moveCriterion(item, -1) }),
                    h(IconBtn, { key: 'down', size: 'sm', icon: 'chevronDown', label: t.criteriaMoveDown, disabled: criteria.indexOf(item) === criteria.length - 1, onClick: () => moveCriterion(item, 1) }),
                    h(IconBtn, { key: 'edit', size: 'sm', icon: 'file', label: t.criteriaEdit, onClick: () => { setEditingText(item); setEditingValue(item) } }),
                    h(IconBtn, { key: 'x', size: 'sm', icon: 'x', label: t.removeCriterion, onClick: () => void removeCriterion(item) }),
                  ])))
            : h('div', { className: 'dshw-hint' }, t.acceptanceLibraryEmpty)),
        h(Card, null,
          h(CardHead, {
            icon: 'file',
            title: t.templates,
            right: h(Btn, { size: 'sm', disabled: templateBusy, onClick: resetTemplate }, t.templateNew),
          }),
          h('p', { className: 'dshw-card-sub' }, t.templateHint),
          templates.length
            ? h('div', { className: 'dshw-template-list' }, templates.map((item: TaskTemplate) =>
              h('div', { key: item.id, className: 'dshw-template-row' + (templateEdit === item.id ? ' dshw-template-row-on' : '') },
                h('div', { className: 'dshw-template-main' },
                  h('div', { className: 'dshw-template-name' }, item.name),
                  item.title ? h('div', { className: 'dshw-hint' }, item.title) : null,
                  item.description ? h('div', { className: 'dshw-hint' }, item.description) : null,
                  item.criteria && item.criteria.length
                    ? h('div', { className: 'dshw-template-criteria' }, item.criteria.map((text: string, i: number) =>
                      h('span', { key: i, className: 'dshw-chip dshw-chip--sm' }, text)))
                    : null),
                h(IconBtn, { size: 'sm', icon: 'file', label: t.templateEdit, onClick: () => editTemplate(item) }),
                h(IconBtn, { size: 'sm', icon: 'trash', label: t.templateDelete, onClick: () => setTemplateDelete(item) }))))
            : h('div', { className: 'dshw-hint' }, t.templateEmpty),
          h('div', { className: 'dshw-template-form' },
            h(TextInput, {
              value: templateName,
              placeholder: t.templateName,
              'aria-label': t.templateName,
              onChange: (e: any) => setTemplateName(e.target.value),
            }),
            h(TextInput, {
              value: templateTitle,
              placeholder: t.templateTitle,
              'aria-label': t.templateTitle,
              onChange: (e: any) => setTemplateTitle(e.target.value),
            }),
            h(TextInput, {
              value: templateDesc,
              placeholder: t.templateDescription,
              'aria-label': t.templateDescription,
              onChange: (e: any) => setTemplateDesc(e.target.value),
            }),
            h('textarea', {
              className: 'dshw-input dshw-template-criteria-input',
              rows: 4,
              value: templateCriteria,
              placeholder: t.templateCriteria,
              'aria-label': t.templateCriteria,
              onChange: (e: any) => setTemplateCriteria(e.target.value),
            }),
            h('div', { className: 'dshw-form-foot' },
              h(Btn, { variant: 'primary', disabled: !templateName.trim() || templateBusy, onClick: () => void saveTemplate() },
                templateBusy ? h(Spinner) : null, t.templateSave),
              templateEdit ? h(Btn, { disabled: templateBusy, onClick: resetTemplate }, t.templateCancel) : null))),
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
            clearModal,
            templateModal))),
      h(Toast, { toast, onClose: dismiss }))
  }


