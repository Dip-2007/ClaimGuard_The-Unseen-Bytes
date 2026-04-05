"""
Database connection module — MongoDB Atlas via Motor + Cloudinary config.
"""

import os
import cloudinary
import cloudinary.uploader
from motor.motor_asyncio import AsyncIOMotorClient

# ── MongoDB ────────────────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/claimguard")

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    """Initialize the MongoDB connection (lazy — doesn't block startup)."""
    global client, db
    client = AsyncIOMotorClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=5000,
    )
    db = client.get_default_database()
    print(f"📡 MongoDB client initialized for database: {db.name}")

    # Try to verify connection in background — non-blocking
    try:
        await client.admin.command("ping")
        print(f"✅ MongoDB connection verified!")
        # Create indexes (best-effort)
        try:
            await db.users.create_index("email", unique=True)
            await db.activities.create_index("user_id")
            await db.activities.create_index("created_at")
            await db.chats.create_index("user_id")
            print("📊 MongoDB indexes created.")
        except Exception as e:
            print(f"⚠️ Index creation warning: {e}")
    except Exception as e:
        print(f"⚠️ MongoDB ping failed (will retry on first request): {e}")
        print("   Make sure your IP is whitelisted in MongoDB Atlas → Network Access")


async def close_db():
    """Close the MongoDB connection."""
    global client
    if client:
        client.close()
        print("🔌 MongoDB connection closed.")


def get_db():
    """Return the database instance."""
    return db


# ── Cloudinary ─────────────────────────────────────────────────────────
def configure_cloudinary():
    """Configure cloudinary from environment variables."""
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    print("☁️  Cloudinary configured.")


def upload_to_cloudinary(file_bytes: bytes, filename: str) -> dict:
    """Upload a file to Cloudinary and return the result."""
    import io
    result = cloudinary.uploader.upload(
        io.BytesIO(file_bytes),
        resource_type="raw",
        public_id=f"claimguard/edi/{filename}",
        overwrite=True,
    )
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "bytes": result.get("bytes"),
    }
