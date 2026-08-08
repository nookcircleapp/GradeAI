import { AlertCircle, Check, Cpu, KeyRound, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatUsd } from '../lib/comparison'
import type { ModelInfo, ModelTier } from '../api/student'

interface ModelPickerProps {
  models: ModelInfo[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  loading?: boolean
  error?: string | null
  disabled?: boolean
}

const TIER_ORDER: ModelTier[] = ['large', 'small']

const TIER_META: Record<ModelTier, { title: string; blurb: string; Icon: typeof Cpu }> = {
  large: {
    title: 'Large model',
    blurb: 'Frontier scale. Highest price per token.',
    Icon: Cpu,
  },
  small: {
    title: 'Small model',
    blurb: 'Compact. Lower price per token, faster to respond.',
    Icon: Zap,
  },
}

export function ModelPicker({
  models,
  selectedIds,
  onChange,
  loading = false,
  error = null,
  disabled = false,
}: ModelPickerProps) {
  const toggle = (model: ModelInfo) => {
    if (!model.available) return
    if (selectedIds.includes(model.id)) {
      if (selectedIds.length <= 1) {
        toast('Keep at least one model selected.', {
          description: 'Deselect a different model first.',
        })
        return
      }
      onChange(selectedIds.filter((id) => id !== model.id))
      return
    }
    onChange([...selectedIds, model.id])
  }

  if (loading) {
    return (
      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="grid gap-3 px-5 sm:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="gap-0 border-dashed py-4">
        <CardContent className="flex items-start gap-2.5 px-5">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-0.5 text-sm">
            <p className="font-semibold">Model registry unavailable</p>
            <p className="text-muted-foreground">
              {error} Grading will fall back to the server&rsquo;s default model.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (models.length === 0) return null

  const availableCount = models.filter((m) => m.available).length

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="grid-cols-[1fr_auto] items-center gap-3 border-b bg-muted/40 px-5 py-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold tracking-tight">Grading models</h2>
          <p className="text-sm text-muted-foreground">
            Every selected model grades the same answers, independently.
          </p>
        </div>
        <span className="rounded-full border bg-background px-3 py-1 text-xs font-semibold tabular-nums">
          {selectedIds.length} of {availableCount} selected
        </span>
      </CardHeader>

      <CardContent className="grid gap-x-5 gap-y-6 px-5 py-5 sm:grid-cols-2">
        {TIER_ORDER.map((tier) => {
          const tierModels = models.filter((m) => m.tier === tier)
          if (tierModels.length === 0) return null
          const { title, blurb, Icon } = TIER_META[tier]
          return (
            <section key={tier} className="space-y-2.5">
              <div className="flex items-baseline gap-2">
                <Icon className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-[0.14em]">{title}</h3>
              </div>
              <p className="-mt-1.5 pl-[1.375rem] text-xs text-muted-foreground">{blurb}</p>
              <div className="space-y-2">
                {tierModels.map((model) => (
                  <ModelOption
                    key={model.id}
                    model={model}
                    selected={selectedIds.includes(model.id)}
                    disabled={disabled}
                    onToggle={() => toggle(model)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </CardContent>
    </Card>
  )
}

interface ModelOptionProps {
  model: ModelInfo
  selected: boolean
  disabled: boolean
  onToggle: () => void
}

function ModelOption({ model, selected, disabled, onToggle }: ModelOptionProps) {
  const unavailable = !model.available
  const isDisabled = disabled || unavailable

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`${model.label}${unavailable ? ' — unavailable, API key not configured' : ''}`}
      disabled={isDisabled}
      onClick={onToggle}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'border-foreground/35 bg-accent shadow-sm ring-1 ring-foreground/15'
          : 'border-border bg-card hover:border-foreground/20 hover:bg-accent/50',
        unavailable && 'cursor-not-allowed border-dashed bg-muted/30 opacity-70 hover:bg-muted/30',
        disabled && !unavailable && 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
            selected ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground/50',
            unavailable && 'border-muted-foreground/30'
          )}
        >
          {selected && <Check className="size-3 stroke-[3]" />}
        </span>

        <span className="min-w-0 flex-1">
          {/* Model name only. Which company hosts the weights is an
              implementation detail and is deliberately not branded on screen —
              `provider` still arrives from the API, it is just not rendered. */}
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold leading-tight">{model.label}</span>
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
            <span>
              <span className="font-medium text-foreground/70">in</span>{' '}
              {formatUsd(model.price_in_per_mtok)}
            </span>
            <span aria-hidden className="text-muted-foreground/40">
              /
            </span>
            <span>
              <span className="font-medium text-foreground/70">out</span>{' '}
              {formatUsd(model.price_out_per_mtok)}
            </span>
            <span className="text-muted-foreground/70">per 1M tokens</span>
          </span>

          {unavailable && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <KeyRound className="size-2.5" />
              API key not configured
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
