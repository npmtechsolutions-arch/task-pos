"""WebSocket connection manager."""

from typing import Dict, List, Set

from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """Manage WebSocket connections with room support."""

    def __init__(self):
        # Map of user_id to list of WebSocket connections (multi-tab support)
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
            try:
                self.active_connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info("WebSocket disconnected", user_id=user_id)

    async def send_to_user(self, user_id: str, message: dict):
        """Send message to specific user (all their tabs)."""
        if user_id not in self.active_connections:
            return
        disconnected = []
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn, user_id)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected users."""
        for user_id in list(self.active_connections.keys()):
            await self.send_to_user(user_id, message)

    async def broadcast_to_users(self, user_ids: List[str], message: dict):
        """Broadcast to a specific set of users (deduplicates internally)."""
        for uid in set(user_ids):
            await self.send_to_user(uid, message)

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
        for user_id in list(self.rooms.get(room, set())):
            await self.send_to_user(user_id, message)

    async def send_to_room_except(self, room: str, exclude_user_id: str, message: dict):
        """Broadcast to room but skip the sender (prevents double-display)."""
        if room not in self.rooms:
            return
        for user_id in list(self.rooms.get(room, set())):
            if user_id != exclude_user_id:
                await self.send_to_user(user_id, message)

    def get_room_users(self, room: str) -> Set[str]:
        """Return set of user_ids currently in a room."""
        return self.rooms.get(room, set()).copy()

    def is_user_online(self, user_id: str) -> bool:
        """Check whether a user has at least one active connection."""
        return user_id in self.active_connections and bool(self.active_connections[user_id])

    def get_online_user_ids(self) -> List[str]:
        """Return all currently connected user IDs."""
        return list(self.active_connections.keys())


# Global connection manager instance
manager = ConnectionManager()
