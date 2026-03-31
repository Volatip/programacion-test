from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from . import models


class PermissionChecker:
    @staticmethod
    def require_admin(user: models.User, detail: str = "Acceso denegado. Se requieren privilegios de administrador."):
        if user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail
            )
        return True

    @staticmethod
    def resolve_user_scope(user: models.User, requested_user_id: int | None = None) -> int | None:
        """
        By default every user, including admins, operates within their own scope.
        Admins may optionally scope requests to another user by sending an explicit user_id.
        """
        if user.role == "admin":
            return requested_user_id if requested_user_id is not None else user.id

        if requested_user_id is not None and requested_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permiso para operar sobre otro usuario."
            )

        return user.id

    @staticmethod
    def check_can_access_funcionario(user: models.User, funcionario_id: int, db: Session):
        """
        Check if the user can access a specific official.
        """
        if user.role == "admin":
            return True

        assignment = db.query(models.UserOfficial).filter(
            models.UserOfficial.user_id == user.id,
            models.UserOfficial.funcionario_id == funcionario_id
        ).first()

        if assignment:
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para acceder a este funcionario."
        )

    @staticmethod
    def check_can_edit_programming(user: models.User, funcionario_id: int, db: Session):
        """
        Check if the user has permission to edit the programming of a specific official.
        """
        try:
            return PermissionChecker.check_can_access_funcionario(user, funcionario_id, db)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permiso para editar la programación de este funcionario. Agréguelo a su lista primero."
            )

    @staticmethod
    def check_can_bind_funcionario(user: models.User, funcionario_id: int, db: Session):
        """
        Check if the user can bind a specific official to a user account.

        Non-admin users are restricted to their existing scope:
        - already assigned officials
        - hidden officials that previously belonged to their scope
        - other contracts that share the same RUT with an assigned official
        """
        funcionario = db.query(models.Funcionario).filter(models.Funcionario.id == funcionario_id).first()
        if not funcionario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Funcionario not found"
            )

        if user.role == "admin":
            return funcionario

        direct_assignment = db.query(models.UserOfficial).filter(
            models.UserOfficial.user_id == user.id,
            models.UserOfficial.funcionario_id == funcionario_id,
        ).first()
        if direct_assignment:
            return funcionario

        funcionario_rut = (funcionario.rut or "").strip()
        if funcionario_rut:
            scoped_assignment = db.query(models.UserOfficial).join(
                models.Funcionario,
                models.Funcionario.id == models.UserOfficial.funcionario_id,
            ).filter(
                models.UserOfficial.user_id == user.id,
                models.Funcionario.rut == funcionario_rut,
            ).first()
            if scoped_assignment:
                return funcionario

            hidden_assignment = db.query(models.UserHiddenOfficial).filter(
                models.UserHiddenOfficial.user_id == user.id,
                models.UserHiddenOfficial.funcionario_rut == funcionario_rut,
            ).first()
            if hidden_assignment:
                return funcionario

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para vincular este funcionario fuera de su ámbito autorizado."
        )

    @staticmethod
    def check_can_manage_group(user: models.User, group_id: int, db: Session):
        """
        Check if the user owns the group or is admin.
        """
        if user.role == "admin":
            return True

        group = db.query(models.Group).filter(models.Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )

        if group.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permiso para gestionar este grupo."
            )

        return True

    @staticmethod
    def check_can_manage_period(user: models.User):
        """
        Only admins can manage periods (create, close, delete).
        """
        if user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo los administradores pueden gestionar periodos."
            )
        return True

    @staticmethod
    def check_can_manage_users(user: models.User):
        return PermissionChecker.require_admin(user)
