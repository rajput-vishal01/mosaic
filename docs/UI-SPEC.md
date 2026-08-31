# Mosaic interface contract

## Design read

Mosaic is a dense B2B operations and analytics application for platform operators, agency administrators, and client viewers. It uses a restrained, trust-first product language with low motion and high information density.

| Dial | Value | Meaning |
|---|---:|---|
| Design variance | 4/10 | Predictable navigation and layouts with limited asymmetry |
| Motion intensity | 2/10 | Functional feedback only, no decorative choreography |
| Visual density | 8/10 | Compact operational tables and dashboards without card clutter |

## Foundation

- Use one customized shadcn/ui and Radix primitive system. Do not mix it with Material, Fluent, Carbon, or another full design system.
- Use Tailwind CSS v4 and semantic CSS variables for color, spacing, radii, elevation, and state.
- Use Geist and Geist Mono through `next/font`.
- Use Phosphor as the only icon family. Do not draw icons manually.
- Use TanStack Table for data grids. Do not build sorting, filtering, pagination, row selection, or column visibility from scratch.
- Use React Hook Form with Zod schemas for complex client forms. Use native React and Server Action form primitives for small forms when they are sufficient.
- Do not add Motion, GSAP, Three.js, or an animation framework in the initial application bundle.

## Product shell

### Superadmin and agency admin

- Persistent left navigation on desktop.
- Collapsible navigation drawer on smaller screens.
- One-line top bar containing breadcrumbs, current agency context, global search when relevant, and user controls.
- Page title, concise description, primary action, and secondary actions share one predictable header pattern.
- Tables are the default for users, agencies, connections, accounts, grants, reports, sync history, and audit events.
- Side sheets handle quick inspection and simple editing without losing table context.
- Dedicated pages handle destructive actions, multi-step connector setup, and complex assignments.

### Client user

- Much smaller navigation surface than the admin shell.
- Dashboard is the default route after login.
- Report history and account/data freshness are visible but secondary.
- No controls are rendered for actions the client cannot perform.

## Layout rules

- Prefer whitespace, grouping, and one-pixel separators over wrapping every section in a card.
- Cards indicate real hierarchy, such as a connection summary or dashboard tile. They are not generic containers.
- Use a documented radius scale: 8px controls, 12px panels, full radius only for status badges.
- Keep numerical columns right-aligned and use tabular numerals.
- Keep table actions in a consistent final column.
- Preserve selected filters and pagination in URL search parameters when the view should be shareable or restorable.
- At widths below 768px, dense tables become prioritized column views or structured lists. They do not shrink into unreadable grids.

## Motion and micro-interactions

Motion must communicate feedback or state change.

- Hover and focus transitions: 120-180ms.
- Panels, dialogs, and menus: 160-220ms.
- Animate only opacity and transform where possible.
- Buttons may use a subtle active-state translation or scale.
- Do not use page-load reveals, parallax, marquees, cursor effects, background animation, or scroll hijacking.
- Honor `prefers-reduced-motion`; all behavior remains understandable with transitions removed.
- Embedded Superset loading must not cause layout shift. Reserve its final viewport before loading.

## Required asynchronous states

Every data-bearing surface defines these states before its successful state is implemented:

1. Initial loading with a skeleton matching the final geometry.
2. Background refresh that preserves current content and shows a quiet progress indicator.
3. Empty state explaining why no data exists and the next permitted action.
4. Partial state when some connectors are healthy and others are unavailable.
5. Stale state showing the last successful synchronization time.
6. Reconnect-required state with an action visible only to the superadmin.
7. Permission-denied state that does not reveal the existence of unauthorized resources.
8. Error state with a stable incident or correlation identifier where appropriate.

Generic full-page spinners are not accepted.

## Forms

- Labels always appear above controls. Placeholders never replace labels.
- Schema validation runs on both client and server from shared Zod schemas where practical.
- Inline errors appear below the responsible field.
- Toasts communicate transient completion, not validation failures or persistent errors.
- Submit controls expose pending state and prevent duplicate submission.
- Destructive operations use a purpose-built confirmation dialog and name the affected resource.
- Provider OAuth forms explain the account identity, scopes, callback, and what happens after authorization.
- Account assignment uses searchable, grouped, multi-select controls backed by established accessible primitives.

## Accessibility

- Meet WCAG 2.2 AA for control states, contrast, labels, keyboard behavior, and error identification.
- All tables, menus, dialogs, tabs, tooltips, and comboboxes remain keyboard operable.
- Focus indicators are always visible and never removed without a stronger replacement.
- Color is not the only connection-health or sync-status signal.
- Skeletons are hidden from assistive technology and paired with an appropriate live-region status when needed.
- Superset embeds receive meaningful titles and a usable focus boundary.

## Visual direction

- Default to a light operational theme with a tested dark theme available through semantic tokens.
- Use one restrained accent color. Do not use AI-purple gradients, neon glow, glassmorphism, or decorative status dots.
- Prefer neutral surfaces, strong type hierarchy, and clear semantic status colors.
- Avoid oversized headings, marketing-page hero patterns, and fake dashboard previews.
- Use real application data in development fixtures and clearly identify sample values.

## Acceptance checklist for every route

- Correct role sees the route and actions.
- Unauthorized role cannot retrieve its data through the server endpoint.
- Keyboard navigation works in logical order.
- Loading, empty, error, stale, and successful states are represented.
- Mobile behavior is specified and usable.
- No unexpected layout shift occurs.
- Text and control contrast meets WCAG AA.
- Reduced-motion mode remains complete.
- The route does not introduce a second design system or duplicate a library capability.

