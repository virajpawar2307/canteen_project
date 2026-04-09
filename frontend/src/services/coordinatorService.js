import apiClient from './apiClient';

export const getCoordinatorVouchers = async () => {
  const response = await apiClient.get('/coordinator/vouchers');
  return response.data;
};

export const createCoordinatorVoucher = async (payload) => {
  const response = await apiClient.post('/coordinator/vouchers', payload);
  return response.data;
};

export const bulkCreateCoordinatorVouchers = async (entries) => {
  const response = await apiClient.post('/coordinator/vouchers/bulk', { entries });
  return response.data;
};

export const deleteCoordinatorVoucher = async (voucherId) => {
  const response = await apiClient.delete(`/coordinator/vouchers/${voucherId}`);
  return response.data;
};

export const clearCoordinatorVouchers = async () => {
  const response = await apiClient.delete('/coordinator/vouchers');
  return response.data;
};

export const getCoordinatorExternalVouchers = async () => {
  const response = await apiClient.get('/coordinator/external-vouchers');
  return response.data;
};

export const getCoordinatorReportData = async (params) => {
  const response = await apiClient.get('/coordinator/reports', { params });
  return response.data;
};
