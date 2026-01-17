import asyncio
import os
from datetime import datetime
from typing import List
import tweepy
from models import UserX, PublicMetrics, Entities, ConversationalGoal
from database import db
from services.llm_service import GrokService # Import the new service

class CrawlerService:
    def __init__(self, grok_service: GrokService):
        self.grok = grok_service  # Inject the service
        self.bearer_token = os.getenv("X_BEARER_TOKEN")
        self.client = tweepy.Client(bearer_token=self.bearer_token) if self.bearer_token else None

    async def clone_profile(self, handle: str, voice: str = "Ara", goals: List[str] = []) -> UserX:
        print(f"🕵️‍♀️ Cloning profile: @{handle}...")

        # 1. Fetch User Data and Tweets
        user_data, raw_tweets = await self._fetch_tweets(handle)

        # 2. Analyze Persona using Grok
        analysis = await self._analyze_persona(handle, raw_tweets)

        # 3. Create UserX Object
        user_profile = UserX(
            _id=user_data["id"],
            username=user_data["username"],
            name=user_data["name"],
            created_at=user_data["created_at"],

            description=user_data["description"] or analysis.get('bio_snippet', ''),

            location=user_data["location"] or "The Internet",
            voice_id=voice,

            conversational_goals=[ConversationalGoal(description=g) for g in goals],

            public_metrics=PublicMetrics(
                followers_count=user_data["public_metrics"]["followers_count"],
                following_count=user_data["public_metrics"]["following_count"],
                tweet_count=user_data["public_metrics"]["tweet_count"],
                listed_count=user_data["public_metrics"]["listed_count"]
            ),
            entities=Entities(),

            # The "Soul" from Grok
            system_prompt=analysis.get('system_prompt', f"You are @{handle}"),
            tags=analysis.get('tags', []),

            # Style analysis
            typing_style=analysis.get('typing_style'),
            speech_style=analysis.get('speech_style'),
            behavior_summary=analysis.get('behavior_summary'),

            verified=user_data["verified"],
            verified_type="blue_verified" if user_data["verified"] else None,
            profile_image_url=user_data["profile_image_url"]
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

    async def _fetch_tweets(self, handle: str) -> tuple:
        """Fetch user profile and tweets from Twitter API."""
        if not self.client:
            # Fallback to mock data if no token
            print("⚠️ X_BEARER_TOKEN not set, using mock data")
            await asyncio.sleep(0.5)
            mock_user = {
                "id": str(abs(hash(handle))),
                "username": handle,
                "name": handle.capitalize(),
                "description": "Mock bio",
                "location": "The Internet",
                "profile_image_url": None,
                "verified": True,
                "created_at": datetime.utcnow(),
                "public_metrics": {"followers_count": 10500, "following_count": 420, "tweet_count": 1337, "listed_count": 50}
            }
            mock_tweets = [
                "We need to accelerate the transition to sustainable energy.",
                "Rockets are cool but have you tried digging tunnels?",
                "AI safety is actually a huge concern.",
                "Meme review 👏👏"
            ]
            return mock_user, mock_tweets

        try:
            # Fetch user
            user_response = self.client.get_user(
                username=handle,
                user_fields=["public_metrics", "description", "location", "verified", "profile_image_url", "created_at"]
            )
            if not user_response.data:
                raise ValueError(f"User @{handle} not found")

            user = user_response.data

            # Fetch recent tweets
            tweets_response = self.client.get_users_tweets(
                user.id,
                max_results=50,
                tweet_fields=["created_at", "public_metrics", "entities"]
            )

            tweets = []
            if tweets_response.data:
                for tweet in tweets_response.data:
                    tweets.append(tweet.text)

            user_dict = {
                "id": str(user.id),
                "username": user.username,
                "name": user.name,
                "description": user.description or "",
                "location": user.location or "",
                "profile_image_url": user.profile_image_url,
                "verified": user.verified or False,
                "created_at": user.created_at,
                "public_metrics": {
                    "followers_count": user.public_metrics["followers_count"],
                    "following_count": user.public_metrics["following_count"],
                    "tweet_count": user.public_metrics["tweet_count"],
                    "listed_count": user.public_metrics["listed_count"]
                }
            }

            return user_dict, tweets

        except Exception as e:
            print(f"❌ Twitter API error for @{handle}: {e}")
            # Fallback to mock
            await asyncio.sleep(0.5)
            mock_user = {
                "id": str(abs(hash(handle))),
                "username": handle,
                "name": handle.capitalize(),
                "description": "Mock bio",
                "location": "The Internet",
                "profile_image_url": None,
                "verified": True,
                "created_at": datetime.utcnow(),
                "public_metrics": {"followers_count": 10500, "following_count": 420, "tweet_count": 1337, "listed_count": 50}
            }
            mock_tweets = [
                "We need to accelerate the transition to sustainable energy.",
                "Rockets are cool but have you tried digging tunnels?",
                "AI safety is actually a huge concern.",
                "Meme review 👏👏"
            ]
            return mock_user, mock_tweets