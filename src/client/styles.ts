import { PALETTE, paletteVars } from './palette'

export const CSS = `
.dshw-scope{${paletteVars(PALETTE.light)}}
.dshw-dark .dshw-scope{${paletteVars(PALETTE.dark)}}

.dshw-scope, .dshw-scope *, .dshw-scope *::before, .dshw-scope *::after{box-sizing:border-box}
.dshw-scope{font-family:inherit;color:var(--dshw-text);font-size:13px;line-height:1.55;-webkit-font-smoothing:antialiased}
.dshw-scope :where(button, input, select, textarea){font:inherit;color:inherit}
.dshw-scope button{cursor:pointer}
.dshw-scope button:disabled{cursor:not-allowed}
.dshw-scope a{color:var(--dshw-brand)}
.dshw-scope h1, .dshw-scope h2, .dshw-scope h3, .dshw-scope h4, .dshw-scope p{margin:0}
.dshw-scope ul, .dshw-scope ol{margin:0;padding:0;list-style:none}
.dshw-scope [hidden]{display:none!important}
.dshw-scope code, .dshw-scope .dshw-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.dshw-scope code{font-size:11.5px;padding:1px 5px;border-radius:5px;background:var(--dshw-surface-2);border:1px solid var(--dshw-border);overflow-wrap:anywhere}
.dshw-scope ::selection{background:var(--dshw-brand-soft);color:var(--dshw-text)}
.dshw-scope :focus-visible{outline:2px solid var(--dshw-brand);outline-offset:2px}
.dshw-scope *{scrollbar-width:thin;scrollbar-color:var(--dshw-border-strong) transparent}
.dshw-scope ::-webkit-scrollbar{width:10px;height:10px}
.dshw-scope ::-webkit-scrollbar-track{background:transparent}
.dshw-scope ::-webkit-scrollbar-thumb{background:var(--dshw-border-strong);border-radius:99px;border:3px solid transparent;background-clip:content-box}
.dshw-scope ::-webkit-scrollbar-thumb:hover{background:var(--dshw-text-3);background-clip:content-box}

.dshw-ico{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}

/* shell ------------------------------------------------------------------ */
.dshw-shell{position:relative;height:100%;min-height:0;container-type:inline-size;container-name:dshw;background:var(--dshw-bg);color:var(--dshw-text);overflow:hidden}
.dshw-app{display:grid;grid-template-columns:320px minmax(0,1fr);height:100%;min-height:0;background:var(--dshw-bg)}

/* tree ------------------------------------------------------------------- */
.dshw-sidebar{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--dshw-tree-bg);border-right:1px solid var(--dshw-border)}
.dshw-task-list{display:flex;flex-direction:column}
.dshw-tree-head{display:flex;align-items:center;gap:6px;padding:12px 10px 10px;flex:none}
.dshw-search{position:relative;flex:1;min-width:0}
.dshw-search>.dshw-ico{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--dshw-text-3);pointer-events:none}
.dshw-search input{width:100%;height:33px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface);padding:0 10px 0 31px;font-size:12.5px;color:var(--dshw-text);transition:border-color .14s,box-shadow .14s}
.dshw-search input::placeholder{color:var(--dshw-text-3)}
.dshw-search input:hover{border-color:var(--dshw-border-strong)}
.dshw-search input:focus{outline:none;border-color:var(--dshw-brand);box-shadow:var(--dshw-focus-ring)}
.dshw-tree-scroll{flex:1;min-height:0;overflow:auto;padding:2px 8px 18px}
.dshw-tree-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 13px;border-top:1px solid var(--dshw-border);font-size:11px;color:var(--dshw-text-3);background:var(--dshw-tree-bg)}
.dshw-tree-status{display:flex;align-items:center;gap:7px;padding:0 12px 8px;font-size:11px;color:var(--dshw-warn)}
.dshw-tree-status .dshw-spinner{width:11px;height:11px}
.dshw-tree-tag{border:1px solid var(--dshw-border);border-radius:999px;padding:1px 6px;background:var(--dshw-surface);font-size:11px;letter-spacing:.02em}

/* project row ------------------------------------------------------------ */
.dshw-project{display:flex;align-items:center;gap:1px;margin-top:5px;padding:2px 1px;border-radius:8px;transition:background .12s}
.dshw-project:hover{background:var(--dshw-surface-2)}
.dshw-project--on{background:var(--dshw-brand-soft);box-shadow:inset 2px 0 0 var(--dshw-brand),inset 0 0 0 1px var(--dshw-brand-border)}
.dshw-project--on .dshw-project-count{background:var(--dshw-surface);border-color:var(--dshw-brand-border);color:var(--dshw-brand)}
.dshw-project-toggle{width:26px;height:30px;flex:none;border:0;background:transparent;color:var(--dshw-text-3);display:grid;place-items:center;border-radius:6px;padding:0}
.dshw-project-toggle:hover{color:var(--dshw-text)}
.dshw-project-toggle .dshw-ico{width:14px;height:14px;transition:transform .16s ease}
.dshw-project[data-open="false"] .dshw-project-toggle .dshw-ico{transform:rotate(-90deg)}
.dshw-project-select{flex:1;min-width:0;display:flex;align-items:center;gap:8px;border:0;background:transparent;text-align:left;padding:4px 2px;border-radius:7px;color:inherit}
.dshw-folder-tile{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;flex:none}
.dshw-folder-tile .dshw-ico{width:13px;height:13px}
.dshw-folder-tile--blue{background:var(--dshw-folder-blue-bg);color:var(--dshw-folder-blue-fg)}
.dshw-folder-tile--purple{background:var(--dshw-folder-purple-bg);color:var(--dshw-folder-purple-fg)}
.dshw-folder-tile--green{background:var(--dshw-folder-green-bg);color:var(--dshw-folder-green-fg)}
.dshw-folder-tile--orange{background:var(--dshw-folder-orange-bg);color:var(--dshw-folder-orange-fg)}
.dshw-project-name{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.dshw-project-count{margin-left:auto;flex:none;min-width:18px;height:17px;padding:0 5px;border-radius:999px;display:grid;place-items:center;background:var(--dshw-surface);border:1px solid var(--dshw-border);font-size:11px;color:var(--dshw-text-3);font-variant-numeric:tabular-nums}
.dshw-project-add{width:24px;height:24px;flex:none;border:0;background:transparent;color:var(--dshw-text-3);border-radius:6px;display:grid;place-items:center;opacity:.55;padding:0;transition:opacity .12s,background .12s,color .12s}
.dshw-project-add .dshw-ico{width:14px;height:14px}
.dshw-project:hover .dshw-project-add, .dshw-project--on .dshw-project-add, .dshw-project-add:focus-visible{opacity:1}
.dshw-project-add:hover{background:var(--dshw-brand-soft);color:var(--dshw-brand)}

/* task rows -------------------------------------------------------------- */
.dshw-task{display:flex;align-items:stretch;margin:1px 0 1px 22px;border-radius:8px;transition:background .12s,box-shadow .12s}
.dshw-task:hover{background:var(--dshw-surface-2)}
.dshw-task--on{background:var(--dshw-brand-soft);box-shadow:inset 2px 0 0 var(--dshw-brand),inset 0 0 0 1px var(--dshw-brand-border)}
.dshw-task-select{flex:1;min-width:0;display:flex;align-items:flex-start;gap:8px;border:0;background:transparent;text-align:left;padding:7px 3px 7px 8px;border-radius:8px 0 0 8px;color:inherit}
.dshw-task-select .dshw-dot{margin-top:5px}
.dshw-task-main{min-width:0;flex:1}
.dshw-task-title{display:block;font-size:12.5px;font-weight:500;color:var(--dshw-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}
.dshw-task--on .dshw-task-title{font-weight:600}
.dshw-task-meta{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden}
.dshw-inline{display:inline-flex;align-items:center;gap:6px;min-width:0}
.dshw-task-count{display:inline-flex;align-items:center;gap:2px;font-size:11px;color:var(--dshw-text-3);font-variant-numeric:tabular-nums}
.dshw-task-count .dshw-ico{width:10px;height:10px;stroke-width:2}
.dshw-task-open{width:27px;flex:none;border:0;background:transparent;color:var(--dshw-text-3);border-radius:0 8px 8px 0;display:grid;place-items:center;opacity:.55;padding:0;transition:opacity .12s,color .12s}
.dshw-task:hover .dshw-task-open, .dshw-task--on .dshw-task-open, .dshw-task-open:focus-visible{opacity:1}
.dshw-task-open:hover{color:var(--dshw-brand)}
.dshw-task-open:disabled{opacity:0!important;color:var(--dshw-text-3)}
.dshw-task-open .dshw-ico{width:14px;height:14px}
.dshw-tree-inline-empty{padding:8px 8px 10px 30px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dshw-text-3)}
.dshw-link-btn{border:0;background:transparent;color:var(--dshw-brand);font-size:inherit;font-weight:600;padding:0;border-radius:4px}
.dshw-link-btn:hover{text-decoration:underline}
.dshw-tree-empty{padding:44px 18px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:9px}
.dshw-tree-empty h3{font-size:13px;color:var(--dshw-text)}
.dshw-tree-empty .dshw-empty-icon{width:52px;height:52px;border-radius:14px}
.dshw-tree-empty .dshw-btn{margin-top:8px}
.dshw-tree-empty p{font-size:11.5px;color:var(--dshw-text-3);line-height:1.6;margin-bottom:4px}

/* skeleton --------------------------------------------------------------- */
.dshw-sk-project{display:flex;align-items:center;gap:8px;padding:10px 6px}
.dshw-sk-task{display:flex;align-items:center;gap:9px;padding:7px 6px 7px 30px}
.dshw-sk-line{height:8px;border-radius:5px;background:linear-gradient(90deg,var(--dshw-surface-3) 25%,var(--dshw-surface-2) 37%,var(--dshw-surface-3) 63%);background-size:400% 100%;animation:dshw-shimmer 1.5s ease-in-out infinite}
.dshw-sk-line--sm{height:6px}
@keyframes dshw-shimmer{0%{background-position:100% 0}100%{background-position:0 0}}

/* detail ----------------------------------------------------------------- */
.dshw-detail{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dshw-bg)}
.dshw-detail-scroll{flex:1;min-height:0;overflow:auto;padding:22px 26px 44px}
.dshw-detail-inner{width:100%;max-width:960px;margin:0 auto}
.dshw-mobile-bar{display:none;max-width:960px;margin:0 auto 10px}
.dshw-mobile-bar .dshw-btn{display:inline-flex}

/* page head -------------------------------------------------------------- */
.dshw-page-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}
.dshw-page-icon{width:44px;height:44px;border-radius:11px;display:grid;place-items:center;flex:none;background:var(--dshw-brand-soft);color:var(--dshw-brand);border:1px solid var(--dshw-brand-border)}
.dshw-page-icon .dshw-ico{width:21px;height:21px}
.dshw-page-icon--folder{background:var(--dshw-folder-blue-bg);border-color:var(--dshw-brand-border);color:var(--dshw-folder-blue-fg)}
.dshw-page-head-copy{min-width:0;flex:1}
.dshw-page-head h1{font-size:20px;line-height:1.3;font-weight:650;letter-spacing:-.01em;overflow-wrap:anywhere}
.dshw-page-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:5px;font-size:12px;color:var(--dshw-text-3);min-width:0}
.dshw-page-sub .dshw-mono{font-size:11.5px;overflow-wrap:anywhere}
.dshw-page-sub .dshw-sep{color:var(--dshw-border-strong)}
.dshw-page-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}

/* cards ------------------------------------------------------------------ */
.dshw-card{background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:12px;padding:16px 18px;margin-bottom:14px;box-shadow:var(--dshw-shadow)}
.dshw-card-head{display:flex;align-items:center;gap:8px;min-height:24px;margin-bottom:12px}
.dshw-card-head>.dshw-ico{width:16px;height:16px;color:var(--dshw-text-3)}
.dshw-card-title{font-size:13px;font-weight:650;letter-spacing:.01em}
.dshw-card-head .dshw-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.dshw-card-sub{font-size:12px;color:var(--dshw-text-2);line-height:1.65;margin:-4px 0 12px;max-width:76ch}
.dshw-card--danger{border-color:var(--dshw-danger-border)}
.dshw-card--danger .dshw-card-head>.dshw-ico{color:var(--dshw-danger)}
.dshw-card--danger .dshw-card-title{color:var(--dshw-danger)}

/* task hero -------------------------------------------------------------- */
.dshw-hero{padding:18px 20px}
.dshw-hero-top{display:flex;gap:22px;align-items:flex-start}
.dshw-hero-copy{min-width:0;flex:1}
.dshw-hero-crumb{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--dshw-text-3);margin-bottom:9px}
.dshw-hero-crumb .dshw-ico{width:13px;height:13px}
.dshw-hero-crumb .dshw-mono{font-size:11px;color:var(--dshw-text-2);background:var(--dshw-surface-2);border:1px solid var(--dshw-border);padding:1px 6px;border-radius:5px}
.dshw-hero h1{font-size:20px;line-height:1.35;font-weight:650;letter-spacing:-.012em;margin-bottom:7px;overflow-wrap:anywhere}
.dshw-hero-desc{font-size:13px;line-height:1.7;color:var(--dshw-text-2);max-width:74ch;white-space:pre-wrap;overflow-wrap:anywhere}
.dshw-hero-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:14px}
.dshw-meta-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border:1px solid var(--dshw-border);border-radius:7px;background:var(--dshw-surface-2);font-size:11px;color:var(--dshw-text-2);max-width:100%}
.dshw-meta-pill .dshw-ico{width:13px;height:13px;color:var(--dshw-text-3)}
.dshw-meta-pill .dshw-mono{font-size:11px;color:var(--dshw-text-2);border:0;background:transparent;padding:0}
.dshw-meta-pill--warn{background:var(--dshw-warn-soft);border-color:var(--dshw-warn-border);color:var(--dshw-warn)}
.dshw-meta-pill--warn .dshw-ico{color:var(--dshw-warn)}
.dshw-hero-action{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:8px;padding-top:2px}
.dshw-hero-action .dshw-hint{max-width:220px;text-align:right;margin:0}

/* buttons ---------------------------------------------------------------- */
.dshw-btn{height:32px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--dshw-border-strong);border-radius:8px;background:var(--dshw-surface);color:var(--dshw-text);font-size:12.5px;font-weight:500;line-height:1;transition:background .14s,border-color .14s,color .14s,box-shadow .14s;white-space:nowrap;cursor:pointer}
.dshw-btn .dshw-ico{width:15px;height:15px}
.dshw-btn:hover{background:var(--dshw-surface-2);border-color:var(--dshw-text-3)}
.dshw-btn:active{background:var(--dshw-surface-2)}
.dshw-btn:disabled{opacity:.45;transform:none}
.dshw-btn:disabled:hover{background:var(--dshw-surface);border-color:var(--dshw-border-strong)}
.dshw-btn--primary{background:var(--dshw-brand-solid);border-color:var(--dshw-brand-solid);color:var(--dshw-on-brand);font-weight:600;box-shadow:var(--dshw-brand-shadow)}
.dshw-btn--primary:active{background:var(--dshw-brand-solid-hover)}
.dshw-btn--primary:hover{background:var(--dshw-brand-solid-hover);border-color:var(--dshw-brand-solid-hover)}
.dshw-btn--primary:disabled:hover{background:var(--dshw-brand-solid);border-color:var(--dshw-brand-solid)}
.dshw-btn--danger{color:var(--dshw-danger);border-color:color-mix(in srgb,var(--dshw-danger) 38%,var(--dshw-border));background:var(--dshw-surface)}
.dshw-btn--danger:hover{background:var(--dshw-danger-soft);border-color:var(--dshw-danger);color:var(--dshw-danger)}
.dshw-btn--danger:disabled:hover{background:var(--dshw-surface);border-color:color-mix(in srgb,var(--dshw-danger) 38%,var(--dshw-border))}
.dshw-btn--lg{height:38px;padding:0 16px;font-size:13px;border-radius:8px}
.dshw-btn--lg .dshw-ico{width:16px;height:16px}
.dshw-btn--sm{height:28px;padding:0 9px;font-size:12px;border-radius:7px}
.dshw-btn--sm .dshw-ico{width:13px;height:13px}
.dshw-btn--ghost{border-color:transparent;background:transparent;color:var(--dshw-text-2)}
.dshw-btn--ghost:hover{background:var(--dshw-surface-2);border-color:var(--dshw-border)}
.dshw-icon-btn{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dshw-text-2);transition:background .14s,color .14s,border-color .14s;padding:0}
.dshw-icon-btn .dshw-ico{width:16px;height:16px}
.dshw-icon-btn:hover{background:var(--dshw-surface-2);color:var(--dshw-text);border-color:var(--dshw-border)}
.dshw-icon-btn--sm{width:27px;height:27px;border-radius:7px}
.dshw-icon-btn--sm .dshw-ico{width:14px;height:14px}
.dshw-spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dshw-spin .7s linear infinite;flex:none;display:inline-block}
@keyframes dshw-spin{to{transform:rotate(360deg)}}

/* chips & dots ----------------------------------------------------------- */
.dshw-chip{display:inline-flex;align-items:center;gap:5px;height:21px;padding:0 8px;border-radius:999px;border:1px solid transparent;font-size:11px;font-weight:600;line-height:1;white-space:nowrap}
.dshw-chip--brand{color:var(--dshw-brand-strong);background:var(--dshw-brand-soft);border-color:var(--dshw-brand-border)}
.dshw-chip--warn{color:var(--dshw-warn);background:var(--dshw-warn-soft);border-color:var(--dshw-warn-border)}
.dshw-chip--success{color:var(--dshw-success);background:var(--dshw-success-soft);border-color:var(--dshw-success-border)}
.dshw-chip--error{color:var(--dshw-danger);background:var(--dshw-danger-soft);border-color:var(--dshw-danger-border)}
.dshw-chip--neutral{color:var(--dshw-text-2);background:var(--dshw-surface-2);border-color:var(--dshw-border)}
.dshw-chip--purple{color:var(--dshw-purple);background:var(--dshw-purple-soft);border-color:var(--dshw-purple-border)}
.dshw-chip--sm{height:19px;font-size:11px;padding:0 6px}
.dshw-chip .dshw-dot{width:5px;height:5px;box-shadow:none}
.dshw-dot{width:7px;height:7px;border-radius:50%;background:var(--dshw-text-3);flex:none;display:inline-block}
.dshw-dot--brand{background:var(--dshw-brand);box-shadow:0 0 0 3px var(--dshw-brand-soft)}
.dshw-dot--warn{background:var(--dshw-warn);box-shadow:0 0 0 3px var(--dshw-warn-soft)}
.dshw-dot--success{background:var(--dshw-success);box-shadow:0 0 0 3px var(--dshw-success-soft)}
.dshw-dot--error{background:var(--dshw-danger);box-shadow:0 0 0 3px var(--dshw-danger-soft)}
.dshw-dot--neutral{background:var(--dshw-text-3);box-shadow:0 0 0 3px var(--dshw-surface-3)}
.dshw-dot--pulse{background:var(--dshw-warn);box-shadow:0 0 0 3px var(--dshw-warn-soft)}
@media (prefers-reduced-motion:no-preference){
  .dshw-dot--pulse{animation:dshw-soft-pulse 2.4s ease-in-out infinite}
}
@keyframes dshw-soft-pulse{0%,100%{box-shadow:0 0 0 3px var(--dshw-warn-soft)}50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--dshw-warn) 14%,transparent)}}

/* banners ---------------------------------------------------------------- */
.dshw-banner{display:flex;gap:9px;align-items:flex-start;padding:11px 12px;border-radius:9px;font-size:12px;line-height:1.6;border:1px solid transparent;margin-bottom:14px}
.dshw-banner .dshw-ico{width:15px;height:15px;margin-top:2px}
.dshw-banner strong{display:block;font-weight:650;margin-bottom:1px}
.dshw-banner-copy{min-width:0;flex:1}
.dshw-banner-actions{margin-left:auto;display:flex;gap:6px;flex:none;align-items:center}
.dshw-banner--info{background:var(--dshw-brand-soft);border-color:var(--dshw-brand-border);color:var(--dshw-text-2)}
.dshw-banner--info>.dshw-ico{color:var(--dshw-brand)}
.dshw-banner--warn{background:var(--dshw-warn-soft);border-color:var(--dshw-warn-border);color:var(--dshw-text)}
.dshw-banner--warn>.dshw-ico{color:var(--dshw-warn)}
.dshw-banner--error{background:var(--dshw-danger-soft);border-color:var(--dshw-danger-border);color:var(--dshw-text)}
.dshw-banner--error>.dshw-ico{color:var(--dshw-danger)}

/* live console ----------------------------------------------------------- */
.dshw-live-state{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--dshw-success)}
.dshw-live-state--idle{color:var(--dshw-text-3)}
.dshw-live-state--pending{color:var(--dshw-warn)}
.dshw-live-state .dshw-dot{width:6px;height:6px;box-shadow:none}
.dshw-console{background:var(--dshw-term-bg);border:1px solid var(--dshw-term-border);border-radius:10px;overflow:hidden;color:var(--dshw-term-text)}
.dshw-console-bar{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--dshw-term-border);color:var(--dshw-term-bar);font-size:11px;min-width:0;overflow:hidden}
.dshw-console-bar>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-console-bar .dshw-ico{width:14px;height:14px;color:var(--dshw-term-tool)}
.dshw-console-bar .dshw-sep{color:var(--dshw-term-gutter)}
.dshw-console-bar .dshw-grow{flex:1}
.dshw-console-bar .dshw-tok{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:var(--dshw-term-muted)}
.dshw-console-grid{display:grid;grid-template-columns:minmax(0,1fr) 216px}
.dshw-console-log{padding:9px 0;max-height:320px;overflow:auto}
.dshw-term-row{display:flex;gap:9px;padding:3px 12px 3px 0}
.dshw-term-gutter{width:28px;flex:none;text-align:right;color:var(--dshw-term-gutter);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;line-height:1.75;user-select:none}
.dshw-term-text{min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.75;overflow-wrap:anywhere;color:var(--dshw-term-text);white-space:pre-wrap}
.dshw-term-tag{flex:none;width:auto;min-width:30px;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;font-size:10.5px;line-height:2.15;color:var(--dshw-term-gutter);user-select:none}
.dshw-term-user .dshw-term-text{color:var(--dshw-term-user)}
.dshw-term-user .dshw-term-tag{color:var(--dshw-term-user)}
.dshw-term-think .dshw-term-text{color:var(--dshw-term-muted);font-style:italic}
.dshw-term-think .dshw-term-tag{color:var(--dshw-term-muted)}
.dshw-term-tool .dshw-term-text{color:var(--dshw-term-tool)}
.dshw-term-tool .dshw-term-tag{color:var(--dshw-term-tool)}
.dshw-term-result .dshw-term-text{color:var(--dshw-term-muted)}
.dshw-term-result .dshw-term-tag{color:var(--dshw-term-gutter)}
.dshw-term-agent .dshw-term-tag{color:var(--dshw-term-text)}
.dshw-term-warn .dshw-term-text{color:var(--dshw-term-warn)}
.dshw-term-error .dshw-term-text,.dshw-term-error .dshw-term-tag{color:var(--dshw-term-error)}

/* collapsed session timeline --------------------------------------------- */
.dshw-step{border-top:1px solid color-mix(in srgb,var(--dshw-term-text) 9%,transparent)}
.dshw-step:first-child{border-top:0}
.dshw-step>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;min-width:0;min-height:28px;padding:3px 10px 3px 0;color:var(--dshw-term-text)}
.dshw-step>summary::-webkit-details-marker{display:none}
.dshw-step>summary:hover{background:color-mix(in srgb,var(--dshw-term-text) 5%,transparent)}
.dshw-step>summary:focus-visible{outline:2px solid var(--dshw-brand);outline-offset:-2px}
.dshw-step-gutter{width:28px;flex:none;text-align:right;color:var(--dshw-term-gutter);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;user-select:none}
.dshw-step-tag{width:auto;min-width:34px;max-width:60px;flex:none;overflow:hidden;text-overflow:ellipsis;text-align:right;font-size:10.5px;line-height:1.6;color:var(--dshw-term-muted);user-select:none;white-space:nowrap}
.dshw-step-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dshw-term-text)}
.dshw-step-meta{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:var(--dshw-term-tool);white-space:nowrap}
.dshw-step-status{flex:none;font-size:10.5px;color:var(--dshw-term-muted);white-space:nowrap}
.dshw-step-status--ok{color:var(--dshw-term-tool)}
.dshw-step-status--error{color:var(--dshw-term-error)}
.dshw-step-chevron{width:12px;height:12px;flex:none;color:var(--dshw-term-gutter);transform:rotate(-90deg);transition:transform .12s}
.dshw-step[open] .dshw-step-chevron{transform:rotate(0)}
.dshw-step-body{margin:0 10px 8px 37px;padding:8px 10px;border-radius:6px;background:color-mix(in srgb,var(--dshw-term-text) 7%,transparent);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dshw-term-text);max-height:240px;overflow:auto}
.dshw-step--think .dshw-step-tag,.dshw-step--think .dshw-step-title{color:var(--dshw-term-muted);font-style:italic}
.dshw-step--user .dshw-step-tag{color:var(--dshw-term-user)}
.dshw-step--tool .dshw-step-tag{color:var(--dshw-term-tool)}
.dshw-step--agent .dshw-step-tag{color:var(--dshw-term-text)}
.dshw-console-side{border-left:1px solid var(--dshw-term-border);padding:10px 12px 12px;display:flex;flex-direction:column;gap:11px;font-size:11px;color:var(--dshw-term-muted)}
.dshw-side-title{font-size:10.5px;font-weight:600;color:var(--dshw-term-text);letter-spacing:.02em;margin-bottom:6px}
.dshw-todo-mini li{display:flex;gap:6px;align-items:flex-start;line-height:1.45;margin-bottom:4px;color:var(--dshw-term-muted)}
.dshw-todo-mini .dshw-ico{width:11px;height:11px;margin-top:1px;flex:none}
.dshw-todo-mini .dshw-done{color:var(--dshw-term-gutter);text-decoration:line-through}
.dshw-todo-mini .dshw-done .dshw-ico{color:var(--dshw-term-tool)}
.dshw-meter-row{display:flex;justify-content:space-between;gap:8px;margin-bottom:5px;font-size:10.5px;color:var(--dshw-term-muted)}
.dshw-meter{height:4px;border-radius:99px;background:color-mix(in srgb,var(--dshw-term-text) 12%,transparent);overflow:hidden}
.dshw-meter i{display:block;height:100%;width:var(--v,0%);border-radius:99px;background:linear-gradient(90deg,var(--dshw-meter-from),var(--dshw-meter-to))}
.dshw-live-empty{border:1px dashed var(--dshw-border-strong);background:var(--dshw-surface-2);border-radius:10px;padding:18px;text-align:center;font-size:12px;color:var(--dshw-text-3)}
.dshw-live-empty strong{display:block;color:var(--dshw-text);font-size:12.5px;margin-bottom:3px;font-weight:600}

/* key / value ------------------------------------------------------------ */
.dshw-kv{display:flex;flex-direction:column;min-width:0}
.dshw-kv-row{display:grid;grid-template-columns:108px minmax(0,1fr);gap:12px;align-items:start;padding:7px 0;border-top:1px solid var(--dshw-border-soft);min-width:0}
.dshw-kv-row:first-child{border-top:0}
.dshw-kv-k{font-size:12px;color:var(--dshw-text-3);padding-top:1px}
.dshw-kv-v{min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:var(--dshw-text);overflow-wrap:anywhere}
.dshw-kv-v .dshw-mono{font-size:11.5px;color:var(--dshw-text-2)}
.dshw-copy-btn{width:26px;height:26px;flex:none;display:inline-grid;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--dshw-text-3);padding:0;transition:background .12s,color .12s}
.dshw-copy-btn .dshw-ico{width:13px;height:13px}
.dshw-copy-btn:hover{background:var(--dshw-surface-2);color:var(--dshw-text)}
.dshw-git-section+.dshw-git-section{margin-top:12px;padding-top:4px}
.dshw-section-label{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:650;color:var(--dshw-text-3);letter-spacing:.03em;margin:2px 0}
.dshw-section-label .dshw-ico{width:13px;height:13px}
.dshw-nowrap{white-space:nowrap}

/* actions ---------------------------------------------------------------- */
.dshw-action-grid{display:flex;gap:8px;flex-wrap:wrap}
.dshw-action-grid>.dshw-btn{flex:1 1 150px}
.dshw-card .dshw-hint{margin-top:9px;font-size:11px;color:var(--dshw-text-3);line-height:1.6}
.dshw-card .dshw-hint .dshw-ico{display:inline-block;vertical-align:-2px;width:12px;height:12px;margin-right:3px}

/* stats ------------------------------------------------------------------ */
.dshw-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
.dshw-stat{display:flex;align-items:center;gap:10px;padding:11px 12px;background:var(--dshw-surface-2);border:1px solid var(--dshw-border);border-radius:10px;min-width:0}
.dshw-stat-ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none}
.dshw-stat-ico .dshw-ico{width:16px;height:16px}
.dshw-stat-ico--neutral{background:var(--dshw-surface-3);color:var(--dshw-text-2)}
.dshw-stat-ico--brand{background:var(--dshw-brand-soft);color:var(--dshw-brand)}
.dshw-stat-ico--warn{background:var(--dshw-warn-soft);color:var(--dshw-warn)}
.dshw-stat-ico--success{background:var(--dshw-success-soft);color:var(--dshw-success)}
.dshw-stat-body{min-width:0}
.dshw-stat-num{font-size:18px;font-weight:700;line-height:1.15;font-variant-numeric:tabular-nums}
.dshw-stat-label{font-size:11px;color:var(--dshw-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshw-attention{display:flex;align-items:center;gap:8px;padding:8px 10px;margin:0 0 12px;background:var(--dshw-warn-soft);border:1px solid var(--dshw-warn-border);border-radius:8px;font-size:11.5px;color:var(--dshw-text-2)}
.dshw-attention .dshw-ico{width:14px;height:14px;color:var(--dshw-warn)}
.dshw-attention .dshw-link-btn{margin-left:auto}

/* forms ------------------------------------------------------------------ */
.dshw-form-rows{display:flex;flex-direction:column;gap:13px}
.dshw-form-row{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:start}
.dshw-form-row>label, .dshw-form-row>.dshw-form-label{padding-top:9px;font-size:12px;color:var(--dshw-text-2);font-weight:600}
.dshw-form-foot{display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:13px;border-top:1px solid var(--dshw-border-soft)}
.dshw-save-state{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--dshw-success);font-weight:600;min-height:18px}
.dshw-save-state .dshw-ico{width:13px;height:13px}
.dshw-field{margin-bottom:14px;min-width:0}
.dshw-field:last-child{margin-bottom:0}
.dshw-field-label{display:block;font-size:12px;font-weight:600;color:var(--dshw-text-2);margin-bottom:6px}
.dshw-req{color:var(--dshw-danger);margin-left:3px}
.dshw-input, .dshw-scope select.dshw-input, .dshw-scope textarea.dshw-input{width:100%;min-height:36px;border:1px solid var(--dshw-border-strong);border-radius:8px;background:var(--dshw-surface);padding:8px 10px;font-size:12.5px;color:var(--dshw-text);transition:border-color .14s,box-shadow .14s,background .14s}
.dshw-input::placeholder{color:var(--dshw-text-3)}
.dshw-input:hover{border-color:var(--dshw-text-3)}
.dshw-input:focus{outline:none;border-color:var(--dshw-brand);box-shadow:var(--dshw-focus-ring)}
.dshw-scope textarea.dshw-input{min-height:86px;resize:vertical;line-height:1.6}
.dshw-scope select.dshw-input{appearance:none;-webkit-appearance:none;padding-right:34px;cursor:pointer;background-image:var(--dshw-select-arrow);background-repeat:no-repeat;background-position:right 10px center;text-overflow:ellipsis;color-scheme:light}
.dshw-dark .dshw-scope select.dshw-input{color-scheme:dark}
.dshw-scope select.dshw-input:disabled{opacity:.6;cursor:not-allowed}
.dshw-input.dshw-invalid{border-color:var(--dshw-danger);box-shadow:0 0 0 3px var(--dshw-danger-soft)}
.dshw-hint{font-size:11px;color:var(--dshw-text-3);line-height:1.55;margin-top:5px}
.dshw-err{display:flex;align-items:flex-start;gap:5px;font-size:11.5px;color:var(--dshw-danger);margin-top:6px;line-height:1.5}
.dshw-err .dshw-ico{width:13px;height:13px;margin-top:1px}
.dshw-err .dshw-link-btn{color:var(--dshw-danger);text-decoration:underline;font-weight:500;margin-left:2px}
.dshw-field-inline{display:flex;gap:8px;align-items:stretch}
.dshw-field-inline .dshw-input{flex:1;min-width:0}
.dshw-field-inline .dshw-btn{height:36px;flex:none}
.dshw-readonly-box{display:flex;align-items:center;gap:8px;min-height:36px;padding:7px 10px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface-2);font-size:12.5px;font-weight:600;color:var(--dshw-text)}
.dshw-readonly-box .dshw-folder-tile{width:20px;height:20px}
.dshw-select-loading{display:flex;align-items:center;gap:8px;min-height:36px;padding:8px 10px;border:1px solid var(--dshw-border-strong);border-radius:8px;background:var(--dshw-surface-2);font-size:12.5px;color:var(--dshw-text-3)}
.dshw-select-loading .dshw-spinner{width:13px;height:13px;color:var(--dshw-text-3)}
.dshw-check{display:flex;align-items:flex-start;gap:9px;font-size:12.5px;cursor:pointer;color:var(--dshw-text)}
.dshw-check input{width:15px;height:15px;margin:1px 0 0;accent-color:var(--dshw-brand);flex:none;cursor:pointer}
.dshw-check-copy{min-width:0}
.dshw-check small{display:block;font-size:11px;color:var(--dshw-text-3);margin-top:2px;line-height:1.5}
.dshw-check+.dshw-check{margin-top:10px}
.dshw-check:has(input:disabled){opacity:.55}
.dshw-choice-group{display:inline-flex;gap:8px;flex-wrap:wrap;margin-top:1px}
.dshw-choice{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:6px 16px;border:1px solid var(--dshw-border-strong);border-radius:8px;background:var(--dshw-surface);font-size:12.5px;color:var(--dshw-text);cursor:pointer;transition:border-color .14s,background .14s,color .14s,box-shadow .14s}
.dshw-choice:hover{border-color:var(--dshw-text-3)}
.dshw-choice input{width:14px;height:14px;margin:0;accent-color:var(--dshw-brand);cursor:pointer}
.dshw-choice:has(input:checked){border-color:var(--dshw-brand);background:var(--dshw-brand-soft);color:var(--dshw-brand);font-weight:600}
.dshw-choice:has(input:focus-visible){box-shadow:var(--dshw-focus-ring)}

/* menus ------------------------------------------------------------------ */
.dshw-menu{position:relative;flex:none}
.dshw-menu>summary{list-style:none;cursor:pointer}
.dshw-menu>summary::-webkit-details-marker{display:none}
.dshw-menu-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:30;min-width:190px;background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:10px;box-shadow:var(--dshw-shadow-lg);padding:5px}
.dshw-menu-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:transparent;border-radius:7px;padding:8px 9px;font-size:12.5px;color:var(--dshw-text)}
.dshw-menu-item .dshw-ico{width:14px;height:14px;color:var(--dshw-text-3)}
.dshw-menu-item:hover{background:var(--dshw-surface-2)}
.dshw-menu-item--danger{color:var(--dshw-danger)}
.dshw-menu-item--danger .dshw-ico{color:var(--dshw-danger)}
.dshw-menu-sep{height:1px;background:var(--dshw-border);margin:5px 4px}

/* empty ------------------------------------------------------------------ */
.dshw-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:72px 24px;gap:9px;min-height:320px}
.dshw-empty-icon{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:var(--dshw-brand-soft);color:var(--dshw-brand);margin-bottom:4px}
.dshw-empty-icon .dshw-ico{width:28px;height:28px}
.dshw-empty h2{font-size:15px;font-weight:600;color:var(--dshw-text)}
.dshw-empty p{font-size:12px;color:var(--dshw-text-3);line-height:1.7;max-width:48ch}
.dshw-empty .dshw-btn{margin-top:8px}
.dshw-detail-empty{padding-top:96px}

/* settings --------------------------------------------------------------- */
.dshw-settings{padding:22px 26px 44px;max-width:960px;margin:0 auto;min-height:100%;background:var(--dshw-bg)}
.dshw-recent-list{display:flex;flex-direction:column}
.dshw-recent-row{display:flex;align-items:center;gap:10px;padding:9px 4px;border-top:1px solid var(--dshw-border-soft)}
.dshw-recent-row:first-child{border-top:0}
.dshw-recent-row>.dshw-ico{width:15px;height:15px;color:var(--dshw-text-3)}
.dshw-recent-main{flex:1;min-width:0}
.dshw-recent-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--dshw-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshw-danger-row{display:flex;align-items:center;gap:10px;margin-top:12px;padding:9px 11px;background:var(--dshw-danger-soft);border:1px solid var(--dshw-danger-border);border-radius:8px;font-size:11.5px;color:var(--dshw-text-2)}
.dshw-danger-row>.dshw-ico{width:14px;height:14px;color:var(--dshw-danger)}
.dshw-danger-row .dshw-btn{margin-left:auto}

/* modal ------------------------------------------------------------------ */
.dshw-modal-layer{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dshw-overlay);animation:dshw-fade-in .14s ease-out}
.dshw-modal{width:min(620px,100%);max-height:min(84vh,760px);display:flex;flex-direction:column;background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:14px;box-shadow:var(--dshw-shadow-lg);overflow:hidden;animation:dshw-modal-in .16s ease-out}
.dshw-modal--sm{width:min(560px,100%)}
.dshw-modal--lg{width:min(680px,100%)}
@keyframes dshw-fade-in{from{opacity:0}to{opacity:1}}
@keyframes dshw-modal-in{from{opacity:0;transform:translateY(8px) scale(.988)}to{opacity:1;transform:none}}
.dshw-modal-head{display:flex;align-items:flex-start;gap:11px;padding:17px 20px 14px;border-bottom:1px solid var(--dshw-border-soft);flex:none}
.dshw-modal-icon{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none;background:var(--dshw-brand-soft);color:var(--dshw-brand);border:1px solid var(--dshw-brand-border)}
.dshw-modal-icon .dshw-ico{width:17px;height:17px}
.dshw-modal-icon--danger{background:var(--dshw-danger-soft);color:var(--dshw-danger);border-color:var(--dshw-danger-border)}
.dshw-modal-icon--warn{background:var(--dshw-warn-soft);color:var(--dshw-warn);border-color:var(--dshw-warn-border)}
.dshw-modal-head-copy{min-width:0;flex:1;padding-top:1px}
.dshw-modal-title{font-size:15.5px;font-weight:650;line-height:1.35;letter-spacing:-.005em}
.dshw-modal-sub{font-size:11.5px;color:var(--dshw-text-3);line-height:1.55;margin-top:3px}
.dshw-modal-close{width:30px;height:30px;flex:none;display:grid;place-items:center;border:1px solid transparent;background:transparent;color:var(--dshw-text-3);border-radius:8px;margin:-2px -5px 0 0;padding:0}
.dshw-modal-close:hover{background:var(--dshw-surface-2);color:var(--dshw-text)}
.dshw-modal-close .dshw-ico{width:16px;height:16px}
.dshw-modal-body{padding:17px 20px 18px;overflow:auto;flex:1;min-height:0;overscroll-behavior:contain}
.dshw-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:13px 20px;border-top:1px solid var(--dshw-border-soft);background:var(--dshw-surface);flex:none}

/* modal internals -------------------------------------------------------- */
.dshw-advanced{border:1px solid var(--dshw-brand-border);border-radius:10px;margin:4px 0 12px;background:color-mix(in srgb,var(--dshw-brand-soft) 62%,var(--dshw-surface));padding:0 12px}
.dshw-advanced>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:7px;padding:10px 0;font-size:12.5px;font-weight:600;color:var(--dshw-text)}
.dshw-advanced>summary::-webkit-details-marker{display:none}
.dshw-advanced>summary .dshw-ico{width:14px;height:14px;color:var(--dshw-text-2);transition:transform .16s}
.dshw-advanced[open]>summary .dshw-ico{transform:rotate(180deg)}
.dshw-advanced-body{padding:2px 0 13px}
.dshw-preview{display:flex;align-items:center;gap:9px;flex-wrap:wrap;border:1px solid var(--dshw-border);background:var(--dshw-surface-2);border-radius:8px;padding:8px 11px;font-size:11px;color:var(--dshw-text-3);margin-top:2px}
.dshw-preview .dshw-preview-label{font-weight:600;flex:none}
.dshw-preview-item{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%}
.dshw-preview .dshw-mono{font-size:11px;color:var(--dshw-text-2);overflow-wrap:anywhere;min-width:0}
.dshw-preview .dshw-sep{color:var(--dshw-border-strong)}
.dshw-info-table{border:1px solid var(--dshw-border);background:var(--dshw-surface-2);border-radius:9px;padding:3px 11px;margin-bottom:15px}
.dshw-info-table .dshw-kv-row{grid-template-columns:88px minmax(0,1fr);border-top:1px solid var(--dshw-border-soft)}
.dshw-info-table .dshw-kv-row:first-child{border-top:0}
.dshw-danger-list{background:var(--dshw-warn-soft);border:1px solid var(--dshw-warn-border);border-radius:10px;padding:11px 12px;margin:11px 0 14px}
.dshw-danger-list .dshw-danger-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--dshw-warn)}
.dshw-danger-list .dshw-danger-title .dshw-ico{width:14px;height:14px}
.dshw-danger-item{display:flex;align-items:flex-start;gap:7px;margin-top:7px;padding:7px 9px;background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:7px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.5;color:var(--dshw-text-2);overflow-wrap:anywhere}
.dshw-danger-item .dshw-ico{width:12px;height:12px;margin-top:1px;color:var(--dshw-text-3)}

/* toast ------------------------------------------------------------------ */
.dshw-toast{position:fixed;left:50%;bottom:26px;z-index:2147483001;display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--dshw-toast-bg);color:var(--dshw-toast-fg);border-radius:9px;font-size:12.5px;font-weight:500;box-shadow:var(--dshw-shadow-lg);transform:translate(-50%,14px);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;max-width:min(92vw,560px)}
.dshw-toast--show{opacity:1;transform:translate(-50%,0)}
.dshw-toast .dshw-ico{width:15px;height:15px;flex:none}

/* responsive ------------------------------------------------------------- */
@container dshw (max-width:860px){
  .dshw-app{grid-template-columns:268px minmax(0,1fr)}
  .dshw-detail-scroll{padding:18px 18px 36px}
}
@container dshw (max-width:1100px){
  .dshw-console-grid{grid-template-columns:1fr}
  .dshw-console-side{border-left:0;border-top:1px solid var(--dshw-term-border);flex-direction:row;flex-wrap:wrap;gap:14px}
  .dshw-console-side>.dshw-side-block{flex:1 1 160px}
}
@container dshw (max-width:700px){
  .dshw-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dshw-console-grid{grid-template-columns:1fr}
  .dshw-console-side{border-left:0;border-top:1px solid var(--dshw-term-border);flex-direction:row;flex-wrap:wrap;gap:14px}
  .dshw-console-side>.dshw-side-block{flex:1 1 150px}
}
@container dshw (max-width:620px){
  .dshw-app{display:block}
  .dshw-sidebar{width:100%;height:100%;border-right:0}
  .dshw-detail{display:none;height:100%}
  .dshw-app--detail .dshw-sidebar{display:none}
  .dshw-app--detail .dshw-detail{display:flex}
  .dshw-detail-scroll{padding:14px 14px 36px}
  .dshw-mobile-bar{display:flex;align-items:center;gap:8px;margin:-4px 0 10px;padding:4px 0 8px;position:sticky;top:0;z-index:4;background:var(--dshw-bg);border-bottom:1px solid var(--dshw-border)}
  .dshw-hero-top{flex-direction:column;gap:14px}
  .dshw-hero-action{width:100%;align-items:stretch}
  .dshw-hero-action .dshw-btn{width:100%}
  .dshw-hero-action .dshw-hint{max-width:none;text-align:left}
  .dshw-page-head{flex-wrap:wrap}
  .dshw-page-actions{margin-left:0;width:100%;justify-content:flex-end}
  .dshw-action-grid>.dshw-btn{flex:1 1 100%}
}
@container dshw (max-width:420px){
  .dshw-detail-scroll{padding:10px 10px 32px}
  .dshw-kv-row{grid-template-columns:1fr;gap:2px;padding:8px 0}
  .dshw-kv-k{font-size:11px}
  .dshw-kv-v{font-size:12.5px}
  .dshw-form-row{grid-template-columns:1fr;gap:4px}
  .dshw-form-row>label{padding-top:0}
  .dshw-card{padding:13px;border-radius:10px}
  .dshw-hero{padding:14px}
  .dshw-hero h1{font-size:18px}
  .dshw-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dshw-task{margin-left:12px}
  .dshw-page-head h1{font-size:18px}
  .dshw-project{flex-wrap:wrap;gap:2px}
  .dshw-project-select{flex:1 1 calc(100% - 28px)}
  .dshw-tree-inline-empty .dshw-link-btn{display:none}
  .dshw-project-add{order:4;display:inline-flex;align-items:center;justify-content:center;gap:3px;width:auto;height:22px;padding:0 7px;margin-left:26px;opacity:1;border-radius:6px;color:var(--dshw-text-3)}
  .dshw-project-add .dshw-ico{width:12px;height:12px}
}

@media (max-width:520px){
  .dshw-modal-layer{padding:10px;align-items:flex-end}
  .dshw-modal{max-height:94dvh;border-radius:14px 14px 12px 12px}
  .dshw-modal-head{padding:15px 16px 12px}
  .dshw-modal-body{padding:15px 16px 16px}
  .dshw-modal-foot{padding:12px 16px}
}

@supports not (color: color-mix(in srgb, white, black)){
  .dshw-advanced{background:var(--dshw-brand-soft)}
  .dshw-meter{background:var(--dshw-term-border)}
}


@media (forced-colors:active){
  .dshw-scope :focus-visible{outline:2px solid CanvasText;outline-offset:2px}
  .dshw-search input:focus,.dshw-input:focus{outline:2px solid CanvasText;outline-offset:2px;box-shadow:none}
  .dshw-btn--primary{border:1px solid ButtonText}
}
@media (pointer:coarse){
  .dshw-btn{min-height:40px}
  .dshw-icon-btn{width:40px;height:40px}
  .dshw-project-toggle{width:34px;height:36px}
  .dshw-task-open{width:40px}
  .dshw-copy-btn{width:34px;height:34px}
  .dshw-menu>summary{width:40px;height:40px}
}
@media (prefers-reduced-motion:reduce){
  .dshw-scope *, .dshw-scope *::before, .dshw-scope *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
  .dshw-sk-line{animation:none;background:var(--dshw-surface-3)}
}
`
