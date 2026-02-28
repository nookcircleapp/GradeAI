# Phase 4: Polish & PDF Export - Research

**Researched:** 2026-02-28
**Domain:** Browser print API, shadcn/ui dialog & sonner, React Error Boundary, UI polish
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PDF Generation Approach**
- Client-side PDF via browser print/CSS `@media print`
- Use `window.print()` with a print-optimized stylesheet that isolates the grade report
- Fallback (if quality insufficient): `html2canvas` + `jspdf` — but start with CSS print

**Download UX**
- "Download PDF" button appears on grade report after grading completes (both Try preview and Submit final)
- Placement: top-right of grade report header card, next to the Final/Preview badge
- Icon: Download icon from lucide-react (already installed)

**UI Polish Scope**
- Admin view error handling: upgrade from plain text `<p className="text-destructive">` to styled error cards matching student view pattern
- Replace `window.confirm()` on submit with a proper shadcn dialog component
- Clean up dead CSS files (`App.css`, `index.css`) — not imported by main.tsx, can be deleted safely
- Consistent spacing audit across admin and student views
- Out of scope: dark mode toggle, animations overhaul, new color themes

**Error Handling Improvements**
- Add React Error Boundary at app level for uncaught errors
- Standardize API error display — both admin and student views use same styled error card pattern
- Add network timeout handling with user-friendly messages

**Frontend Design Quality**
- Use frontend-design skill for any new UI components (dialog, PDF button styling)
- Maintain existing New York style, neutral colors, shadcn/ui aesthetic
- No new component library additions beyond what's needed (dialog for confirm, possibly sonner toast for feedback)

### Claude's Discretion

- Whether to add sonner toast or not (if toast is added for PDF download feedback)
- Exact spacing values in spacing audit
- Error Boundary fallback UI design
- Network timeout duration

### Deferred Ideas (OUT OF SCOPE)

- Dark mode toggle
- Animations overhaul
- New color themes
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPT-01 | Report downloadable as PDF | CSS @media print + window.print() approach verified; shadcn Dialog for confirm; Download button pattern documented |
</phase_requirements>

---

## Summary

Phase 4 is a focused polish-and-export phase, not a redesign. The three technical pillars are: (1) PDF download via browser print API, (2) replacing `window.confirm()` with a shadcn Dialog, and (3) standardizing error handling across admin and student views with an app-level Error Boundary.

The PDF approach chosen — `window.print()` with CSS `@media print` isolation — requires no new npm packages. The technique involves adding utility CSS classes (`print:hidden` for things to hide, `print:block` for the report) to the globals.css and calling `window.print()` from a button click. Tailwind v4 supports `print:` variant natively. The grade report component needs a wrapping `data-print-target` element; the nav header and exam sheet are hidden with `print:hidden`. Browser PDF quality is acceptable for a demo app.

Two shadcn components must be added: `dialog` (for submit confirm replacing `window.confirm()`) and optionally `sonner` (toast notification for PDF download feedback). The Dialog is straightforward — controlled with `open`/`onOpenChange` state. Sonner requires adding `<Toaster />` to App.tsx and calling `toast()` from anywhere. React Error Boundary still requires a class component or the `react-error-boundary` library; a minimal class-based ErrorBoundary wrapping `<App />` in main.tsx is the standard pattern.

**Primary recommendation:** Use Tailwind `print:` utilities + `window.print()` for PDF; install `dialog` + `sonner` via shadcn CLI; write a class-based `ErrorBoundary` component; upgrade Admin error display to match Student's styled Card pattern.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS v4 | ^4.1.18 (installed) | `print:hidden` / `print:block` utilities | Already installed; `print:` variant built-in |
| lucide-react | ^0.563.0 (installed) | `Download` icon for PDF button | Already installed |
| @radix-ui/react-dialog | via shadcn | Submit confirmation modal | shadcn `dialog` wraps this |
| sonner | via shadcn `sonner` component | Toast feedback for PDF action | shadcn's recommended toast library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-error-boundary | npm package | App-level error boundary with functional API | If class component is undesirable; adds one dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `@media print` | `html2canvas` + `jspdf` | jspdf gives pixel-perfect capture but adds ~2MB bundle, requires async work; CSS print is zero-cost and sufficient for demo |
| class-based ErrorBoundary | `react-error-boundary` npm package | Package is cleaner API but adds a dependency; a small class component is zero-dependency |
| shadcn `sonner` | shadcn `toast` (deprecated) | The original `toast` component is deprecated in shadcn (issue #7120); `sonner` is the current standard |

**Installation:**
```bash
# From frontend/ directory
npx shadcn@latest add dialog
npx shadcn@latest add sonner
```

No other npm packages needed for this phase.

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. Changes are contained to existing files + new UI components:

```
frontend/src/
├── components/ui/
│   ├── dialog.tsx        # NEW — add via shadcn CLI
│   └── sonner.tsx        # NEW — add via shadcn CLI (optional)
├── features/
│   ├── admin/
│   │   └── AdminView.tsx # MODIFY — styled error card, use Dialog for confirm (admin has no submit confirm; but standardize error pattern)
│   └── student/
│       ├── StudentView.tsx   # MODIFY — replace window.confirm with Dialog, add PDF button integration
│       └── components/
│           └── GradeReport.tsx # MODIFY — add Download PDF button top-right of header card
├── components/
│   └── ErrorBoundary.tsx  # NEW — class-based error boundary
├── styles/
│   └── globals.css        # MODIFY — add @media print rules
├── App.tsx                # MODIFY — wrap with ErrorBoundary, add <Toaster /> if using sonner
├── App.css                # DELETE — not imported, dead file (Vite default)
└── index.css              # DELETE — not imported, dead file (Vite default)
```

### Pattern 1: CSS Print Isolation (Blacklist approach)

**What:** Add `print:hidden` Tailwind class to all non-report elements; the grade report container has no print modifier (visible by default). Call `window.print()` on button click.

**When to use:** Single printable region per page; works for GradeReport since the entire rest of the page (header nav, exam sheet, action bar) should be hidden.

**Example:**
```typescript
// In globals.css — override Tailwind print: base
@media print {
  @page {
    margin: 1cm;
    size: A4 portrait;
  }
  /* Tailwind's print: variant handles element visibility */
}

// In App.tsx header
<header className="border-b print:hidden">
  ...
</header>

// In StudentView.tsx — exam sheet area
<ExamSheet className="print:hidden" ... />
<div className="mt-8 ... print:hidden">  {/* action bar */}

// GradeReport wrapper — no print:hidden needed (visible by default)
<div className="mt-6" id="grade-report-print-target">
  <GradeReport ... />
</div>

// PDF button handler
function handleDownloadPDF() {
  window.print()
}
```

**Key insight:** Tailwind v4 has `print:` variant built-in. No `@media print` rules needed in globals.css for element visibility — just add `print:hidden` to all non-report elements. The `@page` rule still needs globals.css since Tailwind utilities cannot set page margins.

### Pattern 2: shadcn Dialog for Submit Confirmation

**What:** Replace `window.confirm()` in `StudentView.handleSubmit` with a controlled Dialog. Dialog state is managed with `useState<boolean>`.

**When to use:** Any destructive or irreversible action that currently uses `window.confirm()`.

**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/radix/dialog
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// In component state
const [showSubmitDialog, setShowSubmitDialog] = useState(false)

// Replace window.confirm block:
const handleSubmit = useCallback(async () => {
  if (!exam) return
  setShowSubmitDialog(true)  // open dialog instead
}, [exam])

const handleConfirmSubmit = useCallback(async () => {
  setShowSubmitDialog(false)
  // ... existing submit logic
}, [exam, answers])

// In JSX:
<Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Submit exam?</DialogTitle>
      <DialogDescription>
        This will finalize your exam. You cannot change your answers after submission.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
        Cancel
      </Button>
      <Button variant="default" onClick={handleConfirmSubmit}>
        Submit
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Pattern 3: Admin Error Card (matching Student pattern)

**What:** Replace `{error && <p className="text-destructive">{error}</p>}` in AdminView with a styled Card matching the StudentView error pattern.

**Student pattern (reference, already in StudentView.tsx):**
```typescript
<Card className="border-destructive/50">
  <CardHeader>
    <div className="flex items-center gap-2">
      <AlertCircle className="size-5 text-destructive" />
      <CardTitle className="text-destructive">Failed to Load Exam</CardTitle>
    </div>
    <CardDescription>{error}</CardDescription>
  </CardHeader>
  <CardContent>
    <Button variant="outline" onClick={loadExam} className="gap-2">
      <RefreshCw className="size-4" />
      Try Again
    </Button>
  </CardContent>
</Card>
```

AdminView currently uses this pattern instead:
```typescript
{error && (
  <p className="text-destructive">{error}</p>   // plain text — upgrade to Card
)}
```

AdminView needs a retry function analogous to `loadExam` in StudentView. Currently `loadExam` is defined inside `useEffect` with no separate reference.

### Pattern 4: App-Level Error Boundary

**What:** Class component wrapping `<App />` in main.tsx that catches uncaught render errors and shows a fallback UI.

**When to use:** Wrap the entire app root; catches errors in any descendant component tree.

**Example:**
```typescript
// src/components/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}>
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// In main.tsx:
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
```

### Pattern 5: Sonner Toast for PDF Feedback

**What:** Show a brief toast after `window.print()` is called to confirm the action.

**Setup:** Add `<Toaster />` to App.tsx. Call `toast()` in the download handler.

```typescript
// App.tsx
import { Toaster } from '@/components/ui/sonner'

// Add inside return:
<Toaster />

// In GradeReport or StudentView PDF handler:
import { toast } from 'sonner'

function handleDownloadPDF() {
  window.print()
  toast('Print dialog opened. Choose "Save as PDF" to download.')
}
```

### Anti-Patterns to Avoid

- **Whitelist print approach (hiding everything, showing only target):** CSS `display: none` does not inherit; children remain hidden. Use blacklist instead — hide nav/exam/action-bar with `print:hidden`, leave report visible by default.
- **Modifying `@page` in Tailwind utilities:** `@page` cannot be expressed as a Tailwind utility class. Must go in globals.css directly.
- **Using the old shadcn `toast` component:** Deprecated in favor of `sonner` (shadcn issue #7120). Use `npx shadcn@latest add sonner` not `toast`.
- **Deleting globals.css:** App.css and index.css are the dead files. `globals.css` is actively imported in `main.tsx` and must not be deleted.
- **Functional component Error Boundary:** React 19 still requires class components for `getDerivedStateFromError`. There is no functional component equivalent yet. Either use a class component or install `react-error-boundary`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom canvas/pixel capture logic | CSS `@media print` + `window.print()` | Native browser feature; zero bundle cost; browsers handle pagination |
| Modal/dialog | Custom overlay with z-index management | `shadcn dialog` (Radix primitive) | Focus trapping, keyboard dismiss, aria attributes already handled |
| Toast notifications | Custom positioned div with timers | `shadcn sonner` | Animation, stacking, dismiss, accessibility built-in |
| Error boundary logic | Try/catch in render | Class component `getDerivedStateFromError` or `react-error-boundary` | React lifecycle hooks for render-time errors; try/catch doesn't catch render errors |

**Key insight:** All PDF, dialog, and toast problems are fully solved by existing primitives in the current stack. Zero new npm packages needed for core features (dialog and sonner are added via shadcn CLI — they copy source files, not runtime dependencies beyond their Radix peers).

---

## Common Pitfalls

### Pitfall 1: CSS Variables Not Rendering in Print

**What goes wrong:** Tailwind CSS v4 uses `oklch()` color values from CSS custom properties. Some older PDF renderers (edge case) may not resolve oklch colors. Chrome and Firefox print-to-PDF handle oklch fine as of 2025.

**Why it happens:** CSS color spaces beyond sRGB have varied print support.

**How to avoid:** Test the print preview in Chrome. For this demo app, oklch support in Chrome is confirmed; acceptable risk.

**Warning signs:** Colors appear as black/white in print preview.

### Pitfall 2: `print:hidden` on Parent Hides Children Needed for Print

**What goes wrong:** If a container that wraps both the grade report and other content is marked `print:hidden`, the grade report disappears too.

**Why it happens:** CSS `display: none` is inherited by all descendants.

**How to avoid:** Only mark leaf-level containers with `print:hidden`. The grade report must be in a sibling container, not a child of a `print:hidden` ancestor. In StudentView, the exam sheet, action bar, and grading error card are siblings of the grade report `<div>` — each needs its own `print:hidden`.

**Warning signs:** Print preview shows blank page.

### Pitfall 3: Dialog Stays Open After Submission Starts

**What goes wrong:** If `handleConfirmSubmit` closes the dialog then sets `isGrading` state, a brief re-render may show the exam form enabled while the dialog closes.

**Why it happens:** React batches state updates but dialog close animation overlaps with state changes.

**How to avoid:** Close dialog (`setShowSubmitDialog(false)`) synchronously before starting the async flow. This is the natural order in the pattern above.

### Pitfall 4: AdminView Has No Retry Function Reference

**What goes wrong:** In AdminView, `loadExam` is defined inside the `useEffect` callback and not accessible outside it. The upgraded error card needs a "Try Again" button.

**Why it happens:** Current implementation defines load logic inline in `useEffect`.

**How to avoid:** Refactor AdminView to extract `loadExam` as a `useCallback` (same pattern as StudentView). Then pass `loadExam` to the error card's retry button.

### Pitfall 5: Sonner Toast Fires Before Browser Print Dialog Closes

**What goes wrong:** `window.print()` is synchronous but the print dialog itself is async (user may cancel). Showing "PDF saved!" would be misleading.

**Why it happens:** The browser print dialog return does not signal whether the user clicked "Print" or "Cancel".

**How to avoid:** Use neutral messaging: `toast('Print dialog opened — choose "Save as PDF" in your browser.')` — not "Downloaded successfully". This is accurate regardless of user action.

---

## Code Examples

Verified patterns from official sources:

### Delete Dead CSS Files
```bash
# From frontend/src/ directory
rm App.css index.css
```
Confirmed dead: `main.tsx` imports only `./styles/globals.css`. `App.css` and `index.css` contain only Vite default boilerplate (logo spin animation, dark mode button styles).

### Add shadcn Components
```bash
# From frontend/ directory
npx shadcn@latest add dialog
npx shadcn@latest add sonner
```
Source: https://ui.shadcn.com/docs/cli — current CLI is `shadcn@latest` not `shadcn-ui@latest`

### globals.css Print Rules Addition
```css
/* Add to end of globals.css */
@media print {
  @page {
    margin: 1.5cm;
    size: A4 portrait;
  }
}
```
The `print:hidden` utility classes on elements handle element hiding. The `@page` rule sets page dimensions and must live in globals.css since it cannot be a Tailwind utility.

### Download PDF Button in GradeReport Header
```typescript
// In GradeReport.tsx — import addition
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

// In header card, alongside the existing badge row (right side)
<div className="flex items-start justify-between gap-4">
  {/* existing: Title + badge on left */}
  <div className="space-y-1">...</div>

  {/* right side: performance badge + download button */}
  <div className="flex items-center gap-2">
    <Badge ...>{styles.label}</Badge>
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 print:hidden"
      onClick={() => window.print()}
    >
      <Download className="size-3.5" />
      Download PDF
    </Button>
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `shadcn-ui@latest` CLI | `shadcn@latest` CLI | 2024 (package rename) | Use `npx shadcn@latest add dialog` not `npx shadcn-ui@latest add dialog` |
| shadcn `toast` component | shadcn `sonner` component | 2024 (deprecated) | `toast` is deprecated; always use `sonner` for new projects |
| Class-based Error Boundary only | React 19 adds `onUncaughtError` hook at root | React 19 (2024) | `createRoot` accepts error hooks, but component-level still needs class or library |

**Deprecated/outdated:**
- `shadcn/ui toast` component: Deprecated in favor of `sonner`. Do not use `npx shadcn@latest add toast`.
- `npx shadcn-ui@latest`: Old package name. Current is `npx shadcn@latest`.

---

## Open Questions

1. **Sonner: required or optional?**
   - What we know: The decision says "possibly toast for feedback" — discretionary
   - What's unclear: Whether the PDF button needs feedback at all (print dialog itself is visible)
   - Recommendation: Include sonner for professional feel; the neutral "print dialog opened" message adds clarity without misleading

2. **Network timeout: specific duration?**
   - What we know: Decision says "add network timeout handling with user-friendly messages"
   - What's unclear: What timeout value to use; whether this applies to fetch API calls globally or per-call
   - Recommendation: Add `AbortController` with 30-second timeout to the fetch calls in `student.ts` and `exams.ts`; display existing styled error card on timeout

3. **ExamForm save feedback**
   - What we know: ExamForm currently uses `saveMessage` local state for success/error text
   - What's unclear: Whether to upgrade ExamForm save feedback to use sonner toast as part of polish scope
   - Recommendation: Yes — if sonner is installed, replace ExamForm's inline `saveMessage` state with `toast()` calls for consistency

---

## Sources

### Primary (HIGH confidence)
- https://ui.shadcn.com/docs/cli — CLI commands for `shadcn@latest add`
- https://ui.shadcn.com/docs/components/radix/dialog — Dialog component API, sub-components, usage example
- https://ui.shadcn.com/docs/components/radix/sonner — Sonner installation and Toaster setup
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing — `@media print`, `@page` rule, `beforeprint`/`afterprint` events
- Codebase direct read: `GradeReport.tsx`, `StudentView.tsx`, `AdminView.tsx`, `main.tsx`, `globals.css`, `package.json`

### Secondary (MEDIUM confidence)
- https://github.com/shadcn-ui/ui/issues/7120 — confirms shadcn `toast` deprecated in favor of `sonner`
- https://react.dev/reference/react/Component — confirms class component required for `getDerivedStateFromError`

### Tertiary (LOW confidence)
- WebSearch result: Tailwind `print:` variant works in v4 — not explicitly verified via official Tailwind v4 docs but consistent with v3 behavior and v4 maintaining utility parity

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via official shadcn docs and package.json inspection
- Architecture: HIGH — based on direct codebase read; patterns match existing code style
- Pitfalls: MEDIUM — verified admin/student structural differences from code; CSS print pitfalls from MDN + CSS-Tricks
- Print isolation: MEDIUM — Tailwind `print:` variant assumed working in v4 (not explicitly tested)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (shadcn API stable; browser print API stable)
