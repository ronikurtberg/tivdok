"""Uvicorn entrypoint for the Car Seller FastAPI app."""
import uvicorn


def main():
    uvicorn.run(
        "car_seller.api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["car_seller"],
    )


if __name__ == "__main__":
    main()
