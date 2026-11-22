import { PALETTE, paletteVars } from '../palette'
import { PANEL_CSS } from './panel'

/**
 * Instrument-panel layer — shared by the real workbench and the reference prototype.
 *
 * One visual idea, applied on top of both legacy stylesheets:
 *   · no cards: sections are numbered and separated by hairlines
 *   · monospace carries structure (labels, counts, shas, times)
 *   · one copper accent, only for liveness, selection and the primary action
 *   · editorial figures: big tabular numbers, small uppercase labels
 *   · every interactive control is 28/32/36px tall with a 6px radius
 */

/** The reference prototype's Optical Precision surface, scoped so it cannot affect host pages. */

export const WORKBENCH_CSS = `
.dshw-board, .dshw-board *, .dshw-board *::before, .dshw-board *::after { box-sizing: border-box; }
.dshw-board {
  container-type: inline-size; container-name: dshwboard;
  --bg-canvas: #0b0b0c; --bg-rail: #070708; --bg-stage: #0b0b0c; --bg-elevated: #131315;
  --bg-modal: #0f0f11; --bg-hover: rgba(242,240,236,.05); --bg-active: rgba(242,240,236,.085);
  --backdrop: rgba(4,4,5,.74); --line: rgba(242,240,236,.11); --line-strong: rgba(242,240,236,.20);
  --specular: inset 0 1px 0 rgba(242,240,236,.045);
  --modal-shadow: 0 24px 64px rgba(0,0,0,.62), 0 0 0 1px rgba(242,240,236,.09);
  --text-1: #f2f0ec; --text-2: #a9a59d; --text-3: #807c74;
  --cta-bg: #f2f0ec; --cta-text: #0b0b0c; --cta-hover: #ffffff;
  --accent: #e0a256; --accent-soft: rgba(224,162,86,.12); --accent-line: rgba(224,162,86,.30);
  --ok: #8fbf94; --ok-soft: rgba(143,191,148,.12); --ok-line: rgba(143,191,148,.28);
  --warn: #d9a93f; --warn-soft: rgba(217,169,63,.12); --warn-line: rgba(217,169,63,.28);
  --err: #e0776f; --err-soft: rgba(224,119,111,.12); --err-line: rgba(224,119,111,.28);
  --code-bg: #070708; --diff-add-bg: rgba(143,191,148,.12); --diff-del-bg: rgba(224,119,111,.12);
  height: 100%; min-height: 0; position: relative; overflow: hidden;
  color: var(--text-1); background: var(--bg-canvas);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 13px; line-height: 1.5; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.dshw-board[data-theme="light"] {
  --bg-canvas: #f8f5ef; --bg-rail: #f1ede4; --bg-stage: #f8f5ef; --bg-elevated: #fffdf8;
  --bg-modal: #fffdf8; --bg-hover: rgba(23,21,15,.045); --bg-active: rgba(23,21,15,.08);
  --backdrop: rgba(23,21,15,.32); --line: rgba(23,21,15,.14); --line-strong: rgba(23,21,15,.26);
  --specular: inset 0 1px 0 rgba(255,255,255,.9);
  --modal-shadow: 0 24px 60px rgba(20,20,19,.16), 0 0 0 1px rgba(20,20,19,.09);
  --text-1: #17150f; --text-2: #4d4a42; --text-3: #736f64;
  --cta-bg: #17150f; --cta-text: #f8f5ef; --cta-hover: #2b2820;
  --accent: #9a5619; --accent-soft: rgba(154,86,25,.10); --accent-line: rgba(154,86,25,.30);
  --ok: #3f7a4a; --ok-soft: rgba(63,122,74,.10); --ok-line: rgba(63,122,74,.28);
  --warn: #8a5a12; --warn-soft: rgba(138,90,18,.10); --warn-line: rgba(138,90,18,.28);
  --err: #a83a34; --err-soft: rgba(168,58,52,.08); --err-line: rgba(168,58,52,.26);
  --code-bg: #f6f5f0; --diff-add-bg: rgba(16,185,129,.10); --diff-del-bg: rgba(220,38,38,.08);
}
/* Project overview keeps the legacy .dshw-scope palette, but it must follow the
   board theme rather than the host's dshw-dark ancestor (or lack of one). */
.dshw-board[data-theme="light"] .dshw-scope{${paletteVars(PALETTE.light)}}
.dshw-board[data-theme="dark"] .dshw-scope{${paletteVars(PALETTE.dark)}}
.dshw-board .dshwd-mono { font-family: "JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.dshw-board .dshwd-app { display: grid; grid-template-columns: 272px minmax(0,1fr) 284px; height: 100%; min-height: 0; transition: grid-template-columns .18s cubic-bezier(.2,.8,.2,1); }
.dshw-board .dshwd-app.dshwd-hide-left { grid-template-columns: 0 minmax(0,1fr) 284px; }
.dshw-board .dshwd-app.dshwd-hide-right { grid-template-columns: 272px minmax(0,1fr) 0; }
.dshw-board .dshwd-app.dshwd-hide-left.dshwd-hide-right { grid-template-columns: 0 minmax(0,1fr) 0; }
.dshw-board .dshwd-rail { background: var(--bg-rail); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.dshw-board .dshwd-rail-top { padding: 14px 14px 10px; display: flex; align-items: center; justify-content: space-between; }
.dshw-board .dshwd-logo { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; letter-spacing: -.02em; }
.dshw-board .dshwd-logo-mark { width: 18px; height: 18px; border-radius: 5px; background: var(--cta-bg); color: var(--cta-text); display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.dshw-board .dshwd-rail-controls { padding: 0 12px 10px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--line); }
.dshw-board .dshwd-search-wrap { position: relative; }
.dshw-board .dshwd-search { width: 100%; height: 30px; padding: 0 28px 0 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg-stage); color: var(--text-1); font-size: 12px; outline: none; transition: border-color .15s; }
.dshw-board .dshwd-search::placeholder { color: var(--text-3); }
.dshw-board .dshwd-search:focus { border-color: var(--line-strong); }
.dshw-board .dshwd-search-kbd { position: absolute; right: 7px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--text-3); padding: 1px 4px; border: 1px solid var(--line); border-radius: 4px; }
.dshw-board .dshwd-rail-tools { display: flex; align-items: center; gap: 6px; }
.dshw-board .dshwd-archive-toggle { margin-left: auto; height: 27px; padding: 0 7px; font-size: 11px; flex: none; }
.dshw-board .dshwd-filter { position: relative; flex: 1; min-width: 0; }
.dshw-board .dshwd-filter-btn { display: flex; align-items: center; gap: 5px; width: 100%; height: 27px; padding: 0 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-stage); color: var(--text-2); font-size: 12px; cursor: pointer; transition: border-color .12s, background .12s; }
.dshw-board .dshwd-filter-btn:hover { border-color: var(--line-strong); }
.dshw-board .dshwd-filter-btn-on { border-color: var(--accent-line); background: var(--accent-soft); color: var(--accent); }
.dshw-board .dshwd-filter-btn svg { width: 13px; height: 13px; flex: none; }
.dshw-board .dshwd-filter-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.dshw-board .dshwd-filter-count { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: var(--err-soft); color: var(--err); font-size: 10.5px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.dshw-board .dshwd-filter-chev { width: 12px; height: 12px; color: var(--text-3); flex: none; }
.dshw-board .dshwd-filter-panel { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 190px; margin: 0; padding: 5px; list-style: none; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-elevated); box-shadow: 0 12px 32px rgba(0,0,0,.32); }
.dshw-board .dshwd-filter-option { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 7px; font-size: 12.5px; color: var(--text-1); cursor: pointer; }
.dshw-board .dshwd-filter-ico { width: 14px; height: 14px; color: var(--text-3); flex: none; }
.dshw-board .dshwd-filter-option-active { background: var(--bg-hover); }
.dshw-board .dshwd-filter-option-on { background: var(--accent-soft); color: var(--accent); }
.dshw-board .dshwd-filter-option-danger .dshwd-filter-ico { color: var(--err); }
.dshw-board .dshwd-filter-option-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dshw-board .dshwd-filter-option-count { min-width: 16px; text-align: right; color: var(--text-3); font-size: 11px; }
.dshw-board .dshwd-filter-check { width: 13px; height: 13px; color: var(--accent); flex: none; }
.dshw-board .dshwd-attbar { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 7px 12px; border-bottom: 1px solid var(--line); font-size: 11.5px; }
.dshw-board .dshwd-attbar-warn { background: var(--warn-soft); border-bottom-color: var(--warn-line); }
.dshw-board .dshwd-attbar-error { background: var(--err-soft); border-bottom-color: var(--err-line); }
.dshw-board .dshwd-attbar-neutral { background: var(--bg-elevated); color: var(--text-2); }
.dshw-board .dshwd-attbar-icon { display: inline-flex; flex: none; }
.dshw-board .dshwd-attbar-icon svg { width: 14px; height: 14px; }
.dshw-board .dshwd-attbar-warn .dshwd-attbar-icon { color: var(--warn); }
.dshw-board .dshwd-attbar-error .dshwd-attbar-icon { color: var(--err); }
.dshw-board .dshwd-attbar-neutral .dshwd-attbar-icon { color: var(--text-3); }
.dshw-board .dshwd-attbar-text { color: var(--text-1); min-width: 0; flex: 1 1 200px; white-space: normal; overflow-wrap: anywhere; line-height: 1.4; }
.dshw-board .dshwd-attbar-links { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
.dshw-board .dshwd-attbar-link { border: 0; background: transparent; padding: 0; color: var(--accent); font-size: 11.5px; font-weight: 600; cursor: pointer; border-radius: 4px; }
.dshw-board .dshwd-attbar-link:hover { text-decoration: underline; }
.dshw-board .dshwd-attbar-collapse { flex: none; border: 0; background: transparent; color: var(--text-3); font-size: 11px; cursor: pointer; padding: 2px 5px; border-radius: 6px; }
.dshw-board .dshwd-attbar-collapse:hover { color: var(--text-1); background: var(--bg-hover); }
.dshw-board .dshwd-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.dshw-board .dshwd-rail-list { flex: 1; overflow-y: auto; padding: 10px 8px; }
.dshw-board .dshwd-group-head { width: 100%; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 4px; font-size: 11px; font-weight: 500; color: var(--text-3); text-align: left; }
.dshw-board .dshwd-group-head:hover { color: var(--text-2); }
.dshw-board .dshwd-item { position: relative; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: start; gap: 2px; padding: 9px 10px; border-radius: 7px; border: 1px solid transparent; margin-bottom: 2px; transition: background .12s, border-color .12s; }
.dshw-board .dshwd-item:hover { background: var(--bg-hover); }
.dshw-board .dshwd-item.dshwd-active { background: var(--bg-elevated); border-color: var(--line); box-shadow: var(--specular); }
.dshw-board .dshwd-item-main { display: block; width: 100%; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dshw-board .dshwd-item-main:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
.dshw-board .dshwd-item-actions { display: flex; align-items: center; gap: 2px; flex: none; opacity: 0; transition: opacity .12s; }
.dshw-board .dshwd-item:hover .dshwd-item-actions,
.dshw-board .dshwd-item.dshwd-active .dshwd-item-actions,
.dshw-board .dshwd-item:focus-within .dshwd-item-actions,
.dshw-board .dshwd-item.dshwd-item-more-open .dshwd-item-actions { opacity: 1; }
.dshw-board .dshwd-item-action { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--text-3); cursor: pointer; transition: color .12s, background .12s; }
.dshw-board .dshwd-item-action:hover { color: var(--text-1); background: var(--bg-active); }
.dshw-board .dshwd-item-action svg { width: 13px; height: 13px; }
.dshw-board .dshwd-item-action-cta { color: var(--warn); border-color: var(--warn-line); background: var(--warn-soft); }
.dshw-board .dshwd-item-action-cta:hover { color: var(--warn); background: var(--warn-soft); }
.dshw-board .dshwd-item-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.dshw-board .dshwd-chip-sm { padding: 1px 6px; font-size: 10px; gap: 3px; }
.dshw-board .dshwd-more { grid-column: 1 / -1; margin-top: 7px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-stage); display: flex; flex-direction: column; gap: 3px; }
.dshw-board .dshwd-more-head { font-size: 10px; letter-spacing: .04em; text-transform: uppercase; color: var(--text-3); }
.dshw-board .dshwd-more-item { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11.5px; color: var(--text-2); }
.dshw-board .dshwd-more-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-board .dshwd-more-item svg { width: 12px; height: 12px; flex: none; color: var(--warn); }
.dshw-board .dshwd-more-item-err svg { color: var(--err); }
.dshw-board .dshwd-item-row1 { display: flex; align-items: center; gap: 8px; }
.dshw-board .dshwd-item-title { flex: 1; font-size: 12.5px; font-weight: 500; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dshw-board .dshwd-item-stat { font-size: 11px; color: var(--text-3); flex-shrink: 0; }
.dshw-board .dshwd-item-row2 { margin-top: 4px; padding-left: 15px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--text-3); }
.dshw-board .dshwd-item-row2 span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-board .dshwd-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dshw-board .dshwd-dot.dshwd-review { background: var(--warn); }
.dshw-board .dshwd-dot.dshwd-ready { background: var(--text-3); }
.dshw-board .dshwd-dot.dshwd-developing { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); animation: dshwd-pulse 2s infinite; }
.dshw-board .dshwd-dot.dshwd-merged { background: var(--ok); }
.dshw-board .dshwd-dot.dshwd-broken { background: var(--err); }
@keyframes dshwd-pulse { 0%,100% { box-shadow: 0 0 0 2px var(--accent-soft); } 50% { box-shadow: 0 0 0 5px transparent; } }
.dshw-board .dshwd-rail-foot { padding: 10px 12px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
.dshw-board .dshwd-btn { height: 28px; padding: 0 11px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg-elevated); color: var(--text-1); font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: var(--specular); transition: all .12s; white-space: nowrap; }
.dshw-board .dshwd-btn:hover:not(:disabled) { border-color: var(--line-strong); background: var(--bg-active); }
.dshw-board .dshwd-btn:active:not(:disabled) { transform: translateY(.5px); }
.dshw-board .dshwd-btn:disabled { opacity: .45; cursor: not-allowed; }
.dshw-board .dshwd-btn-cta { background: var(--cta-bg); color: var(--cta-text); border-color: transparent; box-shadow: none; }
.dshw-board .dshwd-btn-cta:hover:not(:disabled) { background: var(--cta-hover); border-color: transparent; }
.dshw-board .dshwd-btn-ghost { background: transparent; border-color: transparent; box-shadow: none; color: var(--text-2); padding: 0 7px; }
.dshw-board .dshwd-btn-ghost:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-1); border-color: transparent; }
.dshw-board .dshwd-btn-danger { color: var(--err); background: var(--err-soft); border-color: var(--err-line); box-shadow: none; }
.dshw-board .dshwd-btn-mini { height: 20px; padding: 0 7px; font-size: 10.5px; }
.dshw-board .dshwd-stage { background: var(--bg-stage); display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.dshw-board .dshwd-topbar { height: 46px; padding: 0 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
.dshw-board .dshwd-topbar-left, .dshw-board .dshwd-topbar-right { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dshw-board .dshwd-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dshw-board .dshwd-breadcrumb strong { color: var(--text-1); font-weight: 500; }
.dshw-board .dshwd-stage-head { padding: 22px 32px 0; border-bottom: 1px solid var(--line); flex-shrink: 0; }
.dshw-board .dshwd-stage-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.dshw-board .dshwd-stage-title { font-size: 20px; font-weight: 600; letter-spacing: -.025em; line-height: 1.3; color: var(--text-1); margin: 0; }
.dshw-board .dshwd-stage-sub { margin-top: 6px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; font-size: 12px; color: var(--text-2); }
.dshw-board .dshwd-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; border: 1px solid var(--line); background: var(--bg-elevated); color: var(--text-2); white-space: nowrap; }
.dshw-board .dshwd-chip.dshwd-warn { background: var(--warn-soft); border-color: var(--warn-line); color: var(--warn); }
.dshw-board .dshwd-chip.dshwd-accent { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent); }
.dshw-board .dshwd-chip.dshwd-ok { background: var(--ok-soft); border-color: var(--ok-line); color: var(--ok); }
.dshw-board .dshwd-chip.dshwd-err { background: var(--err-soft); border-color: var(--err-line); color: var(--err); }
.dshw-board .dshwd-tabs { display: flex; gap: 22px; }
.dshw-board .dshwd-tab { position: relative; padding: 8px 0 11px; border: none; background: transparent; color: var(--text-3); font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: color .12s; }
.dshw-board .dshwd-tab:hover { color: var(--text-2); }
.dshw-board .dshwd-tab.dshwd-active { color: var(--text-1); }
.dshw-board .dshwd-tab.dshwd-active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1.5px; background: var(--text-1); }
.dshw-board .dshwd-stage-body { flex: 1; overflow-y: auto; padding: 26px 32px 48px; }
.dshw-board .dshwd-measure { max-width: 720px; }
.dshw-board .dshwd-block { padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--line); }
.dshw-board .dshwd-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.dshw-board .dshwd-block-label { font-size: 11.5px; font-weight: 500; color: var(--text-3); margin-bottom: 10px; }
.dshw-board .dshwd-block-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.dshw-board .dshwd-block-head .dshwd-block-label { margin-bottom: 0; min-width: 0; }
.dshw-board .dshwd-block-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.dshw-board .dshwd-prose { font-size: 13.5px; line-height: 1.7; color: var(--text-2); white-space: pre-wrap; }
.dshw-board .dshwd-check-list { display: flex; flex-direction: column; gap: 9px; }
.dshw-board .dshwd-check-toggle { background: none; border: 0; padding: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.dshw-board .dshwd-check-toggle input[type='checkbox'] { width: 15px; height: 15px; margin: 0; flex-shrink: 0; accent-color: var(--accent); }
.dshw-board .dshwd-check-readonly { color: var(--text-2); }
.dshw-board .dshwd-check-readonly .dshwd-check-box { opacity: .55; }
.dshw-board .dshwd-check-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-1); }
.dshw-board .dshwd-check-box { width: 15px; height: 15px; border-radius: 4px; border: 1px solid var(--ok-line); display: grid; place-items: center; font-size: 10px; color: var(--ok); background: var(--ok-soft); flex-shrink: 0; }
.dshw-board .dshwd-check-box.dshwd-todo { background: transparent; border-color: var(--line-strong); color: transparent; }
.dshw-board .dshwd-check-toggle:hover input[type='checkbox'] { outline: 2px solid var(--accent); outline-offset: 1px; }
.dshw-board .dshwd-check-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
.dshw-board .dshwd-check-toggle:disabled { cursor: default; opacity: .6; }
.dshw-board .dshwd-check-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--text-2); cursor: pointer; }
.dshw-board .dshwd-check-row input { margin: 2px 0 0; flex: none; accent-color: var(--accent); }
.dshw-board .dshwd-check-label { color: var(--text-1); line-height: 1.45; }
.dshw-board .dshwd-check-hint { display: block; margin-top: 1px; font-size: 11px; color: var(--text-3); }
.dshw-board .dshwd-criteria-library { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--line); max-height: 160px; overflow-y: auto; }
.dshw-board .dshwd-stash-card { border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.dshw-board .dshwd-stash-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.dshw-board .dshwd-input.dshwd-invalid, .dshw-board .dshwd-textarea.dshwd-invalid { border-color: var(--err); }
.dshw-board .dshwd-diff-pre { font-family: "JetBrains Mono", "Cascadia Code", ui-monospace, monospace; font-size: 11.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-all; color: var(--text-2); background: var(--code-bg); border: 1px solid var(--line); border-radius: 7px; padding: 10px; }
.dshw-board .dshwd-stream { border: 1px solid var(--line); border-radius: 8px; background: var(--code-bg); overflow: hidden; }
.dshw-board .dshwd-stream-head { padding: 9px 14px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11.5px; color: var(--text-3); }
.dshw-board .dshwd-stream-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 13px; font-size: 12px; }
.dshw-board .dshwd-log-row { display: grid; grid-template-columns: 58px minmax(0,1fr); gap: 12px; }
.dshw-board .dshwd-log-tag { font-size: 9px; letter-spacing: .1em; color: var(--text-3); padding-top: 1px; }
.dshw-board .dshwd-log-main { color: var(--text-2); overflow-wrap: anywhere; }
.dshw-board .dshwd-log-main strong { display: block; color: var(--text-1); font-weight: 500; }
.dshw-board .dshwd-log-main p { margin: 3px 0 0; color: var(--text-3); white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
/* Live session panel: a status bar plus a log/side split, both inside one frame. */
.dshw-board .dshwd-live-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px; padding: 8px 12px; border: 1px solid var(--line); border-bottom: none; border-radius: 8px 8px 0 0; background: var(--bg-elevated); font-size: 11.5px; color: var(--text-2); }
.dshw-board .dshwd-live-stat { display: inline-flex; align-items: baseline; gap: 6px; min-width: 0; }
.dshw-board .dshwd-live-bar-k { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
.dshw-board .dshwd-live-bar-grow { flex: 1 1 auto; }
.dshw-board .dshwd-live-grid { display: grid; grid-template-columns: minmax(0,1fr) 216px; border: 1px solid var(--line); border-radius: 0 0 8px 8px; background: var(--code-bg); overflow: hidden; }
.dshw-board .dshwd-live-log { padding: 8px; display: flex; flex-direction: column; gap: 2px; max-height: 56vh; overflow-y: auto; font-size: 12px; }
.dshw-board .dshwd-live-side { border-left: 1px solid var(--line); padding: 12px; display: flex; flex-direction: column; gap: 16px; background: var(--bg-stage); min-width: 0; }
.dshw-board .dshwd-live-side-block { display: flex; flex-direction: column; gap: 6px; }
.dshw-board .dshwd-live-side-title { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
.dshw-board .dshwd-step { border-radius: 5px; }
.dshw-board .dshwd-step[open] { background: var(--bg-hover); }
.dshw-board .dshwd-step-head { display: flex; align-items: center; gap: 8px; padding: 4px 6px; cursor: pointer; list-style: none; min-width: 0; }
.dshw-board .dshwd-step-head::-webkit-details-marker { display: none; }
.dshw-board .dshwd-step-gutter { color: var(--text-3); font-size: 10.5px; flex: none; width: 18px; }
.dshw-board .dshwd-step-tag { flex: none; font-size: 9.5px; letter-spacing: .06em; color: var(--text-3); border: 1px solid var(--line); border-radius: 3px; padding: 0 4px; }
.dshw-board .dshwd-step--think .dshwd-step-tag { color: var(--accent); border-color: var(--accent-line); }
.dshw-board .dshwd-step--tool .dshwd-step-tag { color: var(--text-2); }
.dshw-board .dshwd-step-title { min-width: 0; flex: 1 1 auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-1); }
.dshw-board .dshwd-step-meta { flex: none; font-size: 10.5px; color: var(--text-3); }
.dshw-board .dshwd-step-status { flex: none; font-size: 10.5px; }
.dshw-board .dshwd-step-body { padding: 2px 6px 8px 32px; color: var(--text-2); font-size: 11.5px; white-space: pre-wrap; overflow-wrap: anywhere; }
.dshw-board .dshwd-todo-mini { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--text-2); }
.dshw-board .dshwd-todo-mini li { display: flex; gap: 7px; align-items: flex-start; overflow-wrap: anywhere; }
.dshw-board .dshwd-todo-mini li.dshwd-done { color: var(--text-3); text-decoration: line-through; }
.dshw-board .dshwd-todo-mark { flex: none; width: 12px; height: 12px; margin-top: 2px; border: 1px solid var(--line-strong); border-radius: 3px; display: grid; place-items: center; font-size: 9px; color: var(--ok); }
.dshw-board .dshwd-todo-mini li.dshwd-done .dshwd-todo-mark { border-color: var(--ok-line); background: var(--ok-soft); }
.dshw-board .dshwd-meter-row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--text-2); }
.dshw-board .dshwd-meter { height: 4px; border-radius: 999px; background: var(--bg-active); overflow: hidden; margin-top: 4px; }
.dshw-board .dshwd-meter i { display: block; height: 100%; background: var(--accent); border-radius: inherit; }
.dshw-board .dshwd-kv-live { gap: 8px; }
.dshw-board .dshwd-kv-live-value { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px 6px; min-width: 0; }
.dshw-board .dshwd-diff-box { border: 1px solid var(--line); border-radius: 8px; background: var(--code-bg); overflow-x: auto; overflow-y: hidden; margin-bottom: 14px; }
.dshw-board .dshwd-diff-head { padding: 8px 14px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--text-2); }
.dshw-board .dshwd-diff-line { margin: 0; padding: 2px 14px; font-size: 12px; line-height: 1.65; white-space: pre; width: max-content; min-width: 100%; box-sizing: border-box; }
.dshw-board .dshwd-diff-line.dshwd-hunk { color: var(--text-3); background: var(--bg-hover); }
.dshw-board .dshwd-diff-line.dshwd-add { background: var(--diff-add-bg); color: var(--ok); }
.dshw-board .dshwd-diff-line.dshwd-del { background: var(--diff-del-bg); color: var(--err); }
.dshw-board .dshwd-diff-line.dshwd-muted { color: var(--text-3); }
.dshw-board .dshwd-inspector { background: var(--bg-rail); border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; overflow-y: auto; padding: 16px; gap: 18px; }
.dshw-board .dshwd-insp-sec { padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.dshw-board .dshwd-insp-sec:last-child { border-bottom: none; padding-bottom: 0; }
.dshw-board .dshwd-insp-title { font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.dshw-board .dshwd-kv { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 0; font-size: 12px; }
.dshw-board .dshwd-kv-k { color: var(--text-3); flex-shrink: 0; }
.dshw-board .dshwd-kv-v { color: var(--text-1); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-board .dshwd-path-box { margin-top: 6px; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg-stage); font-size: 11px; color: var(--text-2); word-break: break-all; cursor: pointer; }
.dshw-board .dshwd-path-box:hover { border-color: var(--line-strong); color: var(--text-1); }
.dshw-board .dshwd-text-muted { color: var(--text-3); }
.dshw-board .dshwd-text-ok { color: var(--ok); }
.dshw-board .dshwd-text-warn { color: var(--warn); }
.dshw-board .dshwd-text-err { color: var(--err); }
.dshw-board .dshwd-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 260px; color: var(--text-3); text-align: center; padding: 32px; }
.dshw-board .dshwd-empty-title { color: var(--text-1); font-size: 14px; font-weight: 500; }
.dshw-board .dshwd-modal-backdrop { position: absolute; inset: 0; background: var(--backdrop); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100; }
.dshw-board .dshwd-modal { width: 100%; max-width: 580px; max-height: 90%; background: var(--bg-modal); border-radius: 11px; box-shadow: var(--modal-shadow), var(--specular); display: flex; flex-direction: column; overflow: hidden; }
.dshw-board .dshwd-modal.dshwd-modal-sm { max-width: 460px; }
.dshw-board .dshwd-modal-head { padding: 15px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dshw-board .dshwd-modal-title-group { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dshw-board .dshwd-modal-title { font-size: 14px; font-weight: 600; letter-spacing: -.015em; }
.dshw-board .dshwd-modal-badge { font-size: 10.5px; color: var(--text-3); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--line); background: var(--bg-stage); white-space: nowrap; }
.dshw-board .dshwd-modal-body { padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.dshw-board .dshwd-field-row-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
.dshw-board .dshwd-field { display: flex; flex-direction: column; gap: 6px; }
.dshw-board .dshwd-label { font-size: 11.5px; font-weight: 500; color: var(--text-2); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dshw-board .dshwd-label-hint { font-weight: 400; font-size: 11px; color: var(--text-3); }
.dshw-board .dshwd-label-text { display: inline-flex; align-items: baseline; gap: 2px; }
.dshw-board .dshwd-required { color: var(--err); font-weight: 600; }
.dshw-board .dshwd-input, .dshw-board .dshwd-select, .dshw-board .dshwd-textarea { width: 100%; border-radius: 7px; border: 1px solid var(--line); background: var(--bg-stage); color: var(--text-1); font-family: inherit; font-size: 12.5px; outline: none; transition: border-color .14s, background .14s; }
.dshw-board .dshwd-input, .dshw-board .dshwd-select { height: 34px; padding: 0 10px; }
.dshw-board .dshwd-textarea { padding: 9px 11px; min-height: 92px; resize: vertical; line-height: 1.6; }
.dshw-board .dshwd-input::placeholder, .dshw-board .dshwd-textarea::placeholder { color: var(--text-3); }
.dshw-board .dshwd-input:focus, .dshw-board .dshwd-select:focus, .dshw-board .dshwd-textarea:focus { border-color: var(--line-strong); background: var(--bg-elevated); }
.dshw-board .dshwd-criteria-box { border: 1px solid var(--line); border-radius: 7px; background: var(--bg-stage); overflow: hidden; }
.dshw-board .dshwd-criteria-items { display: flex; flex-direction: column; }
.dshw-board .dshwd-criteria-chip { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--text-1); }
.dshw-board .dshwd-criteria-chip span { overflow-wrap: anywhere; }
.dshw-board .dshwd-criteria-remove { border: none; background: transparent; color: var(--text-3); cursor: pointer; font-size: 13px; padding: 0 4px; border-radius: 4px; }
.dshw-board .dshwd-criteria-remove:hover { color: var(--err); background: var(--err-soft); }
.dshw-board .dshwd-criteria-add-row { display: flex; align-items: center; gap: 6px; padding: 4px 6px; }
.dshw-board .dshwd-criteria-input { flex: 1; min-width: 0; height: 28px; border: none; background: transparent; color: var(--text-1); font-size: 12px; padding: 0 4px; outline: none; }
.dshw-board .dshwd-criteria-input::placeholder { color: var(--text-3); }
.dshw-board .dshwd-adv-toggle { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--text-3); font-size: 11.5px; font-weight: 500; cursor: pointer; align-self: flex-start; padding: 0; }
.dshw-board .dshwd-adv-toggle:hover { color: var(--text-2); }
.dshw-board .dshwd-adv-panel { display: none; padding: 12px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg-rail); flex-direction: column; gap: 12px; }
.dshw-board .dshwd-adv-panel.dshwd-open { display: flex; }
.dshw-board .dshwd-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dshw-board .dshwd-switch-title { font-size: 12px; font-weight: 500; }
.dshw-board .dshwd-switch-desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.dshw-board .dshwd-switch { position: relative; width: 34px; height: 20px; flex-shrink: 0; }
.dshw-board .dshwd-switch input { opacity: 0; width: 0; height: 0; }
.dshw-board .dshwd-slider { position: absolute; inset: 0; border-radius: 999px; background: var(--bg-active); border: 1px solid var(--line-strong); cursor: pointer; transition: .15s; }
.dshw-board .dshwd-slider::before { content: ""; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: var(--text-2); transition: .15s; }
.dshw-board .dshwd-switch input:checked + .dshwd-slider { background: var(--cta-bg); border-color: var(--cta-bg); }
.dshw-board .dshwd-switch input:checked + .dshwd-slider::before { transform: translateX(14px); background: var(--cta-text); }
.dshw-board .dshwd-modal-foot { padding: 13px 20px; border-top: 1px solid var(--line); background: var(--bg-rail); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dshw-board .dshwd-modal-foot-meta { font-size: 11px; color: var(--text-3); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-board .dshwd-modal-foot-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.dshw-board .dshwd-alert { padding: 9px 11px; border-radius: 7px; border: 1px solid var(--err-line); background: var(--err-soft); color: var(--err); font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dshw-board .dshwd-alert-info { border-color: var(--accent-line); background: var(--accent-soft); color: var(--accent); }
.dshw-board .dshwd-alert-warn { border-color: var(--warn-line); background: var(--warn-soft); color: var(--warn); }
.dshw-board .dshwd-hint { color: var(--text-3); font-size: 11px; line-height: 1.5; }
/* Persistent inline notice: same text as the error toast, but it stays put. */
.dshw-board .dshwd-notice { align-items: flex-start; margin-bottom: 14px; }
.dshw-board .dshwd-notice-text { min-width: 0; overflow-wrap: anywhere; line-height: 1.5; }
.dshw-board .dshwd-notice-title { font-weight: 600; margin-bottom: 2px; }
.dshw-board .dshwd-notice-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.dshw-board .dshwd-btn-copy { flex-shrink: 0; padding: 0 6px; min-height: 22px; height: 22px; line-height: 22px; }
.dshw-board .dshwd-blocker-box { margin-top: 8px; padding: 8px 10px; border-radius: 7px; border: 1px solid var(--warn-line); background: var(--warn-soft); }
.dshw-board .dshwd-blocker-title { font-size: 11px; font-weight: 600; color: var(--warn); margin-bottom: 4px; }
.dshw-board .dshwd-blocker-list { margin: 0; padding-left: 16px; font-size: 11.5px; line-height: 1.55; color: var(--text-2); overflow-wrap: anywhere; }
.dshw-board .dshwd-confirm-details { margin-top: 10px; padding: 8px 10px; border-radius: 7px; background: var(--bg-rail); border: 1px solid var(--line); }
.dshw-board .dshwd-confirm-details .dshwd-kv { gap: 10px; }
.dshw-board .dshwd-kv-path { gap: 8px; }
.dshw-board .dshwd-kv-path-copy { display: flex; align-items: flex-start; justify-content: flex-end; gap: 4px; min-width: 0; flex: 1 1 auto; }
.dshw-board .dshwd-path-wrap { min-width: 0; text-align: right; white-space: normal; overflow-wrap: anywhere; }
.dshw-board .dshwd-insp-narrow-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--line); background: var(--bg-rail); position: sticky; top: 0; z-index: 1; }
.dshw-board .dshwd-insp-narrow-title { font-size: 12px; font-weight: 600; color: var(--text-2); }
.dshw-board .dshwd-toast { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%) translateY(8px); padding: 8px 14px; border-radius: 7px; background: var(--cta-bg); color: var(--cta-text); font-size: 12px; font-weight: 500; opacity: 0; pointer-events: none; transition: all .15s; z-index: 200; max-width: 80%; text-align: center; }
.dshw-board .dshwd-toast.dshwd-show { opacity: 1; transform: translateX(-50%) translateY(0); }
.dshw-board .dshwd-toast.dshwd-error { background: var(--err); color: #fff; }
.dshw-board .dshwd-management { height: 100%; min-height: 0; overflow: hidden; background: var(--bg-stage); }
.dshw-board .dshwd-management > .dshw-scope { height: 100%; min-height: 0; }
.dshw-board .dshwd-management .dshw-detail-inner.dshw-stage-grid { height: 100%; max-width: none; align-items: stretch; overflow: auto; }
.dshw-board .dshwd-management .dshw-stage { min-height: 100%; }
.dshw-board .dshwd-management .dshw-stage-body { flex: 1; min-height: 0; }
.dshw-board .dshwd-management .dshw-measure { max-width: none; }
.dshw-board .dshwd-management .dshw-inspector { position: static; align-self: stretch; overflow: auto; }
@container dshwboard (max-width: 980px) {
  .dshw-board .dshwd-app { grid-template-columns: 248px minmax(0,1fr) 0; }
  .dshw-board .dshwd-app.dshwd-hide-left { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-board .dshwd-app.dshwd-hide-right { grid-template-columns: 248px minmax(0,1fr) 0; }
  .dshw-board .dshwd-app.dshwd-hide-left.dshwd-hide-right { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-board .dshwd-inspector { display: none; }
  .dshw-board .dshwd-app:not(.dshwd-hide-right) .dshwd-inspector { display: flex; position: absolute; right: 0; top: 46px; bottom: 0; width: 300px; z-index: 20; background: var(--bg-rail); box-shadow: -16px 0 40px rgba(0,0,0,.28); }
  .dshw-board .dshwd-stage-head { padding: 18px 20px 0; }
  .dshw-board .dshwd-stage-body { padding: 20px 20px 36px; }
  .dshw-board .dshwd-stage-title-row { flex-direction: column; }
}
@container dshwboard (max-width: 620px) {
  .dshw-board .dshwd-app { grid-template-columns: 208px minmax(0,1fr) 0; }
  .dshw-board .dshwd-app.dshwd-hide-left { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-board .dshwd-app.dshwd-hide-right { grid-template-columns: 208px minmax(0,1fr) 0; }
  .dshw-board .dshwd-app.dshwd-hide-left.dshwd-hide-right { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-board .dshwd-app:not(.dshwd-hide-right) .dshwd-inspector { width: 100%; }
  .dshw-board .dshwd-stage-head { padding: 14px 14px 0; }
  .dshw-board .dshwd-stage-body { padding: 16px 14px 28px; }
  .dshw-board .dshwd-topbar { padding: 0 14px; }
}
/* Below ~720px the board is one column: rail and inspector become overlay
   sheets, stage/task view keeps the full width, and nothing may overflow. */
@container dshwboard (max-width: 720px) {
  .dshw-board .dshwd-app,
  .dshw-board .dshwd-app.dshwd-hide-left,
  .dshw-board .dshwd-app.dshwd-hide-right,
  .dshw-board .dshwd-app.dshwd-hide-left.dshwd-hide-right { grid-template-columns: minmax(0,1fr); position: relative; }
  .dshw-board .dshwd-rail { display: none; }
  .dshw-board .dshwd-app:not(.dshwd-hide-left) .dshwd-rail { display: flex; position: absolute; left: 0; top: 0; bottom: 0; width: min(300px, 88%); z-index: 40; background: var(--bg-rail); box-shadow: 16px 0 40px rgba(0,0,0,.32); }
  .dshw-board .dshwd-stage, .dshw-board .dshwd-inspector { min-width: 0; }
  .dshw-board .dshwd-app:not(.dshwd-hide-right) .dshwd-inspector { display: flex; position: absolute; left: 0; right: 0; top: 0; bottom: 0; width: 100%; z-index: 45; }
  .dshw-board .dshwd-stage-title-row { flex-direction: column; gap: 10px; }
  .dshw-board .dshwd-stage-title-row > div { min-width: 0; max-width: 100%; }
  .dshw-board .dshwd-stage-title-row > div:last-child { flex-wrap: wrap; flex-shrink: 1; }
  .dshw-board .dshwd-btn { white-space: normal; height: auto; max-width: 100%; }
  .dshw-board .dshwd-kv { flex-wrap: wrap; gap: 6px 10px; }
  .dshw-board .dshwd-kv-v { white-space: normal; overflow-wrap: anywhere; min-width: 0; }
  .dshw-board .dshwd-tabs { overflow-x: auto; }
  .dshw-board .dshwd-breadcrumb { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dshw-board .dshwd-attbar { flex-wrap: wrap; padding: 7px 10px; }
  .dshw-board .dshwd-attbar-text { white-space: normal; flex-basis: 100%; }
  .dshw-board .dshwd-attbar-links { margin-left: 0; }
  .dshw-board .dshwd-management .dshw-app,
  .dshw-board .dshwd-management .dshw-app.dshw-rail-hidden { grid-template-columns: minmax(0,1fr); }
  .dshw-board .dshwd-live-grid { grid-template-columns: minmax(0,1fr); }
  .dshw-board .dshwd-live-side { border-left: none; border-top: 1px solid var(--line); }
  .dshw-board .dshwd-live-log { max-height: none; }
}
@container dshwboard (max-width: 480px) {
  .dshw-board .dshwd-topbar { padding: 0 10px; gap: 6px; }
  /* Header buttons keep their glyph only: a wrapped label reads as broken
     layout at phone width. The full text stays in title/aria-label. */
  .dshw-board .dshwd-topbar .dshwd-btn { white-space: nowrap; flex: none; height: 30px; }
  .dshw-board .dshwd-topbar .dshwd-btn-label { display: none; }
  .dshw-board .dshwd-topbar-left { flex: 1 1 auto; }
  .dshw-board .dshwd-topbar-right { flex: none; }
  .dshw-board .dshwd-topbar-count { white-space: nowrap; flex: none; }
  .dshw-board .dshwd-breadcrumb { flex: 1 1 auto; }
  .dshw-board .dshwd-stage-head { padding: 10px 12px 0; }
  .dshw-board .dshwd-stage-title { font-size: 16px; }
  .dshw-board .dshwd-stage-sub { flex-wrap: wrap; gap: 6px; min-width: 0; }
  .dshw-board .dshwd-stage-sub > .dshwd-mono { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dshw-board .dshwd-stage-sub > .dshwd-btn,
  .dshw-board .dshwd-stage-sub > button { flex: none; }
}
${PANEL_CSS}
`
