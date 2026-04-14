from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class ProgrammingPeriod(Base):
    __tablename__ = "programming_periods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(String, default="ANTIGUO") # ANTIGUO, ACTIVO, OCULTO
    is_active = Column(Boolean, default=False) # Deprecated, kept for DB compatibility if needed, but logic should move to status
    is_closed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    rut = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, default="user") # admin, medical_coordinator, non_medical_coordinator, user
    status = Column(String, default="activo") # activo, inactivo
    last_access = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    review_events = relationship("ProgrammingReviewEvent", foreign_keys="ProgrammingReviewEvent.reviewed_by_id", back_populates="reviewed_by")
    notifications = relationship("UserNotification", back_populates="user", cascade="all, delete-orphan")

class Funcionario(Base):
    __tablename__ = "funcionarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    law_code = Column(String, nullable=True)
    specialty_sis = Column(String, index=True, nullable=True)
    hours_per_week = Column(Integer, default=44)
    rut = Column(String, index=True, nullable=True)
    dv = Column(String, nullable=True)
    contract_id = Column(String, nullable=True)
    contract_correlative = Column(Integer, nullable=True) # Nuevo campo Correlativo Contrato
    establishment_id = Column(Integer, nullable=True)
    effective_hours = Column(Float, default=0.0)
    shift_system = Column(String, nullable=True)
    observations = Column(Text, nullable=True)
    holiday_days = Column(Integer, default=0)
    administrative_days = Column(Integer, default=0)
    congress_days = Column(Integer, default=0)
    breastfeeding_time = Column(Integer, default=0)
    lunch_time_minutes = Column(Integer, default=0)
    contract_start_date = Column(DateTime, nullable=True)
    contract_end_date = Column(DateTime, nullable=True)
    status = Column(String, index=True, default="activo") # activo, licencia, inactivo
    dismiss_start_date = Column(DateTime, nullable=True)
    is_active_roster = Column(Boolean, default=False, index=True)
    latency_hours = Column(Integer, default=0)
    break_minutes = Column(Integer, default=30)
    unscheduled_count = Column(Integer, default=0)
    rrhh_date = Column(DateTime(timezone=True), nullable=True)
    raw_data = Column(Text, nullable=True) # Stores all Excel columns as JSON string
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    period = relationship("ProgrammingPeriod")

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String, index=True, nullable=False)
    description = Column(String, nullable=False)
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User")

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    period = relationship("ProgrammingPeriod")

class UserOfficial(Base):
    __tablename__ = "user_officials"
    __table_args__ = (
        UniqueConstraint("user_id", "funcionario_id", name="uq_user_officials_user_funcionario"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    funcionario_id = Column(Integer, ForeignKey("funcionarios.id"), index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    funcionario = relationship("Funcionario")
    group = relationship("Group")

class Specialty(Base):
    __tablename__ = "specialties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    visible = Column(String, default="SI", index=True)
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stats = relationship("SpecialtyStat", back_populates="specialty", uselist=False)
    period = relationship("ProgrammingPeriod")

class SpecialtyStat(Base):
    __tablename__ = "specialty_stats"

    id = Column(Integer, primary_key=True, index=True)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), unique=True)
    new_consult_percentage = Column(Float, default=0.0)
    yield_new = Column(Float, default=0.0)
    yield_control = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    specialty = relationship("Specialty", back_populates="stats")

class Process(Base):
    __tablename__ = "processes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    period = relationship("ProgrammingPeriod")

class ActivityType(Base):
    __tablename__ = "activity_types"

    id = Column(Integer, primary_key=True, index=True)
    
    # New structure fields
    process = Column(String, index=True, nullable=True) # "Proceso"
    profession = Column(String, index=True, nullable=True) # "Profesión"
    specialty = Column(String, index=True, nullable=True) # "Especialidad"
    name = Column(String, index=True, nullable=False) # "Actividad Visible" (Mapped from 'Actividad Visible')
    visible = Column(String, index=True, default="SI") # "Visible"
    prais = Column(String, nullable=True) # "PRAIS"
    req_rendimiento = Column(String(2), default="NO", nullable=False) # "REQ RENDIMIENTO"
    order_index = Column(Integer, default=0) # "ORDEN"
    
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    period = relationship("ProgrammingPeriod")

# AssignmentStatus model removed

class PerformanceUnit(Base):
    __tablename__ = "performance_units"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    period = relationship("ProgrammingPeriod")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    funcionario_id = Column(Integer, ForeignKey("funcionarios.id"))
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    activity_type = Column(String, nullable=False)
    assigned_hours = Column(Float, default=0.0)
    performance = Column(Float, default=0.0)
    status = Column(String, default="programado") # programado, completado, cancelado
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    funcionario = relationship("Funcionario")

class Programming(Base):
    __tablename__ = "programmings"
    __table_args__ = (
        UniqueConstraint("funcionario_id", "period_id", name="uq_programmings_funcionario_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    funcionario_id = Column(Integer, ForeignKey("funcionarios.id"), nullable=False)
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=False)
    
    # Metadata
    version = Column(Integer, default=1, nullable=False)
    status = Column(String, default="borrador") # borrador, revision, publicado
    observation = Column(Text, nullable=True)
    
    # Extended Fields
    assigned_group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    assigned_status = Column(String, nullable=True)
    prais = Column(Boolean, default=False)
    
    # Configuration Fields
    global_specialty = Column(String, nullable=True)
    selected_process = Column(String, nullable=True)
    selected_performance_unit = Column(String, nullable=True)
    time_unit = Column(String, default="hours") # hours, minutes
    dismiss_reason_id = Column(Integer, nullable=True, index=True)
    dismiss_suboption_id = Column(Integer, nullable=True, index=True)
    dismiss_partial_hours = Column(Integer, nullable=True)
    dismiss_start_date = Column(DateTime, nullable=True)
    review_status = Column(String, nullable=True, index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True, index=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_comment = Column(Text, nullable=True)

    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    funcionario = relationship("Funcionario")
    period = relationship("ProgrammingPeriod")
    group = relationship("Group")
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    items = relationship("ProgrammingItem", back_populates="programming", cascade="all, delete-orphan")
    review_events = relationship("ProgrammingReviewEvent", back_populates="programming", cascade="all, delete-orphan", order_by="ProgrammingReviewEvent.reviewed_at.desc()")

    @property
    def created_by_name(self):
        return self.created_by.name if self.created_by else None

    @property
    def updated_by_name(self):
        return self.updated_by.name if self.updated_by else None

    @property
    def reviewed_by_name(self):
        return self.reviewed_by.name if self.reviewed_by else None


class ProgrammingReviewEvent(Base):
    __tablename__ = "programming_review_events"

    id = Column(Integer, primary_key=True, index=True)
    programming_id = Column(Integer, ForeignKey("programmings.id"), nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    comment = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    email_status = Column(String, nullable=True)
    email_error = Column(Text, nullable=True)

    programming = relationship("Programming", back_populates="review_events")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id], back_populates="review_events")

    @property
    def reviewed_by_name(self):
        return self.reviewed_by.name if self.reviewed_by else None


class UserNotification(Base):
    __tablename__ = "user_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String, nullable=True)
    payload_json = Column(Text, nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    user = relationship("User", back_populates="notifications")

class ProgrammingItem(Base):
    __tablename__ = "programming_items"

    id = Column(Integer, primary_key=True, index=True)
    programming_id = Column(Integer, ForeignKey("programmings.id"), nullable=False)
    
    activity_type_id = Column(Integer, ForeignKey("activity_types.id"), nullable=True) # Optional link to catalog
    activity_name = Column(String, nullable=False) # Store name directly for flexibility
    
    description = Column(String, nullable=True)
    subtitle = Column(String, nullable=True) # e.g. "Policlínico" -> "Cardiología"
    specialty = Column(String, nullable=True) # Specific specialty for this item
    
    # Time info
    day_of_week = Column(Integer, nullable=True) # 0=Monday, 6=Sunday
    start_time = Column(String, nullable=True) # "08:00"
    end_time = Column(String, nullable=True) # "12:00"
    
    assigned_hours = Column(Float, default=0.0)
    performance = Column(Float, default=0.0) # Rendimiento
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    programming = relationship("Programming", back_populates="items")
    activity_type = relationship("ActivityType")

class UserHiddenOfficial(Base):
    __tablename__ = "user_hidden_officials"
    __table_args__ = (
        UniqueConstraint("user_id", "funcionario_rut", "period_id", name="uq_user_hidden_officials_user_rut_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    funcionario_rut = Column(String, index=True, nullable=False)
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=True, index=True)
    reason = Column(String, nullable=True)
    suboption = Column(String, nullable=True)
    dismiss_reason_id = Column(Integer, nullable=True, index=True)
    dismiss_suboption_id = Column(Integer, nullable=True, index=True)
    dismiss_partial_hours = Column(Integer, nullable=True)
    dismiss_start_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    period = relationship("ProgrammingPeriod")

class OfficialAudit(Base):
    __tablename__ = "official_audits"

    id = Column(Integer, primary_key=True, index=True)
    funcionario_id = Column(Integer, nullable=True) # Can be null if deleted
    funcionario_name = Column(String, nullable=True) # Store name for deleted records
    rut = Column(String, nullable=True)
    period_id = Column(Integer, ForeignKey("programming_periods.id"), nullable=True, index=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False) # "Dismiss" or "Delete"
    reason = Column(String, nullable=False) # "Renuncia", "Cambio de servicio", "Agregado por Error"
    suboption = Column(String, nullable=True)
    dismiss_reason_id = Column(Integer, nullable=True, index=True)
    dismiss_suboption_id = Column(Integer, nullable=True, index=True)
    reason_category = Column(String, nullable=True)
    dismiss_partial_hours = Column(Integer, nullable=True)
    dismiss_start_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")
    period = relationship("ProgrammingPeriod")


class DismissReason(Base):
    __tablename__ = "dismiss_reasons"
    __table_args__ = (
        UniqueConstraint("name", name="uq_dismiss_reasons_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    system_key = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    action_type = Column(String, nullable=False, default="dismiss")
    reason_category = Column(String, nullable=False, default="other")
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    requires_start_date = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    suboptions = relationship(
        "DismissReasonSuboption",
        back_populates="reason",
        cascade="all, delete-orphan",
        order_by="DismissReasonSuboption.sort_order",
    )


class DismissReasonSuboption(Base):
    __tablename__ = "dismiss_reason_suboptions"
    __table_args__ = (
        UniqueConstraint("reason_id", "name", name="uq_dismiss_reason_suboptions_reason_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    reason_id = Column(Integer, ForeignKey("dismiss_reasons.id"), nullable=False, index=True)
    system_key = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    reason = relationship("DismissReason", back_populates="suboptions")

class Config(Base):
    __tablename__ = "configs"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ContextualHelpPage(Base):
    __tablename__ = "contextual_help_pages"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    page_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    updated_by = relationship("User")
    sections = relationship(
        "ContextualHelpSection",
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="ContextualHelpSection.position",
    )

    @property
    def updated_by_name(self):
        return self.updated_by.name if self.updated_by else None


class ContextualHelpSection(Base):
    __tablename__ = "contextual_help_sections"
    __table_args__ = (
        UniqueConstraint("page_id", "position", name="uq_contextual_help_sections_page_position"),
    )

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(Integer, ForeignKey("contextual_help_pages.id"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=1)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    page = relationship("ContextualHelpPage", back_populates="sections")

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    token = Column(String, unique=True, index=True, nullable=True)
    revoked_at = Column(DateTime(timezone=True), server_default=func.now())


class SessionAuditEvent(Base):
    __tablename__ = "session_audit_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_rut = Column(String, nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    success = Column(Boolean, nullable=False, default=True, index=True)
    ip_address = Column(String(45), nullable=True, index=True)
    user_agent = Column(String(512), nullable=True)
    session_jti_hash = Column(String(64), nullable=True, index=True)
    failure_reason = Column(String(255), nullable=True)
    request_path = Column(String(255), nullable=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User")
