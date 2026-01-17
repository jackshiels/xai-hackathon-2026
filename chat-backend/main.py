import json
import asyncio
from fastapi import FastAPI, WebSocket, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from services.crawler import CrawlerService
from services.profile_manager import ProfileManager
from services.chat_engine import ChatEngine
from models import UserX, ConversationalGoal
from database import db

app = FastAPI()
XAI_API_KEY = os.getenv("XAI_API_KEY")
if not XAI_API_KEY:
    print("⚠️ WARNING: XAI_API_KEY not found. Crawler will fail.")

grok_service = GrokService(api_key=XAI_API_KEY)

# 2. Pass LLM Service to Crawler
crawler = CrawlerService(grok_service=grok_service)
profile_mgr = ProfileManager()
chat_engine = ChatEngine()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REST ENDPOINTS ---

@app.post("/api/clone", response_model=UserX)
async def clone_user(handle: str = Body(..., embed=True)):
    """Trigger the crawler to clone a Twitter user."""
    profile = await crawler.clone_profile(handle)
    return profile

@app.get("/api/profiles", response_model=List[UserX])
async def list_profiles(tag: Optional[str] = None):
    """Get discovery list, optionally filtered by tag."""
    if tag:
        return await profile_mgr.search_by_tag(tag)
    return await profile_mgr.get_all_profiles()

@app.get("/api/tags", response_model=List[str])
async def list_tags():
    """Get all unique tags from the database."""
    return await profile_mgr.get_all_tags()

@app.post("/api/session/init")
async def init_session(profile_id: str = Body(...), goals: List[str] = Body(default=[])):
    """Initialize session. Returns the system prompts & voice config."""
    user_x = await profile_mgr.get_profile_by_id(profile_id)
    if not user_x:
        raise HTTPException(404, "Profile not found")

    conv_goals = [ConversationalGoal(description=g) for g in goals]

    # Generate the Master Prompt
    system_instructions = chat_engine.construct_system_instruction(user_x, conv_goals)

    return {
        "session_id": "new_sess_123",
        "system_instructions": system_instructions,
        "voice_preset": user_x.voice_id  # Uses the Voice ID from the schema
    }

# --- WEBSOCKET RELAY ---
# (Stays mostly the same, just imports UserX context indirectly via session/init)
import websockets
import os

XAI_URL = "wss://api.x.ai/v1/realtime"
XAI_API_KEY = os.getenv("XAI_API_KEY")

@app.websocket("/ws")
async def websocket_endpoint(client_ws: WebSocket):
    await client_ws.accept()
    
    init_data = await client_ws.receive_json()
    system_instructions = init_data.get("instructions", "You are a helpful AI.")
    voice = init_data.get("voice", "Ara")
    
    async with websockets.connect(
        uri=XAI_URL,
        ssl=True,
        additional_headers={"Authorization": f"Bearer {XAI_API_KEY}"}
    ) as xai_ws:
        
        await xai_ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": system_instructions,
                "voice": voice,
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "turn_detection": {"type": "server_vad"}
            }
        }))
        
        async def browser_to_xai():
            try:
                while True:
                    data = await client_ws.receive_text()
                    await xai_ws.send(data)
            except Exception: pass

        async def xai_to_browser():
            try:
                async for message in xai_ws:
                    await client_ws.send_text(message)
            except Exception: pass

        await asyncio.gather(browser_to_xai(), xai_to_browser())