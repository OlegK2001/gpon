"""
Device models for GPON simulation
"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class Device(BaseModel):
    """Base device model"""
    id: str
    type: str
    name: str
    model: Optional[str] = None
    status: str = "offline"  # offline, online, error
    config: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class OLT(Device):
    """OLT (Optical Line Terminal)"""
    type: str = "OLT"
    pon_ports: int = 4
    management_ip: Optional[str] = None
    ssh_enabled: bool = True
    web_enabled: bool = True
    pon_profiles: List[Dict] = []
    
class ONT(Device):
    """ONT (Optical Network Terminal)"""
    type: str = "ONT"
    serial_number: str
    pon_port: str
    olt_id: Optional[str] = None
    rx_level_dbm: float = -26.0
    tx_level_dbm: float = 2.0
    authorized: bool = False
    firmware_version: str = "1.0"
    cpe_ports: int = 1
    
class Splitter(Device):
    """Optical splitter (FGS)"""
    type: str = "Splitter"
    split_ratio: int = 32
    parent_device: Optional[str] = None
    optical_loss_db: float = 15.0

class CPERouter(Device):
    """CPE Router"""
    type: str = "Router"
    interfaces: List[Dict] = []
    dhcp_client: bool = True
    nat_enabled: bool = True
    firewall_rules: List[Dict] = []
    arp_table: Dict[str, str] = {}
    
class CPEClient(Device):
    """CPE Client (PC, phone)"""
    type: str = "Client"
    hostname: str
    mac_address: str
    ip_address: Optional[str] = None
    gateway: Optional[str] = None
    dns_servers: List[str] = []
    infected: bool = False
    
class Switch(Device):
    """Provider switch"""
    type: str = "Switch"
    ports: int = 24
    vlans: List[int] = []
    mac_table_size: int = 1024
    mac_table: Dict[str, str] = {}
    
class Server(Device):
    """Infrastructure server"""
    type: str = "Server"
    roles: List[str] = []  # DHCP, BRAS, AAA, DNS, etc
    services: List[Dict] = []
    ip_address: str

class DeviceManager:
    """Manages all devices in the simulation"""
    
    def __init__(self):
        self.devices: Dict[str, Device] = {}
        
    def add_device(self, device: Device) -> Device:
        """Add a device to the topology"""
        self.devices[device.id] = device
        return device
        
    def get_device(self, device_id: str) -> Optional[Device]:
        """Get device by ID"""
        return self.devices.get(device_id)
        
    def remove_device(self, device_id: str) -> bool:
        """Remove device from topology"""
        if device_id in self.devices:
            del self.devices[device_id]
            return True
        return False
        
    def list_devices(self, device_type: Optional[str] = None) -> List[Device]:
        """List all devices, optionally filtered by type"""
        devices = list(self.devices.values())
        if device_type:
            devices = [d for d in devices if d.type == device_type]
        return devices
        
    def update_device(self, device_id: str, **kwargs) -> Optional[Device]:
        """Update device configuration"""
        device = self.devices.get(device_id)
        if device:
            for key, value in kwargs.items():
                if hasattr(device, key):
                    setattr(device, key, value)
            device.updated_at = datetime.now()
        return device
        
    def reset(self):
        """Reset all devices"""
        self.devices.clear()

def generate_device_id(device_type: str) -> str:
    """Generate unique device ID"""
    return f"{device_type.lower()}-{uuid.uuid4().hex[:8]}"

