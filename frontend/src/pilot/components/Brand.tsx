/** The BlinkScore wordmark, with an optional "Pilot" pill. */
export function Wordmark({ pilot = false, inverted = false }: { pilot?: boolean; inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`text-xl font-extrabold tracking-tight ${inverted ? 'text-white' : 'text-blue-900'}`}>
        Blink<span className="text-amber-500">Score</span>
      </span>
      {pilot && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pilot</span>
      )}
    </span>
  )
}

export function SupportBanner() {
  return (
    <div className="bg-blue-900 px-6 py-1.5 text-center text-xs text-white print:hidden">
      This project is supported by <strong className="font-semibold">MP Council of Science and Technology</strong>
    </div>
  )
}
