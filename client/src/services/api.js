import axios from 'axios';

const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL ||
  (import.meta?.env?.MODE === 'production' 
    ? 'https://oralvis-healthcare-1-backend.vercel.app' 
    : 'http://localhost:3000');

// Global reference to auth context for handling 401 errors
let authContextRef = null;

export const setAuthContextRef = (authContext) => {
  authContextRef = authContext;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Use the auth context to handle logout properly without page refresh
      if (authContextRef && authContextRef.handleUnauthorized) {
        authContextRef.handleUnauthorized();
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
};

export const submissionAPI = {
  upload: (formData) => api.post('/api/submissions/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  getMySubmissions: () => api.get('/api/submissions/my-submissions'),
  
  getAllSubmissions: () => api.get('/api/submissions/all'),
  getSubmission: (id) => api.get(`/api/submissions/${id}`),
  saveAnnotation: (id, annotationData) => api.post(`/api/submissions/${id}/annotate`, annotationData),
  generateReport: (id) => api.post(`/api/submissions/${id}/generate-report`),
};

export const getFileUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
};

export default api;
