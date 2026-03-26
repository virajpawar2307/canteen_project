import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const requestPath = String(config.url || '');
  const staffToken = localStorage.getItem('canteen_auth_token');
  const voucherToken = localStorage.getItem('canteen_voucher_token');

  let token = '';
  if (requestPath.startsWith('/canteen') || requestPath.startsWith('/coordinator') || requestPath.startsWith('/auth/login')) {
    token = staffToken || '';
  } else if (requestPath.startsWith('/examiner') || requestPath.startsWith('/auth/voucher-login')) {
    token = voucherToken || '';
  } else {
    token = staffToken || voucherToken || '';
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

export default apiClient;
