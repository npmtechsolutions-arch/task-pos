"""Email service with SMTP, retry, and EmailLog for audit/recovery."""

import os
from datetime import datetime, timedelta
from typing import Optional

from app.core.logging import get_logger
from app.models.communication import EmailLog, EmailStatus

logger = get_logger(__name__)

MAX_RETRIES = 3
RETRY_DELAY_MINUTES = [5, 30, 120]  # exponential-ish backoff


class EmailService:
    """Send transactional emails via SMTP with retry tracking in EmailLog."""

    def __init__(self, db=None):
        self.db = db
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_pass = os.getenv("SMTP_PASS", "")
        self.from_email = os.getenv("SMTP_FROM", "noreply@taskpos.app")
        self.enabled = bool(self.smtp_host and self.smtp_user)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        notification_type: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[str]:
        """Send an email, log it, retry on failure. Returns EmailLog ID."""
        log = EmailLog(
            to_email=to_email,
            subject=subject,
            body_html=html_body,
            notification_type=notification_type,
            related_user_id=user_id,
            status=EmailStatus.PENDING,
        )
        if self.db:
            self.db.add(log)
            await self.db.flush()

        if not self.enabled:
            logger.warning(
                "SMTP not configured — email skipped (set SMTP_HOST, SMTP_USER, SMTP_PASS)",
                to=to_email, subject=subject,
            )
            if self.db:
                log.status = EmailStatus.FAILED
                log.last_error = "SMTP not configured"
                await self.db.commit()
            return log.id if log.id else None

        try:
            import aiosmtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html"))

            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_pass,
                start_tls=True,
            )

            log.status = EmailStatus.SENT
            log.sent_at = datetime.utcnow()
            log.attempt_count += 1
            logger.info("Email sent", to=to_email, subject=subject)

        except Exception as exc:  # noqa: BLE001
            log.attempt_count += 1
            log.last_error = str(exc)[:500]
            logger.error("Email failed", to=to_email, error=str(exc))

            if log.attempt_count < MAX_RETRIES:
                delay = RETRY_DELAY_MINUTES[min(log.attempt_count - 1, len(RETRY_DELAY_MINUTES) - 1)]
                log.status = EmailStatus.RETRYING
                log.next_retry_at = datetime.utcnow() + timedelta(minutes=delay)
            else:
                log.status = EmailStatus.FAILED

        if self.db:
            await self.db.commit()

        return log.id if log.id else None

    async def send_mention_notification(
        self, to_email: str, actor_name: str, task_title: str, task_url: str, comment_preview: str
    ) -> None:
        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#4f46e5">You were mentioned in a comment</h2>
          <p><strong>{actor_name}</strong> mentioned you on task <em>{task_title}</em>:</p>
          <blockquote style="border-left:4px solid #4f46e5;padding-left:12px;color:#374151">
            {comment_preview}
          </blockquote>
          <a href="{task_url}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
            View Task
          </a>
        </div>
        """
        await self.send_email(
            to_email=to_email,
            subject=f"You were mentioned in \"{task_title}\"",
            html_body=html,
            notification_type="mention",
        )

    async def send_task_comment_notification(
        self, to_email: str, actor_name: str, task_title: str, task_url: str
    ) -> None:
        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#4f46e5">New Comment on Your Task</h2>
          <p><strong>{actor_name}</strong> commented on <em>{task_title}</em>.</p>
          <a href="{task_url}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
            View Comment
          </a>
        </div>
        """
        await self.send_email(
            to_email=to_email,
            subject=f"Comment on \"{task_title}\"",
            html_body=html,
            notification_type="task_comment",
        )
