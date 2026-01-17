from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, HttpUrl, validator  # optional but very nice
from enum import Enum


class UrlEntity(BaseModel):
    start: int
    end: int
    url: str
    expanded_url: str
    display_url: str


class Entities(BaseModel):
    url: Optional[Dict[str, List[UrlEntity]]] = None
    description: Optional[Dict[str, List[Any]]] = None  # hashtags, mentions, etc.


class PublicMetrics(BaseModel):
    followers_count: int
    following_count: int
    tweet_count: int
    listed_count: int


# Valid voice IDs for validation
VALID_VOICE_IDS = ["Ara", "Rex", "Sal", "Eve", "Leo"]


class UserX(BaseModel):
    # Core identifiers
    id: str = Field(..., alias="_id")           # store Twitter snowflake ID as string
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
    profile_banner_url: Optional[HttpUrl] = None   # not always present

    # Status & protection
    protected: bool = False
    verified: bool = False
    verified_type: Optional[str] = None          # "blue_verified", "government", etc.

    # Counts & popularity
    public_metrics: PublicMetrics

    # Rich entities (parsed urls, hashtags in bio)
    entities: Optional[Entities] = None

    # Less common / conditional fields
    pinned_tweet_id: Optional[str] = None
    withheld: Optional[Dict[str, Any]] = None    # country codes if withheld

    # Voice preference
    voice_id: Optional[str] = Field(default="Ara", description="Preferred voice ID for this user")

    # Metadata you might want to add yourself
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: Optional[datetime] = None

    @validator('voice_id')
    def validate_voice_id(cls, v):
        if v is None:
            return v
        if v not in VALID_VOICE_IDS:
            raise ValueError(f'Voice ID "{v}" is not valid. Must be one of: {VALID_VOICE_IDS}')
        return v

    class Config:
        populate_by_name = True           # allow alias to work
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class VoiceGender(str, Enum):
    FEMALE = "Female"
    MALE = "Male"
    NEUTRAL = "Neutral"


class Voice(BaseModel):
    voice_id: str = Field(..., description="Unique identifier for the voice")
    gender: VoiceGender = Field(..., description="Gender or type of the voice")
    tone_personality: str = Field(..., description="Descriptive text about the voice's tone and personality")
    recommended_use_case: str = Field(..., description="Recommended use cases for this voice")

    class Config:
        use_enum_values = True


# Example voice instances based on xAI voice API
VOICE_PRESETS = [
    Voice(
        voice_id="Ara",
        gender=VoiceGender.FEMALE,
        tone_personality="Warm, friendly, and balanced",
        recommended_use_case="Default; ideal for general assistance."
    ),
    Voice(
        voice_id="Rex",
        gender=VoiceGender.MALE,
        tone_personality="Confident, clear, and articulate",
        recommended_use_case="Professional apps, business, and finance."
    ),
    Voice(
        voice_id="Sal",
        gender=VoiceGender.NEUTRAL,
        tone_personality="Smooth, calm, and versatile",
        recommended_use_case="Unbiased information or balanced contexts."
    ),
    Voice(
        voice_id="Eve",
        gender=VoiceGender.FEMALE,
        tone_personality="Energetic, upbeat, and engaging",
        recommended_use_case="Interactive games or marketing experiences."
    ),
    Voice(
        voice_id="Leo",
        gender=VoiceGender.MALE,
        tone_personality="Authoritative, strong, and commanding",
        recommended_use_case="Instructional content or formal guidance."
    )
]


class VoicesResponse(BaseModel):
    voices: List[Voice] = Field(..., description="List of available voices")
    total_count: int = Field(..., description="Total number of voices available")


# Example usage / instance
example_user = {
    "id": "44196397",
    "username": "elonmusk",
    "name": "Elon Musk",
    "created_at": "2009-05-29T05:15:37.000Z",
    "description": "X Æ A-12's dad",
    "location": "𝕏",
    "voice_id": "Rex",  # Authoritative voice for business/professional use
    "public_metrics": {
        "followers_count": 200000000,
        "following_count": 500,
        "tweet_count": 35000,
        "listed_count": 250000
    },
    "verified": True,
    "verified_type": "blue_verified",
    "profile_image_url": "https://pbs.twimg.com/profile_images/.../profile.jpg",
}

# Validate / convert
if __name__ == "__main__":
    # Test user model
    user_model = UserX(**example_user, fetched_at=datetime.utcnow())
    print("User Model with Voice:")
    print(f"Voice ID: {user_model.voice_id}")
    print(user_model.model_dump_json(indent=2))

    # Test voice validation
    print("\n" + "="*30 + " Voice Validation " + "="*30)
    try:
        # Test valid voice
        test_user_valid = UserX(
            id="123",
            username="testuser",
            name="Test User",
            created_at=datetime.utcnow(),
            voice_id="Eve",  # Valid voice
            public_metrics=PublicMetrics(followers_count=0, following_count=0, tweet_count=0, listed_count=0)
        )
        print(f"✅ Valid voice 'Eve': {test_user_valid.voice_id}")

        # Test invalid voice
        try:
            test_user_invalid = UserX(
                id="123",
                username="testuser",
                name="Test User",
                created_at=datetime.utcnow(),
                voice_id="InvalidVoice",  # Invalid voice
                public_metrics=PublicMetrics(followers_count=0, following_count=0, tweet_count=0, listed_count=0)
            )
        except ValueError as e:
            print(f"❌ Invalid voice rejected: {e}")

    except Exception as e:
        print(f"Error testing voice validation: {e}")

    print("\n" + "="*50 + "\n")

    # Test voice models
    print("Voice Models:")
    for voice in VOICE_PRESETS:
        print(f"Voice ID: {voice.voice_id}")
        print(f"Gender: {voice.gender}")
        print(f"Tone & Personality: {voice.tone_personality}")
        print(f"Recommended Use Case: {voice.recommended_use_case}")
        print("-" * 30)

    # Test voices response
    voices_response = VoicesResponse(voices=VOICE_PRESETS, total_count=len(VOICE_PRESETS))
    print("\nVoices Response:")
    print(voices_response.model_dump_json(indent=2))