from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, HttpUrl, validator  # optional but very nice


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

    # Metadata you might want to add yourself
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: Optional[datetime] = None

    class Config:
        populate_by_name = True           # allow alias to work
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Example usage / instance
example_user = {
    "id": "44196397",
    "username": "elonmusk",
    "name": "Elon Musk",
    "created_at": "2009-05-29T05:15:37.000Z",
    "description": "X Æ A-12's dad",
    "location": "𝕏",
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
    user_model = UserX(**example_user, fetched_at=datetime.utcnow())
    print(user_model.model_dump_json(indent=2))
