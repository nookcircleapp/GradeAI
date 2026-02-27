from __future__ import annotations

import asyncio
import json

from openai import AsyncOpenAI

from app.schemas.submission import AnswerInput, GradeResult


async def grade_answer(
    question_text: str,
    rubric: list[str],
    max_score: int,
    answer: str,
    question_index: int,
    api_key: str,
    model: str,
) -> GradeResult:
    """Grade a single answer against a rubric using OpenAI.

    Returns a GradeResult with score (0 to max_score) and explanation.
    """
    client = AsyncOpenAI(api_key=api_key)

    rubric_text = "\n".join(f"- {point}" for point in rubric)

    system_prompt = (
        "You are an exam grader. Grade the student's answer against the rubric points. "
        "Be fair but rigorous, awarding partial credit where appropriate. "
        "Return a JSON object with exactly two fields: "
        '"score" (an integer from 0 to the max_score) and '
        '"explanation" (2-3 sentences explaining the score).'
    )

    user_prompt = (
        f"Question: {question_text}\n\n"
        f"Rubric (maximum score: {max_score} points):\n{rubric_text}\n\n"
        f"Student's answer: {answer}\n\n"
        f"Grade this answer out of {max_score} points."
    )

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)
    score = max(0, min(int(result["score"]), max_score))

    return GradeResult(
        question_index=question_index,
        score=score,
        max_score=max_score,
        explanation=result["explanation"],
    )


async def grade_submission(
    exam_questions: list,
    answers: list[AnswerInput],
    api_key: str,
    model: str,
) -> tuple[list[GradeResult], int]:
    """Grade all answers in a submission concurrently.

    Returns a list of GradeResults and the total score.
    """
    tasks = []
    for answer_input in answers:
        idx = answer_input.question_index
        if idx >= len(exam_questions):
            continue

        question = exam_questions[idx]
        # question may be a dict (from JSON column) or a QuestionSchema object
        if isinstance(question, dict):
            question_text = question["text"]
            rubric = question["rubric"]
            max_score = question["credit"]
        else:
            question_text = question.text
            rubric = question.rubric
            max_score = question.credit

        tasks.append(
            grade_answer(
                question_text=question_text,
                rubric=rubric,
                max_score=max_score,
                answer=answer_input.answer,
                question_index=idx,
                api_key=api_key,
                model=model,
            )
        )

    grades = await asyncio.gather(*tasks)
    total_score = sum(g.score for g in grades)
    return list(grades), total_score
