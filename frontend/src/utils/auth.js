export const clearAuthSession = () => {
  localStorage.removeItem('canteen_auth_token');
  localStorage.removeItem('canteen_auth_user');
  localStorage.removeItem('canteen_voucher_token');
  localStorage.removeItem('canteen_voucher_session');
};

export const isUnauthorizedError = (error) => {
  const status = error?.response?.status;
  return status === 401 || status === 403;
};
