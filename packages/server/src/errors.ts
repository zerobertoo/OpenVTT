import type { ErrorCode } from "@openvtt/shared";

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  invalid_credentials: 401,
  username_taken: 409,
  too_many_attempts: 429,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invite_invalid: 404,
  internal_error: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode) {
    super(code);
    this.status = STATUS[code];
  }
}
