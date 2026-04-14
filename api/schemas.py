from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Union
from datetime import date, datetime

DISMISS_REASON_SYSTEM_KEY_PATTERN = r"^(comision-servicio)$"
DISMISS_SUBOPTION_SYSTEM_KEY_PATTERN = r"^(total|parcial)$"

# ==========================================
# Config & Catalogs
# ==========================================

class ConfigBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class ConfigCreate(ConfigBase):
    pass

class ConfigResponse(ConfigBase):
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ContextualHelpSectionBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)


class ContextualHelpSectionCreate(ContextualHelpSectionBase):
    pass


class ContextualHelpSectionResponse(ContextualHelpSectionBase):
    id: int
    position: int

    class Config:
        from_attributes = True


class ContextualHelpPageUpsert(BaseModel):
    page_name: str = Field(min_length=1, max_length=200)
    description: str = ""
    sections: List[ContextualHelpSectionCreate] = []


class ContextualHelpPageResponse(BaseModel):
    id: int
    slug: str
    page_name: str
    description: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by_id: Optional[int] = None
    updated_by_name: Optional[str] = None
    sections: List[ContextualHelpSectionResponse] = []

    class Config:
        from_attributes = True


class DismissReasonSuboptionBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    sort_order: int = 0


class DismissReasonSuboptionCreate(DismissReasonSuboptionBase):
    system_key: Optional[str] = Field(default=None, pattern=DISMISS_SUBOPTION_SYSTEM_KEY_PATTERN)


class DismissReasonSuboptionUpdate(BaseModel):
    system_key: Optional[str] = Field(default=None, pattern=DISMISS_SUBOPTION_SYSTEM_KEY_PATTERN)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    sort_order: Optional[int] = None


class DismissReasonSuboptionResponse(DismissReasonSuboptionBase):
    id: int
    system_key: Optional[str] = None

    class Config:
        from_attributes = True


class DismissReasonBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    action_type: str = Field(pattern="^(dismiss|hide)$")
    reason_category: str = Field(pattern="^(resignation|mobility|other)$")
    sort_order: int = 0
    is_active: bool = True
    requires_start_date: bool = False


class DismissReasonCreate(DismissReasonBase):
    system_key: Optional[str] = Field(default=None, pattern=DISMISS_REASON_SYSTEM_KEY_PATTERN)
    suboptions: List[DismissReasonSuboptionCreate] = []


class DismissReasonUpdate(BaseModel):
    system_key: Optional[str] = Field(default=None, pattern=DISMISS_REASON_SYSTEM_KEY_PATTERN)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    action_type: Optional[str] = Field(default=None, pattern="^(dismiss|hide)$")
    reason_category: Optional[str] = Field(default=None, pattern="^(resignation|mobility|other)$")
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    requires_start_date: Optional[bool] = None


class DismissReasonResponse(DismissReasonBase):
    id: int
    system_key: Optional[str] = None
    suboptions: List[DismissReasonSuboptionResponse] = []

    class Config:
        from_attributes = True


class DismissSelectionRequest(BaseModel):
    reason_id: Optional[int] = None
    reason: Optional[str] = None
    suboption_id: Optional[int] = None
    suboption: Optional[str] = None
    partial_hours: Optional[int] = Field(default=None, ge=1)
    start_date: Optional[date] = None
    user_id: Optional[int] = None

class SpecialtyStatResponse(BaseModel):
    new_consult_percentage: float
    yield_new: float
    yield_control: float
    
    class Config:
        from_attributes = True

class SpecialtyResponse(BaseModel):
    id: int
    name: str
    visible: str
    stats: Optional[SpecialtyStatResponse] = None
    
    class Config:
        from_attributes = True

class ProcessResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True

class ActivityTypeResponse(BaseModel):
    id: int
    name: str
    process: Optional[str] = None
    profession: Optional[str] = None
    specialty: Optional[str] = None
    visible: str
    prais: Optional[str] = None
    req_rendimiento: str
    order_index: int
    
    class Config:
        from_attributes = True

class PerformanceUnitResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True

# ==========================================
# Groups
# ==========================================

class GroupBase(BaseModel):
    name: str
    user_id: Optional[int] = None
    period_id: Optional[int] = None

class GroupCreate(GroupBase):
    pass

class GroupUpdate(BaseModel):
    name: Optional[str] = None

class GroupResponse(GroupBase):
    id: int
    created_at: datetime
    count: Optional[int] = 0
    
    class Config:
        from_attributes = True

# ==========================================
# Periods
# ==========================================

class ProgrammingPeriodBase(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    status: Optional[str] = "ANTIGUO"
    is_active: Optional[bool] = False

class ProgrammingPeriodCreate(ProgrammingPeriodBase):
    pass

class ProgrammingPeriodUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

class ProgrammingPeriodResponse(ProgrammingPeriodBase):
    id: int
    is_closed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class PeriodBaseDuplicationRequest(BaseModel):
    destination_period_id: int


class PeriodBaseDuplicationResponse(BaseModel):
    message: str
    source_period_id: int
    destination_period_id: int
    funcionarios: int
    groups: int
    user_officials: int
    programmings: int
    programming_items: int
    specialties: int
    specialty_stats: int
    processes: int
    activity_types: int
    performance_units: int

# ==========================================
# Users & Auth
# ==========================================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    rut: str
    role: str = "user"
    status: str = "activo"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    rut: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None

class UserLogin(BaseModel):
    rut: str
    password: str

class UserResponse(UserBase):
    id: int
    last_access: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserSummary(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None
    user: UserResponse

class TokenRefresh(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

class TokenData(BaseModel):
    rut: Optional[str] = None


class SessionAuditEventResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_rut: Optional[str] = None
    event_type: str
    success: bool
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    failure_reason: Optional[str] = None
    request_path: Optional[str] = None
    occurred_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ==========================================
# Funcionarios (Consolidated)
# ==========================================

class ContractDetail(BaseModel):
    id: int
    law_code: Optional[str] = None
    hours: Optional[int] = None
    contract_correlative: Optional[int] = None
    observations: Optional[str] = None

class FuncionarioConsolidated(BaseModel):
    id: int
    name: str
    rut: Optional[str] = None
    dv: Optional[str] = None
    title: str
    specialty_sis: Optional[str] = None
    law_code: str # Consolidated string
    hours_per_week: str # Consolidated string
    lunch_time_minutes: int
    status: str
    inactive_reason: Optional[str] = None
    termination_date: Optional[datetime] = None
    active_status_label: Optional[str] = None
    has_future_dismiss_scheduled: bool = False
    future_dismiss_start_date: Optional[datetime] = None
    observations: str
    
    holiday_days: int
    administrative_days: int
    congress_days: int
    breastfeeding_time: int
    
    created_at: Optional[datetime] = None
    
    is_scheduled: bool
    programming_id: Optional[int] = None
    programming_updated_at: Optional[datetime] = None
    total_scheduled_hours: float
    group_id: Optional[int] = None
    
    contracts: List[ContractDetail] = []
    
    class Config:
        from_attributes = True


class GeneralOfficialRow(BaseModel):
    funcionario_id: int
    funcionario: str
    title: str
    rut: str
    dv: Optional[str] = None
    law_code: str
    specialty_sis: str
    hours_per_week: str
    lunch_time_minutes: int = 0
    status: str
    user_id: Optional[int] = None
    user_ids: list[int] = []
    user_name: str
    is_scheduled: bool
    programmed_label: str
    contracts: list[ContractDetail] = []
    review_status: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_name: Optional[str] = None

    class Config:
        from_attributes = True

# ==========================================
# Programming
# ==========================================

class ProgrammingItemBase(BaseModel):
    activity_name: str
    activity_type_id: Optional[int] = None
    description: Optional[str] = None
    subtitle: Optional[str] = None
    specialty: Optional[str] = None
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    assigned_hours: float = 0.0
    performance: float = 0.0

class ProgrammingItemCreate(ProgrammingItemBase):
    pass

class ProgrammingItemUpdate(BaseModel):
    activity_name: Optional[str] = None
    activity_type_id: Optional[int] = None
    assigned_hours: Optional[float] = None
    performance: Optional[float] = None
    specialty: Optional[str] = None

class ProgrammingItemResponse(ProgrammingItemBase):
    id: int
    programming_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProgrammingBase(BaseModel):
    funcionario_id: int
    period_id: int
    version: int = 1
    status: str = "borrador"
    observation: Optional[str] = None
    assigned_group_id: Optional[int] = None
    assigned_status: Optional[str] = None
    prais: bool = False
    global_specialty: Optional[str] = None
    selected_process: Optional[str] = None
    selected_performance_unit: Optional[str] = None
    time_unit: str = "hours"
    dismiss_reason_id: Optional[int] = None
    dismiss_suboption_id: Optional[int] = None
    dismiss_partial_hours: Optional[int] = Field(default=None, ge=1)

class ProgrammingCreate(ProgrammingBase):
    items: List[ProgrammingItemCreate] = []

class ProgrammingUpdate(BaseModel):
    version: Optional[int] = Field(default=None, ge=1)
    status: Optional[str] = None
    observation: Optional[str] = None
    assigned_group_id: Optional[int] = None
    assigned_status: Optional[str] = None
    prais: Optional[bool] = None
    global_specialty: Optional[str] = None
    selected_process: Optional[str] = None
    selected_performance_unit: Optional[str] = None
    time_unit: Optional[str] = None
    dismiss_reason_id: Optional[int] = None
    dismiss_suboption_id: Optional[int] = None
    dismiss_partial_hours: Optional[int] = Field(default=None, ge=1)
    items: Optional[List[ProgrammingItemCreate]] = None

class ProgrammingResponse(ProgrammingBase):
    id: int
    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[ProgrammingItemResponse] = []
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    review_status: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_id: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    review_comment: Optional[str] = None
    
    class Config:
        from_attributes = True


class ProgrammingReviewRequest(BaseModel):
    action: str = Field(pattern="^(validated|fix_required)$")
    comment: Optional[str] = None


class ProgrammingReviewEventResponse(BaseModel):
    id: int
    programming_id: int
    action: str
    comment: Optional[str] = None
    reviewed_by_id: int
    reviewed_by_name: Optional[str] = None
    reviewed_at: datetime
    email_status: Optional[str] = None
    email_error: Optional[str] = None

    class Config:
        from_attributes = True


class ProgrammingReviewEmailResult(BaseModel):
    attempted: bool
    status: str
    detail: Optional[str] = None


class ProgrammingReviewResponse(BaseModel):
    programming_id: int
    review_status: str
    reviewed_at: datetime
    reviewed_by: UserSummary
    review_comment: Optional[str] = None
    notifications_created: int = 0
    email: ProgrammingReviewEmailResult


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    link: Optional[str] = None
    payload_json: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationSummaryResponse(BaseModel):
    unread_count: int


class NotificationReadRequest(BaseModel):
    ids: Optional[list[int]] = None
    all: bool = False


class NotificationReadResponse(BaseModel):
    updated: int


class SmtpSettingsResponse(BaseModel):
    host: str = ""
    port: int = 0
    username: str = ""
    from_email: str = ""
    from_name: str = ""
    use_tls: bool = True
    use_ssl: bool = False
    password_configured: bool = False
    review_fix_required_subject: str = ""
    review_fix_required_body: str = ""


class SmtpSettingsUpdate(BaseModel):
    host: str = Field(min_length=1)
    port: int = Field(ge=1, le=65535)
    username: str = ""
    password: Optional[str] = None
    from_email: EmailStr
    from_name: str = Field(min_length=1)
    use_tls: bool = True
    use_ssl: bool = False
    review_fix_required_subject: str = Field(min_length=1)
    review_fix_required_body: str = Field(min_length=1)


class SmtpTestEmailRequest(BaseModel):
    recipient: EmailStr


class SmtpTestEmailResponse(BaseModel):
    recipient: EmailStr
    message: str


class RRHHDeletionBatchOption(BaseModel):
    created_at: datetime
    funcionario_count: int
    tracked_activity_count: int = 0
    file_names: list[str] = Field(default_factory=list)


class RRHHDeletionBatchListResponse(BaseModel):
    batches: list[RRHHDeletionBatchOption]
