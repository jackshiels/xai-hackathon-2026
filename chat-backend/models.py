from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId

class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

class XAIUserProfile(BaseModel):
    """Schema for X AI user profile"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    xai_user_id: str = Field(..., description="X AI platform user ID")
    username: Optional[str] = Field(None, description="X (Twitter) username")
    email: Optional[EmailStr] = Field(None, description="User email address")
    display_name: Optional[str] = Field(None, description="Display name")
    profile_image_url: Optional[str] = Field(None, description="Profile image URL")
    
    # Voice preferences
    preferred_voice: Optional[str] = Field("Ara", description="Preferred Grok voice (e.g., 'Ara', 'Jarvis')")
    voice_settings: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Custom voice settings")
    
    # Session preferences
    session_instructions: Optional[str] = Field(None, description="Custom session instructions for the AI")
    conversation_history_enabled: Optional[bool] = Field(True, description="Whether to store conversation history")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Profile creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    last_active: Optional[datetime] = Field(None, description="Last active timestamp")
    
    # Additional profile data
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict, description="User preferences")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}
        schema_extra = {
            "example": {
                "xai_user_id": "xai_user_12345",
                "username": "johndoe",
                "email": "john@example.com",
                "display_name": "John Doe",
                "profile_image_url": "https://example.com/avatar.jpg",
                "preferred_voice": "Ara",
                "voice_settings": {
                    "speed": 1.0,
                    "pitch": 1.0
                },
                "session_instructions": "You are a helpful assistant.",
                "conversation_history_enabled": True,
                "preferences": {
                    "language": "en",
                    "timezone": "UTC"
                }
            }
        }

class XAIUserProfileCreate(BaseModel):
    """Schema for creating a new X AI user profile"""
    xai_user_id: str
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    preferred_voice: Optional[str] = "Ara"
    voice_settings: Optional[Dict[str, Any]] = None
    session_instructions: Optional[str] = None
    conversation_history_enabled: Optional[bool] = True
    preferences: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

class XAIUserProfileUpdate(BaseModel):
    """Schema for updating an X AI user profile"""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    preferred_voice: Optional[str] = None
    voice_settings: Optional[Dict[str, Any]] = None
    session_instructions: Optional[str] = None
    conversation_history_enabled: Optional[bool] = None
    last_active: Optional[datetime] = None
    preferences: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
