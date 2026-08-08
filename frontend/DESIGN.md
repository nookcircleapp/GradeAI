# BlinkScore — Design System Reference

> React + Tailwind CSS. Read this file before implementing any UI component.
> Supported by MP Council of Science and Technology.

---

## Brand & Colors

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Blue 900 | `#1e3a8a` | `blue-900` | Support banner bg, card gradient start, admin header |
| Blue 800 | `#1e40af` | `blue-800` | Admin header gradient end |
| Blue 700 | `#1d4ed8` | `blue-700` | Primary button, brand text, rubric dots |
| Blue 600 | `#2563eb` | `blue-600` | Selected model border, progress bar |
| Blue 200 | `#bfdbfe` | `blue-200` | Reference answers border, logo placeholder border |
| Blue 100 | `#dbeafe` | `blue-100` | Logo placeholder bg, selected model bg |
| Blue 50  | `#eff6ff` | `blue-50`  | Reference answers section bg, marks chip bg |
| Amber 500 | `#f59e0b` | `amber-500` | Exam marks chip (large), brand accent dot |
| Amber 400 | `#fbbf24` | `amber-400` | Word count progress bar |
| Slate 100 | `#f1f5f9` | `slate-100` | Page background |
| Slate 200 | `#e2e8f0` | `slate-200` | Card borders, dividers |
| Slate 500 | `#64748b` | `slate-500` | Muted / caption text |
| Slate 800 | `#1e293b` | `slate-800` | Body text |

**Font stack:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

---

## Global Layout

### SupportBanner
No props. Always the topmost element on every page.
```jsx
<div className="bg-blue-900 text-white text-center text-xs py-1.5 px-6 font-normal">
  This project is supported by{" "}
  <strong className="font-semibold">MP Council of Science and Technology</strong>
</div>
```

### AppHeader
| Prop | Type | Notes |
|------|------|-------|
| `view` | `'student' \| 'admin'` | Changes tagline text |

```jsx
// Logo slot — replace div with img once asset is ready:
// <img src="/assets/logo.png" alt="Institution logo" className="h-10 w-auto rounded-lg" />
<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-100 to-amber-100 border border-dashed border-blue-200 flex items-center justify-center text-[9px] font-bold text-blue-700 tracking-wide">
  LOGO
</div>

// Brand
<span className="text-xl font-extrabold text-blue-900 tracking-tight">
  Blink<span className="text-amber-500">Score</span>
</span>
```

Full header shell:
```jsx
<header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
  <div className="max-w-5xl mx-auto px-6 h-[62px] flex items-center gap-4">
    {/* logo */}
    {/* brand name + tagline */}
    <div className="flex-1" />
    {/* optional slot for pills/actions */}
  </div>
</header>
```

---

## Student-Facing Components

### ExamCard
| Prop | Type |
|------|------|
| `title` | `string` |
| `meta` | `string` (duration, sections) |
| `totalMarks` | `number` |
| `answeredCount` | `number` |
| `totalCount` | `number` |

```jsx
<div className="bg-white rounded-2xl shadow overflow-hidden">
  {/* Gradient header */}
  <div className="bg-gradient-to-br from-blue-900 via-blue-700 to-blue-600 p-5 flex items-start justify-between gap-4">
    <div>
      <h2 className="text-white text-lg font-bold">{title}</h2>
      <p className="text-white/70 text-sm mt-0.5">{meta}</p>
    </div>
    <span className="bg-amber-500 text-white font-bold rounded-lg px-4 py-1.5 text-sm shadow-md whitespace-nowrap">
      {totalMarks} Marks
    </span>
  </div>
  {/* Progress bar */}
  <div className="px-6 py-4 flex items-center gap-3">
    <span className="text-sm text-slate-500 whitespace-nowrap">Progress</span>
    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
        style={{ width: `${(answeredCount / totalCount) * 100}%` }}
      />
    </div>
    <span className="text-sm font-semibold text-blue-700 whitespace-nowrap">
      {answeredCount} / {totalCount} answered
    </span>
  </div>
</div>
```

### QuestionCard
| Prop | Type |
|------|------|
| `number` | `number` |
| `text` | `string` |
| `marks` | `number` |
| `suggestedWords` | `number` |
| `rubricPoints` | `string[]` |
| `models` | `Model[]` |
| `selectedModelIds` | `string[]` |
| `onToggleModel` | `(id: string) => void` |
| `onSubmit` | `() => void` |

```jsx
<div className="bg-white rounded-xl shadow-sm border border-slate-200">
  {/* Header row */}
  <div className="flex items-start gap-3 p-4 pb-3">
    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-700 to-blue-900 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
      {number}
    </span>
    <p className="flex-1 text-slate-800 text-[15px] leading-relaxed">{text}</p>
    <span className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded px-2.5 py-1 whitespace-nowrap flex-shrink-0">
      {marks} Marks
    </span>
  </div>
  <div className="px-5 pb-4">
    <WordCountBar count={wordCount} suggested={suggestedWords} />
    <MarkingCriteria points={rubricPoints} />
    <GradingModels models={models} selectedIds={selectedModelIds} onToggle={onToggleModel} />
    <ActionBar selectedCount={selectedModelIds.length} onSubmit={onSubmit} />
  </div>
</div>
```

### WordCountBar
| Prop | Type |
|------|------|
| `count` | `number` |
| `suggested` | `number` |

```jsx
<div className="flex items-center gap-2 mb-3">
  <span className="text-[11.5px] text-slate-500">Word count</span>
  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
      style={{ width: `${Math.min((count / suggested) * 100, 100)}%` }}
    />
  </div>
  <span className="text-[11.5px] font-semibold text-amber-600 whitespace-nowrap">
    {count} / {suggested} suggested
  </span>
</div>
```

### MarkingCriteria
| Prop | Type |
|------|------|
| `points` | `string[]` |

```jsx
<details className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden mb-3">
  <summary className="px-4 py-2.5 text-sm font-semibold text-blue-700 cursor-pointer list-none flex items-center gap-2">
    <span className="text-[10px] transition-transform details-arrow">▶</span>
    Marking Criteria
  </summary>
  <div className="px-4 pb-3">
    {points.map((point, i) => (
      <div key={i} className="flex items-start gap-2 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-[7px] flex-shrink-0" />
        <span className="text-[13.5px] text-slate-700">{point}</span>
      </div>
    ))}
  </div>
</details>
```

### GradingModels
| Prop | Type |
|------|------|
| `models` | `{ id: string; name: string }[]` |
| `selectedIds` | `string[]` |
| `onToggle` | `(id: string) => void` |

```jsx
<div className="mb-4">
  <p className="text-sm font-semibold text-slate-700 mb-2">AI Grading Model</p>
  <div className="grid grid-cols-2 gap-2">
    {models.map(m => {
      const selected = selectedIds.includes(m.id)
      return (
        <button
          key={m.id}
          onClick={() => onToggle(m.id)}
          className={`border rounded-lg p-2.5 flex items-center gap-2 text-sm transition-all ${
            selected
              ? 'border-2 border-blue-600 bg-blue-50 text-blue-700 font-semibold'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
          }`}
        >
          <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] flex-shrink-0 border-2 ${
            selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
          }`}>
            {selected && '✓'}
          </span>
          {m.name}
        </button>
      )
    })}
  </div>
</div>
```

### ActionBar
| Prop | Type |
|------|------|
| `selectedCount` | `number` |
| `onTry` | `() => void` |
| `onSubmit` | `() => void` |

```jsx
<div className="flex items-center gap-3 pt-4 border-t border-slate-100 bg-slate-50 -mx-5 px-5 -mb-4 rounded-b-xl">
  <span className="flex-1 text-xs text-slate-500">
    {selectedCount} model{selectedCount !== 1 ? 's' : ''} selected
  </span>
  <button onClick={onTry} className="border border-slate-300 text-slate-700 bg-white rounded-lg px-4 py-2 text-[13.5px] font-semibold hover:bg-slate-50">
    Try with sample
  </button>
  <button
    onClick={onSubmit}
    disabled={selectedCount === 0}
    className="bg-gradient-to-br from-blue-700 to-blue-900 text-white font-semibold rounded-lg px-5 py-2 text-[13.5px] shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Submit Answer
  </button>
</div>
```

---

## Admin Components

### AdminQuestionCard
Shell wrapper for the question editor. Contains `ReferenceAnswers` (above) then `RubricEditor` (below).

```jsx
<div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden mb-5">
  {/* Dark gradient header strip */}
  <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-5 py-3 flex items-center gap-3">
    <span className="bg-white/15 text-white text-xs font-bold rounded px-2.5 py-1">
      Question {number}
    </span>
    <span className="flex-1" />
    <span className="bg-amber-500 text-white text-xs font-bold rounded px-2.5 py-1">
      {marks} Marks
    </span>
  </div>
  <div className="p-5">
    {/* Question text textarea */}
    {/* Marks + suggested word count inputs in a flex row */}
    <hr className="border-slate-200 my-4" />
    <ReferenceAnswers ... />
    <RubricEditor ... />
  </div>
</div>
```

### ReferenceAnswers ★ NEW FEATURE
> Placed **above** RubricEditor. Not shown to students — used only for AI grading.

| Prop | Type |
|------|------|
| `answers` | `string[]` |
| `onAdd` | `() => void` |
| `onRemove` | `(index: number) => void` |
| `onChange` | `(index: number, value: string) => void` |

```jsx
<div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden mb-4">
  {/* Header */}
  <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-b border-blue-200 bg-blue-100/35">
    <span className="text-[13.5px] font-bold text-blue-800">📝 Reference Answers</span>
    <span className="text-[11px] bg-blue-100 border border-blue-200 text-blue-700 rounded-full px-2.5 py-0.5 font-medium">
      Used for AI grading · not shown to students
    </span>
    <button
      onClick={onAdd}
      className="ml-auto bg-gradient-to-br from-blue-700 to-blue-900 text-white text-[12.5px] font-semibold rounded-lg px-3.5 py-1.5 shadow hover:brightness-110"
    >
      + Add Reference Answer
    </button>
  </div>

  <div className="p-4">
    {answers.length === 0 ? (
      /* Empty state */
      <div className="text-center py-6 text-blue-600">
        <div className="text-3xl mb-2">💡</div>
        <p className="text-[13.5px] font-semibold mb-1">No reference answers yet</p>
        <p className="text-xs text-blue-400">Add one or more model answers to improve AI grading accuracy</p>
      </div>
    ) : (
      answers.map((answer, i) => (
        <ReferenceAnswerRow
          key={i}
          index={i}
          value={answer}
          onChange={(val) => onChange(i, val)}
          onRemove={() => onRemove(i)}
        />
      ))
    )}
  </div>
</div>
```

### ReferenceAnswerRow
| Prop | Type |
|------|------|
| `index` | `number` |
| `value` | `string` |
| `onChange` | `(value: string) => void` |
| `onRemove` | `() => void` |

```jsx
<div className="mb-3">
  <div className="flex items-center justify-between mb-1">
    <span className="text-[11.5px] font-semibold text-blue-700">Answer {index + 1}</span>
    <button
      onClick={onRemove}
      className="text-xs border border-red-200 text-red-500 rounded px-2.5 py-1 hover:bg-red-50"
    >
      Remove
    </button>
  </div>
  <textarea
    rows={4}
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full border border-blue-200 rounded-lg p-3 text-[13.5px] bg-white text-slate-800 resize-y focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
  />
</div>
```

### RubricEditor
| Prop | Type |
|------|------|
| `points` | `string[]` |
| `onAdd` | `() => void` |
| `onRemove` | `(index: number) => void` |
| `onChange` | `(index: number, value: string) => void` |

```jsx
<div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
    <span className="text-[13.5px] font-bold text-slate-700">Rubric Points</span>
    <button onClick={onAdd} className="text-[12.5px] font-semibold border border-slate-300 bg-white text-slate-700 rounded-lg px-3.5 py-1.5 hover:bg-slate-50">
      + Add Point
    </button>
  </div>
  <div className="p-4">
    {points.map((point, i) => (
      <div key={i} className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
        <input
          value={point}
          onChange={e => onChange(i, e.target.value)}
          className="flex-1 border border-slate-200 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100/50"
        />
        <button onClick={() => onRemove(i)} className="text-slate-400 hover:text-slate-700 px-1 text-base leading-none">
          ✕
        </button>
      </div>
    ))}
  </div>
</div>
```

---

## Shared Field Components (Admin forms)

```jsx
// Label
<label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
  {label}
</label>

// Text input / textarea
<input
  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-slate-50 text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white"
/>

// Two-column field row
<div className="flex gap-3">
  <div className="flex-1">{/* Marks field */}</div>
  <div className="flex-1">{/* Suggested word count field */}</div>
</div>
```

---

## Button Reference

| Variant | Tailwind Classes |
|---------|-----------------|
| Primary | `bg-gradient-to-br from-blue-700 to-blue-900 text-white font-semibold rounded-lg px-5 py-2 shadow-md hover:brightness-110` |
| Primary sm | same + `px-3.5 py-1.5 text-[12.5px]` |
| Ghost | `bg-white border border-slate-300 text-slate-700 rounded-lg px-5 py-2 font-semibold hover:bg-slate-50` |
| Ghost sm | same + `px-3.5 py-1.5 text-[12.5px]` |
| Danger ghost | `border border-red-200 text-red-500 rounded px-2.5 py-1 text-xs hover:bg-red-50` |

---

## Component Tree

```
App
├── SupportBanner
├── AppHeader (view)
└── Page
    ├── [Student view]
    │   ├── ExamCard (exam, answeredCount, totalCount)
    │   └── QuestionCard[] (number, text, marks, suggestedWords, rubricPoints, models, selectedModelIds, onToggleModel, onSubmit)
    │       ├── WordCountBar (count, suggested)
    │       ├── MarkingCriteria (points)
    │       ├── GradingModels (models, selectedIds, onToggle)
    │       └── ActionBar (selectedCount, onTry, onSubmit)
    └── [Admin view]
        └── AdminQuestionCard[] (number, marks)
            ├── ReferenceAnswers (answers, onAdd, onRemove, onChange)  ← NEW, above rubric
            │   └── ReferenceAnswerRow[] (index, value, onChange, onRemove)
            └── RubricEditor (points, onAdd, onRemove, onChange)
```
