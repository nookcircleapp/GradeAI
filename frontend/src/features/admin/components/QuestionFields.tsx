import { useFieldArray } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import type { ExamFormData } from '../schemas/examSchema'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

interface QuestionFieldsProps {
  control: Control<ExamFormData>
  register: UseFormRegister<ExamFormData>
  errors: FieldErrors<ExamFormData>
  questionIndex: number
}

export function QuestionFields({ control, register, errors, questionIndex }: QuestionFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `questions.${questionIndex}.rubric` as const,
  })

  const question = control._formValues.questions?.[questionIndex]
  const questionErrors = errors.questions?.[questionIndex]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Question {questionIndex + 1}</h3>
          <Badge variant="secondary">
            {question?.credit || 0} credits
          </Badge>
          <span className="text-sm text-muted-foreground">
            Min. {question?.min_words || 0} words
          </span>
        </div>
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
