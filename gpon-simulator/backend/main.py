"""
GPON Network Simulator Backend
FastAPI application with WebSocket support
"""

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Dict, Optional
import json
import asyncio
from datetime import datetime

from models.device import DeviceManager
from models.protocols import ProtocolSimulator
from models.scenarios import ScenarioRunner, load_scenarios
from api.topology import router as topology_router
from api.devices import router as devices_router
from api.scenarios import router as scenarios_router
from api.metrics import router as metrics_router

app = FastAPI(
    title="GPON Network Simulator API",
    description="Backend API for GPON network simulation and attack scenarios",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(topology_router, prefix="/api/topology", tags=["topology"])
app.include_router(devices_router, prefix="/api/devices", tags=["devices"])
app.include_router(scenarios_router, prefix="/api/scenarios", tags=["scenarios"])
app.include_router(metrics_router, prefix="/api/metrics", tags=["metrics"])

# Global managers
device_manager = DeviceManager()
protocol_simulator = ProtocolSimulator(device_manager)
scenario_runner = ScenarioRunner(device_manager, protocol_simulator)

# WebSocket connections
websocket_connections: List[WebSocket] = []

@app.on_event("startup")
async def startup_event():
    """Initialize simulator on startup"""
    # Load default scenarios
    load_scenarios()
    print("GPON Simulator started")
    print(f"Device manager initialized: {len(device_manager.devices)} devices")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    websocket_connections.append(websocket)
    try:
        while True:
            # Keep connection alive and broadcast updates
            await asyncio.sleep(1)
    except:
        websocket_connections.remove(websocket)

async def broadcast_update(message: Dict):
    """Broadcast update to all WebSocket clients"""
    for ws in websocket_connections[:]:  # Copy list
        try:
            await ws.send_json(message)
        except:
            websocket_connections.remove(ws)

@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "running",
        "version": "1.0.0",
        "devices": len(device_manager.devices),
        "scenarios": len(scenario_runner.available_scenarios)
    }

@app.get("/api/status")
async def get_status():
    """Get simulator status"""
    return {
        "running": True,
        "devices_count": len(device_manager.devices),
        "active_scenarios": len(scenario_runner.active_scenarios),
        "metrics": await protocol_simulator.get_summary_metrics()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

