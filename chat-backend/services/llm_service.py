import json
import re
from typing import List, Dict, Any
from openai import AsyncOpenAI

class GrokService:
    def __init__(self, api_key: str, model: str = "grok-4-1-fast-non-reasoning-latest"):
        """
        Initialize the Grok service wrapper.
        
        Args:
            api_key: The xAI API key.
            model: The specific model ID (defaulting to latest Grok 2).
        """
        if not api_key:
            raise ValueError("xAI API Key is required for GrokService")
            
        self.client = AsyncOpenAI(
            api_key=api_key, 
            base_url="https://api.x.ai/v1"
        )
        self.model = model

    async def generate_persona_analysis(self, handle: str, tweets: List[str]) -> Dict[str, Any]:
        """
        Sends tweets to Grok to generate a persona profile, system prompts, and tags.
        """
        
        # 1. Construct the Prompt
        # We join a subset of tweets to fit context, though Grok has a large window.
        tweets_block = "\n".join([f"- {t}" for t in tweets[:50]])
        
        system_instruction = (
            "You are an expert social media analyst and behavioral psychologist. "
            "Your goal is to analyze raw user data and distill it into a precise 'Digital Soul' configuration."
        )
        
        user_prompt = f"""
        Analyze the following tweets from the user @{handle}.

        Task:
        1. Write a 'bio_snippet' (max 2 sentences) that captures their essence.
        2. Create a 'system_prompt' (max 100 words) that instructs an AI how to roleplay this person.
           - Focus on tone, sentence structure, cynicism/optimism, vocabulary, and punctuation habits.
           - Do not be generic. Be specific to their writing style.
        3. Extract 5-8 'tags' that represent their core topics or archetypes.
        4. Analyze 'typing_style' (max 50 words): Describe punctuation habits, sentence length, capitalization, emoji usage, abbreviations, etc.
        5. Analyze 'speech_style' (max 50 words): Describe tone (formal/casual), vocabulary complexity, filler words, pacing, enthusiasm, etc.
        6. Provide 'behavior_summary' (max 50 words): Summarize interaction patterns, emotional tone, humor usage, response style, etc.

        Tweets:
        {tweets_block}

        Return ONLY valid JSON with this structure:
        {{
            "bio_snippet": "string",
            "system_prompt": "string",
            "tags": ["string", "string"],
            "typing_style": "string",
            "speech_style": "string",
            "behavior_summary": "string"
        }}
        """

        try:
            # 2. Call xAI API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7, # Slight creativity for the persona description
                max_tokens=1000,
            )

            raw_content = response.choices[0].message.content
            if not raw_content:
                raise ValueError("Empty response from Grok")

            # 3. Robust JSON Parsing
            # Grok might wrap the JSON in markdown code blocks (```json ... ```)
            return self._extract_json(raw_content)

        except Exception as e:
            # Fallback data so the app doesn't crash
            return {
                "bio_snippet": f"Digital clone of @{handle} (Analysis failed).",
                "system_prompt": f"You are @{handle}. Please speak in a generic but helpful tone.",
                "tags": ["General"],
                "typing_style": "Generic typing style with standard punctuation.",
                "speech_style": "Neutral and conversational tone.",
                "behavior_summary": "Helpful and straightforward interaction style."
            }

    def _extract_json(self, text: str | None) -> Dict[str, Any]:
        """
        Helper to extract JSON from an LLM response string, handling markdown fences.
        """
        if not text:
            raise ValueError("No text to parse")

        try:
            # Attempt direct parse
            return json.loads(text)
        except json.JSONDecodeError:
            # Regex to find content between ```json and ``` or just { and }
            json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))

            # Last ditch: find first { and last }
            fallback_match = re.search(r"(\{.*\})", text, re.DOTALL)
            if fallback_match:
                return json.loads(fallback_match.group(1))

            raise ValueError("Could not parse JSON from Grok response")