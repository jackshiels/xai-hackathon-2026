import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Grok Voice Agent Auth Server")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)