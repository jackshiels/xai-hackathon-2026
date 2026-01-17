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
SAMPLE_RATE = 44100
CHUNK_SIZE = 2048  # Increased chunk size for smoother streaming
CHANNELS = 1
FORMAT = pyaudio.paInt16

class GrokVoiceClient:
    def __init__(self):
        self.p = pyaudio.PyAudio()
        self.input_stream = None
        self.output_stream = None
        self.is_listening = True
        
    async def get_token(self):
        """Fetch token from our local Dockerized server or use direct Key."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post("http://localhost:8000/session")
                response.raise_for_status()
                data = response.json()
                print("✅ Authenticated via Ephemeral Token")
                # Handle both structure possibilities based on your previous debugging
                return data.get('client_secret', {}).get('value') or data.get('token')
        except Exception as e:
            print(f"⚠️  Auth Server Error: {e}. Using Direct API Key.")
            return os.getenv("XAI_API_KEY")

    def setup_audio(self):
        self.input_stream = self.p.open(
            format=FORMAT, channels=CHANNELS, rate=SAMPLE_RATE,
            input=True, frames_per_buffer=CHUNK_SIZE
        )
        self.output_stream = self.p.open(
            format=FORMAT, channels=CHANNELS, rate=SAMPLE_RATE,
            output=True
        )

    async def send_audio_loop(self, websocket):
        """Continuously reads mic input and sends to WebSocket."""
        print("🎤 Listening... (Speak now)")
        
        # 
        
        try:
            while self.is_listening:
                # 1. Read raw bytes from microphone (Non-blocking way)
                # We use specific exception handling for input overflow
                try:
                    data = await asyncio.to_thread(
                        self.input_stream.read, 
                        CHUNK_SIZE, 
                        exception_on_overflow=False
                    )
                except IOError as e:
                    print(f"Audio read warning: {e}")
                    continue

                if not data:
                    break

                # 2. Encode to Base64
                b64_audio = base64.b64encode(data).decode("utf-8")
                
                # 3. Send Append Message
                msg = {
                    "type": "input_audio_buffer.append",
                    "audio": b64_audio
                }
                await websocket.send(json.dumps(msg))
                
                # Zero sleep allows event loop to switch context without adding latency
                await asyncio.sleep(0) 
        except Exception as e:
            print(f"Audio send error: {e}")

    async def receive_loop(self, websocket):
        """Handles incoming WebSocket messages (Audio/Text)."""
        print("👂 Ready to receive audio...")
        try:
            async for message in websocket:
                event = json.loads(message)
                event_type = event.get("type")

                # Debug: Print server events to understand what is happening
                if event_type not in ["response.audio.delta", "response.audio_transcript.delta"]:
                    print(f"📨 Event: {event_type}")

                if event_type == "response.audio.delta":
                    b64_data = event.get("delta", "")
                    if b64_data:
                        audio_bytes = base64.b64decode(b64_data)
                        # Write audio directly to stream
                        await asyncio.to_thread(self.output_stream.write, audio_bytes)
                
                elif event_type == "response.audio_transcript.delta":
                    delta = event.get("delta", "")
                    print(delta, end="", flush=True)

                elif event_type == "response.created":
                    print("\n🤖 Generating response...")

                elif event_type == "error":
                    print(f"\n❌ Error: {event.get('error')}")

        except websockets.exceptions.ConnectionClosed:
            print("\nConnection closed.")

    async def run(self):
        token = await self.get_token()
        
        # NOTE: If using Token, xAI usually requires it in the 'Authorization' header
        # similar to the API key.
        headers = {"Authorization": f"Bearer {token}"}
        
        url = "wss://api.x.ai/v1/realtime"
        
        self.setup_audio()

        async with websockets.connect(url, additional_headers=headers) as ws:
            print("✅ Connected to Grok Voice API")
            
            # 1. Send Session Configuration
            session_config = {
                "type": "session.update",
                "session": {
                    "voice": "Ara",
                    "instructions": "You are a witty, helpful AI.",
                    "turn_detection": {"type": "server_vad"}, 
                    "audio": {
                        "input": {"format": {"type": "audio/pcm", "rate": SAMPLE_RATE}},
                        "output": {"format": {"type": "audio/pcm", "rate": SAMPLE_RATE}}
                    }
                }
            }
            await ws.send(json.dumps(session_config))

            # 

            # 2. Start Loops
            send_task = asyncio.create_task(self.send_audio_loop(ws))
            recv_task = asyncio.create_task(self.receive_loop(ws))

            # 3. Wait for tasks (this keeps the script running)
            await asyncio.gather(send_task, recv_task)

    def cleanup(self):
        print("\nCleaning up audio resources...")
        if self.input_stream: 
            self.input_stream.stop_stream()
            self.input_stream.close()
        if self.output_stream: 
            self.output_stream.stop_stream()
            self.output_stream.close()
        self.p.terminate()

if __name__ == "__main__":
    client = GrokVoiceClient()
    try:
        asyncio.run(client.run())
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        client.cleanup()