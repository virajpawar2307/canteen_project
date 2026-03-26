import apiClient from './apiClient';

export const loginStaff = async (payload) => {
  const response = await apiClient.post('/auth/login', payload);
  return response.data;
};

export const loginWithVoucher = async (payload) => {
  const response = await apiClient.post('/auth/voucher-login', payload);
  return response.data;
};
