import os
import asyncio
import logging
import json
import httpx
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GrokRelay")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

XAI_API_KEY = os.getenv("XAI_API_KEY")
SESSION_REQUEST_URL = "https://api.x.ai/v1/realtime/client_secrets"
# Ensure this matches the docs exactly
XAI_URL = "wss://api.x.ai/v1/realtime"

@app.get("/health")
async def health_check():
    """Health check endpoint to verify the server is running."""
    return {"status": "healthy", "service": "grok-auth-server"}

@app.post("/session")
async def get_ephemeral_token():
    if not XAI_API_KEY:
        logger.error("❌ XAI_API_KEY is missing in environment variables!")
        raise HTTPException(status_code=500, detail="Server misconfigured: API Key missing")

    logger.info("Requesting ephemeral token from xAI...")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url=SESSION_REQUEST_URL,
                headers={
                    "Authorization": f"Bearer {XAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"expires_after": {"seconds": 300}},
            )
            
            # 2. LOG THE RESPONSE if it fails
            if response.status_code != 200:
                logger.error(f"❌ xAI API Error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"xAI Error: {response.text}")

            data = response.json()
            logger.info("✅ Token received successfully")
            return data

        except httpx.RequestError as e:
            logger.error(f"❌ Network Error: {e}")
            raise HTTPException(status_code=500, detail="Failed to connect to xAI")

@app.websocket("/ws")
async def websocket_endpoint(client_ws: WebSocket):
    await client_ws.accept()
    logger.info("🟢 Browser connected")

    if not XAI_API_KEY:
        await client_ws.close(code=1008)
        return

    try:
        async with websockets.connect(
            uri=XAI_URL,
            ssl=True,
            additional_headers={"Authorization": f"Bearer {XAI_API_KEY}"}
        ) as xai_ws:
            
            logger.info("✅ Connected to xAI")
            await client_ws.send_text(json.dumps({"type": "server_log", "message": "Connected to xAI"}))

            async def browser_to_xai():
                try:
                    while True:
                        data = await client_ws.receive_text()
                        logger.info(f"⬆️ Sending to xAI: {data[:100]}...") # Log what we send
                        await xai_ws.send(data)
                except Exception:
                    pass

            async def xai_to_browser():
                try:
                    async for message in xai_ws:
                        if isinstance(message, str):
                            msg_data = json.loads(message)
                            if msg_data.get('type') != 'response.audio.delta':
                                logger.info(f"⬇️ Received from xAI: {json.dumps(msg_data, indent=2)}")

                            await client_ws.send_text(message)
                        else:
                            # Binary data, e.g., audio
                            await client_ws.send_bytes(message)
                except Exception as e:
                    logger.error(f"Error xAI->Browser: {e}")

            await asyncio.gather(browser_to_xai(), xai_to_browser())

    except Exception as e:
        logger.error(f"❌ Connection Error: {e}")
        await client_ws.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)