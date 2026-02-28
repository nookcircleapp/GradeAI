# Phase 4 Context: Polish & PDF Export

## Phase Goal
Report is downloadable as PDF with polished, production-ready user experience

## User Decisions

### PDF Generation Approach
- **Decision:** Client-side PDF generation using browser print/CSS `@media print`
- **Rationale:** No additional server dependencies, works with existing grade report component, simplest approach for a demo app. Use `window.print()` with a print-optimized stylesheet that isolates the grade report.
- **Fallback:** If print-to-PDF quality is insufficient, use `html2canvas` + `jspdf` for pixel-perfect capture

### Download UX
- **Decision:** "Download PDF" button appears on the grade report after grading completes (both Try preview and Submit final)
- **Placement:** Top-right of the grade report header card, next to the Final/Preview badge
- **Icon:** Download icon from lucide-react

### UI Polish Scope
- **Decision:** Focused polish, not a redesign. Target specific gaps identified in codebase:
  1. Admin view error handling — upgrade from plain text to styled error cards (match student view pattern)
  2. Replace `window.confirm()` on submit with a proper shadcn dialog component
  3. Clean up dead CSS files (`App.css`, `index.css`) that are not imported
  4. Consistent spacing audit across admin and student views
- **Out of scope:** Dark mode toggle, animations overhaul, new color themes

### Error Handling Improvements
- **Decision:** Add React Error Boundary at app level for uncaught errors
- **Decision:** Standardize API error display — both admin and student views use the same styled error card pattern
- **Decision:** Add network timeout handling with user-friendly messages

### Frontend Design Quality
- **Decision:** Use frontend-design skill for any new UI components (dialog, PDF button styling)
- **Decision:** Maintain existing New York style, neutral colors, shadcn/ui aesthetic
- **Decision:** No new component library additions beyond what's needed (dialog for confirm, possibly toast for feedback)

## Constraints
- No server-side PDF generation (keep backend simple)
- Must work with existing grade report component structure
- Maintain current Tailwind v4 + shadcn/ui patterns
