from typing import List, Optional, Dict, Any
from models import UserX
from database import db

class ProfileManager:
    async def get_all_profiles(self) -> List[UserX]:
        cursor = db.profiles.find({})
        profiles = await cursor.to_list(length=100)
        return [UserX(**p) for p in profiles]

    async def search_by_tag(self, tag: str) -> List[UserX]:
        cursor = db.profiles.find({"tags": {"$regex": tag, "$options": "i"}})
        profiles = await cursor.to_list(length=100)
        return [UserX(**p) for p in profiles]

    async def get_profile_by_id(self, pid: str) -> Optional[UserX]:
        data = await db.profiles.find_one({"_id": pid})
        return UserX(**data) if data else None

    async def get_profile_by_username(self, username: str) -> Optional[UserX]:
        data = await db.profiles.find_one({"username": username})
        return UserX(**data) if data else None

    async def get_complete_profile(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve complete profile with structured prompt attributes.
        """
        profile = await self.get_profile_by_username(username)
        if not profile:
            return None

        # Extract key prompt attributes
        prompt_attributes = {
            "system_prompt": profile.system_prompt,
            "typing_style": profile.typing_style,
            "speech_style": profile.speech_style,
            "behavior_summary": profile.behavior_summary,
            "voice_id": profile.voice_id,
            "goals": [goal.description for goal in profile.conversational_goals] if profile.conversational_goals else []
        }

        return {
            "profile": profile,
            "prompt_attributes": prompt_attributes
        }

    async def get_all_tags(self) -> List[str]:
        pipeline = [
            {"$unwind": "$tags"},
            {"$group": {"_id": "$tags"}},
            {"$project": {"_id": 0, "tag": "$_id"}}
        ]
        cursor = db.profiles.aggregate(pipeline)
        tags = await cursor.to_list(length=1000)
        return [tag["tag"] for tag in tags]