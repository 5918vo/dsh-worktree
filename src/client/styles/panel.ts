/** Shared instrument-panel overrides applied to both legacy and workbench surfaces. */

export const PANEL_CSS = `
/* ---------- shared geometry -------------------------------------------------- */
.dshw-btn{height:32px;border-radius:6px;padding:0 12px;font-size:12.5px;letter-spacing:-.005em}
.dshw-btn--sm{height:28px;border-radius:6px;padding:0 9px;font-size:12px}
.dshw-btn--lg{height:36px;border-radius:6px;padding:0 15px}
.dshw-btn:hover:not(:disabled){border-color:var(--dshw-border-strong)}
.dshw-btn--primary{background:var(--dshw-brand-solid);border-color:var(--dshw-brand-solid);color:var(--dshw-on-brand)}
.dshw-btn--primary:hover:not(:disabled){background:var(--dshw-brand-solid-hover);border-color:var(--dshw-brand-solid-hover)}
.dshw-icon-btn{width:28px;height:28px;border-radius:6px}
.dshw-icon-btn--sm{width:24px;height:24px}
.dshw-input,.dshw-textarea,.dshw-select{border-radius:6px}
.dshw-chip{height:19px;padding:0 6px;border-radius:4px;font-size:10.5px;font-weight:600;letter-spacing:.02em}
.dshw-tab{border-radius:4px}

/* focus: one ring for every control, only from the keyboard */
.dshw-btn:focus-visible,.dshw-icon-btn:focus-visible,.dshw-tab:focus-visible,.dshw-input:focus-visible,
.dshw-textarea:focus-visible,.dshw-check input:focus-visible,.dshw-link-btn:focus-visible,
.dshw-item:focus-visible,.dshw-project:focus-visible,
.dshw-board .dshwd-btn:focus-visible,.dshw-board .dshwd-input:focus-visible,
.dshw-board .dshwd-pill:focus-visible,.dshw-board .dshwd-item:focus-visible,
.dshw-board .dshwd-group-head:focus-visible,.dshw-board .dshwd-criteria-remove:focus-visible{
  outline:2px solid var(--dshw-brand);outline-offset:2px}
.dshw-board .dshwd-btn:focus-visible,.dshw-board .dshwd-input:focus-visible,
.dshw-board .dshwd-pill:focus-visible,.dshw-board .dshwd-item:focus-visible,
.dshw-board .dshwd-group-head:focus-visible,.dshw-board .dshwd-criteria-remove:focus-visible{
  outline-color:var(--accent)}

/* ---------- numbered sections, no card chrome -------------------------------- */
.dshw-measure,.dshw-board .dshwd-measure{counter-reset:sec}
.dshw-card{position:relative;counter-increment:sec;padding:0 0 20px;margin:0 0 20px;border-bottom:1px solid var(--dshw-border)}
.dshw-card:last-child{border-bottom:0}
.dshw-card-head{min-height:0;margin-bottom:10px;gap:7px}
.dshw-card-title{font-size:12px;font-weight:600;letter-spacing:.02em}
.dshw-card-title::before{content:counter(sec,decimal-leading-zero);margin-right:8px;font-family:var(--dshw-mono);font-size:10.5px;font-weight:500;color:var(--dshw-text-3);letter-spacing:.06em}
.dshw-inspector .dshw-card-title::before{content:none}
.dshw-card-sub{font-size:12px;color:var(--dshw-text-3);max-width:70ch}
.dshw-block-label,.dshw-board .dshwd-block-label{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-family:var(--dshw-mono);font-size:10.5px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--dshw-text-3)}
.dshw-block-label::after{content:"";flex:1;height:1px;background:var(--dshw-border-soft)}

/* ---------- editorial figures ------------------------------------------------ */
.dshw-stats{grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin-bottom:18px;border-top:1px solid var(--dshw-border)}
.dshw-stat{display:flex;align-items:flex-start;gap:0;padding:12px 14px 0 0;background:transparent;border:0;border-radius:0;min-width:0}
.dshw-stat+.dshw-stat{padding-left:14px;border-left:1px solid var(--dshw-border-soft)}
.dshw-stat-ico{display:none}
.dshw-stat-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.dshw-stat-num{order:1;font-family:var(--dshw-mono);font-size:26px;font-weight:400;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--dshw-text)}
.dshw-stat-label{order:2;font-family:var(--dshw-mono);font-size:10.5px;letter-spacing:.06em;color:var(--dshw-text-3)}
.dshw-stat:first-child .dshw-stat-num{color:var(--dshw-text)}

/* ---------- key/value as dotted leaders ------------------------------------- */
.dshw-kv-row{display:flex;align-items:baseline;gap:8px;padding:6px 0;border-top:0}
.dshw-kv-k{flex:none;font-size:12px;color:var(--dshw-text-3)}
.dshw-kv-k::after{content:"";display:none}
.dshw-kv-v{flex:1;display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;text-align:right}
.dshw-kv-row::before{content:"";order:1;flex:1;height:1px;align-self:center;
  background-image:linear-gradient(to right,var(--dshw-border) 1px,transparent 1px);
  background-size:3px 100%;background-repeat:repeat-x;opacity:.9}
.dshw-kv-k{order:0}
.dshw-kv-v{order:2}

/* ---------- rail: one left axis, one right axis ------------------------------ */
.dshw-sidebar{--rp:12px;--gut:16px;--rgap:6px}
.dshw-board .dshwd-rail{--rp:12px;--gut:16px;--rgap:6px}
.dshw-project{padding-left:var(--rp)}
.dshw-item{margin-left:0;padding-left:calc(var(--rp) + var(--gut) + var(--rgap))}
.dshw-board .dshwd-item{margin-left:0;padding-left:calc(var(--rp) + var(--gut) + var(--rgap))}
.dshw-group-head,.dshw-board .dshwd-group-head{padding-left:var(--rp);padding-right:var(--rp)}
.dshw-project-count,.dshw-item-time{font-variant-numeric:tabular-nums}
.dshw-item-row1,.dshw-item-row2{grid-template-columns:minmax(0,1fr) auto}
.dshw-item-title,.dshw-board .dshwd-item-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-item.dshw-selected{box-shadow:inset 1.5px 0 0 var(--dshw-brand);background:var(--dshw-hover)}

/* ---------- modal shell ------------------------------------------------------ */
.dshw-modal{border-radius:8px;border:1px solid var(--dshw-border-strong)}
.dshw-modal-head{padding:14px 18px 12px;align-items:flex-start}
.dshw-modal-title{font-size:15px;font-weight:600;letter-spacing:-.01em}
.dshw-modal-sub{font-size:12px;color:var(--dshw-text-3);margin-top:1px}
.dshw-modal-body{padding:16px 18px;gap:14px}
.dshw-modal-foot{padding:12px 18px;gap:8px}
.dshw-board .dshwd-modal{border-radius:8px}

/* ---------- activity feed ----------------------------------------------------- */
.dshw-acts{display:flex;flex-direction:column;margin:0 -6px}
.dshw-act-row{display:grid;grid-template-columns:7px minmax(0,1fr) auto;align-items:center;gap:9px;width:100%;padding:7px 6px;border:0;background:transparent;border-radius:4px;text-align:left;cursor:pointer;transition:background .12s}
.dshw-act-row:hover{background:var(--dshw-hover)}
.dshw-act-row+.dshw-act-row{box-shadow:inset 0 1px 0 var(--dshw-border-soft)}
.dshw-act-dot{width:5px;height:5px;border-radius:50%;background:var(--dshw-text-3);justify-self:center}
.dshw-act-dot--developing,.dshw-act-dot--reviewing{background:var(--dshw-brand)}
.dshw-act-dot--review{background:var(--dshw-warn)}
.dshw-act-dot--merged{background:var(--dshw-success)}
.dshw-act-dot--broken{background:var(--dshw-danger)}
.dshw-act-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--dshw-text)}
.dshw-act-time{font-size:11px;color:var(--dshw-text-3);font-variant-numeric:tabular-nums}

/* mono plumbing */
.dshw-mono,.dshw-board .dshwd-mono{font-variant-numeric:tabular-nums}
`
