import winston from 'winston';

export class AuditLoggerService {
    private logger: winston.Logger;

    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'audit-service' },
            transports: [
                new winston.transports.File({ filename: 'logs/security-audit.log' }),
                new winston.transports.File({ filename: 'logs/error-audit.log', level: 'error' })
            ]
        });
    }

    info(message: string, metadata: Record<string, unknown>): void {
        this.logger.info(message, metadata);
    }

    warn(message: string, metadata: Record<string, unknown>): void {
        this.logger.warn(message, metadata);
    }

    error(message: string, metadata: Record<string, unknown>): void {
        this.logger.error(message, metadata);
    }
}

// Export singleton instance
export const auditLogger = new AuditLoggerService(); 
