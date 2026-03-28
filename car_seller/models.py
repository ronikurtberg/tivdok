from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class MyCar(BaseModel):
    """Details of the car you want to sell."""

    manufacturer: str = Field(..., description="Manufacturer name in English, e.g. Toyota")
    model: str = Field(..., description="Model name in English, e.g. Corolla")
    sub_model: Optional[str] = Field(None, description="Trim / sub-model, e.g. GLI Premium")
    year: int = Field(..., description="Year of production")
    km: int = Field(..., description="Current mileage in km")
    hand: int = Field(1, description="Number of previous owners (you are the Nth owner)")
    color: Optional[str] = Field(None, description="Color in English")
    gear_box: Optional[str] = Field(None, description="Transmission type, e.g. Automatic")
    engine_type: Optional[str] = Field(None, description="Fuel type, e.g. Petrol, Hybrid")
    engine_volume: Optional[int] = Field(None, description="Engine volume in cc")
    horse_power: Optional[int] = Field(None, description="Horse power")
    doors: Optional[int] = Field(None, description="Number of doors")
    seats: Optional[int] = Field(None, description="Number of seats")
    body_type: Optional[str] = Field(None, description="Body type, e.g. Sedan, SUV")
    city: Optional[str] = Field(None, description="City where the car is located")
    test_date: Optional[str] = Field(None, description="Vehicle test (tesT) expiry date, YYYY-MM")
    asking_price: Optional[int] = Field(None, description="Your desired asking price in ILS")
    description: Optional[str] = Field(None, description="Free-text notes about the car condition")


class Yad2Listing(BaseModel):
    listing_id: str
    url: str
    is_agent: bool = False
    manufacturer_en: Optional[str] = None
    model_en: Optional[str] = None
    sub_model: Optional[str] = None
    year: Optional[int] = None
    km: Optional[int] = None
    hand: Optional[int] = None
    color_en: Optional[str] = None
    engine_volume: Optional[int] = None
    horse_power: Optional[int] = None
    gear_box: Optional[str] = None
    engine_type: Optional[str] = None
    seats: Optional[int] = None
    doors: Optional[int] = None
    body_type: Optional[str] = None
    city_en: Optional[str] = None
    area_en: Optional[str] = None
    price: Optional[int] = None
    currency: str = "ILS"
    cover_image: Optional[str] = None
    listing_description: Optional[str] = None
    test_date: Optional[str] = None
    updated_at: Optional[str] = None
    scraped_at: Optional[str] = None


class MarketAnalysis(BaseModel):
    listings: list[Yad2Listing]
    count: int
    avg_price: Optional[float] = None
    min_price: Optional[int] = None
    max_price: Optional[int] = None
    median_price: Optional[float] = None
    avg_km: Optional[float] = None
    private_count: int = 0
    agent_count: int = 0
