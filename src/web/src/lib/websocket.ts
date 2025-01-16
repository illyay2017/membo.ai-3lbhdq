import { EventEmitter } from 'events';
import { API_BASE_URL } from '../constants/api';

/**
 * WebSocket event constants for standardized event handling
 * @version 1.0.0
 */
export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  ERROR: 'error',
  STUDY_UPDATE: 'study_update',
  VOICE_PROCESS: 'voice_process',
  CONTENT_SYNC: 'content_sync',
  CONNECTION_HEALTH: 'connection_health',
  TOKEN_REFRESH: 'token_refresh',
  RECONNECT: 'reconnect',
} as const;

/**
 * WebSocket configuration constants
 */
const WS_CONFIG = {
  RECONNECT_INTERVAL: 1000,
  MAX_RECONNECT_ATTEMPTS: 5,
  PING_INTERVAL: 30000,
  MESSAGE_TIMEOUT: 5000,
  BACKOFF_MULTIPLIER: 1.5,
  MAX_MESSAGE_SIZE: 1048576, // 1MB
  HEALTH_CHECK_INTERVAL: 15000,
} as const;

/**
 * WebSocket message interface for type safety
 */
interface WebSocketMessage {
  event: string;
  data: any;
  id?: string;
  timestamp?: number;
}

/**
 * WebSocket connection quality metrics
 */
interface ConnectionQuality {
  latency: number;
  messageSuccess: number;
  messageError: number;
  lastHealthCheck: number;
}

/**
 * WebSocket Manager class for handling real-time communication
 * Implements comprehensive connection management, security, and monitoring
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private eventEmitter: EventEmitter;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly authToken: string;
  private lastPingTime: number = 0;
  private connectionQuality: ConnectionQuality;
  private messageCallbacks: Map<string, (response: any) => void>;
  private messageQueue: WebSocketMessage[];
  private healthCheckInterval: NodeJS.Timer | null = null;
  private pingInterval: NodeJS.Timer | null = null;

  /**
   * Initialize WebSocket manager with authentication token
   * @param authToken - JWT authentication token
   */
  constructor(authToken: string) {
    this.eventEmitter = new EventEmitter();
    this.authToken = authToken;
    this.messageCallbacks = new Map();
    this.messageQueue = [];
    this.connectionQuality = {
      latency: 0,
      messageSuccess: 0,
      messageError: 0,
      lastHealthCheck: Date.now(),
    };
  }

  /**
   * Establish WebSocket connection with authentication and monitoring
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws?token=${this.authToken}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHealthCheck();
        this.startPingInterval();
        this.processMessageQueue();
        this.eventEmitter.emit(WS_EVENTS.CONNECT);
        resolve();
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        this.eventEmitter.emit(WS_EVENTS.ERROR, error);
        reject(error);
      };

      this.ws.onmessage = (event) => this.handleMessage(event);
    });
  }

  /**
   * Safely close WebSocket connection and clean up resources
   */
  public disconnect(): void {
    this.clearIntervals();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.isConnected = false;
    this.messageQueue = [];
    this.eventEmitter.emit(WS_EVENTS.DISCONNECT);
  }

  /**
   * Send message through WebSocket with retry and validation
   * @param event - Event type
   * @param data - Message payload
   * @returns Promise resolving to send success status
   */
  public async send(event: string, data: any): Promise<boolean> {
    const message: WebSocketMessage = {
      event,
      data,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    if (JSON.stringify(message).length > WS_CONFIG.MAX_MESSAGE_SIZE) {
      throw new Error('Message size exceeds maximum allowed size');
    }

    if (!this.isConnected) {
      this.messageQueue.push(message);
      return false;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws?.send(JSON.stringify(message));
        this.connectionQuality.messageSuccess++;
        resolve(true);
      } catch (error) {
        this.connectionQuality.messageError++;
        reject(error);
      }
    });
  }

  /**
   * Register event listener
   * @param event - Event type
   * @param callback - Event handler function
   */
  public on(event: string, callback: (data: any) => void): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Remove event listener
   * @param event - Event type
   * @param callback - Event handler function
   */
  public off(event: string, callback: (data: any) => void): void {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Get current connection quality metrics
   * @returns Connection quality object
   */
  public getConnectionQuality(): ConnectionQuality {
    return { ...this.connectionQuality };
  }

  /**
   * Handle incoming WebSocket messages
   * @private
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.updateLatency(message.timestamp);
      this.eventEmitter.emit(WS_EVENTS.MESSAGE, message);
      this.eventEmitter.emit(message.event, message.data);

      if (message.id && this.messageCallbacks.has(message.id)) {
        this.messageCallbacks.get(message.id)?.(message.data);
        this.messageCallbacks.delete(message.id);
      }
    } catch (error) {
      this.eventEmitter.emit(WS_EVENTS.ERROR, error);
    }
  }

  /**
   * Handle disconnection and cleanup
   * @private
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.clearIntervals();
    this.eventEmitter.emit(WS_EVENTS.DISCONNECT);
  }

  /**
   * Attempt reconnection with exponential backoff
   * @private
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      this.eventEmitter.emit(WS_EVENTS.ERROR, new Error('Max reconnection attempts reached'));
      return;
    }

    const backoffDelay = WS_CONFIG.RECONNECT_INTERVAL * 
      Math.pow(WS_CONFIG.BACKOFF_MULTIPLIER, this.reconnectAttempts);
    
    this.reconnectAttempts++;
    this.eventEmitter.emit(WS_EVENTS.RECONNECT, { attempt: this.reconnectAttempts });

    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    await this.connect();
  }

  /**
   * Process queued messages after reconnection
   * @private
   */
  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.send(message.event, message.data);
      }
    }
  }

  /**
   * Start health check interval
   * @private
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.send(WS_EVENTS.CONNECTION_HEALTH, {
        timestamp: Date.now(),
        quality: this.connectionQuality,
      });
      this.connectionQuality.lastHealthCheck = Date.now();
    }, WS_CONFIG.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Start ping interval for connection keepalive
   * @private
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.lastPingTime = Date.now();
        this.ws?.send(JSON.stringify({ event: 'ping' }));
      }
    }, WS_CONFIG.PING_INTERVAL);
  }

  /**
   * Clear all intervals
   * @private
   */
  private clearIntervals(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Update connection latency metrics
   * @private
   */
  private updateLatency(messageTimestamp: number): void {
    if (messageTimestamp) {
      this.connectionQuality.latency = Date.now() - messageTimestamp;
    }
  }
}