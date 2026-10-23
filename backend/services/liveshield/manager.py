"""
manager.py — Simulation Worker Manager, Process Recovery Sweep,
Distributed Lease Locking, and WebSocket Event Hub.
"""
import asyncio
from datetime import datetime, timezone
import json
import logging
import os
import uuid
from typing import Dict, Set, Optional, Any

from fastapi import WebSocket
from sqlalchemy.orm import Session

from db.database import SessionLocal
from models.liveshield import Simulation, SimulationEvent
from services.liveshield.engine import SimulationEngine

logger = logging.getLogger("liveshield")


class SimulationManager:
    def __init__(self):
        self.worker_id = f"worker-{os.getpid()}-{uuid.uuid4().hex[:6]}"
        self.active_engines: Dict[int, SimulationEngine] = {}
        self.websocket_listeners: Dict[int, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        
        # Execute startup recovery sweep
        self.perform_startup_recovery_sweep()

    def perform_startup_recovery_sweep(self):
        """
        Worker Recovery Sweep:
        Detects any simulations left in 'RUNNING' or 'PAUSING' state from a previous backend process crash.
        Safely transitions them to 'PAUSED' and logs a SYSTEM_RECOVERY event so operators can cleanly resume.
        """
        try:
            db: Session = SessionLocal()
            orphaned = db.query(Simulation).filter(
                Simulation.status.in_(["RUNNING", "PAUSING"])
            ).all()

            for sim in orphaned:
                logger.warning(
                    "Recovery Sweep: Found orphaned simulation %d in '%s' state. Transitioning to 'PAUSED'.",
                    sim.id, sim.status
                )
                sim.status = "PAUSED"
                sim.worker_id = None
                sim.heartbeat_at = None
                
                db.add(sim)
                db.add(SimulationEvent(
                    simulation_id=sim.id,
                    event_type="SYSTEM_RECOVERY",
                    message="Backend process restart detected. Simulation safely transitioned to PAUSED.",
                    details={"recovered_by": self.worker_id, "previous_status": "RUNNING"},
                ))

            db.commit()
            db.close()
            if orphaned:
                logger.info("Recovery sweep completed: %d simulations recovered.", len(orphaned))
        except Exception as e:
            logger.error("Error during startup recovery sweep: %s", e)

    async def get_or_create_engine(self, simulation_id: int, config: Dict[str, Any]) -> SimulationEngine:
        """Retrieve existing active engine or instantiate a new one."""
        async with self._lock:
            if simulation_id in self.active_engines:
                return self.active_engines[simulation_id]

            # Worker lease lock check in DB
            db: Session = SessionLocal()
            sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
            if sim:
                sim.worker_id = self.worker_id
                sim.heartbeat_at = datetime.now(timezone.utc)
                db.add(sim)
                db.commit()
            db.close()

            engine = SimulationEngine(
                simulation_id=simulation_id,
                config=config,
                on_event_callback=lambda event: self.broadcast_event_sync(simulation_id, event, "stats"),
                on_transaction_callback=lambda txn: self.broadcast_event_sync(simulation_id, txn, "transaction"),
                on_decision_callback=lambda dec: self.broadcast_event_sync(simulation_id, dec, "decision"),
            )
            self.active_engines[simulation_id] = engine
            return engine

    def get_active_engine(self, simulation_id: int) -> Optional[SimulationEngine]:
        return self.active_engines.get(simulation_id)

    async def remove_engine(self, simulation_id: int):
        async with self._lock:
            if simulation_id in self.active_engines:
                engine = self.active_engines.pop(simulation_id)
                await engine.stop()

    # ============================================================
    # WEBSOCKET BROADCASTING
    # ============================================================

    def register_websocket(self, simulation_id: int, ws: WebSocket):
        if simulation_id not in self.websocket_listeners:
            self.websocket_listeners[simulation_id] = set()
        self.websocket_listeners[simulation_id].add(ws)

    def unregister_websocket(self, simulation_id: int, ws: WebSocket):
        if simulation_id in self.websocket_listeners:
            self.websocket_listeners[simulation_id].discard(ws)
            if not self.websocket_listeners[simulation_id]:
                del self.websocket_listeners[simulation_id]

    def broadcast_event_sync(self, simulation_id: int, data: Any, event_type: str = "stats"):
        """Thread-safe and async-safe WebSocket event broadcast."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._broadcast_async(simulation_id, data, event_type))
        except RuntimeError:
            pass

    async def _broadcast_async(self, simulation_id: int, data: Any, event_type: str):
        listeners = self.websocket_listeners.get(simulation_id, set()).copy()
        if not listeners:
            return

        payload = {
            "type": event_type,
            "simulation_id": simulation_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }

        # JSON serialize with Decimal & Datetime handling
        def json_serial(obj):
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            if hasattr(obj, "__str__"):
                return str(obj)
            raise TypeError(f"Type {type(obj)} not serializable")

        msg = json.dumps(payload, default=json_serial)

        disconnected = set()
        for ws in listeners:
            try:
                await ws.send_text(msg)
            except Exception:
                disconnected.add(ws)

        for ws in disconnected:
            self.unregister_websocket(simulation_id, ws)


# Global singleton manager
simulation_manager = SimulationManager()
