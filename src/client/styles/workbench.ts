import { PALETTE, paletteVars } from '../palette'
import { PANEL_CSS } from './panel'

/**
 * Instrument-panel layer — shared by the real workbench and demo.html.
 *
 * One visual idea, applied on top of both legacy stylesheets:
 *   · no cards: sections are numbered and separated by hairlines
 *   · monospace carries structure (labels, counts, shas, times)
 *   · one copper accent, only for liveness, selection and the primary action
 *   · editorial figures: big tabular numbers, small uppercase labels
 *   · every interactive control is 28/32/36px tall with a 6px radius
 */

/** Demo.html's Optical Precision surface, scoped so it cannot affect host pages. */

export const WORKBENCH_CSS = `
.dshw-demo, .dshw-demo *, .dshw-demo *::before, .dshw-demo *::after { box-sizing: border-box; }
.dshw-demo {
  container-type: inline-size; container-name: dshwdemo;
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
.dshw-demo[data-theme="light"] {
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
.dshw-demo[data-theme="light"] .dshw-scope{${paletteVars(PALETTE.light)}}
.dshw-demo[data-theme="dark"] .dshw-scope{${paletteVars(PALETTE.dark)}}
.dshw-demo .dshwd-mono { font-family: "JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.dshw-demo .dshwd-app { display: grid; grid-template-columns: 272px minmax(0,1fr) 284px; height: 100%; min-height: 0; transition: grid-template-columns .18s cubic-bezier(.2,.8,.2,1); }
.dshw-demo .dshwd-app.dshwd-hide-left { grid-template-columns: 0 minmax(0,1fr) 284px; }
.dshw-demo .dshwd-app.dshwd-hide-right { grid-template-columns: 272px minmax(0,1fr) 0; }
.dshw-demo .dshwd-app.dshwd-hide-left.dshwd-hide-right { grid-template-columns: 0 minmax(0,1fr) 0; }
.dshw-demo .dshwd-rail { background: var(--bg-rail); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.dshw-demo .dshwd-rail-top { padding: 14px 14px 10px; display: flex; align-items: center; justify-content: space-between; }
.dshw-demo .dshwd-logo { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; letter-spacing: -.02em; }
.dshw-demo .dshwd-logo-mark { width: 18px; height: 18px; border-radius: 5px; background: var(--cta-bg); color: var(--cta-text); display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.dshw-demo .dshwd-rail-controls { padding: 0 12px 10px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--line); }
.dshw-demo .dshwd-search-wrap { position: relative; }
.dshw-demo .dshwd-search { width: 100%; height: 30px; padding: 0 28px 0 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg-stage); color: var(--text-1); font-size: 12px; outline: none; transition: border-color .15s; }
.dshw-demo .dshwd-search::placeholder { color: var(--text-3); }
.dshw-demo .dshwd-search:focus { border-color: var(--line-strong); }
.dshw-demo .dshwd-search-kbd { position: absolute; right: 7px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--text-3); padding: 1px 4px; border: 1px solid var(--line); border-radius: 4px; }
.dshw-demo .dshwd-pills { display: flex; gap: 4px; }
.dshw-demo .dshwd-pill { flex: 1; height: 24px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--text-3); font-size: 11px; font-weight: 500; cursor: pointer; transition: all .12s; }
.dshw-demo .dshwd-pill:hover { color: var(--text-2); background: var(--bg-hover); }
.dshw-demo .dshwd-pill.dshwd-active { color: var(--text-1); background: var(--bg-elevated); border-color: var(--line); box-shadow: var(--specular); }
.dshw-demo .dshwd-rail-list { flex: 1; overflow-y: auto; padding: 10px 8px; }
.dshw-demo .dshwd-group-head { width: 100%; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 4px; font-size: 11px; font-weight: 500; color: var(--text-3); text-align: left; }
.dshw-demo .dshwd-group-head:hover { color: var(--text-2); }
.dshw-demo .dshwd-item { padding: 9px 10px; border-radius: 7px; border: 1px solid transparent; cursor: pointer; margin-bottom: 2px; transition: background .12s, border-color .12s; }
.dshw-demo .dshwd-item:hover { background: var(--bg-hover); }
.dshw-demo .dshwd-item.dshwd-active { background: var(--bg-elevated); border-color: var(--line); box-shadow: var(--specular); }
.dshw-demo .dshwd-item-row1 { display: flex; align-items: center; gap: 8px; }
.dshw-demo .dshwd-item-title { flex: 1; font-size: 12.5px; font-weight: 500; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dshw-demo .dshwd-item-stat { font-size: 11px; color: var(--text-3); flex-shrink: 0; }
.dshw-demo .dshwd-item-row2 { margin-top: 4px; padding-left: 15px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--text-3); }
.dshw-demo .dshwd-item-row2 span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-demo .dshwd-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dshw-demo .dshwd-dot.dshwd-review { background: var(--warn); }
.dshw-demo .dshwd-dot.dshwd-ready { background: var(--text-3); }
.dshw-demo .dshwd-dot.dshwd-developing { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); animation: dshwd-pulse 2s infinite; }
.dshw-demo .dshwd-dot.dshwd-merged { background: var(--ok); }
.dshw-demo .dshwd-dot.dshwd-broken { background: var(--err); }
@keyframes dshwd-pulse { 0%,100% { box-shadow: 0 0 0 2px var(--accent-soft); } 50% { box-shadow: 0 0 0 5px transparent; } }
.dshw-demo .dshwd-rail-foot { padding: 10px 12px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
.dshw-demo .dshwd-btn { height: 28px; padding: 0 11px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg-elevated); color: var(--text-1); font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: var(--specular); transition: all .12s; white-space: nowrap; }
.dshw-demo .dshwd-btn:hover:not(:disabled) { border-color: var(--line-strong); background: var(--bg-active); }
.dshw-demo .dshwd-btn:active:not(:disabled) { transform: translateY(.5px); }
.dshw-demo .dshwd-btn:disabled { opacity: .45; cursor: not-allowed; }
.dshw-demo .dshwd-btn-cta { background: var(--cta-bg); color: var(--cta-text); border-color: transparent; box-shadow: none; }
.dshw-demo .dshwd-btn-cta:hover:not(:disabled) { background: var(--cta-hover); border-color: transparent; }
.dshw-demo .dshwd-btn-ghost { background: transparent; border-color: transparent; box-shadow: none; color: var(--text-2); padding: 0 7px; }
.dshw-demo .dshwd-btn-ghost:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-1); border-color: transparent; }
.dshw-demo .dshwd-btn-danger { color: var(--err); background: var(--err-soft); border-color: var(--err-line); box-shadow: none; }
.dshw-demo .dshwd-stage { background: var(--bg-stage); display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.dshw-demo .dshwd-topbar { height: 46px; padding: 0 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
.dshw-demo .dshwd-topbar-left, .dshw-demo .dshwd-topbar-right { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dshw-demo .dshwd-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dshw-demo .dshwd-breadcrumb strong { color: var(--text-1); font-weight: 500; }
.dshw-demo .dshwd-stage-head { padding: 22px 32px 0; border-bottom: 1px solid var(--line); flex-shrink: 0; }
.dshw-demo .dshwd-stage-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.dshw-demo .dshwd-stage-title { font-size: 20px; font-weight: 600; letter-spacing: -.025em; line-height: 1.3; color: var(--text-1); margin: 0; }
.dshw-demo .dshwd-stage-sub { margin-top: 6px; display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-2); }
.dshw-demo .dshwd-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; border: 1px solid var(--line); background: var(--bg-elevated); color: var(--text-2); white-space: nowrap; }
.dshw-demo .dshwd-chip.dshwd-warn { background: var(--warn-soft); border-color: var(--warn-line); color: var(--warn); }
.dshw-demo .dshwd-chip.dshwd-accent { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent); }
.dshw-demo .dshwd-chip.dshwd-ok { background: var(--ok-soft); border-color: var(--ok-line); color: var(--ok); }
.dshw-demo .dshwd-chip.dshwd-err { background: var(--err-soft); border-color: var(--err-line); color: var(--err); }
.dshw-demo .dshwd-tabs { display: flex; gap: 22px; }
.dshw-demo .dshwd-tab { position: relative; padding: 8px 0 11px; border: none; background: transparent; color: var(--text-3); font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: color .12s; }
.dshw-demo .dshwd-tab:hover { color: var(--text-2); }
.dshw-demo .dshwd-tab.dshwd-active { color: var(--text-1); }
.dshw-demo .dshwd-tab.dshwd-active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1.5px; background: var(--text-1); }
.dshw-demo .dshwd-stage-body { flex: 1; overflow-y: auto; padding: 26px 32px 48px; }
.dshw-demo .dshwd-measure { max-width: 720px; }
.dshw-demo .dshwd-block { padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--line); }
.dshw-demo .dshwd-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.dshw-demo .dshwd-block-label { font-size: 11.5px; font-weight: 500; color: var(--text-3); margin-bottom: 10px; }
.dshw-demo .dshwd-prose { font-size: 13.5px; line-height: 1.7; color: var(--text-2); white-space: pre-wrap; }
.dshw-demo .dshwd-check-list { display: flex; flex-direction: column; gap: 9px; }
.dshw-demo .dshwd-check-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-1); }
.dshw-demo .dshwd-check-box { width: 15px; height: 15px; border-radius: 4px; border: 1px solid var(--ok-line); display: grid; place-items: center; font-size: 10px; color: var(--ok); background: var(--ok-soft); flex-shrink: 0; }
.dshw-demo .dshwd-check-box.dshwd-todo { background: transparent; border-color: var(--line-strong); color: transparent; }
.dshw-demo .dshwd-check-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--text-2); cursor: pointer; }
.dshw-demo .dshwd-check-row input { margin: 2px 0 0; flex: none; accent-color: var(--accent); }
.dshw-demo .dshwd-check-label { color: var(--text-1); line-height: 1.45; }
.dshw-demo .dshwd-check-hint { display: block; margin-top: 1px; font-size: 11px; color: var(--text-3); }
.dshw-demo .dshwd-criteria-library { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--line); max-height: 160px; overflow-y: auto; }
.dshw-demo .dshwd-stash-card { border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.dshw-demo .dshwd-stash-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.dshw-demo .dshwd-input.dshwd-invalid, .dshw-demo .dshwd-textarea.dshwd-invalid { border-color: var(--err); }
.dshw-demo .dshwd-diff-pre { font-family: "JetBrains Mono", "Cascadia Code", ui-monospace, monospace; font-size: 11.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-all; color: var(--text-2); background: var(--code-bg); border: 1px solid var(--line); border-radius: 7px; padding: 10px; }
.dshw-demo .dshwd-stream { border: 1px solid var(--line); border-radius: 8px; background: var(--code-bg); overflow: hidden; }
.dshw-demo .dshwd-stream-head { padding: 9px 14px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11.5px; color: var(--text-3); }
.dshw-demo .dshwd-stream-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 13px; font-size: 12px; }
.dshw-demo .dshwd-log-row { display: grid; grid-template-columns: 58px minmax(0,1fr); gap: 12px; }
.dshw-demo .dshwd-log-tag { font-size: 9px; letter-spacing: .1em; color: var(--text-3); padding-top: 1px; }
.dshw-demo .dshwd-log-main { color: var(--text-2); overflow-wrap: anywhere; }
.dshw-demo .dshwd-log-main strong { display: block; color: var(--text-1); font-weight: 500; }
.dshw-demo .dshwd-log-main p { margin: 3px 0 0; color: var(--text-3); white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.dshw-demo .dshwd-diff-box { border: 1px solid var(--line); border-radius: 8px; background: var(--code-bg); overflow: hidden; margin-bottom: 14px; }
.dshw-demo .dshwd-diff-head { padding: 8px 14px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--text-2); }
.dshw-demo .dshwd-diff-line { margin: 0; padding: 2px 14px; font-size: 12px; line-height: 1.65; white-space: pre; overflow-x: auto; }
.dshw-demo .dshwd-diff-line.dshwd-hunk { color: var(--text-3); background: var(--bg-hover); }
.dshw-demo .dshwd-diff-line.dshwd-add { background: var(--diff-add-bg); color: var(--ok); }
.dshw-demo .dshwd-diff-line.dshwd-del { background: var(--diff-del-bg); color: var(--err); }
.dshw-demo .dshwd-diff-line.dshwd-muted { color: var(--text-3); }
.dshw-demo .dshwd-inspector { background: var(--bg-rail); border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; overflow-y: auto; padding: 16px; gap: 18px; }
.dshw-demo .dshwd-insp-sec { padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.dshw-demo .dshwd-insp-sec:last-child { border-bottom: none; padding-bottom: 0; }
.dshw-demo .dshwd-insp-title { font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.dshw-demo .dshwd-kv { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 0; font-size: 12px; }
.dshw-demo .dshwd-kv-k { color: var(--text-3); flex-shrink: 0; }
.dshw-demo .dshwd-kv-v { color: var(--text-1); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-demo .dshwd-path-box { margin-top: 6px; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg-stage); font-size: 11px; color: var(--text-2); word-break: break-all; cursor: pointer; }
.dshw-demo .dshwd-path-box:hover { border-color: var(--line-strong); color: var(--text-1); }
.dshw-demo .dshwd-text-muted { color: var(--text-3); }
.dshw-demo .dshwd-text-ok { color: var(--ok); }
.dshw-demo .dshwd-text-warn { color: var(--warn); }
.dshw-demo .dshwd-text-err { color: var(--err); }
.dshw-demo .dshwd-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 260px; color: var(--text-3); text-align: center; padding: 32px; }
.dshw-demo .dshwd-empty-title { color: var(--text-1); font-size: 14px; font-weight: 500; }
.dshw-demo .dshwd-modal-backdrop { position: absolute; inset: 0; background: var(--backdrop); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100; }
.dshw-demo .dshwd-modal { width: 100%; max-width: 580px; max-height: 90%; background: var(--bg-modal); border-radius: 11px; box-shadow: var(--modal-shadow), var(--specular); display: flex; flex-direction: column; overflow: hidden; }
.dshw-demo .dshwd-modal.dshwd-modal-sm { max-width: 460px; }
.dshw-demo .dshwd-modal-head { padding: 15px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dshw-demo .dshwd-modal-title-group { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dshw-demo .dshwd-modal-title { font-size: 14px; font-weight: 600; letter-spacing: -.015em; }
.dshw-demo .dshwd-modal-badge { font-size: 10.5px; color: var(--text-3); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--line); background: var(--bg-stage); white-space: nowrap; }
.dshw-demo .dshwd-modal-body { padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.dshw-demo .dshwd-field-row-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
.dshw-demo .dshwd-field { display: flex; flex-direction: column; gap: 6px; }
.dshw-demo .dshwd-label { font-size: 11.5px; font-weight: 500; color: var(--text-2); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dshw-demo .dshwd-label-hint { font-weight: 400; font-size: 11px; color: var(--text-3); }
.dshw-demo .dshwd-input, .dshw-demo .dshwd-select, .dshw-demo .dshwd-textarea { width: 100%; border-radius: 7px; border: 1px solid var(--line); background: var(--bg-stage); color: var(--text-1); font-family: inherit; font-size: 12.5px; outline: none; transition: border-color .14s, background .14s; }
.dshw-demo .dshwd-input, .dshw-demo .dshwd-select { height: 34px; padding: 0 10px; }
.dshw-demo .dshwd-textarea { padding: 9px 11px; min-height: 92px; resize: vertical; line-height: 1.6; }
.dshw-demo .dshwd-input::placeholder, .dshw-demo .dshwd-textarea::placeholder { color: var(--text-3); }
.dshw-demo .dshwd-input:focus, .dshw-demo .dshwd-select:focus, .dshw-demo .dshwd-textarea:focus { border-color: var(--line-strong); background: var(--bg-elevated); }
.dshw-demo .dshwd-criteria-box { border: 1px solid var(--line); border-radius: 7px; background: var(--bg-stage); overflow: hidden; }
.dshw-demo .dshwd-criteria-items { display: flex; flex-direction: column; }
.dshw-demo .dshwd-criteria-chip { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--text-1); }
.dshw-demo .dshwd-criteria-chip span { overflow-wrap: anywhere; }
.dshw-demo .dshwd-criteria-remove { border: none; background: transparent; color: var(--text-3); cursor: pointer; font-size: 13px; padding: 0 4px; border-radius: 4px; }
.dshw-demo .dshwd-criteria-remove:hover { color: var(--err); background: var(--err-soft); }
.dshw-demo .dshwd-criteria-add-row { display: flex; align-items: center; gap: 6px; padding: 4px 6px; }
.dshw-demo .dshwd-criteria-input { flex: 1; min-width: 0; height: 28px; border: none; background: transparent; color: var(--text-1); font-size: 12px; padding: 0 4px; outline: none; }
.dshw-demo .dshwd-criteria-input::placeholder { color: var(--text-3); }
.dshw-demo .dshwd-adv-toggle { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--text-3); font-size: 11.5px; font-weight: 500; cursor: pointer; align-self: flex-start; padding: 0; }
.dshw-demo .dshwd-adv-toggle:hover { color: var(--text-2); }
.dshw-demo .dshwd-adv-panel { display: none; padding: 12px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg-rail); flex-direction: column; gap: 12px; }
.dshw-demo .dshwd-adv-panel.dshwd-open { display: flex; }
.dshw-demo .dshwd-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dshw-demo .dshwd-switch-title { font-size: 12px; font-weight: 500; }
.dshw-demo .dshwd-switch-desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.dshw-demo .dshwd-switch { position: relative; width: 34px; height: 20px; flex-shrink: 0; }
.dshw-demo .dshwd-switch input { opacity: 0; width: 0; height: 0; }
.dshw-demo .dshwd-slider { position: absolute; inset: 0; border-radius: 999px; background: var(--bg-active); border: 1px solid var(--line-strong); cursor: pointer; transition: .15s; }
.dshw-demo .dshwd-slider::before { content: ""; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: var(--text-2); transition: .15s; }
.dshw-demo .dshwd-switch input:checked + .dshwd-slider { background: var(--cta-bg); border-color: var(--cta-bg); }
.dshw-demo .dshwd-switch input:checked + .dshwd-slider::before { transform: translateX(14px); background: var(--cta-text); }
.dshw-demo .dshwd-modal-foot { padding: 13px 20px; border-top: 1px solid var(--line); background: var(--bg-rail); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dshw-demo .dshwd-modal-foot-meta { font-size: 11px; color: var(--text-3); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshw-demo .dshwd-modal-foot-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.dshw-demo .dshwd-alert { padding: 9px 11px; border-radius: 7px; border: 1px solid var(--err-line); background: var(--err-soft); color: var(--err); font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dshw-demo .dshwd-alert-info { border-color: var(--accent-line); background: var(--accent-soft); color: var(--accent); }
.dshw-demo .dshwd-hint { color: var(--text-3); font-size: 11px; line-height: 1.5; }
.dshw-demo .dshwd-toast { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%) translateY(8px); padding: 8px 14px; border-radius: 7px; background: var(--cta-bg); color: var(--cta-text); font-size: 12px; font-weight: 500; opacity: 0; pointer-events: none; transition: all .15s; z-index: 200; max-width: 80%; text-align: center; }
.dshw-demo .dshwd-toast.dshwd-show { opacity: 1; transform: translateX(-50%) translateY(0); }
.dshw-demo .dshwd-toast.dshwd-error { background: var(--err); color: #fff; }
.dshw-demo .dshwd-management { height: 100%; min-height: 0; overflow: hidden; background: var(--bg-stage); }
.dshw-demo .dshwd-management > .dshw-scope { height: 100%; min-height: 0; }
.dshw-demo .dshwd-management .dshw-detail-inner.dshw-stage-grid { height: 100%; max-width: none; align-items: stretch; overflow: auto; }
.dshw-demo .dshwd-management .dshw-stage { min-height: 100%; }
.dshw-demo .dshwd-management .dshw-stage-body { flex: 1; min-height: 0; }
.dshw-demo .dshwd-management .dshw-measure { max-width: none; }
.dshw-demo .dshwd-management .dshw-inspector { position: static; align-self: stretch; overflow: auto; }
@container dshwdemo (max-width: 980px) {
  .dshw-demo .dshwd-app { grid-template-columns: 248px minmax(0,1fr) 0; }
  .dshw-demo .dshwd-app.dshwd-hide-left { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-demo .dshwd-app.dshwd-hide-right { grid-template-columns: 248px minmax(0,1fr) 0; }
  .dshw-demo .dshwd-app.dshwd-hide-left.dshwd-hide-right { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-demo .dshwd-inspector { display: none; }
  .dshw-demo .dshwd-app:not(.dshwd-hide-right) .dshwd-inspector { display: flex; position: absolute; right: 0; top: 46px; bottom: 0; width: 300px; z-index: 20; background: var(--bg-rail); box-shadow: -16px 0 40px rgba(0,0,0,.28); }
  .dshw-demo .dshwd-stage-head { padding: 18px 20px 0; }
  .dshw-demo .dshwd-stage-body { padding: 20px 20px 36px; }
  .dshw-demo .dshwd-stage-title-row { flex-direction: column; }
}
@container dshwdemo (max-width: 620px) {
  .dshw-demo .dshwd-app { grid-template-columns: 208px minmax(0,1fr) 0; }
  .dshw-demo .dshwd-app.dshwd-hide-left { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-demo .dshwd-app.dshwd-hide-right { grid-template-columns: 208px minmax(0,1fr) 0; }
  .dshw-demo .dshwd-app.dshwd-hide-left.dshwd-hide-right { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-demo .dshwd-app:not(.dshwd-hide-right) .dshwd-inspector { width: 100%; }
  .dshw-demo .dshwd-stage-head { padding: 14px 14px 0; }
  .dshw-demo .dshwd-stage-body { padding: 16px 14px 28px; }
  .dshw-demo .dshwd-topbar { padding: 0 14px; }
}
${PANEL_CSS}
`
