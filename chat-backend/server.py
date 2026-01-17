import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
from schema import (
    VoicesResponse, Voice,
    initialize_voice_presets, get_active_voices, get_voice_by_id,
    get_user_voice_preference, set_user_voice_preference,
    create_conversation_session, add_message_to_session,
    end_conversation_session, get_user_conversation_history
)

load_dotenv()

app = FastAPI(title="Grok Voice Agent Auth Server")

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://admin:expatsSouthAfrica20@mongodb:27017/?authSource=admin")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "grok_chat")

# Initialize MongoDB client
mongodb_client: AsyncIOMotorClient = None
mongodb_db = None

@app.on_event("startup")
async def startup_db_client():
    """Initialize MongoDB connection on startup."""
    global mongodb_client, mongodb_db
    try:
        mongodb_client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
        # Test connection
        await mongodb_client.admin.command('ping')
        mongodb_db = mongodb_client[MONGODB_DB_NAME]
        print(f"✅ Connected to MongoDB: {MONGODB_DB_NAME}")

        # Initialize voice presets in database
        if mongodb_db:
            await initialize_voice_presets(mongodb_db)

    except ConnectionFailure as e:
        print(f"⚠️  MongoDB connection failed: {e}")
        mongodb_client = None
        mongodb_db = None

@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown."""
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
        print("✅ MongoDB connection closed")

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

@app.get("/health")
async def health_check():
    """Health check endpoint that verifies MongoDB connectivity."""
    health_status = {
        "status": "healthy",
        "mongodb": "disconnected"
    }

    if mongodb_client:
        try:
            await mongodb_client.admin.command('ping')
            health_status["mongodb"] = "connected"
        except Exception as e:
            health_status["mongodb"] = f"error: {str(e)}"
            health_status["status"] = "degraded"
    else:
        health_status["status"] = "degraded"

    return health_status


@app.get("/voices", response_model=VoicesResponse)
async def get_available_voices():
    """Get all available voices."""
    if not mongodb_db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        voices = await get_active_voices(mongodb_db)
        voice_models = [Voice(**voice.model_dump()) for voice in voices]
        return VoicesResponse(voices=voice_models, total_count=len(voice_models))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch voices: {str(e)}")


@app.get("/voices/{voice_id}")
async def get_voice(voice_id: str):
    """Get a specific voice by ID."""
    if not mongodb_db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        voice = await get_voice_by_id(mongodb_db, voice_id)
        if not voice:
            raise HTTPException(status_code=404, detail=f"Voice '{voice_id}' not found")
        return Voice(**voice.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch voice: {str(e)}")


@app.get("/users/{user_id}/voice-preference")
async def get_voice_preference(user_id: str):
    """Get user's voice preference."""
    if not mongodb_db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        preference = await get_user_voice_preference(mongodb_db, user_id)
        if not preference:
            # Return default voice if no preference set
            default_voice = await get_voice_by_id(mongodb_db, "Ara")
            return {
                "user_id": user_id,
                "preferred_voice_id": "Ara",
                "voice": Voice(**default_voice.model_dump()) if default_voice else None
            }
        return preference
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get voice preference: {str(e)}")


@app.post("/users/{user_id}/voice-preference")
async def set_voice_preference(user_id: str, voice_id: str, custom_instructions: str = None):
    """Set user's voice preference."""
    if not mongodb_db:
        raise HTTPException(status_code=503, detail="Database not available")

    # Validate voice exists
    voice = await get_voice_by_id(mongodb_db, voice_id)
    if not voice:
        raise HTTPException(status_code=400, detail=f"Voice '{voice_id}' is not available")

    try:
        await set_user_voice_preference(mongodb_db, user_id, voice_id, custom_instructions)
        return {"message": f"Voice preference set to '{voice_id}' for user {user_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set voice preference: {str(e)}")


@app.post("/conversations")
async def start_conversation(user_id: str, voice_id: str = "Ara"):
    """Start a new conversation session."""
    if not mongodb_db:
        raise HTTPException(status_code=503, detail="Database not available")

    # Validate voice exists
    voice = await get_voice_by_id(mongodb_db, voice_id)
    if not voice:
        raise HTTPException(status_code=400, detail=f"Voice '{voice_id}' is not available")

    try:
        import uuid
        session_id = f"session_{uuid.uuid4().hex[:8]}"
        session = await create_conversation_session(mongodb_db, user_id, session_id, voice_id)
        return {
            "session_id": session.session_id,
            "voice_id": session.voice_id,
            "started_at": session.started_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start conversation: {str(e)}")


@app.post("/conversations/{session_id}/messages")
async def add_conversation_message(session_id: str, role: str, content: str, voice_used: str = None):
    """Add a message to a conversation session."""
    if not mongodb_db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        await add_message_to_session(mongodb_db, session_id, role, content, voice_used)
        return {"message": "Message added to conversation"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add message: {str(e)}")


@app.post("/conversations/{session_id}/end")
async def end_conversation(session_id: str):
    """End a conversation session."""
    if not mongodb_db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        await end_conversation_session(mongodb_db, session_id)
        return {"message": f"Conversation {session_id} ended"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end conversation: {str(e)}")


@app.get("/users/{user_id}/conversations")
async def get_conversation_history(user_id: str, limit: int = 10):
    """Get user's recent conversation history."""
    if not mongodb_db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        sessions = await get_user_conversation_history(mongodb_db, user_id, limit)
        return {"conversations": [session.model_dump() for session in sessions]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation history: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)