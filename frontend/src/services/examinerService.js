import apiClient from './apiClient';

export const getExaminerSession = async () => {
  const response = await apiClient.get('/examiner/session');
  return response.data;
};

export const getExaminerMenu = async () => {
  const response = await apiClient.get('/examiner/menu');
  return response.data;
};

export const getExaminerOrders = async () => {
  const response = await apiClient.get('/examiner/orders');
  return response.data;
};

export const placeExaminerOrder = async (items) => {
  const response = await apiClient.post('/examiner/orders', { items });
  return response.data;
};

export const getGuestPasses = async () => {
  const response = await apiClient.get('/examiner/guest-passes');
  return response.data;
};

export const createGuestPass = async (payload) => {
  const response = await apiClient.post('/examiner/guest-passes', payload);
  return response.data;
};

export const deleteGuestPass = async (guestPassId) => {
  const response = await apiClient.delete(`/examiner/guest-passes/${guestPassId}`);
  return response.data;
};
