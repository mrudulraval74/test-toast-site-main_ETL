import { useCallback, useRef, useEffect } from 'react';
import { RecordedStep } from './types';

interface InterceptedRequest {
  method: RecordedStep['method'];
  url: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

interface UseRequestInterceptorOptions {
  enabled: boolean;
  onRequestCaptured: (request: InterceptedRequest) => void;
  excludePatterns?: RegExp[];
}

export const useRequestInterceptor = ({
  enabled,
  onRequestCaptured,
  excludePatterns = [
    /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico)(\?.*)?$/i,
    /supabase\.co/i,
    /chrome-extension:/i,
    /lovableproject\.com/i,
  ]
}: UseRequestInterceptorOptions) => {
  const originalFetch = useRef<typeof fetch | null>(null);
  const originalXHROpen = useRef<typeof XMLHttpRequest.prototype.open | null>(null);
  const originalXHRSend = useRef<typeof XMLHttpRequest.prototype.send | null>(null);
  const isIntercepting = useRef(false);

  const shouldCapture = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url, window.location.origin);
      return !excludePatterns.some(pattern => pattern.test(urlObj.href));
    } catch {
      return false;
    }
  }, [excludePatterns]);

  const parseHeaders = (headers: HeadersInit | undefined): Record<string, string> => {
    const result: Record<string, string> = {};
    if (!headers) return result;
    
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        result[key] = value;
      });
    } else {
      Object.entries(headers).forEach(([key, value]) => {
        result[key] = value;
      });
    }
    return result;
  };

  const startIntercepting = useCallback(() => {
    if (isIntercepting.current) return;
    isIntercepting.current = true;

    // Store originals
    originalFetch.current = window.fetch;
    originalXHROpen.current = XMLHttpRequest.prototype.open;
    originalXHRSend.current = XMLHttpRequest.prototype.send;

    // Intercept fetch
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method || 'GET').toUpperCase() as RecordedStep['method'];
      
      if (shouldCapture(url)) {
        let bodyText = '';
        if (init?.body) {
          if (typeof init.body === 'string') {
            bodyText = init.body;
          } else if (init.body instanceof FormData) {
            bodyText = '[FormData]';
          } else if (init.body instanceof URLSearchParams) {
            bodyText = init.body.toString();
          }
        }

        onRequestCaptured({
          method,
          url,
          headers: parseHeaders(init?.headers),
          body: bodyText,
          timestamp: Date.now()
        });
      }

      return originalFetch.current!.call(window, input, init);
    };

    // Intercept XMLHttpRequest
    const xhrData = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      xhrData.set(this, { method: method.toUpperCase(), url: url.toString() });
      return originalXHROpen.current!.apply(this, [method, url, ...args] as any);
    };

    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      const data = xhrData.get(this);
      if (data && shouldCapture(data.url)) {
        let bodyText = '';
        if (body) {
          if (typeof body === 'string') {
            bodyText = body;
          } else if (body instanceof FormData) {
            bodyText = '[FormData]';
          }
        }

        onRequestCaptured({
          method: data.method as RecordedStep['method'],
          url: data.url,
          headers: {},
          body: bodyText,
          timestamp: Date.now()
        });
      }

      return originalXHRSend.current!.call(this, body);
    };

    console.log('[RequestInterceptor] Started intercepting requests');
  }, [shouldCapture, onRequestCaptured]);

  const stopIntercepting = useCallback(() => {
    if (!isIntercepting.current) return;
    isIntercepting.current = false;

    // Restore originals
    if (originalFetch.current) {
      window.fetch = originalFetch.current;
    }
    if (originalXHROpen.current) {
      XMLHttpRequest.prototype.open = originalXHROpen.current;
    }
    if (originalXHRSend.current) {
      XMLHttpRequest.prototype.send = originalXHRSend.current;
    }

    console.log('[RequestInterceptor] Stopped intercepting requests');
  }, []);

  useEffect(() => {
    if (enabled) {
      startIntercepting();
    } else {
      stopIntercepting();
    }

    return () => {
      stopIntercepting();
    };
  }, [enabled, startIntercepting, stopIntercepting]);

  return {
    isIntercepting: isIntercepting.current,
    startIntercepting,
    stopIntercepting
  };
};
