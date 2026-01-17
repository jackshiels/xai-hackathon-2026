import os
import httpx
from fastapi import FastAPI, HTTPException
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from database import connect_to_mongo, close_mongo_connection
from models import XAIUserProfile, XAIUserProfileCreate, XAIUserProfileUpdate
from user_profile_service import user_profile_service

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB
    await connect_to_mongo()
    yield
    # Shutdown: Close MongoDB connection
    await close_mongo_connection()

app = FastAPI(
    title="Grok Voice Agent Auth Server",
    lifespan=lifespan
)

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_REQUEST_URL = "https://api.x.ai/v1/realtime/client_secrets"
XAI_API_KEY = os.getenv("XAI_API_KEY")

if not XAI_API_KEY:
    print("WARNING: XAI_API_KEY is not set in environment variables.")

@app.post("/session")
async def get_ephemeral_token():
    """
    Fetches a short-lived ephemeral token from xAI.
    Clients use this token to connect to the WebSocket securely.
    """
    if not XAI_API_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: API Key missing")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url=SESSION_REQUEST_URL,
                headers={
                    "Authorization": f"Bearer {XAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"expires_after": {"seconds": 300}}, # Token valid for 5 mins
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# User Profile Endpoints

@app.post("/user-profiles", response_model=XAIUserProfile, status_code=201)
async def create_user_profile(profile: XAIUserProfileCreate):
    """Create a new X AI user profile"""
    try:
        return await user_profile_service.create_profile(profile)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user-profiles/{xai_user_id}", response_model=XAIUserProfile)
async def get_user_profile(xai_user_id: str):
    """Get user profile by X AI user ID"""
    profile = await user_profile_service.get_profile_by_xai_user_id(xai_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return profile

@app.put("/user-profiles/{xai_user_id}", response_model=XAIUserProfile)
async def update_user_profile(xai_user_id: str, profile_update: XAIUserProfileUpdate):
    """Update user profile"""
    profile = await user_profile_service.update_profile(xai_user_id, profile_update)
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return profile

@app.delete("/user-profiles/{xai_user_id}", status_code=204)
async def delete_user_profile(xai_user_id: str):
    """Delete user profile"""
    deleted = await user_profile_service.delete_profile(xai_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User profile not found")

@app.get("/user-profiles", response_model=List[XAIUserProfile])
async def list_user_profiles(skip: int = 0, limit: int = 100):
    """List all user profiles with pagination"""
    return await user_profile_service.list_profiles(skip=skip, limit=limit)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)