export function getErrorMessage(err: unknown): string {
  let message;
  if (err instanceof Error) {
    message = err.message;
  } else {
    message = String(err);
  }
  return message;
}
