import { useFieldArray } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import { EyeOff, X } from 'lucide-react'
import { MAX_REFERENCE_ANSWERS, type ExamFormData } from '../schemas/examSchema'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <h3 className="text-lg font-semibold">Question {questionIndex + 1}</h3>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            Remove Question
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
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
            <p className="text-sm text-destructive mt-1">{questionErrors.text.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              <p className="text-sm text-destructive mt-1">{questionErrors.credit.message}</p>
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
              <p className="text-sm text-destructive mt-1">{questionErrors.min_words.message}</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Rubric Points</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append("")}
            >
              Add Point
            </Button>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  {...register(`questions.${questionIndex}.rubric.${index}` as const)}
                  placeholder={`Rubric point ${index + 1}`}
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
                    className="self-center text-muted-foreground hover:text-destructive"
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {questionErrors?.rubric && (
            <p className="text-sm text-destructive mt-1">
              {typeof questionErrors.rubric === 'object' && 'message' in questionErrors.rubric
                ? questionErrors.rubric.message
                : 'Invalid rubric points'}
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <Label>
              Reference Answers{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={references.fields.length >= MAX_REFERENCE_ANSWERS}
              onClick={() => references.append('')}
            >
              Add Reference Answer
            </Button>
          </div>

          {/* Stated before the fields, not after: a teacher must not paste a
              hint for the class in here on the assumption it will be shown. */}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2.5">
            <EyeOff className="size-3.5 shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold text-foreground">Never shown to students.</span>{' '}
              Examples of an answer that would earn full marks. They are sent to the AI grader only
              — students never see them, on the exam page or anywhere else. Up to{' '}
              {MAX_REFERENCE_ANSWERS} per question.
            </span>
          </p>

          <div className="space-y-2">
            {references.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                None yet. This question is graded from its rubric alone.
              </p>
            )}
            {references.fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Textarea
                  {...register(`questions.${questionIndex}.reference_answers.${index}` as const)}
                  placeholder={`Reference answer ${index + 1} — a response that would score full marks`}
                  rows={4}
                  className="flex-1"
                />
                {/* Top-aligned rather than centred against a four-row
                    textarea, so it reads as belonging to this field. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove reference answer ${index + 1}`}
                  title="Remove reference answer"
                  onClick={() => references.remove(index)}
                  className="self-start text-muted-foreground hover:text-destructive"
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>

          {questionErrors?.reference_answers && (
            <p className="text-sm text-destructive mt-1">
              {typeof questionErrors.reference_answers === 'object' &&
              'message' in questionErrors.reference_answers &&
              questionErrors.reference_answers.message
                ? questionErrors.reference_answers.message
                : 'Reference answers cannot be blank — remove any you do not want.'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
