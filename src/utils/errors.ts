export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err: Error | AppError): void => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    isOperational: err instanceof AppError ? err.isOperational : false
  });

  if (!(err instanceof AppError)) {
    // If it's not our custom error, we might want to do some cleanup
    // or trigger alerts for unhandled errors
  }
}; 