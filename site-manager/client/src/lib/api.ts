const API_BASE = import.meta.env.VITE_API_URL || "https://site-manager-backend-1.onrender.com/api";

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: string) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    error ? prom.reject(error) : prom.resolve(token);
  });
  failedQueue = [];
};

interface ApiOptions extends RequestInit {
  _retry?: boolean;
}

// Clean init: strip _retry
const cleanInit = (init: ApiOptions): RequestInit => {
  const { _retry, ...rest } = init;
  return rest;
};

export const api = async (
  path: string,
  init: ApiOptions = {}
): Promise<Response> => {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = localStorage.getItem("accessToken");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init.headers,
  };

  // First request — no _retry
  let res = await fetch(url, {
    ...cleanInit(init),
    headers,
    credentials: "include",
  });

  const isRefreshEndpoint = url.includes("/auth/refresh");
  if (res.status === 401 && !isRefreshEndpoint && !init._retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        return fetch(url, {
          ...cleanInit(init),
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
          credentials: "include",
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!refreshRes.ok) throw new Error("Refresh failed");

      const { accessToken } = await refreshRes.json();
      localStorage.setItem("accessToken", accessToken);
      processQueue(null, accessToken);

      // Retry: pass _retry: true in init, but clean it
      const retryInit: ApiOptions = { ...init, _retry: true };
      res = await fetch(url, {
        ...cleanInit(retryInit), // _retry stripped
        headers: { ...headers, Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
    } catch (err) {
      processQueue(err, null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("isAuthenticated");
      window.location.href = "/login";
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  return res;
};