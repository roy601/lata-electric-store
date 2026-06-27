import api from './axiosConfig';

export const loginAdmin = (email, password) =>
  api.post('/auth/login', { email, password });

export const refreshToken = () =>
  api.post('/auth/refresh');

export const logoutAdmin = () =>
  api.post('/auth/logout');

export const getMe = () =>
  api.get('/auth/me');

export const changePassword = ({ currentPassword, newPassword }) =>
  api.patch('/auth/change-password', { currentPassword, newPassword });
