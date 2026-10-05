import type { Paper } from '../api'

export const STATUS_STYLE: Record<Paper['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-blue-50 text-blue-800',
}

export const STATUS_LABEL: Record<Paper['status'], string> = { draft: 'Draft', open: 'Live', closed: 'Closed' }
