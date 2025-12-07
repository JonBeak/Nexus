// File Clean up Finished: 2025-11-25
import axios from 'axios';
import { triggerSessionExpired } from '../contexts/SessionContext';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors and refresh tokens
api.interceptors.response.use(
  (response) => {
    // Unwrap ServiceResult<T> responses from backend
    // Backend returns { success: true, data: T } or { success: false, error: string, code: string }
    if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data;

          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', newRefreshToken);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - show modal then redirect
          console.error('Token refresh failed:', refreshError);
          triggerSessionExpired();
          // Note: SessionExpiredModal will handle cleanup and redirect
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token - show modal then redirect
        triggerSessionExpired();
        // Note: SessionExpiredModal will handle cleanup and redirect
      }
    }
    return Promise.reject(error);
  }
);

// Export as both named export and default for flexibility
export default api;
