import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs/operators';

const REQUEST_TIMEOUT_MS = 20_000;

export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/socket.io')) return next(req);
  return next(req).pipe(timeout(REQUEST_TIMEOUT_MS));
};
