// Standardized error response utilities for API handlers

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

/**
 * Creates a standardized error response object
 * @param {string} errorCode - Short error code/identifier (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param {string} message - Human-readable error message
 * @returns {Object} Standardized error response object
 */
function createErrorResponse(errorCode, message) {
    return {
        success: false,
        error: errorCode,
        message: message
    };
}

/**
 * Sends a standardized error response with proper status code
 * Logs full error details server-side in development, sanitized in production
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Short error code/identifier
 * @param {string} message - Human-readable error message
 * @param {Error|Object} [error] - Optional error object for logging (not exposed to client)
 */
function sendErrorResponse(res, statusCode, errorCode, message, error = null) {
    // Log full error details server-side
    if (error) {
        console.error(`[${errorCode}] ${message}`, {
            statusCode,
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                ...(error.cause && { cause: error.cause })
            } : error
        });
    } else {
        console.error(`[${errorCode}] ${message}`, { statusCode });
    }
    
    // Send standardized response (never expose raw error details in production)
    return res.status(statusCode).json(createErrorResponse(errorCode, message));
}

/**
 * Common error codes used across the API
 */
const ERROR_CODES = {
    // Client errors (4xx)
    METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
    BAD_REQUEST: 'BAD_REQUEST',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SCAN_LIMIT_EXCEEDED: 'SCAN_LIMIT_EXCEEDED',
    
    // Server errors (5xx)
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR'
};

/**
 * Helper to send common error responses
 */
const ErrorResponse = {
    // 400 Bad Request
    badRequest: (res, message, error = null) => {
        return sendErrorResponse(res, 400, ERROR_CODES.BAD_REQUEST, message, error);
    },
    
    // 404 Not Found
    notFound: (res, message = 'Resource not found', error = null) => {
        return sendErrorResponse(res, 404, ERROR_CODES.NOT_FOUND, message, error);
    },
    
    // 405 Method Not Allowed
    methodNotAllowed: (res, message = 'Method not allowed', error = null) => {
        return sendErrorResponse(res, 405, ERROR_CODES.METHOD_NOT_ALLOWED, message, error);
    },
    
    // 429 Too Many Requests (Rate Limit)
    rateLimitExceeded: (res, message = 'Too many requests. Please try again later.', error = null) => {
        return sendErrorResponse(res, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED, message, error);
    },
    
    // 500 Internal Server Error
    internalServerError: (res, message = 'An internal server error occurred', error = null) => {
        return sendErrorResponse(res, 500, ERROR_CODES.INTERNAL_SERVER_ERROR, message, error);
    },
    
    // 500 Configuration Error
    configurationError: (res, message, error = null) => {
        return sendErrorResponse(res, 500, ERROR_CODES.CONFIGURATION_ERROR, message, error);
    },
    
    // 500 Database Error
    databaseError: (res, message = 'Database operation failed', error = null) => {
        return sendErrorResponse(res, 500, ERROR_CODES.DATABASE_ERROR, message, error);
    },
    
    // 500 External Service Error
    externalServiceError: (res, message = 'External service error', error = null) => {
        return sendErrorResponse(res, 500, ERROR_CODES.EXTERNAL_SERVICE_ERROR, message, error);
    },
    
    // 504 Gateway Timeout
    gatewayTimeout: (res, message = 'Request timeout', error = null) => {
        return sendErrorResponse(res, 504, ERROR_CODES.EXTERNAL_SERVICE_ERROR, message, error);
    },
    
    // Validation error (400)
    validationError: (res, message, error = null) => {
        return sendErrorResponse(res, 400, ERROR_CODES.VALIDATION_ERROR, message, error);
    }
};

module.exports = {
    createErrorResponse,
    sendErrorResponse,
    ErrorResponse,
    ERROR_CODES
};

