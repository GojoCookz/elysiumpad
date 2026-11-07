/* Public API v1 errors. Every failure leaves the server as
 *   { "error": { "code": "<stable machine code>", "message": "<plain words>" } }
 * Codes are part of the v1 contract: new codes may be added, existing ones never
 * change meaning. Anything that is not an ApiError is an internal bug, so its
 * message is never sent to the caller (it could hold an upstream URL or a stack). */

export const CODES = {
  invalid_param: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  payload_too_large: 413,
  unsupported_media_type: 415,
  refused: 422,
  rate_limited: 429,
  internal: 500,
  not_ready: 501,
  upstream: 502,
  unavailable: 503,
};

export class ApiError extends Error {
  constructor(code, message, extra = {}) {
    if (!(code in CODES)) throw new Error(`Unknown API error code: ${code}`);
    super(message);
    this.code = code;
    this.status = CODES[code];
    /** Seconds, only for rate_limited. */
    this.retryAfter = extra.retryAfter ?? null;
    /** Extra response headers, e.g. Allow for 405. */
    this.headers = extra.headers ?? {};
  }
}

export const invalid = (message) => new ApiError('invalid_param', message);

/** Turn any thrown value into a safe status + body. */
export function toErrorResponse(e) {
  if (e instanceof ApiError) {
    const headers = { ...e.headers };
    if (e.retryAfter != null) headers['retry-after'] = String(e.retryAfter);
    return { status: e.status, headers, body: { error: { code: e.code, message: e.message } } };
  }
  return { status: 500, headers: {}, body: { error: { code: 'internal', message: 'Internal error. Try again later.' } } };
}
