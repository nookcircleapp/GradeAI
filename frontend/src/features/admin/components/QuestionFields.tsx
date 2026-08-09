import { useFieldArray, useWatch } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import { EyeOff, FileText, Info, X } from 'lucide-react'
import { MAX_REFERENCE_ANSWERS, type ExamFormData } from '../schemas/examSchema'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface QuestionFieldsProps {
  control: Control<ExamFormData>
  register: UseFormRegister<ExamFormData>
  errors: FieldErrors<ExamFormData>
  questionIndex: number
  onRemove?: () => void
}

export function QuestionFields({ control, register, errors, questionIndex, onRemove }: QuestionFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: control as Control<any>,
    name: `questions.${questionIndex}.rubric`,
  })

  const references = useFieldArray({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: control as Control<any>,
    name: `questions.${questionIndex}.reference_answers`,
  })

  const questionErrors = errors.questions?.[questionIndex]

  // Display only, so the header chip tracks the marks field as it is edited.
  // Cleared number inputs arrive as NaN, in which case there is nothing
  // meaningful to show and the chip simply stands down.
  const credit = useWatch({ control, name: `questions.${questionIndex}.credit` })
  const marksLabel =
    typeof credit === 'number' && Number.isFinite(credit)
      ? `${credit} ${credit === 1 ? 'Mark' : 'Marks'}`
      : null

  const referenceCount = references.fields.length
  const atCapacity = referenceCount >= MAX_REFERENCE_ANSWERS

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {/* Dark strip: the question number and its marks stay readable while
          scrolling a long exam, and they separate one editor from the next. */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-blue-900 to-blue-800 px-4 py-3 sm:px-5">
        <Badge className="rounded-md border-transparent bg-white/15 px-2.5 py-1 font-bold text-white">
          Question {questionIndex + 1}
        </Badge>
        <span className="flex-1" />
        {marksLabel && <Badge variant="accent">{marksLabel}</Badge>}
        {onRemove && (
          /* Quiet on purpose — removing a question is destructive, but it is
             not the point of the card. The label carries the meaning. */
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove question ${questionIndex + 1}`}
            title="Remove question"
            onClick={onRemove}
            className="-mr-1.5 text-white/70 hover:bg-white/15 hover:text-white"
          >
            <X />
          </Button>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <Label htmlFor={`questions.${questionIndex}.text`}>Question Text</Label>
          <Textarea
            id={`questions.${questionIndex}.text`}
            {...register(`questions.${questionIndex}.text` as const)}
            placeholder="Enter question text"
            className="mt-1.5"
            rows={3}
          />
          {questionErrors?.text && (
            <p className="mt-1.5 text-sm text-destructive">{questionErrors.text.message}</p>
          )}
        </div>

        {/* Two-column field row; stacks on a phone rather than squeezing two
            number inputs into half a narrow screen each. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`questions.${questionIndex}.credit`}>Credits (marks)</Label>
            <Input
              id={`questions.${questionIndex}.credit`}
              type="number"
              min={0}
              step={1}
              {...register(`questions.${questionIndex}.credit` as const, { valueAsNumber: true })}
              className="mt-1.5"
            />
            {questionErrors?.credit && (
              <p className="mt-1.5 text-sm text-destructive">{questionErrors.credit.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor={`questions.${questionIndex}.min_words`}>Minimum words</Label>
            <Input
              id={`questions.${questionIndex}.min_words`}
              type="number"
              min={0}
              step={1}
              {...register(`questions.${questionIndex}.min_words` as const, { valueAsNumber: true })}
              className="mt-1.5"
            />
            {questionErrors?.min_words && (
              <p className="mt-1.5 text-sm text-destructive">{questionErrors.min_words.message}</p>
            )}
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* Reference answers sit above the rubric and in their own blue panel:
            they are the one thing on this card that a student must never see,
            so they do not look like just another field. */}
        <div>
          <section className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-blue-200 bg-blue-100/40 px-4 py-3">
              <Label className="text-blue-800">
                <FileText className="size-3.5" />
                Reference Answers{' '}
                <span className="font-medium normal-case tracking-normal text-blue-700/70">
                  (optional)
                </span>
              </Label>
              {/* Always visible, so the cap is a known limit rather than a
                  surprise the moment the Add button greys out. */}
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                  atCapacity
                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                    : 'border-blue-200 bg-blue-100 text-blue-700'
                )}
              >
                {referenceCount} of {MAX_REFERENCE_ANSWERS}
              </span>
              <Button
                type="button"
                size="sm"
                className="ml-auto"
                disabled={atCapacity}
                title={
                  atCapacity
                    ? `Maximum of ${MAX_REFERENCE_ANSWERS} reference answers reached`
                    : undefined
                }
                onClick={() => references.append('')}
              >
                Add Reference Answer
              </Button>
            </div>

            <div className="p-4">
              {/* Stated before the fields, not after: a teacher must not paste a
                  hint for the class in here on the assumption it will be shown. */}
              <p className="mb-3 flex items-start gap-1.5 text-xs leading-relaxed text-blue-900/70">
                <EyeOff className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <span className="font-bold text-blue-900">Never shown to students.</span>{' '}
                  Examples of an answer that would earn full marks. They are sent to the AI grader
                  only — students never see them, on the exam page or anywhere else. Up to{' '}
                  {MAX_REFERENCE_ANSWERS} per question.
                </span>
              </p>

              {referenceCount === 0 ? (
                <div className="rounded-lg border border-dashed border-blue-200 bg-white/60 px-4 py-6 text-center">
                  <p className="text-[13.5px] font-semibold text-blue-800">None yet.</p>
                  <p className="mt-0.5 text-xs text-blue-600">
                    This question is graded from its rubric alone.
                  </p>
                </div>
              ) : (
                references.fields.map((field, index) => (
                  <div key={field.id} className="mb-3 last:mb-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-blue-700">
                        Answer {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove reference answer ${index + 1}`}
                        title="Remove reference answer"
                        onClick={() => references.remove(index)}
                        className="text-blue-400 hover:bg-blue-100 hover:text-destructive"
                      >
                        <X />
                      </Button>
                    </div>
                    <Textarea
                      {...register(`questions.${questionIndex}.reference_answers.${index}` as const)}
                      placeholder={`Reference answer ${index + 1} — a response that would score full marks`}
                      rows={4}
                      className="border-blue-200 bg-white text-[13.5px] md:text-[13.5px]"
                    />
                  </div>
                ))
              )}

              {atCapacity && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                  <Info className="mt-px size-3.5 shrink-0" />
                  <span>
                    Limit reached. Remove one to add another — {MAX_REFERENCE_ANSWERS} is the most
                    a question can carry.
                  </span>
                </p>
              )}
            </div>
          </section>

          {questionErrors?.reference_answers && (
            <p className="mt-1.5 text-sm text-destructive">
              {typeof questionErrors.reference_answers === 'object' &&
              'message' in questionErrors.reference_answers &&
              questionErrors.reference_answers.message
                ? questionErrors.reference_answers.message
                : 'Reference answers cannot be blank — remove any you do not want.'}
            </p>
          )}
        </div>

        <div>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 px-4 py-3">
              <Label className="text-slate-700">Rubric Points</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append('')}>
                Add Point
              </Button>
            </div>
            <div className="space-y-2 p-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-blue-600" />
                  <Input
                    {...register(`questions.${questionIndex}.rubric.${index}` as const)}
                    placeholder={`Rubric point ${index + 1}`}
                    className="h-9 bg-white"
                  />
                  {/* Deleting one line of a rubric is an ordinary edit, so it
                      gets an ordinary control: the emphasis belongs on the field,
                      not on the button beside it. Red arrives on hover only. */}
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove rubric point ${index + 1}`}
                      title="Remove rubric point"
                      onClick={() => remove(index)}
                      className="shrink-0 text-slate-400 hover:bg-slate-200/60 hover:text-destructive"
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {questionErrors?.rubric && (
            <p className="mt-1.5 text-sm text-destructive">
              {typeof questionErrors.rubric === 'object' && 'message' in questionErrors.rubric
                ? questionErrors.rubric.message
                : 'Invalid rubric points'}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
