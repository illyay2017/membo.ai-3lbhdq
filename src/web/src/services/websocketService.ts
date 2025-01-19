class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private url: string) {
    if (!url) {
      console.warn('WebSocket URL not configured. Please check environment variables.');
    }
  }

  connect() {
    try {
      if (!this.url) {
        console.warn('WebSocket URL not configured');
        return;
      }

      // Only attempt connection if we have a token
      const token = localStorage.getItem('token');
      if (!token) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('No auth token found - skipping WebSocket connection');
        }
        return;
      }
      
      const wsUrl = `${this.url}/ws?token=${token}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (process.env.NODE_ENV === 'development') {
          console.log('WebSocket connected successfully');
        }
      };

      this.ws.onclose = (event) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('WebSocket closed:', event.code, event.reason);
        }
        this.reconnect();
      };

      this.ws.onerror = (event) => {
        // Prevent error from bubbling up
        event.preventDefault?.();
        
        if (process.env.NODE_ENV === 'development') {
          console.warn('WebSocket error - this is expected if not authenticated or backend is not running');
        }
      };

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('WebSocket connection failed:', error);
      }
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Make sure we have a valid URL before creating the service
const wsUrl = import.meta.env.VITE_WS_URL;
if (!wsUrl && process.env.NODE_ENV === 'development') {
  console.warn('VITE_WS_URL environment variable is not set');
}

export const wsService = new WebSocketService(wsUrl || 'ws://localhost:4000');
