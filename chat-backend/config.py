import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "x_clones_db")
XAI_API_KEY = os.getenv("XAI_API_KEY")
TWITTER_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN")