export const TOKENS_CSS = `
.dshw-scope {
  --w-bg: var(--dsh-bg, var(--dshw-bg, #ffffff));
  --w-bg-subtle: var(--dsh-bg-subtle, var(--dshw-surface, #f8f9fb));
  --w-bg-elevated: var(--dsh-bg-elevated, #ffffff);
  --w-bg-hover: var(--dsh-bg-hover, rgba(15, 23, 42, 0.045));
  --w-bg-active: var(--dsh-bg-active, rgba(37, 99, 235, 0.08));

  --w-border: var(--dsh-border, var(--dshw-border, rgba(15, 23, 42, 0.09)));
  --w-border-strong: var(--dsh-border-strong, var(--dshw-border-strong, rgba(15, 23, 42, 0.16)));

  --w-fg: var(--dsh-fg, var(--dshw-text, #0f172a));
  --w-fg-muted: var(--dsh-fg-muted, var(--dshw-text-2, #475569));
  --w-fg-subtle: var(--dsh-fg-subtle, var(--dshw-text-3, #94a3b8));

  --w-accent: var(--dsh-accent, var(--dshw-brand, #2563eb));
  --w-accent-fg: #ffffff;
  --w-ok: #16a34a;
  --w-ok-bg: rgba(22, 163, 74, 0.1);
  --w-warn: #d97706;
  --w-warn-bg: rgba(217, 119, 6, 0.12);
  --w-danger: #dc2626;
  --w-danger-bg: rgba(220, 38, 38, 0.1);
  --w-info: #7c3aed;
  --w-info-bg: rgba(124, 58, 237, 0.1);

  --w-space-1: 4px;
  --w-space-2: 8px;
  --w-space-3: 12px;
  --w-space-4: 16px;
  --w-space-5: 20px;
  --w-radius-sm: 6px;
  --w-radius-md: 8px;
  --w-radius-lg: 12px;

  --w-ease: cubic-bezier(0.2, 0, 0, 1);
  --w-fast: 120ms;
  --w-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --w-shadow-md: 0 8px 24px -4px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06);
}

.dshw-dark .dshw-scope {
  --w-bg: var(--dsh-bg, var(--dshw-bg, #0d1117));
  --w-bg-subtle: var(--dsh-bg-subtle, var(--dshw-surface, #161b22));
  --w-bg-elevated: var(--dsh-bg-elevated, #1c2128);
  --w-bg-hover: var(--dsh-bg-hover, rgba(240, 246, 252, 0.06));
  --w-bg-active: var(--dsh-bg-active, rgba(56, 139, 253, 0.15));
  --w-border: var(--dsh-border, var(--dshw-border, rgba(240, 246, 252, 0.1)));
  --w-border-strong: var(--dsh-border-strong, var(--dshw-border-strong, rgba(240, 246, 252, 0.18)));
  --w-fg: var(--dsh-fg, var(--dshw-text, #e6edf3));
  --w-fg-muted: var(--dsh-fg-muted, var(--dshw-text-2, #8b949e));
  --w-fg-subtle: var(--dsh-fg-subtle, var(--dshw-text-3, #6e7681));
  --w-accent: var(--dsh-accent, var(--dshw-brand, #3b82f6));
  --w-shadow-md: 0 12px 32px rgba(0, 0, 0, 0.45);
}
`
