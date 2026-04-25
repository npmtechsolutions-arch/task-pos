import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.support import Ticket
from app.schemas.support import TicketResponse

DATABASE_URL = "postgresql+asyncpg://postgres:r7UPnC2N67TIE5HjvJhR5oleeygZ1icwt9nvwuSar5bnvxyY8Oux1pRmAlCxSfp7@168.144.67.169:5440/postgres?ssl=disable"

async def test_validation():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(select(Ticket))
        tickets = result.scalars().all()
        for t in tickets:
            try:
                resp = TicketResponse.model_validate(t)
                print(f"Success validating ticket {t.id}")
            except Exception as e:
                print(f"Validation error for {t.id}: {e}")
                
    await engine.dispose()

asyncio.run(test_validation())
