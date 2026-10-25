from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.fii_dividend_event import FiiDividendEvent
from app.models.investment_fund import InvestmentFund
from app.services.funds_explorer import FundsExplorerDividendEvent


def upsert_dividend_events(
    db: Session,
    fund: InvestmentFund,
    events: tuple[FundsExplorerDividendEvent, ...],
) -> int:
    existing = {
        (event.ex_date, event.payment_date, event.amount_per_share)
        for event in db.scalars(
            select(FiiDividendEvent).where(
                FiiDividendEvent.investment_fund_id == fund.id
            )
        )
    }
    added = 0
    for event in events:
        identity = (event.ex_date, event.payment_date, event.amount_per_share)
        if identity in existing:
            continue
        db.add(
            FiiDividendEvent(
                investment_fund_id=fund.id,
                ex_date=event.ex_date,
                payment_date=event.payment_date,
                amount_per_share=event.amount_per_share,
                source="funds_explorer",
            )
        )
        existing.add(identity)
        added += 1
    return added
