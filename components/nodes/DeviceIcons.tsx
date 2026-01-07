// Cisco Packet Tracer style device icons

export const OLTIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* OLT - Server style with fiber ports */}
    <rect x="8" y="12" width="32" height="24" rx="2" fill="#2C3E50" stroke="#34495E" strokeWidth="2"/>
    <rect x="10" y="14" width="28" height="4" fill="#3498DB"/>
    <circle cx="14" cy="20" r="1.5" fill="#27AE60"/>
    <circle cx="18" cy="20" r="1.5" fill="#27AE60"/>
    <circle cx="22" cy="20" r="1.5" fill="#27AE60"/>
    <circle cx="26" cy="20" r="1.5" fill="#27AE60"/>
    <circle cx="30" cy="20" r="1.5" fill="#27AE60"/>
    <circle cx="34" cy="20" r="1.5" fill="#27AE60"/>
    
    <rect x="10" y="24" width="28" height="3" fill="#34495E"/>
    <rect x="12" y="28" width="2" height="6" fill="#E67E22"/>
    <rect x="16" y="28" width="2" height="6" fill="#E67E22"/>
    <rect x="20" y="28" width="2" height="6" fill="#E67E22"/>
    <rect x="24" y="28" width="2" height="6" fill="#E67E22"/>
    <rect x="28" y="28" width="2" height="6" fill="#E67E22"/>
    <rect x="32" y="28" width="2" height="6" fill="#E67E22"/>
    
    <text x="24" y="16" fontSize="8" fill="white" textAnchor="middle" fontWeight="bold">OLT</text>
  </svg>
)

export const ONUIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* ONU - Small box with antenna */}
    <rect x="10" y="20" width="28" height="16" rx="2" fill="#3498DB" stroke="#2980B9" strokeWidth="2"/>
    <circle cx="16" cy="28" r="2" fill="#27AE60"/>
    <circle cx="22" cy="28" r="2" fill="#F39C12"/>
    <circle cx="28" cy="28" r="2" fill="#E74C3C"/>
    
    {/* Antenna */}
    <line x1="34" y1="20" x2="34" y2="14" stroke="#2980B9" strokeWidth="2"/>
    <circle cx="34" cy="12" r="2" fill="#3498DB"/>
    
    {/* Ports */}
    <rect x="12" y="32" width="3" height="2" fill="#34495E"/>
    <rect x="17" y="32" width="3" height="2" fill="#34495E"/>
    <rect x="22" y="32" width="3" height="2" fill="#34495E"/>
    <rect x="27" y="32" width="3" height="2" fill="#34495E"/>
    
    <text x="24" y="26" fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">ONU</text>
  </svg>
)

export const ONTIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* ONT - Similar to ONU but flatter */}
    <rect x="8" y="22" width="32" height="12" rx="1.5" fill="#1ABC9C" stroke="#16A085" strokeWidth="2"/>
    <circle cx="14" cy="28" r="1.5" fill="#27AE60"/>
    <circle cx="19" cy="28" r="1.5" fill="#F39C12"/>
    <circle cx="24" cy="28" r="1.5" fill="#E74C3C"/>
    <circle cx="29" cy="28" r="1.5" fill="#3498DB"/>
    
    {/* Fiber port */}
    <rect x="34" y="26" width="4" height="4" rx="0.5" fill="#E67E22"/>
    
    <text x="24" y="30" fontSize="6" fill="white" textAnchor="middle" fontWeight="bold">ONT</text>
  </svg>
)

export const SplitterIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Optical Splitter - Y shape */}
    <path d="M 4 24 L 24 24" stroke="#F39C12" strokeWidth="3" fill="none"/>
    <path d="M 24 24 L 40 12" stroke="#F39C12" strokeWidth="2" fill="none"/>
    <path d="M 24 24 L 40 20" stroke="#F39C12" strokeWidth="2" fill="none"/>
    <path d="M 24 24 L 40 28" stroke="#F39C12" strokeWidth="2" fill="none"/>
    <path d="M 24 24 L 40 36" stroke="#F39C12" strokeWidth="2" fill="none"/>
    
    <circle cx="24" cy="24" r="4" fill="#F39C12" stroke="#E67E22" strokeWidth="2"/>
    <circle cx="4" cy="24" r="2" fill="#F39C12"/>
    <circle cx="40" cy="12" r="1.5" fill="#F39C12"/>
    <circle cx="40" cy="20" r="1.5" fill="#F39C12"/>
    <circle cx="40" cy="28" r="1.5" fill="#F39C12"/>
    <circle cx="40" cy="36" r="1.5" fill="#F39C12"/>
    
    <text x="24" y="26" fontSize="6" fill="white" textAnchor="middle" fontWeight="bold">1:4</text>
  </svg>
)

export const RouterIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Router - Cisco style */}
    <rect x="6" y="16" width="36" height="20" rx="2" fill="#9B59B6" stroke="#8E44AD" strokeWidth="2"/>
    <rect x="8" y="18" width="32" height="3" fill="#8E44AD"/>
    
    {/* Antennas */}
    <line x1="12" y1="16" x2="12" y2="10" stroke="#8E44AD" strokeWidth="2"/>
    <circle cx="12" cy="8" r="2" fill="#9B59B6"/>
    <line x1="36" y1="16" x2="36" y2="10" stroke="#8E44AD" strokeWidth="2"/>
    <circle cx="36" cy="8" r="2" fill="#9B59B6"/>
    
    {/* Lights */}
    <circle cx="12" cy="24" r="1.5" fill="#27AE60"/>
    <circle cx="16" cy="24" r="1.5" fill="#27AE60"/>
    <circle cx="20" cy="24" r="1.5" fill="#F39C12"/>
    <circle cx="24" cy="24" r="1.5" fill="#3498DB"/>
    
    {/* Ports */}
    <rect x="10" y="30" width="4" height="4" fill="#2C3E50"/>
    <rect x="16" y="30" width="4" height="4" fill="#2C3E50"/>
    <rect x="22" y="30" width="4" height="4" fill="#2C3E50"/>
    <rect x="28" y="30" width="4" height="4" fill="#2C3E50"/>
    <rect x="34" y="30" width="4" height="4" fill="#E67E22"/>
    
    <text x="24" y="27" fontSize="6" fill="white" textAnchor="middle" fontWeight="bold">ROUTER</text>
  </svg>
)

export const SwitchIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Switch - Cisco style */}
    <rect x="6" y="18" width="36" height="16" rx="1.5" fill="#27AE60" stroke="#229954" strokeWidth="2"/>
    <rect x="8" y="20" width="32" height="2" fill="#229954"/>
    
    {/* LED indicators */}
    <circle cx="10" cy="25" r="1" fill="#F39C12"/>
    <circle cx="13" cy="25" r="1" fill="#27AE60"/>
    <circle cx="16" cy="25" r="1" fill="#27AE60"/>
    <circle cx="19" cy="25" r="1" fill="#27AE60"/>
    <circle cx="22" cy="25" r="1" fill="#27AE60"/>
    <circle cx="25" cy="25" r="1" fill="#27AE60"/>
    <circle cx="28" cy="25" r="1" fill="#27AE60"/>
    <circle cx="31" cy="25" r="1" fill="#27AE60"/>
    
    {/* Ports */}
    <rect x="8" y="28" width="3" height="4" fill="#2C3E50"/>
    <rect x="12" y="28" width="3" height="4" fill="#2C3E50"/>
    <rect x="16" y="28" width="3" height="4" fill="#2C3E50"/>
    <rect x="20" y="28" width="3" height="4" fill="#2C3E50"/>
    <rect x="24" y="28" width="3" height="4" fill="#2C3E50"/>
    <rect x="28" y="28" width="3" height="4" fill="#2C3E50"/>
    <rect x="32" y="28" width="3" height="4" fill="#2C3E50"/>
    <rect x="36" y="28" width="3" height="4" fill="#2C3E50"/>
    
    <text x="24" y="26" fontSize="5" fill="white" textAnchor="middle" fontWeight="bold">SWITCH</text>
  </svg>
)

export const PCIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* PC - Monitor and tower */}
    <rect x="10" y="12" width="20" height="16" rx="1" fill="#34495E" stroke="#2C3E50" strokeWidth="2"/>
    <rect x="12" y="14" width="16" height="12" fill="#3498DB"/>
    <rect x="16" y="28" width="8" height="2" fill="#34495E"/>
    <rect x="14" y="30" width="12" height="2" rx="1" fill="#2C3E50"/>
    
    {/* Tower */}
    <rect x="32" y="18" width="8" height="14" rx="1" fill="#2C3E50" stroke="#34495E" strokeWidth="1"/>
    <circle cx="36" cy="22" r="1.5" fill="#27AE60"/>
    <circle cx="36" cy="26" r="1" fill="#E74C3C"/>
    <rect x="34" y="29" width="4" height="1" fill="#34495E"/>
    
    <text x="20" y="22" fontSize="6" fill="white" textAnchor="middle" fontWeight="bold">PC</text>
  </svg>
)

export const ServerIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Server - Rack mount */}
    <rect x="8" y="10" width="32" height="8" rx="1" fill="#E67E22" stroke="#D35400" strokeWidth="2"/>
    <rect x="10" y="12" width="26" height="4" fill="#D35400"/>
    <circle cx="38" cy="14" r="1.5" fill="#27AE60"/>
    
    <rect x="8" y="20" width="32" height="8" rx="1" fill="#E67E22" stroke="#D35400" strokeWidth="2"/>
    <rect x="10" y="22" width="26" height="4" fill="#D35400"/>
    <circle cx="38" cy="24" r="1.5" fill="#27AE60"/>
    
    <rect x="8" y="30" width="32" height="8" rx="1" fill="#E67E22" stroke="#D35400" strokeWidth="2"/>
    <rect x="10" y="32" width="26" height="4" fill="#D35400"/>
    <circle cx="38" cy="34" r="1.5" fill="#F39C12"/>
    
    <text x="22" y="16" fontSize="5" fill="white" textAnchor="middle" fontWeight="bold">SERVER</text>
  </svg>
)

export const AttackerIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Attacker - Red human figure */}
    <circle cx="24" cy="18" r="8" fill="#DC2626" stroke="#991B1B" strokeWidth="2"/>
    <rect x="20" y="26" width="8" height="14" rx="4" fill="#DC2626" stroke="#991B1B" strokeWidth="2"/>
    <line x1="14" y1="32" x2="20" y2="30" stroke="#991B1B" strokeWidth="2" strokeLinecap="round"/>
    <line x1="28" y1="30" x2="34" y2="32" stroke="#991B1B" strokeWidth="2" strokeLinecap="round"/>
    <line x1="20" y1="40" x2="14" y2="44" stroke="#991B1B" strokeWidth="2" strokeLinecap="round"/>
    <line x1="28" y1="40" x2="34" y2="44" stroke="#991B1B" strokeWidth="2" strokeLinecap="round"/>
    {/* Skull/Evil face */}
    <circle cx="22" cy="16" r="1.5" fill="#FFFFFF"/>
    <circle cx="26" cy="16" r="1.5" fill="#FFFFFF"/>
    <path d="M 22 20 Q 24 22 26 20" stroke="#FFFFFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <text x="24" y="28" fontSize="4" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">⚡</text>
  </svg>
)

export const getDeviceIcon = (type: string) => {
  switch (type) {
    case 'OLT': return <OLTIcon />
    case 'ONU': return <ONUIcon />
    case 'ONT': return <ONTIcon />
    case 'SPLITTER': return <SplitterIcon />
    case 'ROUTER': return <RouterIcon />
    case 'PC': return <PCIcon />
    case 'SERVER': return <ServerIcon />
    case 'ATTACKER': return <AttackerIcon />
    default: return <RouterIcon />
  }
}

