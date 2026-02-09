import { useState, useCallback } from 'react';

export type ProxyStatus = 'unchecked' | 'checking' | 'available' | 'unavailable' | 'error';

interface ProxyCheckResult {
  status: ProxyStatus;
  message: string;
  timestamp: number;
}

export const useProxyCheck = () => {
  const [proxyStatus, setProxyStatus] = useState<ProxyCheckResult>({
    status: 'unchecked',
    message: '',
    timestamp: 0
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkProxyAvailability = useCallback(async (
    host: string, 
    port: number
  ): Promise<ProxyCheckResult> => {
    setIsChecking(true);
    setProxyStatus({
      status: 'checking',
      message: `Checking proxy at ${host}:${port}...`,
      timestamp: Date.now()
    });

    try {
      // Attempt to connect to the proxy endpoint
      // Note: Browser security prevents direct socket connections
      // We can only check if something responds at that address via HTTP
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const proxyUrl = `http://${host}:${port}/`;
      
      try {
        // Try a simple fetch to see if anything responds
        await fetch(proxyUrl, {
          method: 'HEAD',
          mode: 'no-cors', // Allow cross-origin without CORS
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // If we get here without error, something is listening
        const result: ProxyCheckResult = {
          status: 'available',
          message: `Proxy appears to be running at ${host}:${port}`,
          timestamp: Date.now()
        };
        setProxyStatus(result);
        setIsChecking(false);
        return result;
        
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          const result: ProxyCheckResult = {
            status: 'unavailable',
            message: `Connection timeout: No response from ${host}:${port} within 3 seconds`,
            timestamp: Date.now()
          };
          setProxyStatus(result);
          setIsChecking(false);
          return result;
        }
        
        // Network errors typically mean nothing is listening
        const result: ProxyCheckResult = {
          status: 'unavailable',
          message: `Proxy server is refusing connections at ${host}:${port}. Ensure a proxy server is running.`,
          timestamp: Date.now()
        };
        setProxyStatus(result);
        setIsChecking(false);
        return result;
      }
      
    } catch (error: any) {
      const result: ProxyCheckResult = {
        status: 'error',
        message: `Error checking proxy: ${error.message}`,
        timestamp: Date.now()
      };
      setProxyStatus(result);
      setIsChecking(false);
      return result;
    }
  }, []);

  const resetStatus = useCallback(() => {
    setProxyStatus({
      status: 'unchecked',
      message: '',
      timestamp: 0
    });
  }, []);

  return {
    proxyStatus,
    isChecking,
    checkProxyAvailability,
    resetStatus
  };
};
