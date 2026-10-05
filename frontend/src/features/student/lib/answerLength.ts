/**
 * The hard gate on grading, deliberately separate from the advisory word count.
 *
 * A blank answer used to come back with marks and an invented justification
 * ("provides a clear definition of AI" against an empty box), so both layers now
 * refuse it: the UI never sends an answer shorter than this, and the backend
 * independently scores anything shorter as 0. The two thresholds must stay
 * equal — 20 characters, measured after trimming, so whitespace cannot pass.
 *
 * This is not the `min_words` on a question. That stays a suggestion the
 * student may ignore; this is the floor below which grading is meaningless.
 */
export const MIN_ANSWER_CHARS = 20

export function answerLength(answer: string): number {
  return answer.trim().length
}

export type AnswerReadiness =
  /** Untouched. Not an error — an unstarted question is not a failing one. */
  | 'empty'
  /** Started but below the floor. The one state that blocks with a reason. */
  | 'too-short'
  /** Long enough to be worth a billed grading call. */
  | 'ready'

export function answerReadiness(answer: string): AnswerReadiness {
  const length = answerLength(answer)
  if (length === 0) return 'empty'
  return length < MIN_ANSWER_CHARS ? 'too-short' : 'ready'
}

export function isGradable(answer: string): boolean {
  return answerReadiness(answer) === 'ready'
}

function indexesWhere(answers: string[], state: AnswerReadiness): number[] {
  return answers.reduce<number[]>((acc, answer, index) => {
    if (answerReadiness(answer) === state) acc.push(index)
    return acc
  }, [])
}

/** Question indexes long enough to grade. */
export function gradableIndexes(answers: string[]): number[] {
  return indexesWhere(answers, 'ready')
}

/** Question indexes the student started but has not taken past the minimum. */
export function tooShortIndexes(answers: string[]): number[] {
  return indexesWhere(answers, 'too-short')
}

/** "Question 2", "Questions 2 and 3", "Questions 1, 2 and 4". */
export function formatQuestionList(indexes: number[]): string {
  const numbers = indexes.map((index) => index + 1)
  const noun = numbers.length === 1 ? 'Question' : 'Questions'
  if (numbers.length <= 1) return `${noun} ${numbers.join('')}`
  return `${noun} ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
}
