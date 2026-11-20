export const DETAIL_CSS = `
.dshw-stack { display: flex; flex-direction: column; gap: var(--w-space-4); }

.dshw-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--w-space-4);
  flex-wrap: wrap;
  padding-bottom: var(--w-space-4);
  margin-bottom: var(--w-space-4);
  border-bottom: 1px solid var(--w-border);
}
.dshw-detail-title-wrap { min-width: 0; flex: 1; }
.dshw-detail-kicker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--w-space-2);
  font-size: 12px;
  color: var(--w-fg-muted);
  margin-bottom: 6px;
}
.dshw-detail-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--w-fg);
}
.dshw-detail-path {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--w-fg-subtle);
}
.dshw-detail-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--w-space-2); }

.dshw-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--w-space-3);
  margin-bottom: var(--w-space-4);
}
.dshw-stat-card {
  padding: var(--w-space-3) var(--w-space-4);
  border: 1px solid var(--w-border);
  border-radius: var(--w-radius-md);
  background: var(--w-bg-subtle);
}
.dshw-stat-card__val {
  font-size: 18px;
  font-weight: 600;
  color: var(--w-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshw-stat-card__label { margin-top: 2px; font-size: 12px; color: var(--w-fg-muted); }

.dshw-card {
  padding: var(--w-space-4);
  border: 1px solid var(--w-border);
  border-radius: var(--w-radius-md);
  background: var(--w-bg);
  margin-bottom: var(--w-space-4);
}
.dshw-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--w-space-3);
}
.dshw-card__head h2 { margin: 0; font-size: 14px; font-weight: 600; }
.dshw-card__empty { padding: var(--w-space-4); text-align: center; color: var(--w-fg-subtle); font-size: 13px; }

.dshw-tabs {
  display: flex;
  gap: var(--w-space-1);
  border-bottom: 1px solid var(--w-border);
  margin-bottom: var(--w-space-4);
}
.dshw-tab {
  padding: 8px 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--w-fg-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--w-fast) var(--w-ease), border-color var(--w-fast) var(--w-ease);
}
.dshw-tab:hover { color: var(--w-fg); }
.dshw-tab--on { color: var(--w-accent); border-bottom-color: var(--w-accent); }

.dshw-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  background: var(--w-bg-hover);
  color: var(--w-fg-muted);
}
.dshw-badge--developing, .dshw-badge--info { background: var(--w-info-bg); color: var(--w-info); }
.dshw-badge--review, .dshw-badge--reviewing, .dshw-badge--warn { background: var(--w-warn-bg); color: var(--w-warn); }
.dshw-badge--merged, .dshw-badge--ok { background: var(--w-ok-bg); color: var(--w-ok); }
.dshw-badge--broken { background: var(--w-danger-bg); color: var(--w-danger); }

.dshw-mini-list { display: flex; flex-direction: column; gap: 2px; }
.dshw-mini-row, .dshw-commit-row {
  display: flex;
  align-items: center;
  gap: var(--w-space-2);
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--w-radius-sm);
  background: transparent;
  color: var(--w-fg);
  font-size: 13px;
  text-align: left;
}
.dshw-mini-row { cursor: pointer; }
.dshw-mini-row:hover { background: var(--w-bg-hover); }
.dshw-mini-row__title, .dshw-commit-msg { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-mini-row__branch, .dshw-commit-hash {
  font-size: 11px;
  color: var(--w-fg-muted);
  background: var(--w-bg-subtle);
  padding: 2px 6px;
  border-radius: 4px;
}
.dshw-mini-row__time { font-size: 11px; color: var(--w-fg-subtle); }

.dshw-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--w-space-3);
}
.dshw-prose { font-size: 13px; line-height: 1.65; white-space: pre-wrap; color: var(--w-fg); }
.dshw-criteria-list { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: var(--w-fg); list-style: disc; }

.dshw-diff-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  border: 1px solid var(--w-border);
  border-radius: var(--w-radius-md);
  overflow: hidden;
}
.dshw-diff-files {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--w-border);
  background: var(--w-bg-subtle);
  max-height: 560px;
  overflow-y: auto;
}
.dshw-diff-summary {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  font-size: 11px;
  border-bottom: 1px solid var(--w-border);
  color: var(--w-fg-muted);
}
.dshw-diff-add { color: var(--w-ok); font-weight: 600; }
.dshw-diff-del { color: var(--w-danger); font-weight: 600; }
.dshw-diff-file {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  background: transparent;
  color: var(--w-fg);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dshw-diff-file:hover { background: var(--w-bg-hover); }
.dshw-diff-file--on { background: var(--w-bg-active); font-weight: 500; }
.dshw-diff-file__path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-diff-file__stat { font-size: 11px; color: var(--w-fg-subtle); }

.dshw-diff-patch { display: flex; flex-direction: column; min-width: 0; max-height: 560px; }
.dshw-diff-patch__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--w-border);
  background: var(--w-bg-subtle);
  font-size: 12px;
}
.dshw-code-block {
  margin: 0;
  padding: 10px 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}
.dshw-code-block > div { padding: 0 12px; white-space: pre; }
.dshw-line--add { background: var(--w-ok-bg); color: var(--w-ok); }
.dshw-line--del { background: var(--w-danger-bg); color: var(--w-danger); }
.dshw-line--hunk { background: var(--w-bg-subtle); color: var(--w-fg-muted); }

.dshw-center { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px; color: var(--w-fg-muted); font-size: 13px; }
`
