import json
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class FundsExplorerError(Exception):
    """Raised when a Funds Explorer page cannot provide valid FII data."""


@dataclass(frozen=True)
class FundsExplorerFundData:
    ticker: str
    name: str
    sector: str | None
    latest_price: Decimal | None
    annual_dividend_yield: Decimal | None
    dividend_events: tuple["FundsExplorerDividendEvent", ...] = ()


@dataclass(frozen=True)
class FundsExplorerDividendEvent:
    ex_date: date
    payment_date: date
    amount_per_share: Decimal


def _to_decimal(value: object) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _parse_dividend_events(page: str) -> tuple[FundsExplorerDividendEvent, ...]:
    events: list[FundsExplorerDividendEvent] = []
    pattern = re.compile(
        r'<div class="table__linha">\s*Rendimento\s*</div>\s*'
        r'<div class="table__linha">\s*([^<]+)\s*</div>\s*'
        r'<div class="table__linha">\s*([^<]+)\s*</div>\s*'
        r'<div class="table__linha">\s*[^<]+\s*</div>\s*'
        r'<div class="table__linha">\s*([^<]+)\s*</div>',
        flags=re.DOTALL,
    )
    for match in pattern.finditer(page):
        try:
            ex_date = date.fromisoformat(match.group(1).strip())
            payment_date = date.fromisoformat(match.group(2).strip())
        except ValueError:
            continue
        amount = _to_decimal(
            match.group(3).replace("R$", "").replace(".", "").replace(",", ".").strip()
        )
        if amount is not None and amount >= 0:
            events.append(
                FundsExplorerDividendEvent(
                    ex_date=ex_date,
                    payment_date=payment_date,
                    amount_per_share=amount,
                )
            )
    return tuple(dict.fromkeys(events))


def fetch_fund(ticker: str, base_url: str) -> FundsExplorerFundData:
    normalized_ticker = ticker.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{1,10}", normalized_ticker):
        raise FundsExplorerError("Ticker de FII inválido para consulta.")

    request = Request(
        f"{base_url.rstrip('/')}/funds/{quote(normalized_ticker.lower())}",
        headers={
            "Accept": "text/html",
            "User-Agent": "Finora FII importer/1.0 (local development)",
        },
    )
    try:
        with urlopen(request, timeout=15) as response:
            page = response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as error:
        raise FundsExplorerError("Não foi possível consultar o Funds Explorer.") from error

    match = re.search(r'"meta":(\{.*?\})\},"browserName"', page, re.DOTALL)
    if match is None:
        raise FundsExplorerError("Dados do FII não foram encontrados no Funds Explorer.")

    try:
        metadata = json.loads(match.group(1))
    except json.JSONDecodeError as error:
        raise FundsExplorerError("Resposta inválida do Funds Explorer.") from error

    source_ticker = str(metadata.get("codigo") or normalized_ticker).upper()
    name = str(metadata.get("name") or metadata.get("fundname") or source_ticker)
    dividend_yield = _to_decimal(metadata.get("dy"))
    return FundsExplorerFundData(
        ticker=source_ticker,
        name=name,
        sector=metadata.get("setor_atuacao") or metadata.get("segmento_atuacao"),
        latest_price=_to_decimal(metadata.get("valor")),
        annual_dividend_yield=(
            dividend_yield / Decimal("100") if dividend_yield is not None else None
        ),
        dividend_events=_parse_dividend_events(page),
    )
