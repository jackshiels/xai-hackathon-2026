from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from database import get_database
from models import XAIUserProfile, XAIUserProfileCreate, XAIUserProfileUpdate

class UserProfileService:
    """Service for managing X AI user profiles"""
    
    def __init__(self):
        self.collection_name = "user_profiles"
    
    def _get_collection(self):
        """Get the user profiles collection"""
        db = get_database()
        if db is None:
            raise Exception("Database not initialized")
        return db[self.collection_name]
    
    async def create_profile(self, profile_data: XAIUserProfileCreate) -> XAIUserProfile:
        """Create a new user profile"""
        collection = self._get_collection()
        
        # Check if profile already exists
        existing = await collection.find_one({"xai_user_id": profile_data.xai_user_id})
        if existing:
            raise ValueError(f"Profile already exists for xai_user_id: {profile_data.xai_user_id}")
        
        # Convert to dict and add timestamps
        profile_dict = profile_data.model_dump(exclude_none=True)
        profile_dict["created_at"] = datetime.utcnow()
        profile_dict["updated_at"] = datetime.utcnow()
        
        # Insert into database
        result = await collection.insert_one(profile_dict)
        
        # Fetch and return the created profile
        created_profile = await collection.find_one({"_id": result.inserted_id})
        return XAIUserProfile(**created_profile)
    
    async def get_profile_by_xai_user_id(self, xai_user_id: str) -> Optional[XAIUserProfile]:
        """Get user profile by X AI user ID"""
        collection = self._get_collection()
        profile = await collection.find_one({"xai_user_id": xai_user_id})
        if profile:
            return XAIUserProfile(**profile)
        return None
    
    async def get_profile_by_id(self, profile_id: str) -> Optional[XAIUserProfile]:
        """Get user profile by MongoDB ID"""
        collection = self._get_collection()
        if not ObjectId.is_valid(profile_id):
            return None
        profile = await collection.find_one({"_id": ObjectId(profile_id)})
        if profile:
            return XAIUserProfile(**profile)
        return None
    
    async def update_profile(self, xai_user_id: str, update_data: XAIUserProfileUpdate) -> Optional[XAIUserProfile]:
        """Update user profile"""
        collection = self._get_collection()
        
        # Prepare update dict
        update_dict = update_data.model_dump(exclude_none=True)
        if not update_dict:
            # No updates provided
            return await self.get_profile_by_xai_user_id(xai_user_id)
        
        # Add updated_at timestamp
        update_dict["updated_at"] = datetime.utcnow()
        
        # Update in database
        result = await collection.update_one(
            {"xai_user_id": xai_user_id},
            {"$set": update_dict}
        )
        
        if result.modified_count > 0:
            return await self.get_profile_by_xai_user_id(xai_user_id)
        return None
    
    async def update_last_active(self, xai_user_id: str) -> None:
        """Update the last active timestamp for a user"""
        collection = self._get_collection()
        await collection.update_one(
            {"xai_user_id": xai_user_id},
            {"$set": {"last_active": datetime.utcnow(), "updated_at": datetime.utcnow()}}
        )
    
    async def delete_profile(self, xai_user_id: str) -> bool:
        """Delete a user profile"""
        collection = self._get_collection()
        result = await collection.delete_one({"xai_user_id": xai_user_id})
        return result.deleted_count > 0
    
    async def list_profiles(self, skip: int = 0, limit: int = 100) -> List[XAIUserProfile]:
        """List all user profiles with pagination"""
        collection = self._get_collection()
        cursor = collection.find().skip(skip).limit(limit)
        profiles = await cursor.to_list(length=limit)
        return [XAIUserProfile(**profile) for profile in profiles]

# Global service instance
user_profile_service = UserProfileService()
