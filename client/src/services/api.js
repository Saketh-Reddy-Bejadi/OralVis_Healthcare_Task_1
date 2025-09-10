import axios from 'axios';

// Determine API base URL from environment (Vercel-compatible)
const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL ||
  process?.env?.VITE_API_BASE_URL ||
  'http://localhost:3000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
};

// Submission API endpoints
export const submissionAPI = {
  // Patient endpoints
  upload: (formData) => api.post('/api/submissions/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  getMySubmissions: () => api.get('/api/submissions/my-submissions'),
  
  // Admin endpoints
  getAllSubmissions: () => api.get('/api/submissions/all'),
  getSubmission: (id) => api.get(`/api/submissions/${id}`),
  saveAnnotation: (id, annotationData) => api.post(`/api/submissions/${id}/annotate`, annotationData),
  generateReport: (id) => api.post(`/api/submissions/${id}/generate-report`),
};

// Helper function to get file URL
export const getFileUrl = (path) => {
  if (!path) return '';
  // If path is already absolute (e.g., starts with http), return as-is
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
};

export default api;
