from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, HttpUrl, field_validator
from enum import Enum
import uuid

# --- 1. CORE X SCHEMA (Provided by you) ---

class UrlEntity(BaseModel):
    start: int
    end: int
    url: str
    expanded_url: str
    display_url: str

class Entities(BaseModel):
    url: Optional[Dict[str, List[UrlEntity]]] = None
    description: Optional[Dict[str, List[Any]]] = None

class PublicMetrics(BaseModel):
    followers_count: int
    following_count: int
    tweet_count: int
    listed_count: int

VALID_VOICE_IDS = ["Ara", "Rex", "Sal", "Eve", "Leo"]

class UserX(BaseModel):
    # Core identifiers
    id: str = Field(..., alias="_id")
    username: str
    name: str

    # Timestamps
    created_at: datetime

    # Text fields
    description: Optional[str] = None
    location: Optional[str] = None
    url: Optional[HttpUrl] = None

    # Profile assets
    profile_image_url: Optional[HttpUrl] = None
    profile_banner_url: Optional[HttpUrl] = None

    # Status & protection
    protected: bool = False
    verified: bool = False
    verified_type: Optional[str] = None

    # Counts & popularity
    public_metrics: PublicMetrics

    # Rich entities
    entities: Optional[Entities] = None

    # Less common / conditional fields
    pinned_tweet_id: Optional[str] = None
    withheld: Optional[Dict[str, Any]] = None

    # Voice preference
    voice_id: Optional[str] = Field(default="Ara", description="Preferred voice ID for this user")

    # Conversational goals
    conversational_goals: List["ConversationalGoal"] = Field(default_factory=list, description="Initial conversational goals for this persona")

    # Tags
    tags: List[str] = Field(default_factory=list, description="User tags for categorization and filtering")

    # --- ADDED FOR BUSINESS LOGIC ---
    # We need to store the "Soul" of the clone (the LLM instructions)
    system_prompt: Optional[str] = Field(default=None, description="The LLM-generated persona instructions")

    # Style analysis
    typing_style: Optional[str] = Field(default=None, description="Analysis of user's typing style (punctuation, sentence structure, etc.)")
    speech_style: Optional[str] = Field(default=None, description="Analysis of user's speech style (tone, vocabulary, pacing)")
    behavior_summary: Optional[str] = Field(default=None, description="Summary of user's behavioral patterns and interaction style")

    # Metadata
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: Optional[datetime] = None

    @field_validator('voice_id')
    @classmethod
    def validate_voice_id(cls, v):
        if v is None: return v
        if v not in VALID_VOICE_IDS:
            raise ValueError(f'Voice ID "{v}" is not valid. Must be one of: {VALID_VOICE_IDS}')
        return v

    class Config:
        populate_by_name = True
        json_encoders = { datetime: lambda v: v.isoformat() }

# --- 2. VOICE ENUMS & MODELS (Provided by you) ---

class VoiceGender(str, Enum):
    FEMALE = "Female"
    MALE = "Male"
    NEUTRAL = "Neutral"

class Voice(BaseModel):
    voice_id: str
    gender: VoiceGender
    tone_personality: str
    recommended_use_case: str
    
    class Config:
        use_enum_values = True

# --- 3. APP LOGIC MODELS (Preserved for functionality) ---

class ConversationalGoal(BaseModel):
    description: str
    status: str = "pending"

class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # The X user ID we are talking to
    goals: List[ConversationalGoal] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)