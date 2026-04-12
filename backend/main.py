from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.db_routes import router as db_router
from api.connect_db import router as connect_router  # 🔥 NEW

import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = FastAPI(title="CS496 Analytics Backend")

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Existing routes
app.include_router(router)

# ✅ DB analytics routes
app.include_router(db_router)

# 🔥 CONNECT DB ROUTES (IMPORTANT)
app.include_router(connect_router)

@app.get("/")
def root():
    return {"status": "Backend is running"}