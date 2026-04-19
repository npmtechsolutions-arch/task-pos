import re
import random
from datetime import datetime, timedelta, timezone

class AgenticTimesheetEngine:
    """
    Local heuristic-based Agentic AI engine for simulating Timesheet intelligence.
    Extracts time, automatically categorizes tasks, and generates proactive insights.
    """

    CATEGORIES = {
        "Development": ["code", "coding", "frontend", "backend", "api", "ui", "ux", "bug", "feature", "react", "fastapi", "database", "dev"],
        "Meeting": ["meet", "meeting", "sync", "call", "standup", "discuss", "discussion", "client", "planning"],
        "Learning": ["learn", "read", "tutorial", "course", "study", "researching", "explore"],
        "Break": ["break", "lunch", "rest", "walk", "coffee"],
        "Design": ["design", "figma", "wireframe", "mockup", "prototype"],
        "Testing": ["test", "testing", "qa", "debug", "debugging"]
    }

    @classmethod
    def parse_input(cls, text: str) -> dict:
        text_lower = text.lower()
        
        # 1. Extract Duration
        duration_minutes = 0
        hr_match = re.search(r'(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours)', text_lower)
        min_match = re.search(r'(\d+)\s*(min|mins|minute|minutes)', text_lower)
        
        if hr_match:
            duration_minutes += float(hr_match.group(1)) * 60
        if min_match:
            duration_minutes += int(min_match.group(1))
            
        if duration_minutes == 0:
            duration_minutes = 60 # Default to 1 hour if unspecified

        # 2. Determine Category
        assigned_category = "General"
        for category, keywords in cls.CATEGORIES.items():
            if any(kw in text_lower for kw in keywords):
                assigned_category = category
                break

        # 3. Extract Task Name (Basic NLP extraction)
        # Strip out time words
        cleaned_task = re.sub(r'for\s*\d+\s*(hrs?|hours?|mins?|minutes?)', '', text, flags=re.IGNORECASE).strip()
        cleaned_task = re.sub(r'^i (worked on|spent time on|did|completed|started)\s*', '', cleaned_task, flags=re.IGNORECASE).strip()
        if not cleaned_task:
            cleaned_task = "Unspecified Task"

        # Capitalize properly
        cleaned_task = cleaned_task.capitalize()

        # 4. Calculate Times
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(minutes=duration_minutes)

        # 5. Productivity Scoring & Agentic Intelligence
        base_score = random.randint(70, 95)
        
        if assigned_category == "Meeting":
            # Meetings typically reduce raw productivity score
            productivity_score = base_score - 10
            alerts = ["High meeting load detected. Consider scheduling focus blocks."]
            insights = ["Meetings consumed a block of your peak energy time."]
            suggestions = ["Try to batch meetings together tomorrow.", "Always keep an agenda."]
        elif assigned_category == "Break":
            productivity_score = 100 # Taking a break is 100% good!
            alerts = []
            insights = ["Breaks increase cognitive performance."]
            suggestions = ["Drink water and step away from the screen."]
        elif assigned_category in ["Development", "Design"]:
            if duration_minutes > 120:
                productivity_score = base_score + 5
                alerts = ["Long focus session detected. Warning: Avoid burnout."]
                insights = ["Deep work state achieved. You completed a dense task block."]
                suggestions = ["Take a 15-minute screen break.", "Log similar deep work tasks with specific tags."]
            else:
                productivity_score = base_score
                alerts = []
                insights = ["Steady development velocity maintained."]
                suggestions = ["Review your code before PR."]
        else:
            productivity_score = base_score
            alerts = []
            insights = ["Task recorded successfully."]
            suggestions = ["Classify your tasks to get better analytics."]

        # Format times
        fmt = "%Y-%m-%dT%H:%M:%SZ"

        # Generate final structured output matching the User's strict format
        return {
            "task": cleaned_task,
            "category": assigned_category,
            "start_time": start_time.strftime(fmt),
            "end_time": end_time.strftime(fmt),
            "duration": f"{int(duration_minutes // 60)}h {int(duration_minutes % 60)}m" if duration_minutes >= 60 else f"{int(duration_minutes)}m",
            "productivity_score": str(min(100, max(0, int(productivity_score)))),
            "suggestions": suggestions,
            "alerts": alerts,
            "insights": insights
        }
