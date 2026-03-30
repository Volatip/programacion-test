from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Union
from datetime import datetime

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
    
    class Config:
        from_attributes = True
