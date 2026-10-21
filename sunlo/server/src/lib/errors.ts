export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, msg: string, details?: unknown) => new HttpError(400, code, msg, details);
export const unauthorized = (msg = 'Login zaroori hai') => new HttpError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Is kaam ki anumati nahi hai') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (what = 'Record') => new HttpError(404, 'NOT_FOUND', `${what} nahi mila`);
export const conflict = (code: string, msg: string) => new HttpError(409, code, msg);
export const tooMany = (msg: string) => new HttpError(429, 'TOO_MANY_REQUESTS', msg);
export const unavailable = (code: string, msg: string) => new HttpError(503, code, msg);
