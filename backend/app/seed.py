from sqlmodel import Session, select

from app.models.exam import Exam


# Demo exam with AI-themed questions
DEMO_EXAM_DATA = {
    "title": "AI Fundamentals Final Exam",
    "questions": [
        {
            "text": "Define artificial intelligence and provide two real-world applications.",
            "credit": 2,
            "min_words": 30,
            "rubric": [
                "Clear and accurate definition of AI",
                "Two distinct, relevant applications provided",
                "Explanations demonstrate understanding",
            ],
        },
        {
            "text": "Explain the difference between supervised and unsupervised learning with examples.",
            "credit": 5,
            "min_words": 100,
            "rubric": [
                "Accurate definition of supervised learning",
                "Accurate definition of unsupervised learning",
                "Clear distinction between the two approaches",
                "Relevant example for supervised learning",
                "Relevant example for unsupervised learning",
            ],
        },
        {
            "text": "Discuss the ethical implications of AI in healthcare, considering both benefits and risks.",
            "credit": 8,
            "min_words": 200,
            "rubric": [
                "Identifies multiple benefits of AI in healthcare",
                "Identifies multiple risks/ethical concerns",
                "Discusses privacy and data security issues",
                "Considers bias and fairness in AI systems",
                "Addresses patient autonomy and consent",
                "Proposes balanced approach or solutions",
                "Demonstrates critical thinking",
                "Well-organized and coherent argument",
            ],
        },
    ],
}


def seed_demo_exam(engine):
    """Seed demo exam if it doesn't exist."""
    with Session(engine) as session:
        # Check if any exams exist
        existing = session.exec(select(Exam)).first()
        if existing:
            print("Demo exam already exists, skipping seed")
            return

        # Create demo exam
        exam = Exam(**DEMO_EXAM_DATA)
        session.add(exam)
        session.commit()
        print(f"Seeded demo exam: {exam.title}")
