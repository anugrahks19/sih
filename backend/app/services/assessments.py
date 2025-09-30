from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Assessment, CognitiveLog, PredictionResult, SpeechSample, User
from app.schemas.assessments import CognitiveSubmission


def create_assessment(db: Session, user_id: str) -> Assessment:
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("User not found")

    assessment = Assessment(user_id=user_id, language=user.language)
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


def fetch_assessment(db: Session, assessment_id: str, user_id: str) -> Optional[Assessment]:
    assessment = db.get(Assessment, assessment_id)
    if not assessment or assessment.user_id != user_id:
        return None
    return assessment


def persist_speech_sample(
    db: Session,
    assessment_id: str,
    task_id: str,
    file_path: Path | str,
    duration_ms: Optional[int],
    language: Optional[str],
) -> SpeechSample:
    sample = SpeechSample(
        assessment_id=assessment_id,
        task_id=task_id,
        file_path=str(file_path),
        duration_ms=duration_ms,
        language=language,
    )
    db.add(sample)
    db.commit()
    db.refresh(sample)
    return sample


def persist_cognitive_submission(db: Session, assessment_id: str, submission: CognitiveSubmission) -> None:
    for log in submission.logs:
        db.add(
            CognitiveLog(
                assessment_id=assessment_id,
                task_id=log.task_id,
                task_type=log.task_type,
                prompt=log.prompt,
                response_time_ms=log.response_time_ms,
                correct=log.correct,
                errors=log.errors,
                metadata_json=log.metadata,
            )
        )

    assessment = db.get(Assessment, assessment_id)
    if assessment:
        assessment.memory_score = submission.cognitive_scores.memory_score
        assessment.attention_score = submission.cognitive_scores.attention_score
        assessment.language_score = submission.cognitive_scores.language_score
        assessment.executive_score = submission.cognitive_scores.executive_score
        assessment.clock_drawing = submission.clock_drawing
        assessment.updated_at = datetime.utcnow()

    db.commit()


def run_prediction_pipeline(db: Session, assessment: Assessment) -> PredictionResult:
    # Placeholder: connect to actual pipeline
    prediction = db.query(PredictionResult).filter_by(assessment_id=assessment.id).first()
    if prediction:
        return prediction

    prediction = PredictionResult(
        assessment_id=assessment.id,
        risk_level="Moderate",
        probability=0.55,
        feature_importances=[
            {"feature": "speech_rate", "contribution": 0.2, "direction": "positive"},
            {"feature": "memory_score", "contribution": 0.15, "direction": "negative"},
        ],
        recommendations=[
            "Consult a clinician for comprehensive evaluation",
            "Maintain mentally stimulating activities",
        ],
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction
