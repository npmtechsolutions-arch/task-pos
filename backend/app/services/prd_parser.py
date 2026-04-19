"""
PRD AI Parser Service.
Parses uploaded documents (txt/docx/pdf) and generates structured tasks automatically.
Uses heuristic NLP — no external API key required.
"""

import re
import os
import json
from datetime import datetime
from typing import Optional


# ──────────────────────────────────────────────────
# TASK KEYWORDS → CATEGORY MAPPING
# ──────────────────────────────────────────────────

CATEGORY_MAP = {
    "Development": [
        "api", "endpoint", "backend", "frontend", "database", "db",
        "model", "schema", "implement", "build", "create", "develop",
        "code", "service", "module", "integration", "migration", "deploy",
    ],
    "Design": [
        "ui", "ux", "design", "figma", "wireframe", "mockup", "prototype",
        "layout", "interface", "visual", "style", "theme", "brand",
    ],
    "Testing": [
        "test", "qa", "quality", "unit test", "integration test", "e2e",
        "validation", "verify", "debug", "fix bug", "regression",
    ],
    "Research": [
        "research", "analysis", "evaluate", "explore", "investigate",
        "study", "review", "audit", "performance", "benchmark",
    ],
    "Meeting": [
        "meeting", "sync", "standup", "planning", "sprint", "review",
        "presentation", "demo", "stakeholder",
    ],
}

PRIORITY_KEYWORDS = {
    "high": ["critical", "urgent", "must", "immediately", "asap", "high priority", "required"],
    "medium": ["should", "important", "needed", "medium"],
    "low": ["nice to have", "optional", "could", "low priority", "minor", "enhancement"],
}

ESTIMATED_HOURS = {
    "Development": 6,
    "Design": 4,
    "Testing": 3,
    "Research": 4,
    "Meeting": 1,
    "General": 4,
}


def _classify_task(task_text: str) -> str:
    """Classify task into a category based on text keywords."""
    text_lower = task_text.lower()
    for category, keywords in CATEGORY_MAP.items():
        if any(kw in text_lower for kw in keywords):
            return category
    return "Development"


def _assign_priority(task_text: str) -> str:
    """Assign priority based on keyword analysis."""
    text_lower = task_text.lower()
    for priority, keywords in PRIORITY_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return priority
    return "medium"


def _extract_text_from_file(file_path: str, file_type: str) -> str:
    """
    Extract raw text from uploaded file.
    Supports: TXT, basic DOCX (via python-docx), PDF (via pdfminer).
    Falls back to plain UTF-8 read for unknown/unsupported formats.
    """
    try:
        ext = file_type.lower()

        if ext in ("txt", "text/plain"):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        elif ext in ("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
            try:
                from docx import Document as DocxDocument
                doc = DocxDocument(file_path)
                return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            except ImportError:
                pass  # fall back to raw read

        elif ext in ("pdf", "application/pdf"):
            try:
                from pdfminer.high_level import extract_text
                return extract_text(file_path)
            except ImportError:
                pass  # fall back to raw read

        # Fallback: raw bytes decoded as text
        with open(file_path, "rb") as f:
            return f.read().decode("utf-8", errors="ignore")

    except Exception:
        return ""


def _split_into_tasks(text: str) -> list[str]:
    """
    Heuristic task extraction from PRD text.
    Identifies tasks from:
    - Bullet points (- item / * item / • item)
    - Numbered lists (1. item)
    - Sections starting with action verbs
    """
    lines = text.splitlines()
    tasks = []

    action_verbs = r"^(build|create|develop|implement|design|add|set up|configure|integrate|define|establish|write|test|deploy|migrate|fix|refactor|update|generate|analyze|review)"

    for line in lines:
        line = line.strip()
        if not line or len(line) < 8:
            continue

        # Bullet or numbered list
        match = re.match(r"^[-•*\d+\.]\s+(.+)", line)
        if match:
            task_text = match.group(1).strip()
            if len(task_text) > 5:
                tasks.append(task_text)
            continue

        # Action-verb-led sentences
        if re.match(action_verbs, line, re.IGNORECASE) and len(line) < 300:
            tasks.append(line)

    return tasks[:30]  # Cap at 30 auto-generated tasks per PRD


def parse_prd_file(file_path: str, file_type: str) -> dict:
    """
    Full PRD parsing pipeline.
    
    Returns:
    {
      "project_name": str,
      "phases": [...],
      "tasks": [...],
      "dependencies": [],
      "insights": []
    }
    """
    raw_text = _extract_text_from_file(file_path, file_type)

    if not raw_text.strip():
        return {
            "project_name": "Extracted Project",
            "phases": [],
            "tasks": [],
            "dependencies": [],
            "insights": ["⚠️ Document appears empty or could not be parsed."]
        }

    # ── 1. Extract project name from first non-empty heading ─────────────────
    project_name = "Extracted Project"
    for line in raw_text.splitlines():
        line = line.strip()
        if line and len(line) < 100 and not line.startswith(("-", "*", "•")):
            project_name = line
            break

    # ── 2. Generate tasks ─────────────────────────────────────────────────────
    raw_tasks = _split_into_tasks(raw_text)

    tasks = []
    for i, task_text in enumerate(raw_tasks):
        category = _classify_task(task_text)
        priority = _assign_priority(task_text)
        est_hours = ESTIMATED_HOURS.get(category, 4)

        # Generate description from surrounding context (first 150 chars)
        desc = task_text if len(task_text) > 30 else f"Task auto-generated from PRD: {task_text}"

        tasks.append({
            "title": task_text[:200],
            "description": desc,
            "category": category,
            "priority": priority,
            "estimated_hours": est_hours,
            "position": float(i + 1),
            "status": "todo",
            "dependencies": [],
            "suggested_assignee": None,
        })

    # ── 3. Auto-group tasks into phases ───────────────────────────────────────
    phases = []
    phase_groups = {}
    for t in tasks:
        cat = t["category"]
        if cat not in phase_groups:
            phase_groups[cat] = []
        phase_groups[cat].append(t["title"])

    for i, (cat_name, task_titles) in enumerate(phase_groups.items()):
        phases.append({
            "name": f"Phase {i + 1}: {cat_name}",
            "category": cat_name,
            "task_count": len(task_titles),
        })

    # ── 4. Generate AI insights ───────────────────────────────────────────────
    insights = []
    if len(tasks) == 0:
        insights.append("No structured tasks detected. Try uploading a document with bullet points or numbered lists.")
    if len(tasks) > 20:
        insights.append(f"⚠️ {len(tasks)} tasks generated — consider splitting this PRD into multiple projects.")
    
    dev_tasks = [t for t in tasks if t["category"] == "Development"]
    test_tasks = [t for t in tasks if t["category"] == "Testing"]
    if dev_tasks and not test_tasks:
        insights.append("⚠️ Missing: No testing tasks were detected. Consider adding QA tasks.")
    if not any(t["priority"] == "high" for t in tasks):
        insights.append("ℹ️ No high-priority tasks detected. Please review and re-prioritize critical requirements.")

    total_hours = sum(t["estimated_hours"] for t in tasks)
    insights.append(f"📊 Estimated total effort: {total_hours} hours ({total_hours / 8:.1f} workdays).")

    return {
        "project_name": project_name,
        "extracted_text": raw_text[:5000],  # Store first 5000 chars
        "phases": phases,
        "tasks": tasks,
        "dependencies": [],
        "insights": insights,
    }
