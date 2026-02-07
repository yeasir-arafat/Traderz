import axios from 'axios';
import { useAuthStore } from '../store';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/** Build full URL for upload paths (e.g. /uploads/kyc/xxx) so images load from backend. */
export function getUploadUrl(path) {
  if (!path) return path;
  if (typeof path !== 'string' || path.startsWith('http')) return path;
  const base = (API_URL || '').replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : '/' + path}` : path;
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    // Return data directly if success
    if (response.data?.success) {
      return response.data.data;
    }
    return response.data;
  },
  (error) => {
    const errorData = error.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: error.message || 'Network error occurred',
    };
    
    // Handle 401 - logout user
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    
    return Promise.reject(errorData);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  firebaseAuth: (idToken) => api.post('/auth/firebase', { id_token: idToken }),
  completeProfile: (data, params) => api.post('/auth/complete-profile', data, { params }),
  acceptTerms: () => api.post('/auth/accept-terms', { accepted: true }),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/password/change', data),
  forgotPassword: (email) => api.post('/auth/password/forgot', { email }),
  resetPassword: (data) => api.post('/auth/password/reset', data),
  logout: () => api.post('/auth/logout'),
};

// Users API
export const usersAPI = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  becomeSeller: () => api.post('/users/become-seller'),
};

// Sellers API
export const sellersAPI = {
  getProfile: (sellerId) => api.get(`/sellers/${sellerId}`),
};

// Listings API
export const listingsAPI = {
  getAll: (params) => api.get('/listings', { params }),
  getMy: (params) => api.get('/listings/my', { params }),
  getById: (id) => api.get(`/listings/${id}`),
  create: (data) => api.post('/listings', data),
  update: (id, data) => api.put(`/listings/${id}`, data),
  delete: (id) => api.delete(`/listings/${id}`),
  getPending: (params) => api.get('/listings/admin/pending', { params }),
  review: (id, data) => api.post(`/listings/admin/${id}/review`, data),
};

// Orders API
export const ordersAPI = {
  create: (listingId) => api.post('/orders', { listing_id: listingId }),
  getMyPurchases: (params) => api.get('/orders/my/purchases', { params }),
  getMySales: (params) => api.get('/orders/my/sales', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  deliver: (id, deliveryInfo) => api.post(`/orders/${id}/deliver`, { delivery_info: deliveryInfo }),
  complete: (id) => api.post(`/orders/${id}/complete`),
  dispute: (id, reason) => api.post(`/orders/${id}/dispute`, { reason }),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  resolveDispute: (id, data) => api.post(`/orders/admin/${id}/resolve`, data),
};

// Wallet API
export const walletAPI = {
  getBalance: () => api.get('/wallet/balance'),
  getHistory: (params) => api.get('/wallet/history', { params }),
  deposit: (amount) => api.post('/wallet/deposit', { amount_usd: amount }),
  withdraw: (data) => api.post('/wallet/withdraw', data),
  redeemGiftCard: (code) => api.post('/wallet/redeem-giftcard', { code }),
};

// Chats API
export const chatsAPI = {
  getAll: (conversationType = null) => api.get('/chats', { params: conversationType ? { conversation_type: conversationType } : {} }),
  getUnreadCount: () => api.get('/chats/unread-count'),
  start: (data) => api.post('/chats/start', data),
  getOrderChat: (orderId) => api.get(`/chats/order/${orderId}`),
  getMessages: (conversationId, params) => api.get(`/chats/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, content, attachments = []) => 
    api.post(`/chats/${conversationId}/messages`, { content, attachments }),
  markRead: (conversationId, messageIds) => 
    api.post(`/chats/${conversationId}/read`, { message_ids: messageIds }),
  inviteAdmin: (conversationId) => api.post(`/chats/${conversationId}/invite-admin`),
  // Support chat endpoints
  createSupportRequest: (subject, initialMessage, attachments = []) => 
    api.post('/chats/support', { subject, initial_message: initialMessage, attachments }),
  getSupportRequests: () => api.get('/chats/support/requests'),
  acceptSupportRequest: (conversationId) => api.post(`/chats/support/${conversationId}/accept`),
  closeSupportRequest: (conversationId, reason = null) => 
    api.post(`/chats/support/${conversationId}/close`, { reason }),
};

// Notifications API
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

// KYC API
export const kycAPI = {
  submit: (data) => api.post('/kyc', data),
  getMy: () => api.get('/kyc/my'),
  getPending: (params) => api.get('/kyc/admin/pending', { params }),
  review: (id, data) => api.post(`/kyc/admin/${id}/review`, data),
};

// Games API
export const gamesAPI = {
  getAll: (includeInactive = false) => api.get('/games', { params: { include_inactive: includeInactive } }),
  getById: (id) => api.get(`/games/${id}`),
  create: (data) => api.post('/games', data),
  update: (id, data) => api.put(`/games/${id}`, data),
  addPlatform: (gameId, data) => api.post(`/games/${gameId}/platforms`, data),
  updatePlatform: (platformId, data) => api.put(`/games/platforms/${platformId}`, data),
  getFeeRules: () => api.get('/games/fee-rules'),
  createFeeRule: (data) => api.post('/games/fee-rules', data),
  updateFeeRule: (id, data) => api.put(`/games/fee-rules/${id}`, data),
  deleteFeeRule: (id) => api.delete(`/games/fee-rules/${id}`),
};

// FAQ API
export const faqAPI = {
  getAll: (category) => api.get('/faq', { params: { category } }),
  create: (data) => api.post('/faq', data),
  update: (id, data) => api.put(`/faq/${id}`, data),
  delete: (id) => api.delete(`/faq/${id}`),
};

// Config API
export const configAPI = {
  getPublic: () => api.get('/config'),
  getAll: () => api.get('/config/all'),
  update: (key, value) => api.put('/config', { key, value }),
};

// Reviews API
export const reviewsAPI = {
  create: (orderId, data) => api.post(`/reviews/order/${orderId}`, data),
  getForSeller: (sellerId, params) => api.get(`/reviews/seller/${sellerId}`, { params }),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getDisputes: (params) => api.get('/admin/disputes', { params }),
};

// Super Admin API
export const superAdminAPI = {
  // Dashboard
  getDashboard: () => api.get('/superadmin/dashboard'),
  getSystemHealth: () => api.get('/superadmin/system-health'),
  getAdminActions: (params) => api.get('/superadmin/admin-actions', { params }),
  
  // Legacy stats
  getStats: () => api.get('/superadmin/stats'),
  getFinance: () => api.get('/superadmin/finance'),
  
  // All Orders View
  getAllOrders: (params) => api.get('/superadmin/orders', { params }),
  
  // Admin Management
  getAdmins: (params) => api.get('/superadmin/admins', { params }),
  createAdmin: (data) => api.post('/superadmin/admins', data),
  toggleAdmin: (id, data) => api.patch(`/superadmin/admins/${id}`, data),
  
  // Admin Permission Scopes
  getAdminScopes: (adminId) => api.get(`/superadmin/admins/${adminId}/scopes`),
  updateAdminScopes: (adminId, data) => api.put(`/superadmin/admins/${adminId}/scopes`, data),
  applyAdminScopePreset: (adminId, data) => api.post(`/superadmin/admins/${adminId}/scopes/preset`, data),
  
  // User Management
  getUsers: (params) => api.get('/superadmin/users', { params }),
  getUserDetail: (id) => api.get(`/superadmin/users/${id}`),
  updateUserStatus: (id, data) => api.patch(`/superadmin/users/${id}/status`, data),
  updateUserRoles: (id, data) => api.patch(`/superadmin/users/${id}/roles`, data),
  forceLogout: (id, reason) => api.post(`/superadmin/users/${id}/force-logout?reason=${encodeURIComponent(reason)}`),
  unlockProfile: (id, data) => api.post(`/superadmin/users/${id}/unlock-profile`, data),
  suspendSeller: (id, data) => api.post(`/superadmin/users/${id}/suspend-seller`, data),
  
  // Wallet / Finance
  creditWallet: (data, idempotencyKey) => api.post('/superadmin/wallet/credit', data, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
  }),
  debitWallet: (data, idempotencyKey) => api.post('/superadmin/wallet/debit', data, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
  }),
  freezeFunds: (data, idempotencyKey) => api.post('/superadmin/wallet/freeze', data, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
  }),
  unfreezeFunds: (data, idempotencyKey) => api.post('/superadmin/wallet/unfreeze', data, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
  }),
  getUserLedger: (userId, params) => api.get('/superadmin/wallet/ledger', { params: { user_id: userId, ...params } }),
  
  // Withdrawals Management
  getWithdrawals: (params) => api.get('/superadmin/withdrawals', { params }),
  processWithdrawal: (id, data) => api.post(`/superadmin/withdrawals/${id}/process`, data),
  
  // Order Overrides
  forceRefund: (orderId, data) => api.post(`/superadmin/orders/${orderId}/force-refund`, data),
  forceComplete: (orderId, data) => api.post(`/superadmin/orders/${orderId}/force-complete`, data),
  extendDisputeWindow: (orderId, data) => api.patch(`/superadmin/orders/${orderId}/dispute-window`, data),
  
  // Content Moderation
  hideListing: (id, data) => api.patch(`/superadmin/listings/${id}/status`, data),
  hideMessage: (id, data) => api.patch(`/superadmin/messages/${id}/hide`, data),
  
  // Gift Card Management
  generateGiftCards: (data) => api.post('/superadmin/giftcards/generate', data),
  getGiftCards: (params) => api.get('/superadmin/giftcards', { params }),
  deactivateGiftCard: (id, data) => api.post(`/superadmin/giftcards/${id}/deactivate`, data),
  
  // Platform Config
  getConfig: () => api.get('/superadmin/config'),
  updateConfig: (data) => api.put('/superadmin/config', data),
  
  // Legal Documents
  updateLegal: (data) => api.put('/superadmin/legal', data),
};

// Gift Cards API
export const giftCardsAPI = {
  getAll: (params) => api.get('/giftcards', { params }),
  create: (data) => api.post('/giftcards', data),
  deactivate: (id) => api.delete(`/giftcards/${id}`),
};

// Upload API
export const uploadAPI = {
  uploadListing: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/listing', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadKYC: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/kyc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
