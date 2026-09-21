import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const detail = exception.message;
    const exceptionResponse = exception.getResponse();
    const retryAfter =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { retryAfter?: unknown }).retryAfter
        : undefined;
    if (typeof retryAfter === 'number') response.setHeader('Retry-After', String(retryAfter));
    response
      .status(status)
      .type('application/problem+json')
      .send({
        type: `https://httpstatuses.com/${status}`,
        title: exception.name,
        status,
        detail,
      });
  }
}
