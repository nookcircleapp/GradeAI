/**
 * The sponsor credit. Topmost element on every page, above the header.
 *
 * The wording is fixed attribution for the project's funder rather than UI copy,
 * so it is spelled out here exactly as DESIGN.md gives it and takes no props.
 * Hidden when printing: a grading report on paper is not the place for it.
 */
export function SupportBanner() {
  return (
    <div className="bg-blue-900 px-6 py-1.5 text-center text-xs font-normal text-white print:hidden">
      This project is supported by{' '}
      <strong className="font-semibold">MP Council of Science and Technology</strong>
    </div>
  )
}
