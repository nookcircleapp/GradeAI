import { useFieldArray } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import type { ExamFormData } from '../schemas/examSchema'
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
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    Remove
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
      </CardContent>
    </Card>
  )
}
