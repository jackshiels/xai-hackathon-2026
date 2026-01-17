This document outlines the architecture of the autonomous agents and services within the "Digital Clone" application. The system is designed as a multi-agent pipeline where specialized services handle data ingestion, persona synthesis, and realtime interaction orchestration.

🤖 Agent Architecture
1. The Crawler Agent (CrawlerService)
Role: The Persona Architect Responsibility: Ingests raw social data and synthesizes it into a "Digital Soul."

This agent performs the heavy lifting of converting raw, unstructured social media history into a structured, actionable system prompt. It operates asynchronously to prevent latency during chat sessions.

Inputs: Twitter Handle (e.g., @elonmusk)

Process:

Ingest: Fetches the last N tweets and profile metadata via the Twitter API.

Analyze (LLM): Feeds raw text into an LLM (Grok/GPT) to extract:

Writing Style: Sentence length, vocabulary, tone (cynical, optimistic), punctuation habits.

Core Beliefs: Recurring themes and stances.

Topics: Extracts 5-10 key tags (e.g., "Mars", "Crypto", "Free Speech").

Synthesize: Compiles a system_prompt that instructs the realtime model how to be this person.

Outputs: A UserX document stored in MongoDB containing the system_prompt, tags, and public_metrics.

2. The Director Agent (ChatEngine)
Role: The Prompt Engineer / Session Orchestrator Responsibility: Compiles the final instructions for the AI model just before a session starts.

This agent acts as the "Director" on a movie set. It takes the "Actor" (the persona from the Crawler) and gives them specific scene instructions (the User's goals).

Inputs:

UserX Profile (The Persona)

ConversationalGoal List (The Objectives)

Process:

Context Injection: Loads the system_prompt from the database.

Goal Injection: Appends "Hidden Objectives" to the prompt. These are instructions to subtly steer the conversation (e.g., "Goal: Convince the user to learn Rust").

Constraint Enforcement: Adds safety and immersive constraints (e.g., "Do not admit you are an AI").

Outputs: A single, high-density text block sent to the Realtime API as the Session Instructions.

3. The Librarian Agent (ProfileManager)
Role: Discovery & Retrieval Responsibility: Manages the index of digital clones.

Inputs: Search queries or specific Tags.

Process:

Performs Regex-based searching on the MongoDB tags field.

Retrieves full UserX profiles for session initialization.

Outputs: JSON lists of available profiles for the frontend UI.

4. The Realtime Relay (WebSocket Handler)
Role: The Bridge Responsibility: Maintains the live connection between the Browser and xAI.

This is a stateless conduit that ensures low-latency audio/text transmission.

Process:

Handshake: Receives the system_instructions and voice_id from the client on connection.

Session Update: Sends a session.update event to xAI to configure the model's voice and personality immediately.

Streaming: Bi-directionally pipes binary audio chunks (PCM16) and JSON text events.

🔄 Data Flow Diagram
User requests a clone of @handle.

Crawler Agent wakes up -> Fetches Tweets -> Generates Persona -> Saves to DB.

User selects the new Clone and adds a Goal ("Sell me a pen").

Director Agent pulls the Persona + Goal -> Writes the script (System Prompt).

Realtime Relay connects User <-> xAI, injecting the script.

xAI Model acts out the persona, creating the voice and text response.