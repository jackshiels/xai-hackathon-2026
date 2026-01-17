import asyncio
from datetime import datetime
from typing import List
from models import UserX, PublicMetrics, Entities
from database import db
from services.llm_service import GrokService # Import the new service

class CrawlerService:
    def __init__(self, grok_service: GrokService):
        self.grok = grok_service  # Inject the service

    async def clone_profile(self, handle: str) -> UserX:
        print(f"🕵️‍♀️ Cloning profile: @{handle}...")
        
        # 1. Fetch Tweets (Still mocked for now, or insert real Tweepy logic here)
        raw_tweets = await self._mock_fetch_tweets(handle)
        
        # 2. Analyze Persona using Grok
        # This now calls the actual API via our new service
        analysis = await self._analyze_persona(handle, raw_tweets)
        
        # 3. Create UserX Object
        user_profile = UserX(
            _id=str(abs(hash(handle))), 
            username=handle,
            name=handle.capitalize(),
            created_at=datetime.utcnow(),
            
            # Populating from Grok Analysis
            description=f"{analysis.get('bio_snippet', '')}", 
            
            location="The Internet",
            voice_id="Rex", 
            
            public_metrics=PublicMetrics(
                followers_count=10500,
                following_count=420,
                tweet_count=1337,
                listed_count=50
            ),
            entities=Entities(),
            
            # The "Soul" from Grok
            system_prompt=analysis.get('system_prompt', f"You are @{handle}"),
            tags=analysis.get('tags', []),
            
            verified=True,
            verified_type="blue_verified"
        )
        
        # Upsert into DB
        await db.profiles.update_one(
            {"_id": user_profile.id}, 
            {"$set": user_profile.model_dump(by_alias=True)}, 
            upsert=True
        )
        
        return user_profile

    async def _analyze_persona(self, handle: str, tweets: List[str]) -> dict:
        """
        Delegates the analysis to the GrokService.
        """
        print(f"🧠 Asking Grok to analyze {len(tweets)} tweets for @{handle}...")
        return await self.grok.generate_persona_analysis(handle, tweets)

    async def _mock_fetch_tweets(self, handle: str) -> List[str]:
        # Simulating API delay
        await asyncio.sleep(0.5) 
        # Returns dummy tweets if you don't have the Twitter API connected yet
        return [
            "We need to accelerate the transition to sustainable energy.",
            "Rockets are cool but have you tried digging tunnels?",
            "AI safety is actually a huge concern.",
            "Meme review 👏👏"
        ]