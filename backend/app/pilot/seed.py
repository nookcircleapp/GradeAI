"""Two pre-made pilot papers, created once as templates teachers can copy."""
from __future__ import annotations

from sqlmodel import Session, select

from app.pilot.models import Paper, User
from app.pilot.security import new_share_code

FOOL_THE_AI = {
    "title": "AI Fundamentals: Fool the AI Challenge",
    "subject": "AI Course · Civil Engineering",
    "instructions": (
        "Answer all 3 questions. An AI grades each answer against the teacher's reference answer "
        "and rubric. This is a contest: try to get the highest score you can from the AI grader. "
        "Highest total wins. Your teacher reviews every answer afterwards."
    ),
    "time_limit_minutes": 45,
    "is_contest": True,
    "results_mode": "immediate",
    "questions": [
        {
            "text": "Define Artificial Intelligence and give two real-world applications of it in civil engineering.",
            "marks": 2,
            "min_words": 30,
            "rubric": [
                "1 mark: a correct definition of AI (machines performing tasks that normally need human intelligence, such as learning, reasoning or perception)",
                "1 mark: two distinct, valid civil engineering applications, each briefly explained",
                "No marks for buzzwords or applications named without any explanation",
            ],
            "reference_answer": (
                "Artificial Intelligence is the ability of computer systems to perform tasks that normally require "
                "human intelligence, such as learning from data, recognising patterns, reasoning and making decisions. "
                "In civil engineering, AI is used for crack detection on bridges and buildings, where image models "
                "spot cracks in drone or camera photos, and for predicting concrete compressive strength from the mix "
                "design, which reduces the number of physical cube tests needed."
            ),
        },
        {
            "text": "Differentiate between supervised and unsupervised learning, with one civil engineering example of each.",
            "marks": 5,
            "min_words": 80,
            "rubric": [
                "1 mark: supervised learning uses labelled data (inputs with known correct outputs)",
                "1 mark: unsupervised learning uses unlabelled data to find structure or groups",
                "1 mark: names a typical task or algorithm for each (e.g. regression or classification; clustering such as k-means)",
                "1 mark: a valid civil engineering example of supervised learning",
                "1 mark: a valid civil engineering example of unsupervised learning",
            ],
            "reference_answer": (
                "Supervised learning trains a model on labelled examples, where each input comes with the correct "
                "output, so the model learns to predict that output for new inputs. Typical tasks are regression and "
                "classification. Example: predicting the 28-day compressive strength of concrete from cement, water, "
                "aggregate and admixture quantities, using past test results as labels. Unsupervised learning works "
                "on unlabelled data and finds structure by itself, for example with clustering such as k-means. "
                "Example: grouping soil samples from a site investigation into zones with similar properties, or "
                "clustering traffic sensor data into typical daily patterns, without telling the model the groups "
                "in advance."
            ),
        },
        {
            "text": "Discuss the risks of relying on AI for structural safety decisions, such as approving a bridge inspection.",
            "marks": 8,
            "min_words": 150,
            "rubric": [
                "2 marks: data quality and bias, e.g. training data that lacks rare failure modes or local conditions",
                "2 marks: explainability, e.g. engineers cannot see why the model passed a structure",
                "2 marks: accountability and the need for a licensed engineer to sign off",
                "1 mark: over-reliance or automation bias by human inspectors",
                "1 mark: a sensible mitigation, such as human review, validation on local data or conservative thresholds",
            ],
            "reference_answer": (
                "AI can speed up inspections, but structural safety decisions carry a risk to life, so relying on it "
                "is dangerous without safeguards. First, models are only as good as their training data: if the data "
                "lacks rare failure modes, unusual materials or local climate effects, the model may miss exactly the "
                "defects that matter. Second, many models are black boxes, so an engineer cannot see why a girder was "
                "judged safe, which makes errors hard to catch and decisions hard to justify. Third, accountability "
                "is unclear: codes and law require a licensed engineer to take responsibility, and an AI cannot be "
                "held accountable. Fourth, inspectors may over-trust a confident system and stop looking closely, "
                "which is automation bias. To manage these risks AI should only assist: flag possible defects for a "
                "qualified engineer to verify, be validated on local structures before use, use conservative "
                "thresholds, and keep records of every decision for audit."
            ),
        },
    ],
}

ML_BASICS = {
    "title": "Machine Learning Basics for Civil Engineers",
    "subject": "AI Course · Civil Engineering",
    "instructions": "Answer all questions in your own words. Use examples from civil engineering where you can.",
    "time_limit_minutes": 40,
    "is_contest": False,
    "results_mode": "immediate",
    "questions": [
        {
            "text": "What is overfitting in machine learning, and how can it be detected?",
            "marks": 5,
            "min_words": 60,
            "rubric": [
                "2 marks: overfitting means the model learns noise or specifics of the training data and fails to generalise",
                "2 marks: detected by comparing training and validation/test performance (high training, poor validation accuracy)",
                "1 mark: a relevant example",
            ],
            "reference_answer": (
                "Overfitting happens when a model learns the training data too closely, including its noise and "
                "quirks, so it performs very well on that data but poorly on new data. It is detected by holding "
                "back a validation or test set: if accuracy on the training data is high but much lower on the "
                "validation data, the model is overfitting. For example, a model predicting pavement deterioration "
                "that fits every past road perfectly but makes poor predictions for new roads is overfitted."
            ),
        },
        {
            "text": "Explain the steps you would follow to build a model that predicts traffic volume at a junction.",
            "marks": 5,
            "min_words": 80,
            "rubric": [
                "1 mark: define the problem and target (e.g. vehicles per hour)",
                "1 mark: collect relevant data (counts, time of day, day of week, weather, events)",
                "1 mark: clean and prepare data, split into training and test sets",
                "1 mark: choose and train a suitable model",
                "1 mark: evaluate on test data with a metric and use or monitor the model",
            ],
            "reference_answer": (
                "First define the target, such as vehicles per hour at the junction for each hour of the day. "
                "Then collect data: historical traffic counts from sensors or surveys, with time of day, day of week, "
                "holidays, weather and nearby events. Clean the data by removing faulty sensor readings and filling "
                "gaps, create useful features, and split it into training and test sets. Train a regression model, "
                "for example a gradient-boosted tree or linear regression as a baseline. Evaluate it on the test set "
                "with a metric such as mean absolute error, and finally deploy it and monitor its accuracy, "
                "retraining when traffic patterns change."
            ),
        },
        {
            "text": "Compare rule-based systems and machine learning for detecting defects in construction site photos. Which would you choose and why?",
            "marks": 10,
            "min_words": 150,
            "rubric": [
                "2 marks: explains rule-based systems (hand-written rules, e.g. thresholds on colour or edges)",
                "2 marks: explains machine learning (learns patterns from labelled example images)",
                "2 marks: strengths and weaknesses of rule-based (transparent, but brittle with lighting, angles, variety)",
                "2 marks: strengths and weaknesses of ML (handles variety, but needs labelled data and is harder to explain)",
                "2 marks: a justified choice that follows from the comparison",
            ],
            "reference_answer": (
                "A rule-based system uses rules written by engineers, for example flagging a crack when a thin dark "
                "line longer than a set length appears after edge detection. It is transparent and needs no training "
                "data, but it is brittle: changes in lighting, shadows, camera angle, surface texture or dirt break "
                "the rules, and every new defect type needs new rules. A machine learning approach, such as a "
                "convolutional neural network, learns what defects look like from many labelled photos. It copes much "
                "better with the variety of real site photos and can detect several defect types, but it needs a "
                "large labelled dataset, can be hard to explain, and may fail on conditions it never saw. For real "
                "construction sites I would choose machine learning, because the variety of conditions is too large "
                "for hand-written rules, while keeping an engineer to review flagged images and collecting more "
                "labelled data over time to improve it."
            ),
        },
    ],
}

TEMPLATES = [FOOL_THE_AI, ML_BASICS]


def seed_templates(session: Session) -> None:
    """Create the pre-made papers once, owned by the first admin."""
    if session.exec(select(Paper.id).where(Paper.is_template == True)).first():  # noqa: E712
        return
    admin = session.exec(select(User).where(User.role == "admin").order_by(User.id)).first()
    if not admin:
        return
    for data in TEMPLATES:
        code = new_share_code()
        while session.exec(select(Paper.id).where(Paper.share_code == code)).first():
            code = new_share_code()
        session.add(Paper(**data, owner_id=admin.id, share_code=code, is_template=True))
    session.commit()
