import logging
from typing import Optional

from sqlalchemy.orm import Session
from . import models


logger = logging.getLogger(__name__)

class AuditLogger:
    @staticmethod
    def log_action(
        db: Session,
        user_id: int,
        action: str,
        reason: str,
        funcionario_id: Optional[int] = None,
        funcionario_name: Optional[str] = None,
        rut: Optional[str] = None,
    ):
        """
        Create an audit log entry.
        """
        try:
            audit = models.OfficialAudit(
                funcionario_id=funcionario_id,
                funcionario_name=funcionario_name,
                rut=rut,
                user_id=user_id,
                action=action,
                reason=reason
            )  # type: ignore[arg-type]
            db.add(audit)
            db.commit()
        except Exception:
            logger.exception("Error logging audit action '%s'", action)
            db.rollback()
