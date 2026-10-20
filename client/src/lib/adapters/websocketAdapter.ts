/**
 * ============================================================================
 * J & D Beach House · WebSocket Frontend Adapter
 * Consumes: Data Payload 1 (Live streaming over TCP WebSocket channel)
 * Handles: Real-time room locks, live booking updates, AI concierge chat
 * ============================================================================
 */

import { getSocket } from '../socket';

export interface DataPayload1<T = any> {
  topic: string;
  data: T;
  timestamp: string;
}

export type Payload1Listener<T = any> = (payload: T) => void;

class WebSocketAdapter {
  private socket: any = null;
  private listeners: Map<string, Set<Payload1Listener>> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.socket = getSocket();
      if (!this.socket) return;

      // Listen to generic Data Payload 1 streaming pipeline
      this.socket.on('payload1:stream', (packet: DataPayload1) => {
        if (!packet || !packet.topic) return;
        const set = this.listeners.get(packet.topic);
        if (set) {
          set.forEach((fn) => {
            try { fn(packet.data); } catch (e) { console.warn('[WS Adapter] Callback error:', e); }
          });
        }
      });
    } catch (err) {
      console.warn('[WS Adapter] Initialization notice:', err);
    }
  }

  /**
   * Subscribe to a specific Data Payload 1 topic (e.g. 'reservations:created', 'room:locks')
   */
  public subscribe<T = any>(topic: string, callback: Payload1Listener<T>): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    this.listeners.get(topic)!.add(callback);

    // Also listen to direct socket event if topic matches
    if (this.socket) {
      this.socket.on(`payload1:${topic}`, callback);
    }

    return () => {
      const set = this.listeners.get(topic);
      if (set) set.delete(callback);
      if (this.socket) {
        this.socket.off(`payload1:${topic}`, callback);
      }
    };
  }

  /**
   * Send an outgoing packet to the backend over WebSocket TCP channel
   */
  public emit(event: string, data: any) {
    if (!this.socket) this.socket = getSocket();
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  public getRawSocket() {
    if (!this.socket) this.socket = getSocket();
    return this.socket;
  }
}

export const websocketAdapter = new WebSocketAdapter();
