import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import httpx
import os
from dotenv import load_dotenv

load_dotenv("d:/ClaimGuard_The-Unseen-Bytes/project_Inspiron5.0/backend/.env")

async def main():
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(uri)
    db = client.claimguard_db
    
    # Get latest activity
    activity = await db.activities.find_one({}, sort=[("created_at", -1)])
    if not activity:
        print("No activities found")
        sys.exit(1)
        
    url = activity.get("cloudinary_url")
    print(f"Cloudinary URL: {url}")
    
    if url:
        print("Fetching via httpx direct...")
        try:
            async with httpx.AsyncClient() as hc:
                res = await hc.get(url)
                print(f"Status: {res.status_code}")
                print(f"Content Length: {len(res.text)}")
                print(res.text[:100])
        except Exception as e:
            print(f"Direct fetch failed: {e}")
            
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
