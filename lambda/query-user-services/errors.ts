export function getErrorMessage(err: unknown): string {
  let message;
  if (err instanceof Error) {
    message = err.message;
  } else {
    message = String(err);
  }
  return message;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
