from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.financial_accounts import router as financial_accounts_router
from app.api.routes.health import router as health_router
from app.api.routes.financial_movements import router as financial_movements_router
from app.api.routes.investment_funds import router as investment_funds_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.settings import router as settings_router
from app.core.config import settings

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(investment_funds_router)
app.include_router(portfolio_router)
app.include_router(financial_movements_router)
app.include_router(financial_accounts_router)
app.include_router(settings_router)
