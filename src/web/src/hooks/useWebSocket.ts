import { useEffect, useCallback, useRef } from 'react';
import { WebSocketManager, WS_EVENTS } from '../lib/websocket';
import { useAuth } from '../hooks/useAuth';
import type { AuthTokens } from '../types/auth';

/**
 * Connection quality type for monitoring WebSocket performance
 * @version 1.0.0
 */
type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

/**
 * Latency metrics interface for detailed performance monitoring
 */
interface LatencyMetrics {
  current: number;
  average: number;
  peak: number;
  jitter: number;
}

/**
 * Message queue interface for handling offline scenarios
 */
interface MessageQueue {
  pending: number;
  processed: number;
  failed: number;
}

/**
 * Connection statistics interface for monitoring
 */
interface ConnectionStats {
  quality: ConnectionQuality;
  latency: LatencyMetrics;
  uptime: number;
  reconnects: number;
}

/**
 * WebSocket configuration interface
 */
interface WebSocketConfig {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

/**
 * WebSocket hook result interface
 */
interface WebSocketHookResult {
  isConnected: boolean;
  connectionQuality: ConnectionQuality;
  latencyMetrics: LatencyMetrics;
  messageQueue: MessageQueue;
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (event: string, data: any) => Promise<boolean>;
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string, callback: (data: any) => void) => void;
  getConnectionStats: () => ConnectionStats;
  enableAutoReconnect: (enabled: boolean) => void;
}

/**
 * Custom React hook for managing WebSocket connections with enhanced performance monitoring
 * @param config - WebSocket configuration options
 * @returns WebSocket hook interface with connection state and methods
 */
export const useWebSocket = (
  config: WebSocketConfig = {}
): WebSocketHookResult => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const wsRef = useRef<WebSocketManager | null>(null);
  const startTime = useRef<number>(Date.now());
  const reconnectCount = useRef<number>(0);
  const latencyHistory = useRef<number[]>([]);
  const autoReconnectEnabled = useRef<boolean>(config.autoReconnect ?? true);

  useEffect(() => {
    // Don't try to connect while auth is loading
    if (isLoading) return;

    const tokens = (user as any)?.tokens as AuthTokens | undefined;
    const token = tokens?.accessToken;
    
    if (isAuthenticated && token) {
      wsRef.current = new WebSocketManager(token);
      wsRef.current.connect().catch(console.error);

      return () => {
        wsRef.current?.disconnect();
      };
    }
  }, [isAuthenticated, user, isLoading]);

  // Calculate latency metrics
  const calculateLatencyMetrics = useCallback((): LatencyMetrics => {
    const history = latencyHistory.current;
    const current = history[history.length - 1] || 0;
    const average = history.reduce((a, b) => a + b, 0) / history.length || 0;
    const peak = Math.max(...history, 0);
    const jitter = history.length > 1
      ? Math.sqrt(history.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / history.length)
      : 0;

    return { current, average, peak, jitter };
  }, []);

  // Determine connection quality
  const determineConnectionQuality = useCallback((): ConnectionQuality => {
    if (!wsRef.current?.getConnectionQuality()) return 'disconnected';
    
    const metrics = calculateLatencyMetrics();
    if (metrics.average < 100 && metrics.jitter < 50) return 'excellent';
    if (metrics.average < 300 && metrics.jitter < 100) return 'good';
    return 'poor';
  }, [calculateLatencyMetrics]);

  // Connect to WebSocket server
  const connect = useCallback(async (): Promise<void> => {
    try {
      await wsRef.current?.connect();
      startTime.current = Date.now();
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      throw error;
    }
  }, []);

  // Disconnect from WebSocket server
  const disconnect = useCallback((): void => {
    wsRef.current?.disconnect();
  }, []);

  // Send message through WebSocket
  const send = useCallback(async (event: string, data: any): Promise<boolean> => {
    try {
      return await wsRef.current?.send(event, data) || false;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }, []);

  // Subscribe to WebSocket events
  const subscribe = useCallback((event: string, callback: (data: any) => void): void => {
    wsRef.current?.on(event, callback);
  }, []);

  // Unsubscribe from WebSocket events
  const unsubscribe = useCallback((event: string, callback: (data: any) => void): void => {
    wsRef.current?.off(event, callback);
  }, []);

  // Get connection statistics
  const getConnectionStats = useCallback((): ConnectionStats => {
    return {
      quality: determineConnectionQuality(),
      latency: calculateLatencyMetrics(),
      uptime: Date.now() - startTime.current,
      reconnects: reconnectCount.current
    };
  }, [determineConnectionQuality, calculateLatencyMetrics]);

  // Enable/disable auto reconnect
  const enableAutoReconnect = useCallback((enabled: boolean): void => {
    autoReconnectEnabled.current = enabled;
  }, []);

  // Setup WebSocket event listeners
  useEffect(() => {
    if (!wsRef.current) return;

    const handleLatencyUpdate = (quality: any) => {
      latencyHistory.current.push(quality.latency);
      if (latencyHistory.current.length > 50) {
        latencyHistory.current.shift();
      }
    };

    const handleDisconnect = () => {
      if (autoReconnectEnabled.current) {
        reconnectCount.current++;
        connect();
      }
    };

    wsRef.current.on(WS_EVENTS.CONNECT, () => {
      latencyHistory.current = [];
    });
    wsRef.current.on(WS_EVENTS.DISCONNECT, handleDisconnect);
    wsRef.current.on(WS_EVENTS.ERROR, console.error);
    wsRef.current.on('latency_update', handleLatencyUpdate);

    return () => {
      if (!wsRef.current) return;
      wsRef.current.off(WS_EVENTS.CONNECT, () => {});
      wsRef.current.off(WS_EVENTS.DISCONNECT, handleDisconnect);
      wsRef.current.off(WS_EVENTS.ERROR, console.error);
      wsRef.current.off('latency_update', handleLatencyUpdate);
    };
  }, [connect]);

  return {
    isConnected: !!wsRef.current?.getConnectionQuality(),
    connectionQuality: determineConnectionQuality(),
    latencyMetrics: calculateLatencyMetrics(),
    messageQueue: {
      pending: 0, // Implemented in WebSocketManager
      processed: 0,
      failed: 0
    },
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    getConnectionStats,
    enableAutoReconnect
  };
};
