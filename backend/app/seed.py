"""Demo exam seeded on first startup.

Each question carries both a ``rubric`` (what must be present) and
``reference_answers`` (what full-credit work looks like). They are used
TOGETHER at grading time — see app/services/grading.py.

Reference answers are teacher material and are NEVER sent to a student: the
public read schema (app/schemas/exam.py :: ExamRead) has no field for them.

They are written to be genuinely full-credit for the rubric beside them, and
deliberately differ from each other in wording, structure and examples — the
grader is instructed to treat them as a quality benchmark, not a target string,
and a pair that disagrees on phrasing makes that instruction concrete.
"""

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
            "reference_answers": [
                (
                    "Artificial intelligence is the branch of computer science concerned "
                    "with building systems that carry out tasks we would normally say "
                    "require human intelligence — perceiving, reasoning, learning from "
                    "experience and making decisions — rather than following a fixed set "
                    "of hand-written rules. Two real-world applications are medical "
                    "imaging, where a model trained on thousands of labelled scans flags "
                    "likely tumours so a radiologist can review the highest-risk cases "
                    "first, and navigation apps such as Google Maps, which predict travel "
                    "times and reroute drivers by learning from live and historical "
                    "traffic data. Both work by learning patterns from data instead of "
                    "being explicitly programmed with every rule they need."
                ),
                (
                    "AI means getting a machine to do things that would count as "
                    "intelligent if a person did them: understanding language, "
                    "recognising images, planning a course of action, and improving its "
                    "own performance as it sees more data. The term covers older "
                    "rule-based expert systems as well as modern machine learning. One "
                    "everyday application is email spam filtering, where the system "
                    "learns from millions of labelled messages which signals indicate "
                    "spam and keeps adapting as spammers change tactics. Another is the "
                    "speech recognition in a voice assistant, which turns a noisy audio "
                    "signal into text and then into an action such as setting an alarm. "
                    "Each handles messy real-world input that no fixed rule set could "
                    "anticipate."
                ),
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
            "reference_answers": [
                (
                    "In supervised learning the training data is labelled: every example "
                    "arrives with the correct output attached, and the algorithm learns a "
                    "mapping from inputs to those known outputs by repeatedly minimising "
                    "the error between its prediction and the label. In unsupervised "
                    "learning there are no labels at all — the algorithm is given only "
                    "the inputs and has to discover structure in them by itself, such as "
                    "clusters of similar points, useful lower-dimensional "
                    "representations, or observations that do not fit the rest.\n\n"
                    "The core distinction is supervision, and it has practical "
                    "consequences. A supervised model is told what the right answer is, "
                    "so it can be evaluated objectively as accuracy or error on held-out "
                    "labelled data; but labels are expensive because a human must produce "
                    "them. An unsupervised model has no ground truth to be scored "
                    "against, so its output has to be judged by whether the structure it "
                    "found is useful or interpretable; in exchange it can use cheap, "
                    "abundant unlabelled data.\n\n"
                    "A typical supervised example is spam detection: each training email "
                    "is marked 'spam' or 'not spam', and the model learns to classify new "
                    "mail it has never seen. A typical unsupervised example is customer "
                    "segmentation, where a retailer runs k-means over purchase histories "
                    "and discovers groups of similar shoppers that nobody defined in "
                    "advance."
                ),
                (
                    "Machine learning problems divide according to whether the data comes "
                    "with answers attached. Supervised methods train on input-output "
                    "pairs: the dataset supplies a target for each example, the model "
                    "makes a prediction, a loss function measures how far off it was, and "
                    "the parameters are updated to close that gap. Unsupervised methods "
                    "receive only the raw inputs and look for regularities in the data "
                    "itself — which points resemble one another, which dimensions "
                    "actually carry information, which observations are anomalous.\n\n"
                    "So the two differ in what they are given, how they are trained and "
                    "how they are judged: supervised learning imitates a known answer and "
                    "is measured against it, while unsupervised learning describes the "
                    "data and is measured by whether a human finds the description "
                    "useful.\n\n"
                    "For supervised learning, take a hospital predicting whether a "
                    "patient will be readmitted within thirty days: historical records "
                    "are labelled with what actually happened, and the model learns from "
                    "them to score new patients. For unsupervised learning, take topic "
                    "modelling over thousands of news articles: the algorithm groups "
                    "documents by the vocabulary they share and the themes emerge without "
                    "anyone having labelled a single article."
                ),
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
            "reference_answers": [
                (
                    "AI in healthcare offers real and measurable benefits. Diagnostic "
                    "models can detect diabetic retinopathy or early-stage tumours at or "
                    "above the accuracy of an average specialist, and they do it in "
                    "seconds, which matters most in places with too few specialists to go "
                    "round. Triage systems flag deteriorating patients from vital signs "
                    "before a nurse would notice. Drug discovery pipelines cut years off "
                    "candidate screening, and administrative automation gives clinicians "
                    "back time to spend with patients.\n\n"
                    "The risks are equally concrete. Health data is among the most "
                    "sensitive information a person has, and training these systems "
                    "requires it in volume. Records are re-identifiable even after naive "
                    "anonymisation, breaches are irreversible in a way a stolen password "
                    "is not, and data collected for treatment is often reused for model "
                    "training that the patient never contemplated. Strong encryption, "
                    "strict access control, data minimisation and techniques such as "
                    "federated learning — where the model travels to the hospital rather "
                    "than the data leaving it — are the minimum responsible practice.\n\n"
                    "Bias is the second major concern. A model learns the distribution it "
                    "was trained on, so a system built mainly on data from urban "
                    "tertiary hospitals, or from one ethnic group, will underperform for "
                    "everyone else; pulse oximetry and dermatology models have both shown "
                    "exactly this failure on darker skin. Because the model is applied at "
                    "scale, it can entrench an existing inequity far faster than any "
                    "individual clinician could. Representative datasets, subgroup "
                    "reporting rather than a single headline accuracy, and monitoring "
                    "after deployment are all necessary.\n\n"
                    "Autonomy and consent are also at stake. Patients should know when an "
                    "algorithm contributed to a decision about them, what it was used "
                    "for, and be able to ask for human review; consent to treatment is "
                    "not consent to have one's records train a commercial model. Opacity "
                    "makes this worse — a clinician cannot meaningfully explain a "
                    "recommendation they do not understand, and accountability blurs "
                    "between the vendor, the hospital and the doctor.\n\n"
                    "The balanced position is neither refusal nor uncritical adoption. AI "
                    "should be used as decision support with a clinician retaining "
                    "responsibility, validated prospectively on the population it will "
                    "serve, regulated like a medical device, audited for subgroup "
                    "performance after deployment, and governed by explicit consent and "
                    "clear liability. Used that way the benefits are worth having; "
                    "deployed on unexamined trust, the same systems scale their mistakes "
                    "as efficiently as their successes."
                ),
                (
                    "Any honest assessment of AI in healthcare has to weigh a genuine "
                    "upside against genuine hazards, because both are already visible in "
                    "deployed systems.\n\n"
                    "On the benefit side: earlier and more consistent diagnosis from "
                    "imaging and pathology; continuous monitoring that catches sepsis or "
                    "cardiac deterioration hours before conventional observation; faster "
                    "drug discovery; personalised treatment planning that accounts for a "
                    "patient's own history; and expanded access, since a model on a phone "
                    "can bring screening to a rural district that has no radiologist at "
                    "all.\n\n"
                    "Against that, four ethical problems stand out. First, privacy: "
                    "training needs enormous volumes of the most sensitive data that "
                    "exists, held by institutions that are frequent targets of "
                    "ransomware, and re-identification from supposedly anonymised records "
                    "is well documented. Second, bias: a model trained on unrepresentative "
                    "data quietly performs worse for the groups it under-saw, and because "
                    "it runs on every patient it converts one dataset's blind spot into a "
                    "systemic one. Third, autonomy and consent: patients are rarely told "
                    "an algorithm was involved, rarely asked before their records train "
                    "one, and often have no route to a human second opinion. Fourth, "
                    "accountability and de-skilling: when an opaque model is wrong, it is "
                    "unclear who answers for it, and clinicians who defer to it over time "
                    "lose the judgement needed to catch its errors.\n\n"
                    "None of this argues for abandoning the technology; it argues for "
                    "conditions on its use. Reasonable ones include validating models "
                    "prospectively on the actual local population before deployment, "
                    "publishing accuracy broken down by subgroup instead of one aggregate "
                    "figure, keeping a qualified human accountable for every clinical "
                    "decision, obtaining specific and revocable consent for secondary use "
                    "of data, preferring privacy-preserving training such as federated "
                    "learning, and regulating clinical AI as a medical device with "
                    "post-market surveillance. The trade-off is real: the same scale that "
                    "makes these systems valuable is what makes their failures dangerous, "
                    "so the governance has to scale with them."
                ),
            ],
        },
    ],
}


def seed_demo_exam(engine):
    """Seed demo exam if it doesn't exist.

    Deliberately skips when ANY exam already exists, so a restart can never
    overwrite edits a teacher made through the admin UI. Consequence: changing
    DEMO_EXAM_DATA does NOT update an already-seeded database — that has to be
    done with an admin PATCH (or by clearing the exam table on a throwaway DB).
    """
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
