from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router
from .core.config import settings
from .core.db import Base, engine
from .models import Transaction

app=FastAPI(title="bit API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=True, allow_methods=["GET","POST","PATCH","DELETE"], allow_headers=["*"])
app.include_router(router)
@app.on_event("startup")
def startup(): Base.metadata.create_all(bind=engine)
