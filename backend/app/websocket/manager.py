"""WebSocket connection manager."""

from typing import Dict, List, Set

from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """Manage WebSocket connections."""

    def __init__(self):
        # Map of user_id to list of WebSocket connections
        self.active_connections: Dict[str, List] = {}
        # Map of room name to set of user_ids
        self.rooms: Dict[str, Set[str]] = {}

    async def connect(self, websocket, user_id: str):
        """Accept connection and register user."""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)
        logger.info("WebSocket connected", user_id=user_id)

    def disconnect(self, websocket, user_id: str):
        """Remove connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)

            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        logger.info("WebSocket disconnected", user_id=user_id)

    async def send_to_user(self, user_id: str, message: dict):
        """Send message to specific user."""
        if user_id not in self.active_connections:
            return

        disconnected = []
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected sockets
        for conn in disconnected:
            self.disconnect(conn, user_id)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected users."""
        for user_id in list(self.active_connections.keys()):
            await self.send_to_user(user_id, message)

    async def join_room(self, user_id: str, room: str):
        """Add user to room."""
        if room not in self.rooms:
            self.rooms[room] = set()

        self.rooms[room].add(user_id)
        logger.info("User joined room", user_id=user_id, room=room)

    async def leave_room(self, user_id: str, room: str):
        """Remove user from room."""
        if room in self.rooms:
            self.rooms[room].discard(user_id)

            if not self.rooms[room]:
                del self.rooms[room]

        logger.info("User left room", user_id=user_id, room=room)

    async def send_to_room(self, room: str, message: dict):
        """Send message to all users in room."""
        if room not in self.rooms:
            return

        for user_id in self.rooms[room]:
            await self.send_to_user(user_id, message)


# Global connection manager instance
manager = ConnectionManager()
