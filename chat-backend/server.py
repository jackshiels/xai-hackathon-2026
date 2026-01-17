import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure

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