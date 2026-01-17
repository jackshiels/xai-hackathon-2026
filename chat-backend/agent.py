import asyncio
import json
import base64
import os
import sys
import numpy as np
import pyaudio
import websockets
import httpx
from dotenv import load_dotenv

load_dotenv()

# Audio Configuration
SAMPLE_RATE = 24000
CHUNK_SIZE = 1024
CHANNELS = 1
FORMAT = pyaudio.paInt16

class GrokVoiceClient:
    def __init__(self):
        self.p = pyaudio.PyAudio()
        self.input_stream = None
        self.output_stream = None
        self.is_listening = True
        
    async def get_token(self):
        """Fetch token from our local Dockerized server or use direct Key if server is down."""
        try:
            # Try to get ephemeral token from our server
            async with httpx.AsyncClient() as client:
                response = await client.post("http://localhost:8000/session")
                response.raise_for_status()
                data = response.json()
                print("✅ Authenticated via Ephemeral Token")
                return data['token'] # Adjust based on actual xAI response structure if needed
        except Exception:
            # Fallback to direct API Key
            print("⚠️  Auth Server not reachable. Using Direct API Key.")
            return os.getenv("XAI_API_KEY")

    def setup_audio(self):
        # Input Stream (Microphone)
        self.input_stream = self.p.open(
            format=FORMAT, channels=CHANNELS, rate=SAMPLE_RATE,
            input=True, frames_per_buffer=CHUNK_SIZE
        )
        # Output Stream (Speaker)
        self.output_stream = self.p.open(
            format=FORMAT, channels=CHANNELS, rate=SAMPLE_RATE,
            output=True
        )

    async def send_audio_loop(self, websocket):
        """Continuously reads mic input and sends to WebSocket."""
        print("🎤 Listening... (Press Ctrl+C to stop)")
        try:
            while self.is_listening:
                data = await asyncio.to_thread(self.input_stream.read, CHUNK_SIZE, exception_on_overflow=False)
                # Encode raw PCM to base64
                b64_audio = base64.b64encode(data).decode("utf-8")
                
                msg = {
                    "type": "input_audio_buffer.append",
                    "audio": b64_audio
                }
                await websocket.send(json.dumps(msg))
                await asyncio.sleep(0.01) # Yield control
        except Exception as e:
            print(f"Audio send error: {e}")

    async def receive_loop(self, websocket):
        """Handles incoming WebSocket messages (Audio/Text)."""
        try:
            async for message in websocket:
                event = json.loads(message)
                event_type = event.get("type")

                if event_type == "response.audio.delta":
                    # Handle incoming audio stream
                    b64_data = event.get("delta", "")
                    if b64_data:
                        audio_bytes = base64.b64decode(b64_data)
                        await asyncio.to_thread(self.output_stream.write, audio_bytes)
                
                elif event_type == "response.text.delta":
                    # Print text generation in real-time
                    delta = event.get("delta", "")
                    print(delta, end="", flush=True)

                elif event_type == "response.done":
                    print("\n") # New line after response
                
                elif event_type == "error":
                    print(f"\nError: {event.get('error')}")

        except websockets.exceptions.ConnectionClosed:
            print("\nConnection closed.")

    async def run(self):
        token_or_key = await self.get_token()
        
        # Headers depend on whether we use a Token (Ephemeral) or Key (Direct)
        headers = {"Authorization": f"Bearer {token_or_key}"}
        
        url = "wss://api.x.ai/v1/realtime"
        
        self.setup_audio()

        async with websockets.connect(url, additional_headers=headers) as ws:
            print("✅ Connected to Grok Voice API")
            
            # 1. Send Session Configuration
            session_config = {
                "type": "session.update",
                "session": {
                    "voice": "Ara",
                    "instructions": "You are a concise and helpful AI assistant.",
                    "turn_detection": {"type": "server_vad"}, # Server detects when I stop speaking
                    "audio": {
                        "input": {"format": {"type": "audio/pcm", "rate": SAMPLE_RATE}},
                        "output": {"format": {"type": "audio/pcm", "rate": SAMPLE_RATE}}
                    }
                }
            }
            await ws.send(json.dumps(session_config))

            # 2. Run Send/Receive loops concurrently
            send_task = asyncio.create_task(self.send_audio_loop(ws))
            recv_task = asyncio.create_task(self.receive_loop(ws))

            await asyncio.gather(send_task, recv_task)

    def cleanup(self):
        if self.input_stream: self.input_stream.stop_stream(); self.input_stream.close()
        if self.output_stream: self.output_stream.stop_stream(); self.output_stream.close()
        self.p.terminate()

if __name__ == "__main__":
    client = GrokVoiceClient()
    try:
        asyncio.run(client.run())
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        client.cleanup()