from sqlalchemy.orm import Session
from . import models

class AuditLogger:
    @staticmethod
    def log_action(db: Session, user_id: int, action: str, reason: str, funcionario_id: int = None, funcionario_name: str = None, rut: str = None):
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
            )
            db.add(audit)
            db.commit()
        except Exception as e:
            print(f"Error logging audit action '{action}': {e}")
            db.rollback()
