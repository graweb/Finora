from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal, get_db
from app.models.fii_dividend_event import FiiDividendEvent
from app.models.investment_fund import InvestmentFund
from app.models.portfolio_dividend_adjustment import PortfolioDividendAdjustment
from app.models.portfolio_transaction import PortfolioTransaction
from app.services.dividend_events import upsert_dividend_events
from app.services.fund_cache import (
    cache_fund,
    cache_portfolio_dashboard,
    clear_portfolio_dashboard_cache,
    create_fund_sync_job,
    finish_fund_sync_job,
    finish_fund_refresh,
    get_cached_fund,
    get_cached_portfolio_dashboard,
    get_cached_recommendation,
    get_fund_sync_job,
    is_fund_refreshing,
    schedule_fund_refresh,
    update_fund_sync_job,
)
from app.services.funds_explorer import FundsExplorerError, fetch_fund

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class PortfolioTransactionPayload(BaseModel):
    investment_fund_id: int
    transaction_type: Literal["buy", "sell"]
    unit_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    quantity: int = Field(gt=0)
    occurred_on: date


class PortfolioTransactionResponse(PortfolioTransactionPayload):
    id: int
    total_amount: Decimal


class PortfolioTransactionDeletePayload(BaseModel):
    ids: list[int] = Field(min_length=1)


class PortfolioDividendResponse(BaseModel):
    id: int
    investment_fund_id: int
    ex_date: date
    payment_date: date
    amount_per_share: Decimal
    ticker: str
    fund_name: str
    eligible_quantity: int
    calculated_amount: Decimal
    adjustment_amount: Decimal
    total_amount: Decimal


class PortfolioDividendAdjustmentPayload(BaseModel):
    amount_delta: Decimal = Field(max_digits=12, decimal_places=2)
    note: str | None = Field(default=None, max_length=500)


class PortfolioDividendTotals(BaseModel):
    total_received: Decimal
    total_records: int


class PortfolioDividendListResponse(BaseModel):
    items: list[PortfolioDividendResponse]
    totals: PortfolioDividendTotals
    page: int
    limit: int
    total_items: int
    total_pages: int


class PortfolioDividendSyncResponse(BaseModel):
    detail: str
    tickers: list[str]
    job_id: str


class PortfolioDividendSyncStatus(BaseModel):
    status: str
    total: int
    processed: int
    failed: int


class PortfolioPosition(BaseModel):
    fund_id: int
    ticker: str
    name: str
    sector: str
    total_quantity: int
    total_value: Decimal
    transactions: list[PortfolioTransactionResponse]


class PortfolioTotals(BaseModel):
    total_value: Decimal
    total_funds: int


class PortfolioResponse(BaseModel):
    items: list[PortfolioPosition]
    totals: PortfolioTotals
    page: int
    limit: int
    total_items: int
    total_pages: int


class PortfolioDashboardMonth(BaseModel):
    label: str
    amount: Decimal


class PortfolioDashboardTrend(BaseModel):
    label: str
    invested_amount: Decimal
    market_value: Decimal


class PortfolioDashboardUpcomingIncome(BaseModel):
    ticker: str
    amount: Decimal
    payment_label: str


class PortfolioDashboardHighlight(BaseModel):
    ticker: str
    name: str
    sector: str
    quantity: int
    average_price: Decimal
    current_price: Decimal
    result_amount: Decimal
    result_percentage: Decimal
    yield_on_cost: Decimal
    estimated_monthly_income: Decimal


class PortfolioDashboardSummary(BaseModel):
    monthly_income: Decimal
    income_target: Decimal
    remaining_to_target: Decimal
    total_return_percentage: Decimal
    total_return_amount: Decimal
    total_invested: Decimal
    market_value: Decimal


class PortfolioDashboardResponse(BaseModel):
    summary: PortfolioDashboardSummary
    monthly_income_history: list[PortfolioDashboardMonth]
    portfolio_history: list[PortfolioDashboardTrend]
    upcoming_income: list[PortfolioDashboardUpcomingIncome]
    highlights: list[PortfolioDashboardHighlight]
    refreshing_tickers: list[str]


def transaction_sign(transaction_type: str) -> int:
    return 1 if transaction_type == "buy" else -1


def refresh_fund_cache(tickers: list[str]) -> None:
    for ticker in tickers:
        try:
            explorer_fund = fetch_fund(ticker, settings.funds_explorer_base_url)
            cache_fund(explorer_fund)
            with SessionLocal() as db:
                fund = db.scalar(
                    select(InvestmentFund).where(InvestmentFund.ticker == ticker)
                )
                if fund is not None:
                    upsert_dividend_events(db, fund, explorer_fund.dividend_events)
                    db.commit()
                    clear_portfolio_dashboard_cache()
        except FundsExplorerError:
            pass
        finally:
            finish_fund_refresh(ticker)


def quantity_at_date(fund_id: int, as_of: date, db: Session) -> int:
    transactions = db.scalars(
        select(PortfolioTransaction)
        .where(
            PortfolioTransaction.investment_fund_id == fund_id,
            PortfolioTransaction.occurred_on <= as_of,
        )
        .order_by(PortfolioTransaction.occurred_on, PortfolioTransaction.id)
    ).all()
    return max(
        0,
        sum(
            transaction_sign(transaction.transaction_type) * transaction.quantity
            for transaction in transactions
        ),
    )


def serialize_dividend(
    dividend: FiiDividendEvent,
    fund: InvestmentFund,
    adjustment: PortfolioDividendAdjustment | None,
    db: Session,
) -> PortfolioDividendResponse:
    eligible_quantity = quantity_at_date(dividend.investment_fund_id, dividend.ex_date, db)
    calculated_amount = dividend.amount_per_share * eligible_quantity
    adjustment_amount = adjustment.amount_delta if adjustment is not None else Decimal("0")
    return PortfolioDividendResponse(
        id=dividend.id,
        investment_fund_id=dividend.investment_fund_id,
        ex_date=dividend.ex_date,
        payment_date=dividend.payment_date,
        amount_per_share=dividend.amount_per_share,
        ticker=fund.ticker,
        fund_name=fund.name,
        eligible_quantity=eligible_quantity,
        calculated_amount=calculated_amount,
        adjustment_amount=adjustment_amount,
        total_amount=calculated_amount + adjustment_amount,
    )


@router.get("/dividends", response_model=PortfolioDividendListResponse)
def list_portfolio_dividends(
    year: int | None = Query(default=None, ge=2000, le=2100),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PortfolioDividendListResponse:
    filters = [extract("year", FiiDividendEvent.payment_date) == year] if year else []
    rows = db.execute(
        select(FiiDividendEvent, InvestmentFund, PortfolioDividendAdjustment)
        .join(InvestmentFund, InvestmentFund.id == FiiDividendEvent.investment_fund_id)
        .outerjoin(
            PortfolioDividendAdjustment,
            PortfolioDividendAdjustment.dividend_event_id == FiiDividendEvent.id,
        )
        .where(*filters)
        .order_by(FiiDividendEvent.payment_date.desc(), FiiDividendEvent.id.desc())
    ).all()
    calculated = [
        serialize_dividend(dividend, fund, adjustment, db)
        for dividend, fund, adjustment in rows
    ]
    total_items = len(calculated)
    total_received = sum((item.total_amount for item in calculated), Decimal("0"))
    total_pages = max(1, (total_items + limit - 1) // limit)
    return PortfolioDividendListResponse(
        items=calculated[(page - 1) * limit : page * limit],
        totals=PortfolioDividendTotals(
            total_received=total_received, total_records=total_items
        ),
        page=page,
        limit=limit,
        total_items=total_items,
        total_pages=total_pages,
    )


@router.put("/dividends/{dividend_event_id}/adjustment", response_model=PortfolioDividendResponse)
def adjust_portfolio_dividend(
    dividend_event_id: int,
    payload: PortfolioDividendAdjustmentPayload,
    db: Session = Depends(get_db),
) -> PortfolioDividendResponse:
    row = db.execute(
        select(FiiDividendEvent, InvestmentFund, PortfolioDividendAdjustment)
        .join(InvestmentFund, InvestmentFund.id == FiiDividendEvent.investment_fund_id)
        .outerjoin(
            PortfolioDividendAdjustment,
            PortfolioDividendAdjustment.dividend_event_id == FiiDividendEvent.id,
        )
        .where(FiiDividendEvent.id == dividend_event_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Evento de dividendo não encontrado.")
    dividend, fund, adjustment = row
    if adjustment is None:
        adjustment = PortfolioDividendAdjustment(dividend_event_id=dividend.id)
        db.add(adjustment)
    adjustment.amount_delta = payload.amount_delta
    adjustment.note = payload.note.strip() if payload.note else None
    db.commit()
    db.refresh(adjustment)
    clear_portfolio_dashboard_cache()
    return serialize_dividend(dividend, fund, adjustment, db)


def refresh_dividend_events(tickers: list[str], job_id: str) -> None:
    for ticker in tickers:
        succeeded = False
        try:
            explorer_fund = fetch_fund(ticker, settings.funds_explorer_base_url)
            cache_fund(explorer_fund)
            with SessionLocal() as db:
                fund = db.scalar(
                    select(InvestmentFund).where(InvestmentFund.ticker == ticker)
                )
                if fund is not None:
                    upsert_dividend_events(db, fund, explorer_fund.dividend_events)
                    db.commit()
                    clear_portfolio_dashboard_cache()
                    succeeded = True
        except FundsExplorerError:
            pass
        finally:
            finish_fund_refresh(ticker)
            update_fund_sync_job(job_id, succeeded=succeeded)
    finish_fund_sync_job(job_id)


@router.post("/dividends/sync", response_model=PortfolioDividendSyncResponse)
def sync_portfolio_dividends(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> PortfolioDividendSyncResponse:
    tickers = list(
        db.scalars(
            select(InvestmentFund.ticker)
            .join(PortfolioTransaction)
            .distinct()
            .order_by(InvestmentFund.ticker)
        )
    )
    scheduled = schedule_fund_refresh(tickers)
    job_id = create_fund_sync_job(scheduled)
    if scheduled:
        background_tasks.add_task(refresh_dividend_events, scheduled, job_id)
    else:
        finish_fund_sync_job(job_id)
    return PortfolioDividendSyncResponse(
        detail="A sincronização dos proventos foi iniciada em segundo plano.",
        tickers=scheduled,
        job_id=job_id,
    )


@router.get("/dividends/sync/{job_id}", response_model=PortfolioDividendSyncStatus)
def get_portfolio_dividend_sync_status(job_id: str) -> PortfolioDividendSyncStatus:
    job = get_fund_sync_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Sincronização não encontrada.")
    return PortfolioDividendSyncStatus(**job)


@router.get("/dashboard", response_model=PortfolioDashboardResponse)
def get_portfolio_dashboard(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> PortfolioDashboardResponse:
    cached_dashboard = get_cached_portfolio_dashboard()
    if cached_dashboard is not None:
        return PortfolioDashboardResponse.model_validate(cached_dashboard)

    rows = db.execute(
        select(InvestmentFund, PortfolioTransaction)
        .join(PortfolioTransaction, PortfolioTransaction.investment_fund_id == InvestmentFund.id)
        .order_by(InvestmentFund.ticker, PortfolioTransaction.occurred_on, PortfolioTransaction.id)
    ).all()
    positions: dict[int, dict[str, object]] = {}
    missing_cache: list[str] = []

    for fund, transaction in rows:
        cached_fund = get_cached_fund(fund.ticker)
        if cached_fund is None:
            missing_cache.append(fund.ticker)
        current_price = (
            cached_fund.latest_price if cached_fund else fund.latest_price
        ) or Decimal("0")
        annual_yield = (
            cached_fund.annual_dividend_yield
            if cached_fund
            else fund.annual_dividend_yield
        ) or Decimal("0")
        position = positions.setdefault(
            fund.id,
            {
                "ticker": fund.ticker,
                "name": (cached_fund.name if cached_fund else fund.name),
                "sector": (cached_fund.sector if cached_fund else fund.sector)
                or "Não informado",
                "quantity": 0,
                "net_invested": Decimal("0"),
                "current_price": Decimal(current_price),
                "annual_yield": Decimal(annual_yield),
            },
        )
        sign = Decimal(transaction_sign(transaction.transaction_type))
        position["quantity"] = int(position["quantity"]) + int(sign) * transaction.quantity
        position["net_invested"] = Decimal(position["net_invested"]) + sign * transaction.total_amount

    highlights: list[PortfolioDashboardHighlight] = []
    total_invested = Decimal("0")
    market_value = Decimal("0")
    monthly_income = Decimal("0")
    for position in positions.values():
        quantity = max(0, int(position["quantity"]))
        if quantity == 0:
            continue
        net_invested = max(Decimal("0"), Decimal(position["net_invested"]))
        current_price = Decimal(position["current_price"])
        current_value = current_price * quantity
        average_price = net_invested / quantity if quantity else Decimal("0")
        result_amount = current_value - net_invested
        result_percentage = result_amount / net_invested if net_invested > 0 else Decimal("0")
        annual_yield = Decimal(position["annual_yield"])
        monthly_fund_income = current_value * annual_yield / Decimal("12")
        yield_on_cost = (
            monthly_fund_income * Decimal("12") / net_invested
            if net_invested > 0
            else Decimal("0")
        )
        total_invested += net_invested
        market_value += current_value
        monthly_income += monthly_fund_income
        highlights.append(
            PortfolioDashboardHighlight(
                ticker=str(position["ticker"]),
                name=str(position["name"]),
                sector=str(position["sector"]),
                quantity=quantity,
                average_price=average_price,
                current_price=current_price,
                result_amount=result_amount,
                result_percentage=result_percentage,
                yield_on_cost=yield_on_cost,
                estimated_monthly_income=monthly_fund_income,
            )
        )

    highlights.sort(key=lambda item: item.estimated_monthly_income, reverse=True)
    current_date = date.today()
    dividend_rows = db.execute(
        select(FiiDividendEvent, PortfolioDividendAdjustment)
        .outerjoin(
            PortfolioDividendAdjustment,
            PortfolioDividendAdjustment.dividend_event_id == FiiDividendEvent.id,
        )
        .where(extract("year", FiiDividendEvent.payment_date) == current_date.year)
    ).all()
    received_by_month: dict[int, Decimal] = {}
    for dividend, adjustment in dividend_rows:
        total = dividend.amount_per_share * quantity_at_date(
            dividend.investment_fund_id, dividend.ex_date, db
        )
        if adjustment is not None:
            total += adjustment.amount_delta
        month = dividend.payment_date.month
        received_by_month[month] = received_by_month.get(month, Decimal("0")) + total
    has_calculated_dividends = bool(dividend_rows)
    if has_calculated_dividends:
        monthly_income = received_by_month.get(current_date.month, Decimal("0"))
    cached_recommendation = get_cached_recommendation() or {}
    income_target = Decimal(str(cached_recommendation.get("desired_income", 0)))
    total_return_amount = market_value - total_invested
    total_return_percentage = (
        total_return_amount / total_invested if total_invested > 0 else Decimal("0")
    )
    months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    monthly_income_history = [
        PortfolioDashboardMonth(
            label=month,
            amount=(
                received_by_month.get(index + 1, Decimal("0"))
                if has_calculated_dividends
                else monthly_income
            ),
        )
        for index, month in enumerate(months)
    ]
    portfolio_history = [
        PortfolioDashboardTrend(
            label=month,
            invested_amount=total_invested,
            market_value=market_value,
        )
        for month in months
    ]
    upcoming_income = [
        PortfolioDashboardUpcomingIncome(
            ticker=item.ticker,
            amount=item.estimated_monthly_income,
            payment_label="Estimativa mensal",
        )
        for item in sorted(
            highlights, key=lambda item: item.estimated_monthly_income, reverse=True
        )[:3]
    ]
    scheduled_tickers = schedule_fund_refresh(list(dict.fromkeys(missing_cache)))
    if scheduled_tickers:
        background_tasks.add_task(refresh_fund_cache, scheduled_tickers)
    refreshing_tickers = [
        ticker for ticker in missing_cache if is_fund_refreshing(ticker)
    ]
    response = PortfolioDashboardResponse(
        summary=PortfolioDashboardSummary(
            monthly_income=monthly_income,
            income_target=income_target,
            remaining_to_target=max(Decimal("0"), income_target - monthly_income),
            total_return_percentage=total_return_percentage,
            total_return_amount=total_return_amount,
            total_invested=total_invested,
            market_value=market_value,
        ),
        monthly_income_history=monthly_income_history,
        portfolio_history=portfolio_history,
        upcoming_income=upcoming_income,
        highlights=highlights[:10],
        refreshing_tickers=refreshing_tickers,
    )
    cache_portfolio_dashboard(response.model_dump(mode="json"))
    return response


@router.get("", response_model=PortfolioResponse)
def list_portfolio(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PortfolioResponse:
    rows = db.execute(
        select(
            InvestmentFund.id,
            InvestmentFund.ticker,
            InvestmentFund.name,
            InvestmentFund.sector,
            PortfolioTransaction,
        )
        .join(
            PortfolioTransaction,
            PortfolioTransaction.investment_fund_id == InvestmentFund.id,
        )
        .order_by(
            InvestmentFund.ticker,
            PortfolioTransaction.occurred_on.desc(),
            PortfolioTransaction.id.desc(),
        )
    ).all()
    positions: dict[int, PortfolioPosition] = {}
    for fund_id, ticker, name, sector, transaction in rows:
        position = positions.setdefault(
            fund_id,
            PortfolioPosition(
                fund_id=fund_id,
                ticker=ticker,
                name=name,
                sector=sector or "Não informado",
                total_quantity=0,
                total_value=Decimal("0"),
                transactions=[],
            ),
        )
        sign = transaction_sign(transaction.transaction_type)
        position.total_quantity += sign * transaction.quantity
        position.total_value += sign * transaction.total_amount
        position.transactions.append(
            PortfolioTransactionResponse(
                id=transaction.id,
                investment_fund_id=transaction.investment_fund_id,
                transaction_type=transaction.transaction_type,
                unit_price=transaction.unit_price,
                quantity=transaction.quantity,
                total_amount=transaction.total_amount,
                occurred_on=transaction.occurred_on,
            )
        )

    all_positions = list(positions.values())
    total_items = len(all_positions)
    total_pages = max(1, (total_items + limit - 1) // limit)
    return PortfolioResponse(
        items=all_positions[(page - 1) * limit : page * limit],
        totals=PortfolioTotals(
            total_value=sum(
                (position.total_value for position in all_positions), Decimal("0")
            ),
            total_funds=total_items,
        ),
        page=page,
        limit=limit,
        total_items=total_items,
        total_pages=total_pages,
    )


@router.post(
    "/transactions",
    response_model=PortfolioTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_portfolio_transaction(
    payload: PortfolioTransactionPayload, db: Session = Depends(get_db)
) -> PortfolioTransactionResponse:
    if db.get(InvestmentFund, payload.investment_fund_id) is None:
        raise HTTPException(status_code=404, detail="FII não encontrado.")
    transaction = PortfolioTransaction(
        **payload.model_dump(),
        total_amount=payload.unit_price * payload.quantity,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    clear_portfolio_dashboard_cache()
    return PortfolioTransactionResponse(
        id=transaction.id,
        investment_fund_id=transaction.investment_fund_id,
        transaction_type=transaction.transaction_type,
        unit_price=transaction.unit_price,
        quantity=transaction.quantity,
        total_amount=transaction.total_amount,
        occurred_on=transaction.occurred_on,
    )


@router.put("/transactions/{transaction_id}", response_model=PortfolioTransactionResponse)
def update_portfolio_transaction(
    transaction_id: int,
    payload: PortfolioTransactionPayload,
    db: Session = Depends(get_db),
) -> PortfolioTransactionResponse:
    transaction = db.get(PortfolioTransaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    if db.get(InvestmentFund, payload.investment_fund_id) is None:
        raise HTTPException(status_code=404, detail="FII não encontrado.")

    transaction.investment_fund_id = payload.investment_fund_id
    transaction.transaction_type = payload.transaction_type
    transaction.unit_price = payload.unit_price
    transaction.quantity = payload.quantity
    transaction.total_amount = payload.unit_price * payload.quantity
    transaction.occurred_on = payload.occurred_on
    db.commit()
    db.refresh(transaction)
    clear_portfolio_dashboard_cache()
    return PortfolioTransactionResponse(
        id=transaction.id,
        investment_fund_id=transaction.investment_fund_id,
        transaction_type=transaction.transaction_type,
        unit_price=transaction.unit_price,
        quantity=transaction.quantity,
        total_amount=transaction.total_amount,
        occurred_on=transaction.occurred_on,
    )


@router.delete("/transactions", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_transactions(
    payload: PortfolioTransactionDeletePayload,
    db: Session = Depends(get_db),
) -> None:
    transactions = db.scalars(
        select(PortfolioTransaction).where(PortfolioTransaction.id.in_(payload.ids))
    ).all()
    if len(transactions) != len(set(payload.ids)):
        raise HTTPException(status_code=404, detail="Um ou mais lançamentos não foram encontrados.")
    for transaction in transactions:
        db.delete(transaction)
    db.commit()
    clear_portfolio_dashboard_cache()


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_transaction(transaction_id: int, db: Session = Depends(get_db)) -> None:
    transaction = db.get(PortfolioTransaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    db.delete(transaction)
    db.commit()
    clear_portfolio_dashboard_cache()
