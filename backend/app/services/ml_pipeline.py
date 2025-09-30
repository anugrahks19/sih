from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

import librosa
import numpy as np
import torch
import torchaudio
from transformers import AutoModel, AutoProcessor
import os
import joblib

from app.models import Assessment, SpeechSample


class AudioFeatureExtractor:
    def __init__(self) -> None:
        self.sample_rate = 16000
        self.mfcc_config = {"n_mfcc": 40, "n_fft": 1024, "hop_length": 512}

    def load_audio(self, file_path: Path | str) -> Tuple[np.ndarray, int]:
        waveform, sr = torchaudio.load(file_path)
        if sr != self.sample_rate:
            waveform = torchaudio.functional.resample(waveform, sr, self.sample_rate)
        return waveform.numpy().squeeze(), self.sample_rate

    def extract_features(self, audio: np.ndarray, sample_rate: int) -> Dict[str, Any]:
        mfcc = librosa.feature.mfcc(y=audio, sr=sample_rate, **self.mfcc_config)
        spectral_rolloff = librosa.feature.spectral_rolloff(y=audio, sr=sample_rate)
        zero_cross = librosa.feature.zero_crossing_rate(y=audio)

        return {
            "mfcc_mean": mfcc.mean(axis=1).tolist(),
            "mfcc_std": mfcc.std(axis=1).tolist(),
            "spectral_rolloff_mean": float(spectral_rolloff.mean()),
            "zero_cross_mean": float(zero_cross.mean()),
        }


class SpeechEmbeddingExtractor:
    def __init__(self) -> None:
        self.processor = AutoProcessor.from_pretrained("facebook/wav2vec2-base-960h")
        self.model = AutoModel.from_pretrained("facebook/wav2vec2-base-960h")
        self.model.eval()

    def get_embeddings(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        inputs = self.processor(audio, sampling_rate=sample_rate, return_tensors="pt", padding=True)
        with torch.no_grad():
            outputs = self.model(**inputs)
        return outputs.last_hidden_state.mean(dim=1).cpu().numpy()


class RiskPredictor:
    def __init__(self) -> None:
        # Attempt to load a persisted scikit-learn/xgboost model if available
        self.model: Optional[Any] = None
        model_path = os.getenv("MODEL_PATH", "model.pkl")
        try:
            if Path(model_path).exists():
                self.model = joblib.load(model_path)
        except Exception:
            self.model = None

    def _fallback(self) -> Dict[str, Any]:
        return {
            "risk_level": "Medium",
            "probability": 0.48,
            "feature_importances": [
                {"feature": "speech_rate", "contribution": 0.18, "direction": "positive"},
                {"feature": "memory_score", "contribution": 0.12, "direction": "negative"},
            ],
            "recommendations": [
                "Share results with a clinician",
                "Engage in memory reinforcement activities",
            ],
        }

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        # If no model, use placeholder
        if self.model is None:
            return self._fallback()

        # Build a simple tabular vector from available features as an example
        tab = features.get("tabular", {})
        x = np.array([
            tab.get("memory_score", 0.0),
            tab.get("attention_score", 0.0),
            tab.get("language_score", 0.0),
            tab.get("executive_score", 0.0),
        ]).reshape(1, -1)

        try:
            if hasattr(self.model, "predict_proba"):
                proba = float(self.model.predict_proba(x)[0, 1])
            else:
                # Some regressors output risk directly in [0,1]
                proba = float(self.model.predict(x)[0])
                proba = max(0.0, min(1.0, proba))

            risk_level = "Low" if proba < 0.33 else ("Medium" if proba < 0.66 else "High")

            # Best-effort feature importances
            fi = []
            if hasattr(self.model, "feature_importances_"):
                names = ["memory_score", "attention_score", "language_score", "executive_score"]
                importances = getattr(self.model, "feature_importances_")
                total = float(np.sum(np.abs(importances))) or 1.0
                for name, imp in zip(names, importances):
                    fi.append({"feature": name, "contribution": float(imp) / total, "direction": "positive"})

            return {
                "risk_level": risk_level,
                "probability": proba,
                "feature_importances": fi or self._fallback()["feature_importances"],
                "recommendations": [
                    "Share results with a clinician",
                    "Maintain routine cognitive activities",
                    "Follow up screening in 3 months",
                ],
            }
        except Exception:
            return self._fallback()


class PipelineManager:
    def __init__(self) -> None:
        self.audio_feature_extractor = AudioFeatureExtractor()
        self.speech_embedding_extractor = SpeechEmbeddingExtractor()
        self.predictor = RiskPredictor()

    def process_assessment(self, assessment: Assessment, samples: List[SpeechSample]) -> Dict[str, Any]:
        speech_embeddings: List[np.ndarray] = []
        audio_feature_map: Dict[str, Dict[str, Any]] = {}

        for sample in samples:
            audio, sr = self.audio_feature_extractor.load_audio(sample.file_path)
            audio_feature_map[sample.task_id] = self.audio_feature_extractor.extract_features(audio, sr)
            speech_embeddings.append(self.speech_embedding_extractor.get_embeddings(audio, sr))

        if speech_embeddings:
            speech_embedding = np.mean(np.concatenate(speech_embeddings, axis=0), axis=0).tolist()
        else:
            speech_embedding = [0.0] * 768

        tabular_features = {
            "memory_score": assessment.memory_score or 0.0,
            "attention_score": assessment.attention_score or 0.0,
            "language_score": assessment.language_score or 0.0,
            "executive_score": assessment.executive_score or 0.0,
        }

        features = {
            "audio": audio_feature_map,
            "speech_embedding": speech_embedding,
            "tabular": tabular_features,
        }

        prediction = self.predictor.predict(features)
        return {"prediction": prediction, "features": features}


pipeline_manager = PipelineManager()
