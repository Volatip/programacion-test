from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

class UserOfficial(Base):
    __tablename__ = "user_officials"

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
    items = relationship("ProgrammingItem", back_populates="programming", cascade="all, delete-orphan")

    @property
    def created_by_name(self):
        return self.created_by.name if self.created_by else None

    @property
    def updated_by_name(self):
        return self.updated_by.name if self.updated_by else None

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

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    funcionario_rut = Column(String, index=True, nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

class OfficialAudit(Base):
    __tablename__ = "official_audits"

    id = Column(Integer, primary_key=True, index=True)
    funcionario_id = Column(Integer, nullable=True) # Can be null if deleted
    funcionario_name = Column(String, nullable=True) # Store name for deleted records
    rut = Column(String, nullable=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False) # "Dismiss" or "Delete"
    reason = Column(String, nullable=False) # "Renuncia", "Cambio de servicio", "Agregado por Error"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")

class Config(Base):
    __tablename__ = "configs"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    revoked_at = Column(DateTime(timezone=True), server_default=func.now())
