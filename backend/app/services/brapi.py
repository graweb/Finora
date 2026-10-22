import json
from dataclasses import dataclass
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class BrapiError(Exception):
    """Raised when the brapi request cannot provide a valid FII quote."""


@dataclass(frozen=True)
class BrapiFundData:
    ticker: str
    name: str
    sector: str | None
    latest_price: Decimal | None
    annual_dividend_yield: Decimal | None


def fetch_fund_quote(ticker: str, token: str, fii_list_url: str) -> BrapiFundData:
    normalized_ticker = ticker.strip().upper()
    query = urlencode({"symbols": normalized_ticker})
    request = Request(
        f"{fii_list_url}?{query}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.load(response)
    except HTTPError as error:
        if error.code == 404:
            raise BrapiError("FII não encontrado na brapi.") from error
        if error.code == 401:
            raise BrapiError("A chave da brapi é inválida ou não foi informada.") from error
        if error.code == 403:
            raise BrapiError(
                "Seu plano da brapi não inclui os dados de FIIs para este ativo."
            ) from error
        raise BrapiError("A brapi não pôde atender a consulta agora.") from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise BrapiError("Não foi possível consultar a brapi.") from error

    fiis = payload.get("fiis", [])
    if not fiis:
        raise BrapiError("FII não encontrado na brapi.")

    result = next(
        (
            fii
            for fii in fiis
            if fii.get("symbol", "").upper() == normalized_ticker
        ),
        fiis[0],
    )
    price = result.get("price")
    annual_yield = result.get("dividendYield12m")

    return BrapiFundData(
        ticker=result.get("symbol", normalized_ticker).upper(),
        name=result.get("name") or normalized_ticker,
        sector=result.get("segmentoAtuacao") or result.get("segmentType"),
        latest_price=Decimal(str(price)) if price is not None else None,
        annual_dividend_yield=(
            Decimal(str(annual_yield)) if annual_yield is not None else None
        ),
    )
