import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const isRelativeUrl = !req.url.startsWith('http://') && !req.url.startsWith('https://');
  const isApiRequest = req.url.startsWith('/api');
  
  if (isRelativeUrl && !isApiRequest) {
    const apiReq = req.clone({
      url: `${environment.apiUrl}${req.url}`
    });
    return next(apiReq);
  }
  
  return next(req);
};
