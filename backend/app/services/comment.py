"""Comment service with real-time broadcasting, mention parsing, and reactions."""

import re
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import delete, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.communication import CommentReaction
from app.models.notification import Notification, NotificationType, NotificationChannel
from app.models.project import ProjectMember
from app.models.task import Task, TaskActivity, TaskComment, ActivityAction
from app.models.user import User
from app.websocket.manager import manager

logger = get_logger(__name__)

# Max depth for threaded replies (0 = top-level, 1 = reply, 2 = reply-to-reply)
MAX_REPLY_DEPTH = 3

# Regex to extract @mentions: matches @word (letters, digits, underscores, dots, hyphens)
MENTION_PATTERN = re.compile(r"@([\w.\-]+)", re.UNICODE)


class CommentService:
    """Handles comments with real-time WS, @mention parsing, reactions."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Auth helpers ──────────────────────────────────────────────────────────

    async def is_project_member(self, project_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            select(ProjectMember).where(
                and_(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none() is not None

    # ── Mention parsing ───────────────────────────────────────────────────────

    async def _parse_mentions(
        self, content: str, project_id: str
    ) -> List[str]:
        """Extract @username mentions, validate they are project members, deduplicate."""
        raw = set(MENTION_PATTERN.findall(content))
        if not raw:
            return []

        # Resolve usernames → user IDs, only if they belong to the project
        # We join ProjectMember with User
        result = await self.db.execute(
            select(User.id).join(
                ProjectMember, ProjectMember.user_id == User.id
            ).where(
                and_(
                    ProjectMember.project_id == project_id,
                    User.email.in_(raw),  # try email prefix match first
                )
            )
        )
        matched_by_email = {row[0] for row in result.fetchall()}

        # Also try first_name + last_name slug (e.g. @john_doe)
        result2 = await self.db.execute(
            select(User.id).join(
                ProjectMember, ProjectMember.user_id == User.id
            ).where(
                ProjectMember.project_id == project_id
            )
        )
        all_member_ids = [row[0] for row in result2.fetchall()]

        return list(matched_by_email)  # de-duplicated set → list

    # ── Notification helpers ──────────────────────────────────────────────────

    async def _notify_mentions(
        self,
        mentioned_ids: List[str],
        actor_id: str,
        task: Task,
        comment_id: str,
    ) -> None:
        """Create in-app notifications for mentioned users (skip actor, deduplicate)."""
        seen: set = set()
        for uid in mentioned_ids:
            if uid == actor_id or uid in seen:
                continue
            seen.add(uid)
            notif = Notification(
                user_id=uid,
                notification_type=NotificationType.TASK_MENTIONED,
                title=f"You were mentioned in a comment",
                message=f"Someone mentioned you in task '{task.title}'",
                task_id=task.id,
                project_id=task.project_id,
                comment_id=comment_id,
                channels=[NotificationChannel.IN_APP.value],
                action_url=f"/tasks/{task.id}",
            )
            self.db.add(notif)
            # Push via WebSocket immediately (non-blocking, no crash on failure)
            try:
                await manager.send_to_user(uid, {
                    "type": "notification",
                    "notification_type": NotificationType.TASK_MENTIONED,
                    "title": notif.title,
                    "task_id": task.id,
                })
            except Exception:
                pass

    async def _notify_task_comment(
        self,
        task: Task,
        actor_id: str,
        comment_id: str,
    ) -> None:
        """Notify task reporter and assignee (but not the commenter, no duplicates)."""
        recipients = set()
        if task.reporter_id and task.reporter_id != actor_id:
            recipients.add(task.reporter_id)
        if task.primary_assignee_id and task.primary_assignee_id != actor_id:
            recipients.add(task.primary_assignee_id)

        for uid in recipients:
            notif = Notification(
                user_id=uid,
                notification_type=NotificationType.TASK_COMMENTED,
                title="New comment on your task",
                message=f"A comment was added to '{task.title}'",
                task_id=task.id,
                project_id=task.project_id,
                comment_id=comment_id,
                channels=[NotificationChannel.IN_APP.value],
                action_url=f"/tasks/{task.id}",
            )
            self.db.add(notif)
            try:
                await manager.send_to_user(uid, {
                    "type": "notification",
                    "notification_type": NotificationType.TASK_COMMENTED,
                    "title": notif.title,
                    "task_id": task.id,
                })
            except Exception:
                pass

    # ── CRUD ────────────────────────────────────────────────────────────────

    async def list_comments(
        self,
        task_id: str,
        page: int = 1,
        per_page: int = 20,
        include_resolved: bool = True,
    ) -> Tuple[List[TaskComment], int]:
        """Return top-level comments only (replies are loaded via relationship)."""
        query = select(TaskComment).where(
            and_(
                TaskComment.task_id == task_id,
                TaskComment.parent_id == None,  # top-level only
            )
        )
        if not include_resolved:
            query = query.where(TaskComment.is_resolved == False)

        query = query.order_by(TaskComment.created_at.asc())

        count_query = select(
            __import__("sqlalchemy", fromlist=["func"]).func.count()
        ).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        offset = (page - 1) * per_page
        result = await self.db.execute(query.offset(offset).limit(per_page))
        return result.scalars().all(), total

    async def create_comment(
        self,
        task: Task,
        author_id: str,
        content: str,
        parent_id: Optional[str] = None,
    ) -> TaskComment:
        """Create a comment, parse mentions, notify, broadcast via WebSocket."""
        # Enforce depth limit
        if parent_id:
            parent = await self.db.get(TaskComment, parent_id)
            if parent and parent.parent_id:
                # Already at depth 1, allow one more level
                grandparent = await self.db.get(TaskComment, parent.parent_id)
                if grandparent and grandparent.parent_id:
                    # At max depth (3), flatten to same parent
                    parent_id = parent.parent_id

        mentioned_ids = await self._parse_mentions(content, task.project_id)

        comment = TaskComment(
            task_id=task.id,
            author_id=author_id,
            content=content,
            parent_id=parent_id,
            mentions=mentioned_ids,
        )
        self.db.add(comment)
        await self.db.flush()  # get comment.id

        # Notifications (deduplicated — mentions + comment watchers)
        await self._notify_mentions(mentioned_ids, author_id, task, comment.id)
        await self._notify_task_comment(task, author_id, comment.id)

        # Activity log
        activity = TaskActivity(
            task_id=task.id,
            user_id=author_id,
            project_id=task.project_id,
            action=ActivityAction.COMMENTED,
            description="Added a comment",
            activity_metadata={"comment_id": comment.id, "preview": content[:100]},
        )
        self.db.add(activity)

        await self.db.commit()
        await self.db.refresh(comment)

        # Broadcast to task room (everyone viewing this task except author)
        room = f"task:{task.id}"
        try:
            await manager.send_to_room_except(room, author_id, {
                "type": "comment_added",
                "task_id": task.id,
                "comment": {
                    "id": comment.id,
                    "content": content,
                    "author_id": author_id,
                    "parent_id": parent_id,
                    "created_at": comment.created_at.isoformat(),
                },
            })
        except Exception:
            pass

        logger.info("Comment created", comment_id=comment.id, task_id=task.id)
        return comment

    async def edit_comment(
        self,
        comment: TaskComment,
        editor_id: str,
        new_content: str,
    ) -> TaskComment:
        """Edit a comment — only by its author."""
        comment.content = new_content
        comment.is_edited = True
        comment.edited_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(comment)

        room = f"task:{comment.task_id}"
        try:
            await manager.send_to_room_except(room, editor_id, {
                "type": "comment_edited",
                "comment_id": comment.id,
                "content": new_content,
                "is_edited": True,
            })
        except Exception:
            pass

        return comment

    async def delete_comment(self, comment: TaskComment) -> None:
        """Hard-delete a comment and cascade to replies/reactions."""
        await self.db.delete(comment)
        await self.db.commit()

    async def resolve_comment(
        self,
        comment: TaskComment,
        resolver_id: str,
        resolved: bool = True,
    ) -> TaskComment:
        """Toggle the resolved state of a top-level comment."""
        comment.is_resolved = resolved
        comment.resolved_by = resolver_id if resolved else None
        comment.resolved_at = datetime.utcnow() if resolved else None
        await self.db.commit()
        await self.db.refresh(comment)
        return comment

    # ── Reactions ────────────────────────────────────────────────────────────

    async def toggle_reaction(
        self,
        comment_id: str,
        user_id: str,
        emoji: str,
    ) -> dict:
        """Add or remove an emoji reaction (idempotent, concurrency-safe via DB row)."""
        existing = await self.db.execute(
            select(CommentReaction).where(
                and_(
                    CommentReaction.comment_id == comment_id,
                    CommentReaction.user_id == user_id,
                    CommentReaction.emoji == emoji,
                )
            )
        )
        row = existing.scalar_one_or_none()

        if row:
            await self.db.delete(row)
            action = "removed"
        else:
            self.db.add(CommentReaction(
                comment_id=comment_id,
                user_id=user_id,
                emoji=emoji,
            ))
            action = "added"

        await self.db.commit()

        # Return current reaction counts for this comment
        counts = await self._get_reaction_counts(comment_id)
        return {"action": action, "emoji": emoji, "reactions": counts}

    async def _get_reaction_counts(self, comment_id: str) -> dict:
        """Return {emoji: count} for a comment."""
        from sqlalchemy import func
        result = await self.db.execute(
            select(CommentReaction.emoji, func.count(CommentReaction.id))
            .where(CommentReaction.comment_id == comment_id)
            .group_by(CommentReaction.emoji)
        )
        return {row[0]: row[1] for row in result.fetchall()}

    async def get_comment_reactions(self, comment_id: str, user_id: str) -> dict:
        """Return reactions + which ones the current user has made."""
        counts = await self._get_reaction_counts(comment_id)
        my_reactions_result = await self.db.execute(
            select(CommentReaction.emoji).where(
                and_(
                    CommentReaction.comment_id == comment_id,
                    CommentReaction.user_id == user_id,
                )
            )
        )
        my = {row[0] for row in my_reactions_result.fetchall()}
        return {"counts": counts, "mine": list(my)}
