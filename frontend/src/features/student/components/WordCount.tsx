interface WordCountProps {
  current: number
  minimum: number
}

export function WordCount({ current, minimum }: WordCountProps) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span>
        {current} word{current === 1 ? '' : 's'}
        {minimum > 0 && (
          <span className="ml-1 opacity-70">(suggested: {minimum}+)</span>
        )}
      </span>
    </div>
  )
}
