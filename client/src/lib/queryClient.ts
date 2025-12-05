import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken } from "./authToken";

// Debug logging helper
function logApi(stage: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[API ${timestamp}] ${stage}`, data || '');
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    logApi('RESPONSE_ERROR', { status: res.status, url: res.url, text });
    throw new Error(`${res.status}: ${text}`);
  }
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    logApi('AUTH_HEADER_SET', { tokenLength: token.length, tokenPreview: `${token.substring(0, 15)}...` });
  } else {
    logApi('AUTH_HEADER_MISSING', { message: 'No token available' });
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    logApi('FETCH_START', { url });
    
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: "include",
    });
    
    logApi('FETCH_RESPONSE', { url, status: res.status, ok: res.ok });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      logApi('FETCH_401_HANDLED', { url, behavior: 'returnNull' });
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
