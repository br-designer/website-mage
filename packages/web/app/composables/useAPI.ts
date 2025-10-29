interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export const useAPI = () => {
  const config = useRuntimeConfig();
  const baseURL = config.public.apiUrl || 'https://api.websitemage.com';

  const call = async <T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `API error: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  const get = <T = unknown>(endpoint: string, options?: RequestInit) =>
    call<T>(endpoint, { ...options, method: 'GET' });

  const post = <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    call<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });

  const put = <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    call<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });

  const del = <T = unknown>(endpoint: string, options?: RequestInit) =>
    call<T>(endpoint, { ...options, method: 'DELETE' });

  return {
    call,
    get,
    post,
    put,
    delete: del,
  };
};
