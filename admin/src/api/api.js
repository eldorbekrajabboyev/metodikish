import axios from 'axios';

const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';

const api = axios.create({
  headers: {
    'X-Admin-Key': ADMIN_API_KEY,
  },
});

export default api;
