from sqlalchemy.orm import Session

from app.models.investment_policy import InvestmentPolicy


def get_or_create_investment_policy(db: Session) -> InvestmentPolicy:
    policy = db.get(InvestmentPolicy, 1)
    if policy is None:
        policy = InvestmentPolicy(id=1)
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy
