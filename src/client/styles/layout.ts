export const LAYOUT_CSS = `
.dshw-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--w-bg);
}

.dshw-app {
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.dshw-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--w-border);
  background: var(--w-bg-subtle);
}

.dshw-tree-head {
  display: flex;
  flex-direction: column;
  gap: var(--w-space-2);
  padding: var(--w-space-3);
  border-bottom: 1px solid var(--w-border);
  background: var(--w-bg-subtle);
}

.dshw-tree-tools {
  display: flex;
  align-items: center;
  gap: var(--w-space-1);
}

.dshw-tree-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--w-space-2);
}

.dshw-tree-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--w-space-2) var(--w-space-3);
  border-top: 1px solid var(--w-border);
  font-size: 11px;
  color: var(--w-fg-subtle);
}

.dshw-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--w-bg);
}

.dshw-detail-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--w-space-5);
}

.dshw-detail-inner {
  max-width: 960px;
  margin: 0 auto;
}

.dshw-mobile-bar {
  display: none;
  margin-bottom: var(--w-space-3);
}

@media (max-width: 820px) {
  .dshw-app { grid-template-columns: 1fr; }
  .dshw-app--detail .dshw-sidebar { display: none; }
  .dshw-app:not(.dshw-app--detail) .dshw-detail { display: none; }
  .dshw-mobile-bar { display: flex; }
}
`
