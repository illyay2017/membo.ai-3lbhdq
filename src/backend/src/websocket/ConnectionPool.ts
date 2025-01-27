import WebSocket from 'ws';

export class ConnectionPool {
    private pool: Set<WebSocket>;
    private readonly maxSize: number;

    constructor(maxSize = 1000) {
        this.pool = new Set();
        this.maxSize = maxSize;
    }

    acquire(): WebSocket | null {
        if (this.pool.size >= this.maxSize) {
            return null;
        }
        const ws = new WebSocket.Server({ noServer: true });
        this.pool.add(ws);
        return ws;
    }

    release(ws: WebSocket): void {
        this.pool.delete(ws);
    }

    size(): number {
        return this.pool.size;
    }
}
