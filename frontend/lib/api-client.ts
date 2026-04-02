export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ApiRequestOptions {
  method?: ApiMethod;
  token?: string;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || 'Request failed';
    throw new Error(message);
  }

  return payload.data as T;
}
