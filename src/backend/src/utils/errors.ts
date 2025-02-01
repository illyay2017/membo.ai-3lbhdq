export class AuthError extends Error {
  constructor(
    message: string,
    public code: string = 'AUTH_ERROR',
    public status: number = 401
  ) {
    super(message);
  }
} 