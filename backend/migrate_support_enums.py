"""
Migration: Convert Support Ticket ENUMs to VARCHAR
Run once: python migrate_support_enums.py
"""
# -*- coding: utf-8 -*-
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:r7UPnC2N67TIE5HjvJhR5oleeygZ1icwt9nvwuSar5bnvxyY8Oux1pRmAlCxSfp7@168.144.67.169:5440/postgres?ssl=disable"
)

async def run():
    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        print("=== Support Tickets ENUM Migration Starting ===")

        # We will alter the columns to be plain VARCHAR(50) 
        # so native_enum=False works perfectly and no casting errors happen.
        cols = [
            ("tickets", "status", "VARCHAR(50)"),
            ("tickets", "priority", "VARCHAR(50)"),
            ("tickets", "category", "VARCHAR(50)"),
        ]
        
        for table, col, coltype in cols:
            try:
                # Cast existing enum to varchar
                await conn.execute(text(
                    f"ALTER TABLE {table} ALTER COLUMN {col} TYPE {coltype} USING {col}::VARCHAR;"
                ))
                print(f"OK: {table}.{col} converted to {coltype}")
            except Exception as e:
                print(f"SKIP (or already converted): {table}.{col} -> {e}")

        print("=== Migration complete! ===")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run())
