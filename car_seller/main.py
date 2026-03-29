"""Main CLI entrypoint for Car Seller Assistant."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm

load_dotenv()

from car_seller.models import MyCar
from car_seller.my_car_wizard import collect_car_details, save_car, load_cars, pick_car
from car_seller.scraper import scrape_market
from car_seller.official_price import lookup_official_price
from car_seller.display import print_car_summary, print_market_analysis
from car_seller.selling_plan import generate_selling_plan, display_plan

app = typer.Typer(
    name="car-seller",
    help="🚗 Car Selling Assistant — scrape Yad2, check official prices, get a selling plan.",
    add_completion=False,
)
console = Console()

BANNER = """[bold green]
╔══════════════════════════════════════════════╗
║       🚗  Car Seller Assistant  🚗           ║
║   Yad2 Market Data · Official Prices · Plan  ║
╚══════════════════════════════════════════════╝
[/]"""


@app.command("add")
def cmd_add():
    """Add a new car to your garage (saved locally)."""
    console.print(BANNER)
    car = collect_car_details()
    console.print("\n[bold]Review your car:[/]")
    print_car_summary(car)
    if Confirm.ask("  Save this car?"):
        save_car(car)


@app.command("list")
def cmd_list():
    """List your saved cars."""
    console.print(BANNER)
    cars = load_cars()
    if not cars:
        console.print("[yellow]No cars saved yet. Run `car-seller add` to add one.[/]")
        return
    console.print(f"[bold]You have {len(cars)} saved car(s):[/]\n")
    for i, car in enumerate(cars, 1):
        price_str = f"  Asking: ₪{car.asking_price:,}" if car.asking_price else ""
        km_str = f"  {car.km:,} km"
        console.print(f"  [cyan]{i}.[/] [bold]{car.year} {car.manufacturer} {car.model}[/]{km_str}{price_str}")


@app.command("analyze")
def cmd_analyze(
    max_items: int = typer.Option(200, "--max-items", "-n", help="Max Yad2 listings to fetch (default 200)"),
    exclude_agents: bool = typer.Option(False, "--private-only", help="Only include private sellers"),
    no_official_price: bool = typer.Option(False, "--no-official-price", help="Skip official catalog price lookup"),
    save_plan: Optional[Path] = typer.Option(None, "--save", "-o", help="Save selling plan to a markdown file"),
    debug: bool = typer.Option(False, "--debug", help="Print raw Yad2 API response and exit (for troubleshooting)"),
):
    """
    Full analysis: pick a saved car → scrape Yad2 → official price → selling plan.
    """
    console.print(BANNER)

    # Load or create car
    cars = load_cars()
    car: Optional[MyCar] = None

    if cars:
        console.print("[bold]Select a car to analyze:[/]")
        console.print(f"  [cyan]0.[/] Enter new car details")
        for i, c in enumerate(cars, 1):
            price_str = f"  (asking ₪{c.asking_price:,})" if c.asking_price else ""
            console.print(f"  [cyan]{i}.[/] {c.year} {c.manufacturer} {c.model} — {c.km:,} km{price_str}")
        from car_seller.my_car_wizard import _ask_int
        idx = _ask_int(f"  Enter choice [0-{len(cars)}]")
        if idx == 0 or idx is None:
            car = collect_car_details()
            if Confirm.ask("  Save this car for future use?"):
                save_car(car)
        elif 1 <= idx <= len(cars):
            car = cars[idx - 1]
        else:
            console.print("[red]Invalid selection.[/]")
            raise typer.Exit(1)
    else:
        console.print("[yellow]No saved cars found. Let's add your car details now.[/]\n")
        car = collect_car_details()
        if Confirm.ask("  Save this car for future use?"):
            save_car(car)

    console.print("\n[bold]Car to analyze:[/]")
    print_car_summary(car)

    # Step 1: Scrape Yad2
    console.rule("[bold cyan]Step 1: Yad2 Market Scrape[/]")
    try:
        analysis = scrape_market(car, max_items=max_items, exclude_agents=exclude_agents, debug=debug)
    except ValueError as e:
        console.print(f"[red]Error:[/] {e}")
        raise typer.Exit(1)
    except RuntimeError as e:
        console.print(f"[red]Scraper error:[/] {e}")
        raise typer.Exit(1)

    print_market_analysis(analysis, car)

    # Step 2: Official price
    official_price: Optional[int] = None
    if not no_official_price:
        console.rule("[bold cyan]Step 2: Official Catalog Price[/]")
        official_price = lookup_official_price(car)
        if official_price:
            console.print(f"  [bold green]Official catalog price: ₪{official_price:,}[/]")
        else:
            console.print("  [yellow]Official catalog price not found.[/]")

    # Step 3: Selling plan
    console.rule("[bold cyan]Step 3: Selling Plan[/]")
    plan = generate_selling_plan(car, analysis, official_price)
    display_plan(plan)

    if save_plan:
        save_plan.write_text(plan, encoding="utf-8")
        console.print(f"\n[green]✓ Plan saved to {save_plan}[/]")

    console.print("\n[bold green]✅ Analysis complete. Good luck with your sale![/]")


@app.command("plan")
def cmd_plan(
    save: Optional[Path] = typer.Option(None, "--save", "-o", help="Save plan to a markdown file"),
):
    """
    Generate a selling plan from cached Yad2 data (no scrape). 
    Useful if you already ran `analyze` and want to regenerate the plan.
    """
    console.print(BANNER)
    cars = load_cars()
    if not cars:
        console.print("[yellow]No saved cars. Run `car-seller add` first.[/]")
        raise typer.Exit(1)
    car = pick_car(cars)
    if not car:
        raise typer.Exit(1)
    console.print("[yellow]Note: Running plan-only mode. Yad2 data is not fresh — run `analyze` for live data.[/]")
    from car_seller.models import MarketAnalysis
    empty_analysis = MarketAnalysis(listings=[], count=0)
    official_price = lookup_official_price(car)
    plan = generate_selling_plan(car, empty_analysis, official_price)
    display_plan(plan)
    if save:
        save.write_text(plan, encoding="utf-8")
        console.print(f"\n[green]✓ Plan saved to {save}[/]")


def main():
    app()


if __name__ == "__main__":
    main()
