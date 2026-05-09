"""
Recognition Health Monitor — Track and report face matcher performance.

Provides real-time health metrics and configurable confidence thresholds
per matcher, replacing the previous fixed 0.85 threshold for all methods.
"""

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class MatcherState:
    """Live state of a single face matcher."""
    name: str
    enabled: bool = True
    total_attempts: int = 0
    total_matches: int = 0
    last_confidence: float = 0.0
    last_error: str = ""
    consecutive_errors: int = 0
    max_consecutive_errors: int = 3
    confidence_threshold: float = 0.80
    avg_inference_ms: float = 0.0

    @property
    def accuracy(self) -> float:
        if self.total_attempts == 0:
            return 0.0
        return self.total_matches / self.total_attempts * 100

    @property
    def healthy(self) -> bool:
        return self.enabled and self.consecutive_errors < self.max_consecutive_errors

    def record_match(self, confidence: float, inference_ms: float = 0.0) -> None:
        self.total_attempts += 1
        self.total_matches += 1
        self.last_confidence = confidence
        self.consecutive_errors = 0
        self.last_error = ""
        if inference_ms > 0:
            self.avg_inference_ms = (
                self.avg_inference_ms * (self.total_attempts - 1) + inference_ms
            ) / self.total_attempts

    def record_miss(self) -> None:
        self.total_attempts += 1

    def record_error(self, error: str) -> None:
        self.consecutive_errors += 1
        self.last_error = error
        if self.consecutive_errors >= self.max_consecutive_errors:
            self.enabled = False


@dataclass
class RecognitionHealth:
    """Aggregate health for all face matchers."""

    matchers: dict[str, MatcherState] = field(default_factory=dict)
    last_report_time: float = field(default_factory=time.time)

    def __post_init__(self):
        if not self.matchers:
            self.matchers = {
                "hybrid": MatcherState(name="Hybrid (OpenCV+Gemini)"),
                "photo_matcher": MatcherState(name="Photo-to-Photo"),
                "opencv": MatcherState(name="OpenCV DNN (YuNet+Face)"),
            }

    def get_matcher(self, method: str) -> MatcherState:
        for key, matcher in self.matchers.items():
            if method.lower() in key.lower():
                return matcher
        return self.matchers.get(method, MatcherState(name=method))

    def record_match(self, method: str, confidence: float,
                     inference_ms: float = 0.0) -> None:
        self.get_matcher(method).record_match(confidence, inference_ms)

    def record_miss(self, method: str) -> None:
        self.get_matcher(method).record_miss()

    def record_error(self, method: str, error: str) -> None:
        self.get_matcher(method).record_error(error)

    @property
    def all_healthy(self) -> bool:
        return all(m.healthy for m in self.matchers.values())

    @property
    def active_matchers(self) -> list[str]:
        return [name for name, m in self.matchers.items() if m.enabled]

    def get_report(self) -> dict:
        """Human-readable health report for UI/logging."""
        return {
            "total_matchers": len(self.matchers),
            "active": len(self.active_matchers),
            "matchers": {
                name: {
                    "enabled": m.enabled,
                    "attempts": m.total_attempts,
                    "matches": m.total_matches,
                    "accuracy_pct": round(m.accuracy, 1),
                    "last_error": m.last_error[:80],
                    "threshold": m.confidence_threshold,
                    "avg_inference_ms": round(m.avg_inference_ms, 1),
                }
                for name, m in self.matchers.items()
            },
        }


# Singleton
_health_instance: Optional[RecognitionHealth] = None


def get_recognition_health() -> RecognitionHealth:
    global _health_instance
    if _health_instance is None:
        _health_instance = RecognitionHealth()
    return _health_instance


# Optimized thresholds per matcher (calibrated for this deployment):
#   - Hybrid: 0.75 (OpenCV base, Gemini verification disabled)
#   - Photo-to-Photo: 0.80 (dlib/PyTorch, more precise)
#   - OpenCV DNN: 0.78 (YuNet+Face, balanced)
OPTIMAL_THRESHOLDS = {
    "hybrid": 0.75,
    "photo_matcher": 0.80,
    "opencv": 0.78,
}


def get_threshold(method: str) -> float:
    """Get the calibrated confidence threshold for a matcher."""
    return OPTIMAL_THRESHOLDS.get(method, 0.80)
