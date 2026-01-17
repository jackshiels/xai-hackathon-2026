import os
import tweepy
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

app = FastAPI()

# X API Setup
BEARER_TOKEN = os.getenv("X_BEARER_TOKEN")
client = tweepy.Client(bearer_token=BEARER_TOKEN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/search")
async def search_users(query: str = Query(..., min_length=1)):
    try:
        # Note: X API v2 'get_user' finds a single user by username.
        # To search for multiple users by a keyword, you typically need 
        # the 'User Search' endpoint (Standard v1.1 or specific v2 tracks).
        
        # Here we attempt to fetch a single user by their exact handle
        response = client.get_user(username=query, user_fields=["profile_image_url", "description", "public_metrics"])
        
        if not response.data:
            return []

        user = response.data
        return [{
            "id": user.id,
            "username": user.username,
            "display_name": user.name,
            "description": user.description,
            "profile_image": user.profile_image_url
        }]

    except tweepy.TweepyException as e:
        raise HTTPException(status_code=400, detail=f"X API Error: {str(e)}")

@app.get("/get_recent_tweet")
async def get_recent_tweet(username: str = Query(..., min_length=1)):
    try:
        # First get user ID from username
        user_response = client.get_user(username=username)
        if not user_response.data:
            return {"tweet": f"User @{username} not found"}

        user_id = user_response.data.id

        # Get user's recent tweets
        response = client.get_users_tweets(
            id=user_id,
            max_results=1,
            tweet_fields=["created_at", "text"]
        )

        if not response.data or len(response.data) == 0:
            return {"tweet": f"No recent tweets found for @{username}"}

        tweet = response.data[0]
        return {"tweet": tweet.text}

    except tweepy.TweepyException as e:
        raise HTTPException(status_code=400, detail=f"X API Error: {str(e)}")

# If you wanted to search TWEETS containing the query instead:
@app.get("/search_tweets")
async def search_tweets(query: str):
    tweets = client.search_recent_tweets(query=query, max_results=10)
    return [{"id": t.id, "text": t.text} for t in tweets.data] if tweets.data else []