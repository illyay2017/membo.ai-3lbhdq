/**
 * @fileoverview Express middleware for performance monitoring
 * Tracks API request performance metrics
 */

import { Request, Response, NextFunction } from 'express';
import { performanceMonitor } from '../core/monitoring/PerformanceMonitor';

export const performanceMonitoringMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const spanId = performanceMonitor.startSpan('api_request', {
      type: 'api_request',
      endpoint: req.path,
      method: req.method,
      traceId: req.headers['x-trace-id'] as string
    });

    // Track response
    res.on('finish', () => {
      performanceMonitor.endSpan(spanId, {
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length'),
        userAgent: req.get('User-Agent')
      });
    });

    next();
  };
};
