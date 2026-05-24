import axios from 'axios';

let _accessToken: string | null = null;
let onTokenRefreshCallback: ((token: string) => void) | null = null;
let onLogoutCallback: (() => void) | null = null;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8009',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HttpOnly refresh_token cookie
});

export const getAccessToken = () => _accessToken;
export const setAccessToken = (token: string | null) => {
  _accessToken = token;
};

export const registerAuthCallbacks = (
  onRefresh: (token: string) => void,
  onLogout: () => void
) => {
  onTokenRefreshCallback = onRefresh;
  onLogoutCallback = onLogout;
};

// Request Interceptor: inject in-memory JWT
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: auto silent refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loops if refresh requests fail
    if (originalRequest.url?.includes('/auth/refresh')) {
      setAccessToken(null);
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await api.post('/auth/refresh');
        const { access_token } = refreshResponse.data;
        setAccessToken(access_token);

        if (onTokenRefreshCallback) {
          onTokenRefreshCallback(access_token);
        }

        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        if (onLogoutCallback) {
          onLogoutCallback();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
