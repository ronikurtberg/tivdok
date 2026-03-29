"""Rich display helpers for market analysis results."""
from __future__ import annotations

from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box

from car_seller.models import MyCar, MarketAnalysis, Yad2Listing

console = Console()


def _fmt_ils(amount: Optional[float]) -> str:
    if amount is None:
        return "[dim]N/A[/]"
    return f"₪{int(amount):,}"


def print_car_summary(car: MyCar) -> None:
    table = Table(box=box.ROUNDED, show_header=False, title="[bold]Your Car[/]")
    table.add_column("Field", style="cyan", no_wrap=True)
    table.add_column("Value", style="white")

    rows = [
        ("Manufacturer", car.manufacturer),
        ("Model", car.model),
        ("Sub-model", car.sub_model or "—"),
        ("Year", str(car.year)),
        ("Mileage", f"{car.km:,} km"),
        ("Owners", str(car.hand)),
        ("Color", car.color or "—"),
        ("Transmission", car.gear_box or "—"),
        ("Fuel type", car.engine_type or "—"),
        ("Engine", f"{car.engine_volume} cc" if car.engine_volume else "—"),
        ("Horse power", f"{car.horse_power} hp" if car.horse_power else "—"),
        ("Body type", car.body_type or "—"),
        ("Doors / Seats", f"{car.doors or '—'} / {car.seats or '—'}"),
        ("City", car.city or "—"),
        ("Test expiry", car.test_date or "—"),
        ("Asking price", _fmt_ils(car.asking_price) if car.asking_price else "—"),
        ("Notes", car.description or "—"),
    ]

    for field, value in rows:
        table.add_row(field, value)

    console.print(Panel(table, border_style="blue", expand=False))


def print_market_analysis(analysis: MarketAnalysis, car: MyCar) -> None:
    console.print("\n")

    # Stats panel
    stats = Table(box=box.SIMPLE_HEAVY, show_header=False, title="[bold]📊 Market Analysis[/]")
    stats.add_column("Metric", style="cyan")
    stats.add_column("Value", style="bold white")

    stats.add_row("Total listings found", str(analysis.count))
    stats.add_row("Private sellers", f"{analysis.private_count}  ({int(analysis.private_count/analysis.count*100) if analysis.count else 0}%)")
    stats.add_row("Dealer listings", str(analysis.agent_count))
    stats.add_row("Price range", f"{_fmt_ils(analysis.min_price)} – {_fmt_ils(analysis.max_price)}")
    stats.add_row("Average price", _fmt_ils(analysis.avg_price))
    stats.add_row("Median price", _fmt_ils(analysis.median_price))
    stats.add_row("Average mileage", f"{int(analysis.avg_km):,} km" if analysis.avg_km else "N/A")

    # Highlight your price vs market
    if car.asking_price and analysis.avg_price:
        diff = car.asking_price - analysis.avg_price
        diff_pct = diff / analysis.avg_price * 100
        sign = "+" if diff >= 0 else ""
        color = "yellow" if abs(diff_pct) > 5 else "green"
        stats.add_row(
            "Your price vs. market avg",
            f"[{color}]{sign}₪{int(diff):,} ({sign}{diff_pct:.1f}%)[/]",
        )

    console.print(Panel(stats, border_style="cyan", expand=False))

    # Top 10 cheapest private listings table
    private = [l for l in analysis.listings if not l.is_agent and l.price]
    private_sorted = sorted(private, key=lambda l: l.price)[:10]

    if private_sorted:
        console.print("\n[bold]🔟 10 Cheapest Private Listings on Yad2[/]")
        tbl = Table(box=box.ROUNDED, show_lines=True)
        tbl.add_column("Year", style="dim", width=6)
        tbl.add_column("Sub-model", style="white")
        tbl.add_column("KM", justify="right")
        tbl.add_column("Hand", justify="center")
        tbl.add_column("Price", style="bold green", justify="right")
        tbl.add_column("City")
        tbl.add_column("URL", style="blue dim")

        for l in private_sorted:
            tbl.add_row(
                str(l.year or "—"),
                l.sub_model or "—",
                f"{l.km:,}" if l.km else "—",
                str(l.hand) if l.hand else "—",
                f"₪{l.price:,}",
                l.city_en or "—",
                l.url,
            )
        console.print(tbl)
