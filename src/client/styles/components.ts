export const COMPONENTS_CSS = `
.dshw-search {
  display: flex;
  align-items: center;
  gap: var(--w-space-2);
  height: 32px;
  padding: 0 var(--w-space-2);
  border: 1px solid var(--w-border);
  border-radius: var(--w-radius-sm);
  background: var(--w-bg);
  color: var(--w-fg-subtle);
  transition: border-color var(--w-fast) var(--w-ease);
}
.dshw-search:focus-within { border-color: var(--w-accent); color: var(--w-fg); }
.dshw-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--w-fg);
  font-size: 13px;
}

.dshw-project {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: var(--w-radius-sm);
  transition: background var(--w-fast) var(--w-ease);
}
.dshw-project:hover { background: var(--w-bg-hover); }
.dshw-project--on { background: var(--w-bg-active); }

.dshw-project-toggle,
.dshw-project-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: var(--w-radius-sm);
  background: transparent;
  color: var(--w-fg-subtle);
  cursor: pointer;
}
.dshw-project-toggle:hover,
.dshw-project-add:hover { background: var(--w-bg-hover); color: var(--w-fg); }
.dshw-project[data-open="false"] .dshw-project-toggle svg { transform: rotate(-90deg); }

.dshw-project-select {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--w-space-2);
  padding: 4px;
  border: 0;
  background: transparent;
  color: var(--w-fg);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.dshw-project-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-project-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--w-bg-hover);
  color: var(--w-fg-muted);
}

.dshw-folder-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--w-radius-sm);
  flex-shrink: 0;
}
.dshw-folder-tile--blue { background: rgba(37, 99, 235, 0.12); color: #2563eb; }
.dshw-folder-tile--purple { background: rgba(124, 58, 237, 0.12); color: #7c3aed; }
.dshw-folder-tile--green { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.dshw-folder-tile--orange { background: rgba(234, 88, 12, 0.12); color: #ea580c; }

.dshw-task-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 2px 0 var(--w-space-2) 14px;
  padding-left: var(--w-space-2);
  border-left: 1px solid var(--w-border);
}

.dshw-form-section {
  display: flex;
  flex-direction: column;
  gap: var(--w-space-3);
  padding: var(--w-space-3);
  border: 1px solid var(--w-border);
  border-radius: var(--w-radius-md);
  background: var(--w-bg-subtle);
  margin-bottom: var(--w-space-3);
}
.dshw-form-section__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--w-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dshw-input,
.dshw-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid var(--w-border-strong);
  border-radius: var(--w-radius-sm);
  background: var(--w-bg);
  color: var(--w-fg);
  font-size: 13px;
  transition: border-color var(--w-fast) var(--w-ease), box-shadow var(--w-fast) var(--w-ease);
}
.dshw-input:focus,
.dshw-textarea:focus {
  outline: none;
  border-color: var(--w-accent);
  box-shadow: 0 0 0 2px var(--w-bg-active);
}
.dshw-invalid { border-color: var(--w-danger); }
`
