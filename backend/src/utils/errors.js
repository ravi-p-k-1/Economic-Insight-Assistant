export class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = options.code ?? 'API_ERROR'
    this.details = options.details
  }
}

export function isApiError(error) {
  return error instanceof ApiError
}

export function createServiceUnavailableError(message, options = {}) {
  return new ApiError(503, message, {
    code: options.code ?? 'SERVICE_UNAVAILABLE',
    details: options.details,
  })
}
