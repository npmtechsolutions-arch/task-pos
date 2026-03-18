"""Task scoring service for dynamic prioritization."""

from app.models.task import Task

class TaskScoringService:
    """Service to calculate priority scores based on multiple factors."""

    # Weights for the scoring model
    WEIGHT_IMPACT = 0.4
    WEIGHT_EFFORT = 0.2
    WEIGHT_RISK = 0.2
    WEIGHT_STRATEGIC_ALIGNMENT = 0.2

    @classmethod
    def calculate_priority_score(
        cls, impact: float, effort: float, risk: float, alignment: float
    ) -> float:
        """
        Calculate an absolute priority score.
        All inputs should be normalized between 0.0 and 10.0 or 1.0 and 100.0 (consistent scale).
        """
        score = (
            (impact * cls.WEIGHT_IMPACT)
            + (effort * cls.WEIGHT_EFFORT)
            + (risk * cls.WEIGHT_RISK)
            + (alignment * cls.WEIGHT_STRATEGIC_ALIGNMENT)
        )
        return round(score, 2)

    @classmethod
    def compute_and_update_task_score(cls, task: Task) -> float:
        """
        Extracts factors from task custom_fields and updates the priority_score.
        Expects custom_fields to contain: 'impact', 'effort_factor', 'risk', 'strategic_alignment'.
        Falls back to 0 for missing fields.
        """
        cf = task.custom_fields or {}
        impact = float(cf.get("impact", 0.0))
        effort_factor = float(cf.get("effort_factor", 0.0))
        risk = float(cf.get("risk", 0.0))
        alignment = float(cf.get("strategic_alignment", 0.0))

        new_score = cls.calculate_priority_score(impact, effort_factor, risk, alignment)
        task.priority_score = new_score
        return new_score
