/**
 * ============================================================================
 * J & D Beach House · REST API Frontend Adapter
 * Consumes: Data Payload 2 (Transactional HTTP/JSON over TCP)
 * Handles: Standard CRUD, authentication, admin endpoints, room inventory
 * ============================================================================
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface RestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

class RestAdapter {
  private getAuthHeader(): Record<string, string> {
    if (typeof sessionStorage === 'undefined') return {};
    const adminToken = sessionStorage.getItem('jd_admin_jwt');
    const customerToken = sessionStorage.getItem('jd_customer_jwt');
    const token = adminToken || customerToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Request data payload 2 from the REST API channel
   */
  public async request<T = any>(endpoint: string, options: RestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...(options.headers || {}),
    };

    const fetchConfig: RequestInit = {
      method: options.method || 'GET',
      headers,
      credentials: options.credentials || 'include',
    };

    if (options.body && options.method !== 'GET') {
      fetchConfig.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchConfig);

    if (!res.ok) {
      let errData: any = {};
      try {
        errData = await res.json();
      } catch {
        errData = { message: `HTTP ${res.status}: ${res.statusText}` };
      }
      const err = new Error(errData.message || `Request failed with status ${res.status}`);
      (err as any).status = res.status;
      (err as any).data = errData;
      throw err;
    }

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json();
  }

  public get<T = any>(endpoint: string, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  public post<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  public put<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  public patch<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers });
  }

  public delete<T = any>(endpoint: string, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const restAdapter = new RestAdapter();
