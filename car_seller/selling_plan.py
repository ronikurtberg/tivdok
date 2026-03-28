"""Generate a personalized selling plan using OpenAI (or a rule-based fallback)."""
from __future__ import annotations

import os
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown

from car_seller.models import MyCar, MarketAnalysis

console = Console()


def _fmt_ils(amount: Optional[float]) -> str:
    if amount is None:
        return "N/A"
    return f"₪{int(amount):,}"


def _rule_based_plan(car: MyCar, analysis: MarketAnalysis, official_price: Optional[int]) -> str:
    """Fallback plan when OpenAI is not available."""
    avg = analysis.avg_price
    median = analysis.median_price
    low = analysis.min_price
    high = analysis.max_price

    # Suggested price band
    if avg and median:
        suggested_low = int(min(avg, median) * 0.97)
        suggested_high = int(max(avg, median) * 1.03)
    elif avg:
        suggested_low = int(avg * 0.95)
        suggested_high = int(avg * 1.05)
    else:
        suggested_low = None
        suggested_high = None

    your_price = car.asking_price
    price_comment = ""
    if your_price and suggested_low and suggested_high:
        if your_price < suggested_low:
            price_comment = f"⚠️ Your asking price (₪{your_price:,}) is **below** the market average — you may be underpricing. Consider raising it."
        elif your_price > suggested_high:
            price_comment = f"⚠️ Your asking price (₪{your_price:,}) is **above** the market average — this may slow the sale. Consider adjusting it."
        else:
            price_comment = f"✅ Your asking price (₪{your_price:,}) is **well within** the market range."

    private_pct = int(analysis.private_count / analysis.count * 100) if analysis.count else 0

    lines = [
        f"# 🚗 Selling Plan — {car.year} {car.manufacturer} {car.model}",
        "",
        "## 📊 Market Overview",
        f"- **Listings analyzed:** {analysis.count}",
        f"- **Price range:** {_fmt_ils(low)} – {_fmt_ils(high)}",
        f"- **Average price:** {_fmt_ils(avg)}",
        f"- **Median price:** {_fmt_ils(median)}",
        f"- **Average km:** {_fmt_ils(analysis.avg_km)}",
        f"- **Private sellers:** {analysis.private_count} ({private_pct}%)  |  **Dealers:** {analysis.agent_count}",
    ]

    if official_price:
        depreciation = round((1 - (avg / official_price)) * 100, 1) if avg else None
        lines += [
            "",
            "## 🏛️ Official Catalog Price",
            f"- **Catalog (mankal) price:** {_fmt_ils(official_price)}",
        ]
        if depreciation:
            lines.append(f"- **Market depreciation vs. catalog:** {depreciation}%")

    lines += [
        "",
        "## 💰 Recommended Asking Price",
    ]
    if suggested_low and suggested_high:
        lines.append(f"- **Suggested range:** {_fmt_ils(suggested_low)} – {_fmt_ils(suggested_high)}")
    if price_comment:
        lines.append(f"- {price_comment}")

    # Condition-based adjustments
    adjustments = []
    if car.km and avg and analysis.avg_km:
        if car.km < analysis.avg_km * 0.85:
            adjustments.append("✅ **Low mileage** — justify +3–5% premium over market avg")
        elif car.km > analysis.avg_km * 1.15:
            adjustments.append("⚠️ **High mileage** — expect buyers to negotiate 3–5% below market avg")

    if car.hand == 1:
        adjustments.append("✅ **First-hand car** — strong selling point, commands premium")
    elif car.hand and car.hand >= 3:
        adjustments.append("⚠️ **3+ owners** — be transparent and price competitively")

    if car.test_date:
        month_str = car.test_date[:7]
        adjustments.append(f"📋 **Test (tesт) valid until {month_str}** — mention prominently in listing")

    if adjustments:
        lines += ["", "## 🔧 Price Adjustment Factors"] + [f"- {a}" for a in adjustments]

    lines += [
        "",
        "## 📣 Where to Sell",
        "- **Yad2.co.il** — Israel's #1 platform, highest reach (paid listing recommended)",
        "- **Facebook Marketplace / Groups** — Free, large audience in local groups",
        "- **AutoTrader Israel (auto1.co.il)** — Secondary option for broader exposure",
        "- **Word of mouth** — Share in WhatsApp groups, neighborhood communities",
        "",
        "## 📸 Listing Tips",
        "- Take 15–20 high-quality photos: exterior (all angles), interior, engine, dashboard, tires",
        "- Shoot in daylight with a clean, neutral background",
        "- Include the odometer reading in the photos",
        "- Write an honest, detailed description: service history, condition, reason for selling",
        "",
        "## 🤝 Negotiation Strategy",
        "- Set your listed price **3–5% above** your minimum to leave negotiation room",
        "- Prepare all documents in advance: ownership (רישיון רכב), service history, tesт certificate",
        "- Be transparent about any faults — builds trust and speeds up the sale",
        "- Accompany buyers on a test drive; stay in the car",
        "- Never accept payment before full transfer (העברת בעלות) is completed",
        "",
        "## ⏱️ Estimated Time to Sell",
    ]

    if analysis.count > 50:
        lines.append("- **High competition** — expect 2–6 weeks; price sharply to stand out")
    elif analysis.count > 20:
        lines.append("- **Moderate market** — expect 3–8 weeks at the right price")
    else:
        lines.append("- **Low supply** — this model is in demand; expect 1–4 weeks")

    lines += [
        "",
        "---",
        "*Plan generated by Car Seller Assistant. Prices are estimates based on live Yad2 data.*",
    ]
    return "\n".join(lines)


def _openai_plan(car: MyCar, analysis: MarketAnalysis, official_price: Optional[int]) -> str:
    """Use OpenAI to generate a richer, personalized selling plan."""
    import openai

    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    car_summary = (
        f"{car.year} {car.manufacturer} {car.model}"
        + (f" {car.sub_model}" if car.sub_model else "")
        + f", {car.km:,} km, hand #{car.hand}"
        + (f", {car.color}" if car.color else "")
        + (f", {car.gear_box}" if car.gear_box else "")
        + (f", {car.engine_type}" if car.engine_type else "")
        + (f", test until {car.test_date}" if car.test_date else "")
        + (f", located in {car.city}" if car.city else "")
        + (f", asking price ₪{car.asking_price:,}" if car.asking_price else "")
        + (f". Notes: {car.description}" if car.description else "")
    )

    market_summary = (
        f"Market data from Yad2: {analysis.count} similar listings. "
        f"Price range: ₪{analysis.min_price:,}–₪{analysis.max_price:,}. "
        f"Average: ₪{int(analysis.avg_price):,}. Median: ₪{int(analysis.median_price):,}. "
        f"Avg km: {int(analysis.avg_km):,}. "
        f"Private sellers: {analysis.private_count}, dealers: {analysis.agent_count}."
    ) if analysis.avg_price else f"Market data: {analysis.count} listings scraped."

    official_str = f"Official catalog price: ₪{official_price:,}." if official_price else "No official catalog price found."

    prompt = f"""You are an expert Israeli car sales advisor. A seller wants to sell their car.

Car details: {car_summary}
{market_summary}
{official_str}

Write a comprehensive, actionable selling plan in Markdown. Include:
1. Market position analysis (how this car compares to the market)
2. Recommended asking price with reasoning
3. Key selling points to highlight
4. Where to advertise (platforms, groups)
5. How to write a compelling listing (title, description tips)
6. Photo tips
7. Negotiation strategy
8. Estimated time to sell
9. Documents to prepare

Be specific to the Israeli car market. Use ₪ for prices. Be concise but thorough.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=2000,
    )
    return response.choices[0].message.content


def generate_selling_plan(car: MyCar, analysis: MarketAnalysis, official_price: Optional[int] = None) -> str:
    """
    Generate a selling plan. Uses OpenAI if OPENAI_API_KEY is set, else rule-based fallback.
    """
    console.print("\n[bold cyan]▶ Generating your personalized selling plan…[/]")

    openai_key = os.getenv("OPENAI_API_KEY", "")
    if openai_key and openai_key != "your_openai_api_key_here":
        try:
            plan = _openai_plan(car, analysis, official_price)
            console.print("  [green]✓ Plan generated with OpenAI GPT-4o-mini[/]")
            return plan
        except Exception as e:
            console.print(f"  [yellow]OpenAI unavailable ({e}), using rule-based plan.[/]")

    plan = _rule_based_plan(car, analysis, official_price)
    console.print("  [green]✓ Plan generated (rule-based)[/]")
    return plan


def display_plan(plan: str) -> None:
    console.print("\n")
    console.print(Panel(Markdown(plan), title="[bold green]Your Selling Plan[/]", border_style="green", expand=True))
