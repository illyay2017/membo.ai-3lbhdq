import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../api/middlewares/auth.middleware';

export const asyncHandler = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>) => 
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
