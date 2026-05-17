"""
Run this to verify that kanban move actually persists to DB.
Usage:  cd backend && python debug_kanban_move.py
"""
import asyncio
import sys
sys.path.insert(0, ".")

from sqlalchemy import select, text
from app.db.session import async_session_factory  # adjust import if needed


async def main():
    async with async_session_factory() as db:
        # Show 5 tasks and their board_column_id
        result = await db.execute(
            text("""
                SELECT t.id, t.title, t.status, t.board_column_id, t.updated_at,
                       bc.name as column_name
                FROM tasks t
                LEFT JOIN board_columns bc ON bc.id = t.board_column_id
                ORDER BY t.updated_at DESC
                LIMIT 10
            """)
        )
        rows = result.fetchall()
        print("\n=== Recent Tasks (board_column_id check) ===")
        for r in rows:
            print(f"  id={r.id[:8]}.. | status={r.status:<15} | col_name={str(r.column_name):<15} | board_column_id={str(r.board_column_id)[:8] if r.board_column_id else 'NULL'}..")
        print()

        if not rows:
            print("No tasks found. Is the DB connected?")
            return

        # Try a simulated move on the first task
        task_id = rows[0].id
        print(f"Testing move on task: {task_id[:8]}.. ({rows[0].title[:40]})")
        
        # Get a different column
        col_result = await db.execute(
            text("SELECT id, name, column_type FROM board_columns LIMIT 5")
        )
        cols = col_result.fetchall()
        print("\nAvailable board columns:")
        for c in cols:
            print(f"  id={c.id[:8]}.. | name={c.name:<20} | type={c.column_type}")
        
        if len(cols) < 2:
            print("Not enough columns to test move.")
            return
        
        # Find a different column than current
        current_col = rows[0].board_column_id
        target_col = next((c for c in cols if c.id != current_col), cols[0])
        
        print(f"\nAttempting move to column: {target_col.name} (id={target_col.id[:8]}..) ...")
        await db.execute(
            text("""
                UPDATE tasks 
                SET board_column_id = :col_id, updated_at = now()
                WHERE id = :task_id
            """),
            {"col_id": target_col.id, "task_id": task_id}
        )
        await db.commit()
        
        # Verify
        check = await db.execute(
            text("SELECT board_column_id, updated_at FROM tasks WHERE id = :id"),
            {"id": task_id}
        )
        row = check.fetchone()
        if row.board_column_id == target_col.id:
            print(f"✅ DB SAVE CONFIRMED: board_column_id={row.board_column_id[:8]}.. updated_at={row.updated_at}")
        else:
            print(f"❌ DB SAVE FAILED: board_column_id={row.board_column_id}, expected {target_col.id[:8]}..")


asyncio.run(main())
