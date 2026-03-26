import apiClient from './apiClient';

export const getCanteenOrders = async (status = 'Pending') => {
  const response = await apiClient.get('/canteen/orders', { params: { status } });
  return response.data;
};

export const processCanteenOrder = async (orderId) => {
  const response = await apiClient.patch(`/canteen/orders/${orderId}/process`);
  return response.data;
};

export const getCanteenMenuData = async () => {
  const response = await apiClient.get('/canteen/menu');
  return response.data;
};

export const updateCanteenCategorySettings = async (categorySettings) => {
  const response = await apiClient.put('/canteen/menu/settings', { categorySettings });
  return response.data;
};

export const createCanteenMenuItem = async (payload) => {
  const response = await apiClient.post('/canteen/menu/items', payload);
  return response.data;
};

export const updateCanteenMenuItem = async (itemId, payload) => {
  const response = await apiClient.put(`/canteen/menu/items/${itemId}`, payload);
  return response.data;
};

export const deleteCanteenMenuItem = async (itemId) => {
  const response = await apiClient.delete(`/canteen/menu/items/${itemId}`);
  return response.data;
};

export const getCanteenReportData = async (params) => {
  const response = await apiClient.get('/canteen/reports', { params });
  return response.data;
};
