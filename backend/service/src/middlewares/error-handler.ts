import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-errors.js';
import { ApiErrorResponse } from '../models/domain.js';

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  request.log.error(
    {
      err: error,
      url: request.raw.url,
      method: request.raw.method,
      requestId: request.id
    },
    'Request execution failed'
  );

  if (error instanceof ZodError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.flatten().fieldErrors
      }
    };
    reply.status(400).send(errorResponse);
    return;
  }

  if (error instanceof AppError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        message: error.message,
        code: error.constructor.name,
        details: (error as { details?: unknown }).details
      }
    };
    reply.status(error.statusCode).send(errorResponse);
    return;
  }

  const statusCode = (error as FastifyError).statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      message: isProduction && statusCode === 500 ? 'Internal Server Error' : error.message,
      code: 'INTERNAL_SERVER_ERROR'
    }
  };

  reply.status(statusCode).send(errorResponse);
}
