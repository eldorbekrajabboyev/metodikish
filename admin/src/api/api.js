import axios from 'axios';

const api = axios.create();

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('admin_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && window.location.pathname !== '/admin/login') {
      const basePath = window.location.pathname.replace(/^\/admin/, '') || '/';
      sessionStorage.setItem('admin_redirect', basePath);
      sessionStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
