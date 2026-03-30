from typing import List
from fastapi import WebSocket
from . import models


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[tuple[WebSocket, models.User]] = []

    async def connect(self, websocket: WebSocket, user: models.User, subprotocol: str | None = None):
        await websocket.accept(subprotocol=subprotocol)
        self.active_connections.append((websocket, user))

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            (connection, user)
            for connection, user in self.active_connections
            if connection != websocket
        ]

    def is_admin_connection(self, websocket: WebSocket) -> bool:
        for connection, user in self.active_connections:
            if connection == websocket:
                role = getattr(user, "role", None)
                return isinstance(role, str) and role == "admin"
        return False

    async def broadcast(self, message: str):
        for connection, _user in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()
