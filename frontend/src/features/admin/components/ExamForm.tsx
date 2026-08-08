import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { examSchema, type ExamFormData } from '../schemas/examSchema'
import { AdminAuthError, updateExam } from '../api/exams'
import { QuestionFields } from './QuestionFields'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface ExamFormProps {
  defaultValues: ExamFormData
  examId: number
  onSaved?: () => void
  /** The password the admin view already validated to load this exam. */
  adminToken: string
  /**
   * The held password has stopped working — the server token changed, or it was
   * revoked. The admin view drops back to its locked state rather than leaving
   * a form on screen that can no longer save.
   */
  onAuthError: (message: string) => void
}

export function ExamForm({ defaultValues, examId, onSaved, adminToken, onAuthError }: ExamFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'questions',
  })

  const onSubmit = async (data: ExamFormData) => {
    try {
      setIsSaving(true)
      setSaveMessage(null)
      await updateExam(examId, data, adminToken)
      setSaveMessage({ type: 'success', text: 'Saved!' })
      onSaved?.()
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      if (error instanceof AdminAuthError) {
        // The API layer has already discarded the rejected password. Hand the
        // reason up: the dashboard locks itself rather than leaving a form
        // on screen that cannot save.
        onAuthError(error.message)
        return
      }
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save exam',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <Label htmlFor="title">Exam Title</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Enter exam title"
            className="mt-1.5"
          />
          {errors.title && (
            <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Questions ({fields.length})</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  text: '',
                  credit: 1,
                  min_words: 0,
                  rubric: [''],
                  reference_answers: [],
                })
              }
            >
              Add Question
            </Button>
          </div>
          {fields.map((field, index) => (
            <QuestionFields
              key={field.id}
              control={control}
              register={register}
              errors={errors}
              questionIndex={index}
              onRemove={fields.length > 1 ? () => remove(index) : undefined}
            />
          ))}
          {errors.questions && typeof errors.questions === 'object' && 'message' in errors.questions && (
            <p className="text-sm text-destructive">{errors.questions.message}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Exam'}
          </Button>
          {saveMessage && (
            <p
              className={`text-sm font-medium transition-opacity ${
                saveMessage.type === 'success' ? 'text-green-600' : 'text-destructive'
              }`}
            >
              {saveMessage.text}
            </p>
          )}
        </div>
      </form>
    </>
  )
}
