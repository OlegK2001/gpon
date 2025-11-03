import { create } from 'zustand';
import { NetworkNode, NetworkLink, Packet, LogEntry, Attack } from '@/types/network';

interface SimulatorState {
  // Simulation state
  isRunning: boolean;
  isPaused: boolean;
  speedFactor: number;
  simulationTime: number;

  // Network elements
  nodes: NetworkNode[];
  links: NetworkLink[];
  packets: Packet[];
  logs: LogEntry[];
  attacks: Attack[];

  // Selected elements
  selectedNode: string | null;
  selectedLink: string | null;

  // Actions
  setRunning: (running: boolean) => void;
  setPaused: (paused: boolean) => void;
  setSpeedFactor: (factor: number) => void;
  
  addNode: (node: NetworkNode) => void;
  updateNode: (id: string, updates: Partial<NetworkNode>) => void;
  removeNode: (id: string) => void;
  
  addLink: (link: NetworkLink) => void;
  updateLink: (id: string, updates: Partial<NetworkLink>) => void;
  removeLink: (id: string) => void;
  
  addPacket: (packet: Packet) => void;
  removePacket: (id: string) => void;
  updatePacket: (id: string, updates: Partial<Packet>) => void;
  
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  
  addAttack: (attack: Attack) => void;
  updateAttack: (id: string, updates: Partial<Attack>) => void;
  removeAttack: (id: string) => void;
  
  setSelectedNode: (id: string | null) => void;
  setSelectedLink: (id: string | null) => void;

  reset: () => void;
  saveState: () => string;
  loadState: (state: string) => void;
}

const initialState = {
  isRunning: false,
  isPaused: false,
  speedFactor: 1,
  simulationTime: 0,
  nodes: [],
  links: [],
  packets: [],
  logs: [],
  attacks: [],
  selectedNode: null,
  selectedLink: null,
};

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  ...initialState,

  setRunning: (running) => set({ isRunning: running }),
  setPaused: (paused) => set({ isPaused: paused }),
  setSpeedFactor: (factor) => set({ speedFactor: factor }),

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
  })),
  removeNode: (id) => set((state) => ({
    nodes: state.nodes.filter((n) => n.id !== id),
    links: state.links.filter((l) => l.source !== id && l.target !== id),
  })),

  addLink: (link) => set((state) => ({ links: [...state.links, link] })),
  updateLink: (id, updates) => set((state) => ({
    links: state.links.map((l) => (l.id === id ? { ...l, ...updates } : l)),
  })),
  removeLink: (id) => set((state) => ({
    links: state.links.filter((l) => l.id !== id),
  })),

  addPacket: (packet) => set((state) => ({ packets: [...state.packets, packet] })),
  removePacket: (id) => set((state) => ({
    packets: state.packets.filter((p) => p.id !== id),
  })),
  updatePacket: (id, updates) => set((state) => ({
    packets: state.packets.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  })),

  addLog: (log) => set((state) => ({ logs: [log, ...state.logs].slice(0, 1000) })),
  clearLogs: () => set({ logs: [] }),

  addAttack: (attack) => set((state) => ({ attacks: [...state.attacks, attack] })),
  updateAttack: (id, updates) => set((state) => ({
    attacks: state.attacks.map((a) => (a.id === id ? { ...a, ...updates } : a)),
  })),
  removeAttack: (id) => set((state) => ({
    attacks: state.attacks.filter((a) => a.id !== id),
  })),

  setSelectedNode: (id) => set({ selectedNode: id }),
  setSelectedLink: (id) => set({ selectedLink: id }),

  reset: () => set(initialState),
  
  saveState: () => {
    const state = get();
    return JSON.stringify({
      version: '2.0',
      nodes: state.nodes,
      links: state.links,
      logs: state.logs,
      speedFactor: state.speedFactor,
      timestamp: new Date().toISOString(),
    });
  },
  
  loadState: (stateStr) => {
    try {
      const loaded = JSON.parse(stateStr);
      set({
        nodes: loaded.nodes || [],
        links: loaded.links || [],
        logs: loaded.logs || [],
        speedFactor: loaded.speedFactor || 1,
        packets: [],
        attacks: [],
      });
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  },
}));
