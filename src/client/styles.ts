import { PALETTE, paletteVars } from './palette'

export const CSS = `
.dshw-scope{${paletteVars(PALETTE.light)}}
.dshw-dark .dshw-scope{${paletteVars(PALETTE.dark)}}

.dshw-scope, .dshw-scope *, .dshw-scope *::before, .dshw-scope *::after{box-sizing:border-box}
.dshw-scope{font-family:"Inter",-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif;color:var(--dshw-text);font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"cv02","cv03","cv04","cv11"}
.dshw-scope :where(button, input, select, textarea){font:inherit;color:inherit}
.dshw-scope button{cursor:pointer}
.dshw-scope button:disabled{cursor:not-allowed}
.dshw-scope a{color:var(--dshw-brand)}
.dshw-scope h1, .dshw-scope h2, .dshw-scope h3, .dshw-scope h4, .dshw-scope p{margin:0}
.dshw-scope ul, .dshw-scope ol{margin:0;padding:0;list-style:none}
.dshw-scope [hidden]{display:none!important}
.dshw-scope code, .dshw-scope .dshw-mono{font-family:"JetBrains Mono","Cascadia Code",ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.dshw-scope code{font-size:11.5px;padding:1px 5px;border-radius:5px;background:var(--dshw-surface-2);border:1px solid var(--dshw-border);overflow-wrap:anywhere}
.dshw-scope ::selection{background:var(--dshw-brand-soft);color:var(--dshw-text)}
.dshw-scope :focus-visible{outline:2px solid var(--dshw-brand);outline-offset:2px}
.dshw-scope *{scrollbar-width:thin;scrollbar-color:var(--dshw-border-strong) transparent}
.dshw-scope ::-webkit-scrollbar{width:10px;height:10px}
.dshw-scope ::-webkit-scrollbar-track{background:transparent}
.dshw-scope ::-webkit-scrollbar-thumb{background:var(--dshw-border-strong);border-radius:99px;border:3px solid transparent;background-clip:content-box}
.dshw-scope ::-webkit-scrollbar-thumb:hover{background:var(--dshw-text-3);background-clip:content-box}

.dshw-ico{width:18px;height:18px;flex:none;display:block}
/* The local sprite is stroke-drawn; shared icons ship their own paint. */
.dshw-ico-sprite{stroke:currentColor;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}

/* shell ------------------------------------------------------------------ */
.dshw-shell{position:relative;height:100%;min-height:0;container-type:inline-size;container-name:dshw;background:var(--dshw-bg);color:var(--dshw-text);overflow:hidden;display:flex;flex-direction:column}
.dshw-app{display:grid;grid-template-columns:272px minmax(0,1fr);flex:1;min-height:0;background:var(--dshw-bg)}
.dshw-attention-bar{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:7px 12px;border-bottom:1px solid var(--dshw-border);font-size:12px}
.dshw-attention-bar--warn{background:var(--dshw-warn-soft);border-bottom-color:var(--dshw-warn-border)}
.dshw-attention-bar--error{background:var(--dshw-danger-soft);border-bottom-color:var(--dshw-danger-border)}
.dshw-attention-bar--neutral{background:var(--dshw-surface-2);color:var(--dshw-text-2)}
.dshw-attention-bar__icon{display:inline-flex;flex:none;color:inherit}
.dshw-attention-bar__icon .dshw-ico{width:15px;height:15px}
.dshw-attention-bar--error .dshw-attention-bar__icon{color:var(--dshw-danger)}
.dshw-attention-bar__text{color:var(--dshw-text);min-width:0}
.dshw-attention-bar__links{display:flex;flex-wrap:wrap;gap:10px;margin-left:auto}
.dshw-attention-bar__collapse{flex:none;border:0;background:transparent;color:var(--dshw-text-3);font-size:11.5px;cursor:pointer;padding:2px 5px;border-radius:6px}
.dshw-attention-bar__collapse:hover{color:var(--dshw-text)}
@container dshw (max-width:620px){.dshw-shell--detail .dshw-attention-bar{display:none}}

/* tree ------------------------------------------------------------------- */
.dshw-sidebar{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--dshw-tree-bg);border-right:1px solid var(--dshw-border)}
.dshw-task-list{display:flex;flex-direction:column}
.dshw-tree-head{display:flex;flex-direction:column;flex:none}
.dshw-rail-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 14px 10px}
.dshw-logo{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;letter-spacing:-.02em;color:var(--dshw-text);min-width:0}
.dshw-logo-mark{width:18px;height:18px;border-radius:5px;background:var(--dshw-brand-solid);color:var(--dshw-on-brand);display:grid;place-items:center;font-size:11px;font-weight:700;flex:none}
.dshw-rail-controls{display:flex;flex-direction:column;gap:8px;padding:0 12px 10px;border-bottom:1px solid var(--dshw-border)}
.dshw-rail-controls .dshw-search input{height:30px;border-radius:6px;background:var(--dshw-surface);font-size:12px}
.dshw-tree-head .dshw-search{width:100%}
.dshw-tree-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap;position:relative;min-width:0}
.dshw-search{position:relative;flex:1;min-width:0}
.dshw-search>.dshw-ico{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--dshw-text-3);pointer-events:none}
.dshw-search input{width:100%;height:33px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface);padding:0 10px 0 31px;font-size:12.5px;color:var(--dshw-text);transition:border-color .14s,box-shadow .14s}
.dshw-search input::placeholder{color:var(--dshw-text-3)}
.dshw-search input:hover{border-color:var(--dshw-border-strong)}
.dshw-search input:focus{outline:none;border-color:var(--dshw-brand);box-shadow:var(--dshw-focus-ring)}
.dshw-search-kbd{position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--dshw-text-3);padding:1px 4px;border:1px solid var(--dshw-border);border-radius:4px;pointer-events:none}
.dshw-rail-controls .dshw-search input{padding-right:26px}
.dshw-pills{display:flex;gap:4px}
.dshw-pill{flex:1;height:24px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--dshw-text-3);font-size:11px;font-weight:500;cursor:pointer;transition:all .12s;padding:0}
.dshw-pill:hover{color:var(--dshw-text-2);background:var(--dshw-hover)}
.dshw-pill--on{color:var(--dshw-text);background:var(--dshw-elevated);border-color:var(--dshw-border);box-shadow:var(--dshw-specular)}
.dshw-pill__count{font-variant-numeric:tabular-nums;margin-left:3px;color:var(--dshw-text-3)}
.dshw-pill--on .dshw-pill__count{color:var(--dshw-text-2)}
.dshw-tree-scroll{flex:1;min-height:0;overflow:auto;padding:2px 8px 18px}
.dshw-tree-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 13px;border-top:1px solid var(--dshw-border);font-size:11px;color:var(--dshw-text-3);background:var(--dshw-tree-bg)}
.dshw-tree-status{display:flex;align-items:center;gap:7px;padding:0 12px 8px;font-size:11px;color:var(--dshw-warn)}
.dshw-tree-status .dshw-spinner{width:11px;height:11px}
.dshw-tree-tag{border:1px solid var(--dshw-border);border-radius:999px;padding:1px 6px;background:var(--dshw-surface);font-size:11px;letter-spacing:.02em}
.dshw-sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.dshw-attention-filter{position:relative;flex:none}
.dshw-attention-filter__btn{display:inline-flex;align-items:center;gap:5px;height:27px;padding:0 8px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface);color:var(--dshw-text-2);font-size:12px;cursor:pointer;transition:border-color .12s,background .12s}
.dshw-attention-filter__btn:hover{border-color:var(--dshw-border-strong)}
.dshw-attention-filter__btn--on{border-color:var(--dshw-brand-border);background:var(--dshw-brand-soft);color:var(--dshw-brand)}
.dshw-attention-filter__btn .dshw-ico{width:13px;height:13px}
.dshw-attention-filter__chev{width:12px;height:12px;color:var(--dshw-text-3)}
.dshw-attention-filter__count{min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dshw-danger-soft);color:var(--dshw-danger);font-size:10.5px;display:inline-flex;align-items:center;justify-content:center}
.dshw-attention-panel{position:absolute;top:calc(100% + 6px);left:0;z-index:30;min-width:190px;margin:0;padding:5px;list-style:none;border:1px solid var(--dshw-border);border-radius:10px;background:var(--dshw-surface);box-shadow:var(--dshw-shadow)}
.dshw-attention-option{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:7px;font-size:12.5px;color:var(--dshw-text);cursor:pointer}
.dshw-attention-option__ico{width:14px;height:14px;color:var(--dshw-text-3);flex:none}
.dshw-attention-option--active{background:var(--dshw-surface-2)}
.dshw-attention-option--on{background:var(--dshw-brand-soft);color:var(--dshw-brand)}
.dshw-attention-option--danger .dshw-attention-option__ico{color:var(--dshw-danger)}
.dshw-attention-option__label{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshw-attention-option__count{min-width:16px;text-align:right;color:var(--dshw-text-3);font-size:11px}
.dshw-attention-option__check{width:13px;height:13px;color:var(--dshw-brand)}
.dshw-tree-notice{display:flex;align-items:center;gap:6px;margin:2px 0 6px;padding:6px 8px;border:1px solid var(--dshw-warn-border);background:var(--dshw-warn-soft);border-radius:8px;font-size:11.5px;color:var(--dshw-warn)}
.dshw-tree-notice .dshw-ico{width:13px;height:13px;flex:none}
.dshw-pick-list{display:flex;flex-direction:column;gap:4px;margin-top:10px;max-height:320px;overflow:auto}
.dshw-pick-item{display:flex;align-items:center;gap:9px;padding:8px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface);text-align:left;cursor:pointer}
.dshw-pick-item:hover,.dshw-pick-item:focus-visible{border-color:var(--dshw-brand-border);background:var(--dshw-brand-soft);outline:none}
.dshw-pick-main{display:flex;flex-direction:column;min-width:0}
.dshw-pick-name{font-size:12.5px;font-weight:600;color:var(--dshw-text)}
.dshw-pick-path{font-size:11px;color:var(--dshw-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* project row ------------------------------------------------------------ */
.dshw-project{display:flex;align-items:center;gap:1px;margin-top:5px;padding:2px 1px;border-radius:8px;transition:background .12s}
.dshw-project:hover{background:var(--dshw-surface-2)}
.dshw-project--on{background:var(--dshw-surface);box-shadow:inset 0 0 0 1px var(--dshw-border)}
.dshw-project--on .dshw-project-count{background:var(--dshw-surface-2);border-color:var(--dshw-border);color:var(--dshw-text-2)}
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
.dshw-task--on{background:var(--dshw-surface);box-shadow:inset 0 0 0 1px var(--dshw-border)}
.dshw-task-select{flex:1;min-width:0;display:flex;align-items:flex-start;gap:8px;border:0;background:transparent;text-align:left;padding:7px 3px 7px 8px;border-radius:8px 0 0 8px;color:inherit}
.dshw-task-select .dshw-dot{margin-top:5px}
.dshw-task-main{min-width:0;flex:1}
.dshw-task-title{display:block;font-size:12.5px;font-weight:500;color:var(--dshw-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}
/* simplified task rows (three lines + more + quick action) */
.dshw-trow{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:stretch;margin:1px 0 1px 22px;border-radius:8px;transition:background .12s,box-shadow .12s}
.dshw-trow:hover{background:var(--dshw-surface-2)}
.dshw-trow--on{background:var(--dshw-surface);box-shadow:inset 0 0 0 1px var(--dshw-border)}
.dshw-trow-content{min-width:0;display:flex;flex-direction:column;gap:3px;border:0;background:transparent;text-align:left;padding:7px 3px 7px 8px;border-radius:8px;color:inherit;grid-column:1}
.dshw-trow-content:focus-visible{outline:2px solid var(--dshw-brand);outline-offset:-2px}
.dshw-trow-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12.5px;font-weight:500;color:var(--dshw-text);line-height:1.35;word-break:break-word}
.dshw-trow-meta{display:flex;flex-wrap:wrap;align-items:center;gap:5px;min-width:0}
.dshw-trow-counts{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:11px;color:var(--dshw-text-3);font-variant-numeric:tabular-nums}
.dshw-trow-count{display:inline-flex;align-items:center;gap:3px}
.dshw-trow-count .dshw-ico{width:12px;height:12px}
.dshw-trow-more{align-self:center;width:32px;height:32px;flex:none;border:0;background:transparent;color:var(--dshw-text-3);border-radius:7px;display:grid;place-items:center}
.dshw-trow-more:hover,.dshw-trow-more[aria-expanded="true"]{background:var(--dshw-surface-3);color:var(--dshw-text)}
.dshw-trow-more .dshw-ico{width:15px;height:15px}
.dshw-trow-quick{align-self:center;display:inline-flex;align-items:center;gap:4px;height:28px;margin-right:2px;padding:0 7px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface);color:var(--dshw-brand);font-size:11.5px;cursor:pointer;white-space:nowrap}
.dshw-trow-quick:hover{border-color:var(--dshw-brand-border);background:var(--dshw-brand-soft)}
.dshw-trow-quick .dshw-ico{width:13px;height:13px}
.dshw-trow-popover{position:absolute;right:6px;top:calc(100% - 2px);z-index:25;min-width:170px;padding:5px;border:1px solid var(--dshw-border);border-radius:9px;background:var(--dshw-surface);box-shadow:var(--dshw-shadow);display:flex;flex-direction:column;gap:2px}
.dshw-trow-pop-item{display:flex;align-items:center;gap:7px;padding:5px 7px;border-radius:6px;font-size:12px;color:var(--dshw-text-2)}
.dshw-trow-pop-ico{width:13px;height:13px;color:var(--dshw-text-3);flex:none}
@media (prefers-reduced-motion:reduce){.dshw-trow,.dshw-trow-content{transition:none}}
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
.dshw-detail-scroll{flex:1;min-height:0;overflow:auto;padding:26px 32px 48px}
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
.dshw-card{background:transparent;border:0;border-radius:0;box-shadow:none;padding:0 0 22px;margin:0 0 22px;border-bottom:1px solid var(--dshw-border)}
.dshw-card:last-child{border-bottom:0;padding-bottom:0;margin-bottom:0}
.dshw-card-head{display:flex;align-items:center;gap:8px;min-height:24px;margin-bottom:12px}
.dshw-card-head>.dshw-ico{width:16px;height:16px;color:var(--dshw-text-3)}
.dshw-card-title{font-size:13px;font-weight:600;letter-spacing:-.01em}
.dshw-card-head .dshw-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.dshw-card-sub{font-size:12px;color:var(--dshw-text-2);line-height:1.65;margin:-4px 0 12px;max-width:76ch}
.dshw-card--danger{border-bottom-color:color-mix(in srgb,var(--dshw-danger) 30%,var(--dshw-border))}
.dshw-card--danger .dshw-card-head>.dshw-ico{color:var(--dshw-danger)}
.dshw-card--danger .dshw-card-title{color:var(--dshw-danger)}

/* task hero -------------------------------------------------------------- */
.dshw-hero{padding:18px 20px}
.dshw-hero-top{display:flex;gap:22px;align-items:flex-start}
.dshw-hero-copy{min-width:0;flex:1}
.dshw-hero-crumb{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--dshw-text-3);margin-bottom:9px}
.dshw-hero-crumb .dshw-ico{width:13px;height:13px}
.dshw-hero-crumb .dshw-mono{font-size:11px;color:var(--dshw-text-2);background:var(--dshw-surface-2);border:1px solid var(--dshw-border);padding:1px 6px;border-radius:5px}
.dshw-hero h1{font-size:20px;line-height:1.35;font-weight:650;letter-spacing:-.022em;margin-bottom:7px;overflow-wrap:anywhere}
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
/* Danger keeps the board's red outline on top of the shared outline button. */
.dshw-btn-danger{color:var(--dshw-danger);border-color:color-mix(in srgb,var(--dshw-danger) 38%,var(--dshw-border))}
.dshw-btn-danger:hover{background:var(--dshw-danger-soft);border-color:var(--dshw-danger);color:var(--dshw-danger)}
.dshw-btn--ghost{border-color:transparent;background:transparent;color:var(--dshw-text-2)}
.dshw-btn--ghost:hover{background:var(--dshw-surface-2);border-color:var(--dshw-border)}
.dshw-icon-btn{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dshw-text-2);transition:background .14s,color .14s,border-color .14s;padding:0}
.dshw-icon-btn .dshw-ico{width:16px;height:16px}
.dshw-icon-btn:hover{background:var(--dshw-surface-2);color:var(--dshw-text);border-color:var(--dshw-border)}
.dshw-icon-btn--sm{width:27px;height:27px;border-radius:7px}
.dshw-icon-btn--sm .dshw-ico{width:14px;height:14px}
.dshw-icon-btn--on{background:var(--dshw-brand-soft);color:var(--dshw-brand-strong);border-color:var(--dshw-brand-border)}
.dshw-spinner{flex:none;display:inline-block}
.dshw-spinner--ring{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dshw-spin .7s linear infinite}
@keyframes dshw-spin{to{transform:rotate(360deg)}}

/* chips & dots ----------------------------------------------------------- */
/* Fallback styling only: the shared Tag/StateDot own these when present. */
.dshw-tag--sm{padding:0 6px;font-size:11px}
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
.dshw-input-field{display:block;width:100%;min-width:0}
.dshw-input-field>input{width:100%}
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
/* searchable branch combobox ------------------------------------------------ */
.dshw-combo{position:relative;width:100%}
.dshw-combo-trigger{display:flex;align-items:center;gap:8px;text-align:left;cursor:pointer;padding-right:34px;position:relative}
.dshw-combo-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-combo-chevron{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--dshw-text-3);transition:transform .14s}
.dshw-combo-trigger--open .dshw-combo-chevron{transform:translateY(-50%) rotate(180deg)}
.dshw-combo-panel{margin-top:6px;border:1px solid var(--dshw-border-strong);border-radius:9px;background:var(--dshw-surface);box-shadow:var(--dshw-shadow-lg);padding:7px}
.dshw-combo-search-wrap{position:relative;display:flex;align-items:center}
.dshw-combo-search{padding-right:30px}
.dshw-combo-clear{position:absolute;right:5px;width:22px;height:22px;display:grid;place-items:center;border:0;background:transparent;color:var(--dshw-text-3);border-radius:6px;padding:0}
.dshw-combo-clear:hover{background:var(--dshw-surface-2);color:var(--dshw-text)}
.dshw-combo-clear .dshw-ico{width:13px;height:13px}
.dshw-combo-list{list-style:none;margin:7px 0 0;padding:0;max-height:210px;overflow:auto}
.dshw-combo-option{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;font-size:12.5px;color:var(--dshw-text);cursor:pointer}
.dshw-combo-option-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-combo-option--active{background:var(--dshw-surface-2)}
.dshw-combo-option--selected{color:var(--dshw-brand);font-weight:600}
.dshw-combo-check{width:14px;height:14px;color:var(--dshw-brand);flex:none}
.dshw-combo-tag{font-size:10.5px;color:var(--dshw-text-3);border:1px solid var(--dshw-border);border-radius:99px;padding:1px 6px;flex:none}
.dshw-combo-empty{padding:12px 9px;text-align:center;font-size:11.5px;color:var(--dshw-text-3)}
.dshw-model-default{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:transparent;border-radius:7px;padding:8px 9px;margin-top:7px;font-size:12.5px;color:var(--dshw-text);cursor:pointer}
.dshw-model-default:hover{background:var(--dshw-surface-2)}
.dshw-model-default--selected{color:var(--dshw-brand);font-weight:600}
.dshw-model-default .dshw-combo-check{margin-left:auto}
.dshw-model-group{padding:8px 9px 3px;font-size:10.5px;font-weight:700;letter-spacing:.02em;color:var(--dshw-text-3)}
/* acceptance criteria ------------------------------------------------------ */
.dshw-criteria-pick{border:1px solid var(--dshw-border-strong);border-radius:8px;background:var(--dshw-surface-2);padding:8px 10px;margin-bottom:8px;max-height:150px;overflow:auto}
.dshw-criteria-pick-title{font-size:11px;color:var(--dshw-text-3);margin-bottom:5px}
.dshw-criteria-check{margin:0}
.dshw-criteria-check+.dshw-criteria-check{margin-top:6px}
.dshw-acceptance-list{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.dshw-acceptance-list li{display:flex;align-items:flex-start;gap:7px;font-size:12.5px;color:var(--dshw-text);line-height:1.55}
.dshw-acceptance-list .dshw-ico{width:14px;height:14px;margin-top:2px;color:var(--dshw-success);flex:none}
.dshw-acceptance-card .dshw-card-head{margin-bottom:10px}
.dshw-merge-criteria{border:1px solid var(--dshw-border);background:var(--dshw-surface-2);border-radius:8px;padding:9px 11px;margin:10px 0}
.dshw-merge-criteria-title{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--dshw-text-2);margin-bottom:5px}
.dshw-merge-criteria-title .dshw-ico{width:13px;height:13px;color:var(--dshw-success)}
.dshw-merge-criteria ul{margin:0;padding-left:18px;list-style:disc;font-size:12px;color:var(--dshw-text);line-height:1.55}
.dshw-criteria-add{display:flex;gap:8px;align-items:stretch;margin:2px 0 10px}
.dshw-criteria-add .dshw-input{flex:1;min-width:0}
.dshw-criteria-add .dshw-btn{flex:none;height:36px}
.dshw-criteria-lib{display:flex;flex-direction:column;gap:6px}
.dshw-criteria-lib-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid var(--dshw-border);border-radius:8px;background:var(--dshw-surface-2);font-size:12.5px}
.dshw-criteria-lib-row .dshw-ico{width:14px;height:14px;color:var(--dshw-success);flex:none}
.dshw-criteria-lib-text{flex:1;min-width:0;overflow-wrap:anywhere}
.dshw-switch-warn{font-size:12px;color:var(--dshw-text);line-height:1.6;margin-bottom:8px}
.dshw-switch-files{display:flex;flex-direction:column;gap:5px;margin:0;padding:0;list-style:none;max-height:200px;overflow:auto}
.dshw-switch-files li{display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 8px;border:1px solid var(--dshw-border);border-radius:7px;background:var(--dshw-surface-2);overflow-wrap:anywhere}
.dshw-stash-card .dshw-card-head{margin-bottom:8px}
.dshw-check{display:flex;align-items:flex-start;gap:9px;font-size:12.5px;cursor:pointer;color:var(--dshw-text)}
.dshw-check input{width:15px;height:15px;margin:1px 0 0;accent-color:var(--dshw-brand);flex:none;cursor:pointer}
.dshw-check-copy{min-width:0}
.dshw-check-gap{margin-top:10px}
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
.dshw-modal{width:min(620px,100%);max-height:min(84vh,760px);display:flex;flex-direction:column;background:var(--dshw-surface);border:1px solid var(--dshw-border-strong);border-radius:12px;box-shadow:var(--dshw-shadow-lg),inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden;animation:dshw-modal-in .16s ease-out}
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
.dshw-info-table{border:1px solid var(--dshw-border);background:var(--dshw-surface-2);border-radius:9px;padding:3px 11px;margin-bottom:15px}
.dshw-info-table .dshw-kv-row{grid-template-columns:88px minmax(0,1fr);border-top:1px solid var(--dshw-border-soft)}
.dshw-info-table .dshw-kv-row:first-child{border-top:0}
.dshw-danger-list{background:var(--dshw-warn-soft);border:1px solid var(--dshw-warn-border);border-radius:10px;padding:11px 12px;margin:11px 0 14px}
.dshw-danger-list .dshw-danger-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--dshw-warn)}
.dshw-danger-list .dshw-danger-title .dshw-ico{width:14px;height:14px}
.dshw-danger-item{display:flex;align-items:flex-start;gap:7px;margin-top:7px;padding:7px 9px;background:var(--dshw-surface);border:1px solid var(--dshw-border);border-radius:7px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.5;color:var(--dshw-text-2);overflow-wrap:anywhere}
.dshw-danger-item .dshw-ico{width:12px;height:12px;margin-top:1px;color:var(--dshw-text-3)}

/* diff card -------------------------------------------------------------- */
.dshw-diff-tools{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.dshw-diff-summary{display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--dshw-text-3);font-variant-numeric:tabular-nums}
.dshw-diff-add{color:var(--dshw-success);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}
.dshw-diff-del{color:var(--dshw-danger);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}
.dshw-diff-body{margin-top:10px}
.dshw-diff-status{display:flex;align-items:center;gap:8px;color:var(--dshw-text-2);font-size:12px;padding:5px 2px}
.dshw-diff-status .dshw-ico{width:15px;height:15px;color:var(--dshw-text-3)}
.dshw-diff-status--muted{color:var(--dshw-text-3)}
.dshw-diff-status .dshw-spinner{width:12px;height:12px}
.dshw-diff-trunc{display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:6px 10px;border-radius:7px;background:var(--dshw-warn-soft);border:1px solid var(--dshw-warn-border);color:var(--dshw-warn);font-size:11px}
.dshw-diff-trunc .dshw-ico{width:13px;height:13px}
.dshw-diff-list{display:flex;flex-direction:column;gap:6px}
.dshw-diff-file{border:1px solid var(--dshw-border);border-radius:8px;overflow:hidden;background:var(--dshw-surface)}
.dshw-diff-file-head{display:flex;align-items:center;gap:9px;width:100%;border:0;background:var(--dshw-surface);text-align:left;padding:7px 10px;color:var(--dshw-text)}
.dshw-diff-file-head:hover{background:var(--dshw-surface-2)}
.dshw-diff-badge{min-width:20px;justify-content:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600}
.dshw-diff-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dshw-text)}
.dshw-diff-old{color:var(--dshw-text-3);font-size:11px}
.dshw-diff-stat{flex:none;display:inline-flex;gap:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-variant-numeric:tabular-nums}
.dshw-diff-binary{color:var(--dshw-text-3);font-size:11px}
.dshw-diff-chevron{width:13px;height:13px;flex:none;color:var(--dshw-text-3);transform:rotate(-90deg);transition:transform .12s}
.dshw-diff-file-head[aria-expanded="true"] .dshw-diff-chevron{transform:rotate(0)}
.dshw-diff-patch{margin:0;padding:8px 0;border-top:1px solid var(--dshw-border-soft);background:var(--dshw-term-bg);color:var(--dshw-term-text);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.6;max-height:420px;overflow:auto;tab-size:4}
.dshw-diff-line{display:block;padding:0 12px;white-space:pre;min-height:1.6em}
.dshw-diff-line--meta{color:var(--dshw-term-muted)}
.dshw-diff-line--hunk{color:var(--dshw-term-tool)}
.dshw-diff-line--add{background:color-mix(in srgb,var(--dshw-success) 22%,transparent);color:var(--dshw-term-text)}
.dshw-diff-line--del{background:color-mix(in srgb,var(--dshw-danger) 22%,transparent);color:var(--dshw-term-text)}

/* toast ------------------------------------------------------------------ */
.dshw-toast{position:fixed;left:50%;bottom:26px;z-index:2147483001;display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--dshw-toast-bg);color:var(--dshw-toast-fg);border-radius:9px;font-size:12.5px;font-weight:500;box-shadow:var(--dshw-shadow-lg);transform:translate(-50%,14px);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;max-width:min(92vw,560px)}
.dshw-toast--show{opacity:1;transform:translate(-50%,0)}
.dshw-toast .dshw-ico{width:15px;height:15px;flex:none}

/* optical stage / inspector split ---------------------------------------- */
.dshw-detail-scroll:has(.dshw-stage-grid){padding:0}
.dshw-detail-inner.dshw-stage-grid{display:grid;grid-template-columns:minmax(0,1fr) 284px;gap:0;align-items:start;max-width:1280px;margin:0 auto}
.dshw-stage{min-width:0;display:flex;flex-direction:column;background:var(--dshw-surface)}
.dshw-topbar{height:46px;padding:0 20px;border-bottom:1px solid var(--dshw-border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;background:var(--dshw-surface)}
.dshw-topbar-left,.dshw-topbar-right{display:flex;align-items:center;gap:8px;min-width:0}
.dshw-breadcrumb{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dshw-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshw-breadcrumb .dshw-ico{width:14px;height:14px;flex:none}
.dshw-breadcrumb strong{color:var(--dshw-text);font-weight:500}
.dshw-stage-head{padding:22px 32px 0;border-bottom:1px solid var(--dshw-border);flex:none}
.dshw-stage-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}
.dshw-stage-title{font-size:20px;font-weight:600;letter-spacing:-.025em;line-height:1.3;color:var(--dshw-text);overflow-wrap:anywhere}
.dshw-stage-sub{margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--dshw-text-2)}
.dshw-tabs{display:flex;gap:22px}
.dshw-tab{position:relative;padding:8px 0 11px;border:none;background:transparent;color:var(--dshw-text-3);font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:color .12s}
.dshw-tab:hover{color:var(--dshw-text-2)}
.dshw-tab--on{color:var(--dshw-text)}
.dshw-tab--on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1.5px;background:var(--dshw-text)}
.dshw-stage-body{padding:26px 32px 48px;min-width:0}
.dshw-measure{max-width:720px}
.dshw-block{padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid var(--dshw-border)}
.dshw-block:last-child{border-bottom:none;padding-bottom:0;margin-bottom:0}
.dshw-block-label{font-size:11.5px;font-weight:500;color:var(--dshw-text-3);margin-bottom:10px}
.dshw-prose{font-size:13.5px;line-height:1.7;color:var(--dshw-text-2);white-space:pre-wrap;overflow-wrap:anywhere}
/* flatten cards living inside the stage into divider-separated blocks */
.dshw-stage .dshw-card{background:transparent;border:0;border-radius:0;box-shadow:none;padding:0 0 22px;margin:0 0 22px;border-bottom:1px solid var(--dshw-border)}
.dshw-stage .dshw-card:last-child{border-bottom:0;margin-bottom:0;padding-bottom:0}
.dshw-stage .dshw-card-head{margin-bottom:10px}
.dshw-inspector{min-width:0;display:flex;flex-direction:column;gap:18px;padding:16px;position:sticky;top:0;align-self:start;background:var(--dshw-tree-bg);border-left:1px solid var(--dshw-border)}
.dshw-inspector .dshw-card{background:transparent;border:0;border-radius:0;box-shadow:none;padding:0 0 16px;margin:0;border-bottom:1px solid var(--dshw-border)}
.dshw-inspector .dshw-card:last-child{border-bottom:0;padding-bottom:0}
.dshw-inspector .dshw-card-head{margin-bottom:10px;min-height:0}
.dshw-inspector .dshw-card-title{font-size:11px;font-weight:600;color:var(--dshw-text-3);letter-spacing:.02em}
.dshw-inspector .dshw-card-sub{margin:0 0 10px;font-size:11.5px;color:var(--dshw-text-3)}
@container dshw (max-width:1120px){
  .dshw-detail-inner.dshw-stage-grid{grid-template-columns:minmax(0,1fr)}
  .dshw-stage{border-right:0}
  .dshw-inspector{position:static;flex-direction:row;flex-wrap:wrap;gap:16px;border-top:1px solid var(--dshw-border)}
  .dshw-inspector>.dshw-card{flex:1 1 320px;min-width:0}
}

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
  .dshw-diff-line--add{background:rgba(20,108,51,.22)}
  .dshw-diff-line--del{background:rgba(185,28,28,.22)}
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

/* ---- demo.html parity: rail group-head + item rows ---------------------- */
.dshw-sidebar .dshw-project{display:flex;align-items:center;gap:4px;margin-top:6px;padding:6px 8px 4px;border-radius:6px;background:transparent;border:0;box-shadow:none;transition:background .12s}
.dshw-sidebar .dshw-project:hover{background:var(--dshw-hover)}
.dshw-sidebar .dshw-project--on{background:transparent;box-shadow:none}
.dshw-sidebar .dshw-project-select{padding:0;gap:8px}
.dshw-sidebar .dshw-project .dshw-folder-tile{display:none}
.dshw-sidebar .dshw-project-name{font-size:11.5px;font-weight:500;color:var(--dshw-text-2);letter-spacing:.01em}
.dshw-sidebar .dshw-project--on .dshw-project-name{color:var(--dshw-text)}
.dshw-sidebar .dshw-project-count{margin-left:auto;min-width:0;height:auto;padding:0;background:transparent;border:0;color:var(--dshw-text-3);font-size:11px}
.dshw-sidebar .dshw-project-toggle{width:16px;height:16px;opacity:0;transition:opacity .12s,transform .16s}
.dshw-sidebar .dshw-project-toggle .dshw-ico{width:13px;height:13px}
.dshw-sidebar .dshw-project-add{width:20px;height:20px;opacity:0;transition:opacity .12s}
.dshw-sidebar .dshw-project-add .dshw-ico{width:13px;height:13px}
.dshw-sidebar .dshw-project:hover .dshw-project-toggle,
.dshw-sidebar .dshw-project:hover .dshw-project-add,
.dshw-sidebar .dshw-project:focus-within .dshw-project-toggle,
.dshw-sidebar .dshw-project:focus-within .dshw-project-add{opacity:.75}

.dshw-item{position:relative;padding:9px 10px;border:1px solid transparent;border-radius:7px;margin-bottom:2px;transition:background .12s,border-color .12s}
.dshw-item:hover{background:var(--dshw-hover)}
.dshw-item--on{background:var(--dshw-elevated);border-color:var(--dshw-border);box-shadow:var(--dshw-specular)}
.dshw-item-hit{display:block;width:100%;border:0;background:transparent;text-align:left;padding:0;color:inherit;cursor:pointer}
.dshw-item-row1{display:flex;align-items:center;gap:8px;min-width:0}
.dshw-item-title{flex:1;min-width:0;font-size:12.5px;font-weight:500;color:var(--dshw-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshw-item--on .dshw-item-title{font-weight:600}
.dshw-item-stat{flex:none;font-size:11px;color:var(--dshw-text-3)}
.dshw-item-row2{margin-top:4px;padding-left:15px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--dshw-text-3)}
.dshw-item-branch{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshw-item-status{flex:none;color:var(--dshw-text-3)}
.dshw-item-quick{position:absolute;right:8px;top:8px;width:22px;height:22px;display:grid;place-items:center;border:1px solid var(--dshw-border);border-radius:6px;background:var(--dshw-elevated);color:var(--dshw-brand);opacity:0;transition:opacity .12s;padding:0}
.dshw-item-quick .dshw-ico{width:13px;height:13px}
.dshw-item-more{position:absolute;right:8px;bottom:8px;width:18px;height:18px;display:grid;place-items:center;border:0;background:transparent;color:var(--dshw-text-3);opacity:0;padding:0}
.dshw-item-more .dshw-ico{width:13px;height:13px}
.dshw-item:hover .dshw-item-quick,
.dshw-item:hover .dshw-item-more,
.dshw-item:focus-within .dshw-item-quick,
.dshw-item:focus-within .dshw-item-more{opacity:1}
.dshw-item-popover{position:absolute;right:6px;top:calc(100% - 2px);z-index:25;min-width:170px;padding:5px;border:1px solid var(--dshw-border);border-radius:9px;background:var(--dshw-elevated);box-shadow:var(--dshw-shadow);display:flex;flex-direction:column;gap:2px}
.dshw-foot-tools{display:flex;align-items:center;gap:2px}
.dshw-foot-count{font-size:11px;color:var(--dshw-text-3)}
.dshw-rail-hidden{grid-template-columns:0 minmax(0,1fr)!important}
.dshw-rail-hidden .dshw-sidebar{overflow:hidden;border-right:0}
.dshw-inspector-hidden .dshw-inspector{display:none}
.dshw-inspector-hidden .dshw-detail-inner.dshw-stage-grid{grid-template-columns:minmax(0,1fr)!important}

/* ---- demo.html parity: modal shell ------------------------------------- */
.dshw-modal{width:min(580px,100%);max-height:90vh;border-radius:11px;background:var(--dshw-surface);border:1px solid var(--dshw-border);box-shadow:var(--dshw-modal-shadow),var(--dshw-specular)}
.dshw-modal--lg{width:min(680px,100%)}
.dshw-modal-head{padding:15px 20px;border-bottom:1px solid var(--dshw-border);align-items:center}
.dshw-modal-body{display:flex;flex-direction:column;gap:16px;padding:18px 20px}
.dshw-modal-foot{padding:13px 20px;background:var(--dshw-tree-bg);border-top:1px solid var(--dshw-border)}
.dshw-modal-badge{font-size:10.5px;color:var(--dshw-text-3);padding:1px 6px;border-radius:4px;border:1px solid var(--dshw-border);background:var(--dshw-surface);font-weight:500}
.dshw-modal-title-group{display:flex;align-items:center;gap:10px;min-width:0}
.dshw-field-row-2{display:grid;grid-template-columns:1.3fr 1fr;gap:12px}
@media (max-width:520px){.dshw-field-row-2{grid-template-columns:1fr}}
.dshw-modal .dshw-form-rows{gap:14px}
.dshw-modal .dshw-form-row{grid-template-columns:1fr;gap:6px}
.dshw-modal .dshw-form-row>label,.dshw-modal .dshw-form-row>.dshw-form-label{padding-top:0;font-size:11.5px;font-weight:500;color:var(--dshw-text-2)}
.dshw-foot-meta{margin-right:auto;font-size:11px;color:var(--dshw-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:52%}
`

/** Demo.html's Optical Precision surface, scoped so it cannot affect host pages. */
export const DEMO_CSS = `
.dshw-demo, .dshw-demo *, .dshw-demo *::before, .dshw-demo *::after { box-sizing: border-box; }
.dshw-demo {
  --bg-canvas: #09090b; --bg-rail: #0d0e11; --bg-stage: #101114; --bg-elevated: #16181d;
  --bg-modal: #13151a; --bg-hover: rgba(255,255,255,.045); --bg-active: rgba(255,255,255,.075);
  --backdrop: rgba(4,4,6,.72); --line: rgba(255,255,255,.08); --line-strong: rgba(255,255,255,.16);
  --specular: inset 0 1px 0 rgba(255,255,255,.07);
  --modal-shadow: 0 24px 64px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08);
  --text-1: #f4f4f5; --text-2: #a1a1aa; --text-3: #63636e;
  --cta-bg: #f4f4f5; --cta-text: #09090b; --cta-hover: #ffffff;
  --accent: #818cf8; --accent-soft: rgba(129,140,248,.12); --accent-line: rgba(129,140,248,.28);
  --ok: #34d399; --ok-soft: rgba(52,211,153,.11); --ok-line: rgba(52,211,153,.25);
  --warn: #fbbf24; --warn-soft: rgba(251,191,36,.11); --warn-line: rgba(251,191,36,.26);
  --err: #f87171; --err-soft: rgba(248,113,113,.11); --err-line: rgba(248,113,113,.26);
  --code-bg: #0b0c0f; --diff-add-bg: rgba(16,185,129,.11); --diff-del-bg: rgba(244,63,94,.12);
  height: 100%; min-height: 0; position: relative; overflow: hidden;
  color: var(--text-1); background: var(--bg-canvas);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 13px; line-height: 1.5; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.dshw-demo[data-theme="light"] {
  --bg-canvas: #f2f1ec; --bg-rail: #f6f5f0; --bg-stage: #fcfbf8; --bg-elevated: #ffffff;
  --bg-modal: #fcfbf8; --bg-hover: rgba(20,20,19,.04); --bg-active: rgba(20,20,19,.075);
  --backdrop: rgba(20,20,19,.36); --line: rgba(20,20,19,.085); --line-strong: rgba(20,20,19,.18);
  --specular: inset 0 1px 0 rgba(255,255,255,.9);
  --modal-shadow: 0 24px 60px rgba(20,20,19,.16), 0 0 0 1px rgba(20,20,19,.09);
  --text-1: #141413; --text-2: #575652; --text-3: #8c8a82;
  --cta-bg: #141413; --cta-text: #fcfbf8; --cta-hover: #2a2a28;
  --accent: #4f46e5; --accent-soft: rgba(79,70,229,.09); --accent-line: rgba(79,70,229,.24);
  --ok: #059669; --ok-soft: rgba(5,150,105,.09); --ok-line: rgba(5,150,105,.24);
  --warn: #b45309; --warn-soft: rgba(180,83,9,.09); --warn-line: rgba(180,83,9,.24);
  --err: #dc2626; --err-soft: rgba(220,38,38,.08); --err-line: rgba(220,38,38,.22);
  --code-bg: #f6f5f0; --diff-add-bg: rgba(16,185,129,.10); --diff-del-bg: rgba(220,38,38,.08);
}
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
.dshw-demo .dshwd-management { height: 100%; min-height: 0; overflow: hidden; }
@media (max-width: 900px) {
  .dshw-demo .dshwd-app { grid-template-columns: 248px minmax(0,1fr) 0; }
  .dshw-demo .dshwd-app.dshwd-hide-left { grid-template-columns: 0 minmax(0,1fr) 0; }
  .dshw-demo .dshwd-inspector { display: none; }
  .dshw-demo .dshwd-app:not(.dshwd-hide-right) .dshwd-inspector { display: flex; position: absolute; right: 0; top: 0; bottom: 0; width: 284px; z-index: 20; }
  .dshw-demo .dshwd-stage-head { padding: 18px 20px 0; }
  .dshw-demo .dshwd-stage-body { padding: 20px 20px 36px; }
  .dshw-demo .dshwd-stage-title-row { flex-direction: column; }
}
`
