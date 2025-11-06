const { useState, useEffect } = React;
// Lucide icons not used in this version - using emoji icons instead
// const { AlertCircle, CheckCircle, Clock, XCircle, LogOut, Plus, Edit, Trash2, FileText, DollarSign, Users, Package } = lucide;

// Dynamically determine API URL based on current host
const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api`;

// Helper to get auth token from localStorage
const getAuthToken = () => localStorage.getItem('authToken');

// Helper to get refresh token from localStorage
const getRefreshToken = () => localStorage.getItem('refreshToken');

// Helper to get user data from localStorage
const getUserData = () => {
  const userData = localStorage.getItem('userData');
  return userData ? JSON.parse(userData) : null;
};

// Helper to set auth token
const setAuthToken = (token) => localStorage.setItem('authToken', token);

// Helper to set refresh token
const setRefreshToken = (token) => localStorage.setItem('refreshToken', token);

// Helper to set user data
const setUserData = (user) => localStorage.setItem('userData', JSON.stringify(user));

// Helper to clear all auth data
const clearAuthToken = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userData');
};

// Helper to get headers with auth
const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Theme Management Helpers
const getTheme = () => localStorage.getItem('theme') || 'light';

const setTheme = (theme) => {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
};

const toggleTheme = () => {
  const currentTheme = getTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  return newTheme;
};

// Helper to refresh access token
const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!res.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data.token;
};

// Enhanced fetch with automatic token refresh
const fetchWithAuth = async (url, options = {}) => {
  // First attempt with current token
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...getHeaders()
    }
  });

  // If 401 (unauthorized), try to refresh token and retry
  if (response.status === 401) {
    try {
      await refreshAccessToken();
      // Retry the request with new token
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...getHeaders()
        }
      });
    } catch (error) {
      // Refresh failed, clear auth and redirect to login
      clearAuthToken();
      window.location.reload();
      throw new Error('Session expired. Please login again.');
    }
  }

  return response;
};

const api = {
  login: async (username, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    // Store all auth data
    if (data.token) {
      setAuthToken(data.token);
    }
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
    }
    if (data.user) {
      setUserData(data.user);
    }
    return data;
  },
  
  getRequisitions: async () => {
    const res = await fetchWithAuth(`${API_URL}/requisitions`);
    if (!res.ok) throw new Error('Failed to fetch requisitions');
    return res.json();
  },

  createRequisition: async (data) => {
    const res = await fetch(`${API_URL}/requisitions/simple`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create requisition');
    }
    return res.json();
  },

  updateRequisition: async (id, data) => {
    const res = await fetch(`${API_URL}/requisitions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update requisition');
    return res.json();
  },

  getUsers: async () => {
    const res = await fetch(`${API_URL}/users`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  createUser: async (data) => {
    const res = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  },

  deleteUser: async (id) => {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return res.json();
  },

  getVendors: async () => {
    const res = await fetchWithAuth(`${API_URL}/vendors`);
    if (!res.ok) throw new Error('Failed to fetch vendors');
    return res.json();
  },

  createVendor: async (data) => {
    const res = await fetch(`${API_URL}/vendors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create vendor');
    return res.json();
  },

  deleteVendor: async (id) => {
    const res = await fetch(`${API_URL}/vendors/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete vendor');
    return res.json();
  },

  // Purchase Orders
  getPurchaseOrders: async () => {
    const res = await fetchWithAuth(`${API_URL}/purchase-orders`);
    if (!res.ok) throw new Error('Failed to fetch purchase orders');
    return res.json();
  },

  downloadPOPDF: async (poId) => {
    const res = await fetchWithAuth(`${API_URL}/purchase-orders/${poId}/pdf`);
    if (!res.ok) throw new Error('Failed to download PO PDF');
    return res.blob();
  },

  downloadRequisitionPDF: async (reqId) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${reqId}/pdf`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to download Requisition PDF');
    }
    return res.blob();
  },

  getDepartments: async () => {
    const res = await fetch(`${API_URL}/departments`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch departments');
    return res.json();
  },

  // ============================================
  // FX RATES API - COMPLETE
  // ============================================

  getFXRates: async () => {
    const res = await fetch(`${API_URL}/fx-rates`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch FX rates');
    return res.json();
  },

  getAllFXRates: async () => {
    const res = await fetch(`${API_URL}/fx-rates/all`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch all FX rates');
    return res.json();
  },

  updateFXRate: async (data) => {
    const res = await fetch(`${API_URL}/fx-rates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update FX rate');
    return res.json();
  },

  deactivateFXRate: async (id) => {
    const res = await fetch(`${API_URL}/fx-rates/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to deactivate FX rate');
    return res.json();
  },

  getFXRateHistory: async (currencyCode) => {
    const res = await fetch(`${API_URL}/fx-rates/${currencyCode}/history`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch FX rate history');
    return res.json();
  },

  // ============================================
  // BUDGET API - COMPLETE
  // ============================================

  getBudgetOverview: async (fiscalYear) => {
    const res = await fetch(`${API_URL}/budgets/overview?fiscal_year=${fiscalYear}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch budget overview');
    return res.json();
  },

  getDepartmentBudget: async (department, fiscalYear) => {
    const res = await fetch(`${API_URL}/budgets/department/${department}?fiscal_year=${fiscalYear}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch department budget');
    return res.json();
  },

  updateBudgetAllocation: async (budgetId, amount) => {
    const res = await fetch(`${API_URL}/budgets/${budgetId}/allocate`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ allocated_amount: amount })
    });
    if (!res.ok) throw new Error('Failed to update budget');
    return res.json();
  },

  budgetCheck: async (requisitionId, approved, comments) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/budget-check`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ approved, comments })
    });
    if (!res.ok) throw new Error('Failed to perform budget check');
    return res.json();
  },

  // ============================================
  // REQUISITION ITEMS API - MULTI-CURRENCY
  // ============================================

  addRequisitionItem: async (requisitionId, item) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to add item');
    return res.json();
  },

  updateRequisitionItem: async (requisitionId, itemId, item) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/items/${itemId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to update item');
    return res.json();
  },

  deleteRequisitionItem: async (requisitionId, itemId) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/items/${itemId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete item');
    return res.json();
  },

  updateRequisitionFields: async (requisitionId, fields) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/update-fields`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(fields)
    });
    if (!res.ok) throw new Error('Failed to update fields');
    return res.json();
  },

  // ============================================
  // REQUISITION WORKFLOW API
  // ============================================

  submitRequisition: async (requisitionId, userId, selectedHodId = null) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/submit`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ user_id: userId, selected_hod_id: selectedHodId })
    });
    if (!res.ok) throw new Error('Failed to submit requisition');
    return res.json();
  },

  hodApprove: async (requisitionId, approved, comments, userId) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/hod-approve`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ user_id: userId, approve: approved, comments })
    });
    if (!res.ok) throw new Error('Failed to process HOD approval');
    return res.json();
  },

  financeApprove: async (requisitionId, approved, comments, userId) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/finance-approve`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ user_id: userId, approve: approved, comments })
    });
    if (!res.ok) throw new Error('Failed to process finance approval');
    return res.json();
  },

  mdApprove: async (requisitionId, approved, comments, userId) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/md-approve`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ user_id: userId, approve: approved, comments })
    });
    if (!res.ok) throw new Error('Failed to process MD approval');
    return res.json();
  },

  completeProcurement: async (requisitionId, comments, procurementAssignedTo) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/procurement`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        comments,
        procurement_assigned_to: procurementAssignedTo
      })
    });
    if (!res.ok) throw new Error('Failed to complete procurement');
    return res.json();
  },

  redirectRequisition: async (requisitionId, newApproverId, reason) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/redirect`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ new_approver_id: newApproverId, reason })
    });
    if (!res.ok) throw new Error('Failed to redirect requisition');
    return res.json();
  },

  getRequisitionPDF: async (requisitionId) => {
    const token = getAuthToken();
    window.open(`${API_URL}/requisitions/${requisitionId}/pdf?token=${token}`, '_blank');
  },

  // ============================================
  // ADMIN API
  // ============================================

  getAdminStats: async () => {
    const res = await fetch(`${API_URL}/admin/stats`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
  },

  getAdminUsers: async () => {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin users');
    return res.json();
  },

  createAdminUser: async (userData) => {
    const res = await fetch(`${API_URL}/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  },

  updateAdminUser: async (userId, userData) => {
    const res = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    if (!res.ok) throw new Error('Failed to update user');
    return res.json();
  },

  deleteAdminUser: async (userId) => {
    const res = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return res.json();
  },

  createAdminVendor: async (vendorData) => {
    const res = await fetch(`${API_URL}/admin/vendors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(vendorData)
    });
    if (!res.ok) throw new Error('Failed to create vendor');
    return res.json();
  },

  updateAdminVendor: async (vendorId, vendorData) => {
    const res = await fetch(`${API_URL}/admin/vendors/${vendorId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(vendorData)
    });
    if (!res.ok) throw new Error('Failed to update vendor');
    return res.json();
  },

  deleteAdminVendor: async (vendorId) => {
    const res = await fetch(`${API_URL}/admin/vendors/${vendorId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete vendor');
    return res.json();
  },

  getAdminDepartments: async () => {
    const res = await fetch(`${API_URL}/admin/departments`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch departments');
    return res.json();
  },

  getAdminPendingRequisitions: async () => {
    const res = await fetch(`${API_URL}/admin/pending-requisitions`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch pending requisitions');
    return res.json();
  },

  reassignRequisition: async (requisitionId, newApproverId, reason) => {
    const res = await fetch(`${API_URL}/admin/reassign/${requisitionId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ new_approver_id: newApproverId, reason })
    });
    if (!res.ok) throw new Error('Failed to reassign requisition');
    return res.json();
  },

  getAdminReportSummary: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const res = await fetch(`${API_URL}/admin/reports/summary?${params}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch report summary');
    return res.json();
  },

  getAdminBudgets: async () => {
    const res = await fetch(`${API_URL}/admin/budgets`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    return res.json();
  },

  createAdminBudget: async (budgetData) => {
    const res = await fetch(`${API_URL}/admin/budgets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(budgetData)
    });
    if (!res.ok) throw new Error('Failed to create budget');
    return res.json();
  },

  deleteAdminBudget: async (department) => {
    const res = await fetch(`${API_URL}/admin/budgets/${department}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete budget');
    return res.json();
  },

  // ============================================
  // REPORTS API - COMPLETE
  // ============================================

  downloadRequisitionsExcel: (filters = {}) => {
    const params = new URLSearchParams(filters);
    const token = getAuthToken();
    window.open(`${API_URL}/reports/requisitions/excel?${params}`, '_blank');
  },

  downloadRequisitionsPDF: (filters = {}) => {
    const params = new URLSearchParams(filters);
    const token = getAuthToken();
    window.open(`${API_URL}/reports/requisitions/pdf?${params}`, '_blank');
  },

  downloadBudgetExcel: (fiscalYear) => {
    const token = getAuthToken();
    window.open(`${API_URL}/reports/budgets/excel?fiscal_year=${fiscalYear}`, '_blank');
  },

  downloadBudgetPDF: (fiscalYear) => {
    const token = getAuthToken();
    window.open(`${API_URL}/reports/budgets/pdf?fiscal_year=${fiscalYear}`, '_blank');
  },

  downloadFXRatesExcel: () => {
    const token = getAuthToken();
    window.open(`${API_URL}/reports/fx-rates/excel`, '_blank');
  },

  downloadDepartmentPDF: (department, fiscalYear) => {
    const params = new URLSearchParams({ fiscal_year: fiscalYear });
    const token = getAuthToken();
    window.open(`${API_URL}/reports/department/${department}/pdf?${params}`, '_blank');
  },

  // ============================================
  // QUOTES AND ADJUDICATIONS API
  // ============================================

  uploadQuote: async (requisitionId, formData) => {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/quotes`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to upload quote');
    }
    return res.json();
  },

  getQuotes: async (requisitionId) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/quotes`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch quotes');
    return res.json();
  },

  downloadQuote: (quoteId) => {
    const token = getAuthToken();
    window.open(`${API_URL}/quotes/${quoteId}/download?token=${token}`, '_blank');
  },

  deleteQuote: async (quoteId) => {
    const res = await fetch(`${API_URL}/quotes/${quoteId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete quote');
    return res.json();
  },

  createAdjudication: async (requisitionId, data) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/adjudication`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create adjudication');
    }
    return res.json();
  },

  getAdjudication: async (requisitionId) => {
    const res = await fetch(`${API_URL}/requisitions/${requisitionId}/adjudication`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch adjudication');
    return res.json();
  },

  // ============================================
  // AUTH API - COMPLETE
  // ============================================

  refreshToken: async (refreshToken) => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) throw new Error('Failed to refresh token');
    return res.json();
  },

  logout: async () => {
    const res = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Logout failed');
    return res.json();
  },

  // ============================================
  // STATS API
  // ============================================

  getStats: async () => {
    const res = await fetch(`${API_URL}/stats`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // ============================================
  // DEPARTMENT MANAGEMENT API
  // ============================================

  createDepartment: async (deptData) => {
    const res = await fetch(`${API_URL}/admin/departments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(deptData)
    });
    if (!res.ok) throw new Error('Failed to create department');
    return res.json();
  },

  updateDepartment: async (deptId, deptData) => {
    const res = await fetch(`${API_URL}/admin/departments/${deptId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(deptData)
    });
    if (!res.ok) throw new Error('Failed to update department');
    return res.json();
  },

  deleteDepartment: async (deptId) => {
    const res = await fetch(`${API_URL}/admin/departments/${deptId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete department');
    return res.json();
  },

  // ============================================
  // DEPARTMENT CODES API
  // ============================================

  getDepartmentCodes: async () => {
    const res = await fetch(`${API_URL}/admin/department-codes`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch department codes');
    return res.json();
  },

  createDepartmentCode: async (codeData) => {
    const res = await fetch(`${API_URL}/admin/department-codes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(codeData)
    });
    if (!res.ok) throw new Error('Failed to create department code');
    return res.json();
  },

  updateDepartmentCode: async (codeId, codeData) => {
    const res = await fetch(`${API_URL}/admin/department-codes/${codeId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(codeData)
    });
    if (!res.ok) throw new Error('Failed to update department code');
    return res.json();
  },

  deleteDepartmentCode: async (codeId) => {
    const res = await fetch(`${API_URL}/admin/department-codes/${codeId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete department code');
    return res.json();
  },

  // ============================================
  // PASSWORD RESET API
  // ============================================

  resetUserPassword: async (userId, newPassword) => {
    const res = await fetch(`${API_URL}/admin/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ new_password: newPassword })
    });
    if (!res.ok) throw new Error('Failed to reset password');
    return res.json();
  },

  // ============================================
  // REQUISITION REROUTING API
  // ============================================

  getRerouteUsers: async (role) => {
    const params = role ? `?role=${role}` : '';
    const res = await fetch(`${API_URL}/admin/reroute-users${params}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch users for rerouting');
    return res.json();
  },

  rerouteRequisition: async (reqId, toUserId, reason, newStatus) => {
    const res = await fetch(`${API_URL}/admin/reroute/${reqId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ to_user_id: toUserId, reason, new_status: newStatus })
    });
    if (!res.ok) throw new Error('Failed to reroute requisition');
    return res.json();
  },

  // ============================================
  // ANALYTICS API
  // ============================================

  analytics: {
    getOverview: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.department) params.append('department', filters.department);

      const res = await fetch(`${API_URL}/analytics/overview?${params}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch overview analytics');
      return res.json();
    },

    getSpendingTrend: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.period) params.append('period', filters.period);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.department) params.append('department', filters.department);

      const res = await fetch(`${API_URL}/analytics/spending-trend?${params}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch spending trend');
      return res.json();
    },

    getDepartmentBreakdown: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const res = await fetch(`${API_URL}/analytics/department-breakdown?${params}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch department breakdown');
      return res.json();
    },

    getApprovalFlow: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const res = await fetch(`${API_URL}/analytics/approval-flow?${params}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch approval flow');
      return res.json();
    },

    getDuration: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const res = await fetch(`${API_URL}/analytics/duration?${params}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch duration analytics');
      return res.json();
    },

    getStatusDistribution: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.department) params.append('department', filters.department);

      const res = await fetch(`${API_URL}/analytics/status-distribution?${params}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch status distribution');
      return res.json();
    },

    getTopVendors: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.limit) params.append('limit', filters.limit);

      const res = await fetch(`${API_URL}/analytics/top-vendors?${params}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch top vendors');
      return res.json();
    },

    exportCSV: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.department) params.append('department', filters.department);

      const token = getAuthToken();
      window.open(`${API_URL}/analytics/export/csv?${params}&token=${token}`, '_blank');
    },

    exportJSON: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.department) params.append('department', filters.department);

      const res = await fetch(`${API_URL}/analytics/export/json?${params}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to export data');
      return res.json();
    }
  }
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login');
  const [selectedReq, setSelectedReq] = useState(null);
  const [data, setData] = useState({
    requisitions: [],
    users: [],
    vendors: [],
    departments: []
  });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      const savedUser = getUserData();
      
      if (token && savedUser) {
        try {
          // Try to fetch data to verify token is valid
          const res = await fetchWithAuth(`${API_URL}/requisitions`);

          if (res.ok) {
            // Token is valid, restore user data from localStorage
            const requisitions = await res.json();
            setData(prevData => ({ ...prevData, requisitions }));
            setCurrentUser(savedUser);  // Restore full user data
            setView('dashboard');
          } else {
            // Token is invalid, clear it
            clearAuthToken();
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          clearAuthToken();
        }
      }
      setInitializing(false);
    };

    checkAuth();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Only load endpoints that exist in the backend
      const [requisitions, vendors] = await Promise.all([
        api.getRequisitions(),
        api.getVendors()
      ]);
      setData({
        requisitions,
        vendors,
        users: [], // Not implemented yet
        departments: [] // Not implemented yet
      });
    } catch (error) {
      console.error('Error loading data:', error);
      // If error is 401, clear auth and go to login
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        clearAuthToken();
        setCurrentUser(null);
        setView('login');
      } else {
        alert('Error loading data: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && !initializing) {
      loadData();
    }
  }, [currentUser]);

  const logout = async () => {
    try {
      // Call backend logout endpoint to revoke refresh token
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if backend call fails
    }
    
    // Clear local auth data
    clearAuthToken();
    setCurrentUser(null);
    setView('login');
    // Clear data on logout
    setData({
      requisitions: [],
      users: [],
      vendors: [],
      departments: []
    });
  };

  // Show loading screen while checking authentication
  if (initializing) {
    return React.createElement('div', {
      className: "min-h-screen flex items-center justify-center transition-colors",
      style: { backgroundColor: 'var(--bg-secondary)' }
    },
      React.createElement('div', { className: "text-center" },
        React.createElement('div', {
          className: "animate-spin rounded-full h-12 w-12 border-b-2 mx-auto",
          style: { borderColor: 'var(--color-primary)' }
        }),
        React.createElement('p', {
          className: "mt-4 transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, "Initializing...")
      )
    );
  }

  if (!currentUser) {
    return React.createElement(LoginScreen, { setCurrentUser, setView });
  }

  if (loading) {
    return React.createElement('div', {
      className: "min-h-screen flex items-center justify-center transition-colors",
      style: { backgroundColor: 'var(--bg-secondary)' }
    },
      React.createElement('div', { className: "text-center" },
        React.createElement('div', {
          className: "animate-spin rounded-full h-12 w-12 border-b-2 mx-auto",
          style: { borderColor: 'var(--color-primary)' }
        }),
        React.createElement('p', {
          className: "mt-4 transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, "Loading...")
      )
    );
  }

  return React.createElement('div', {
    className: "min-h-screen flex transition-colors",
    style: { backgroundColor: 'var(--bg-secondary)' }
  },
    React.createElement(Sidebar, { user: currentUser, logout, setView, view }),
    React.createElement('div', { className: "flex-1" },
      React.createElement(TopBar, { user: currentUser }),
      React.createElement('div', { className: "container mx-auto px-6 py-6" },
        view === 'dashboard' && React.createElement(Dashboard, { user: currentUser, data, setView, setSelectedReq, loadData }),
        view === 'requisitions' && React.createElement(Dashboard, { user: currentUser, data, setView, setSelectedReq, loadData }),
        view === 'approval-console' && React.createElement(ApprovalConsole, { user: currentUser, setView, setSelectedReq, loadData }),
        view === 'rejected' && React.createElement(RejectedRequisitions, { user: currentUser, setView, setSelectedReq, loadData }),
        view === 'create' && React.createElement(CreateRequisition, { user: currentUser, setView, loadData }),
        view === 'approve' && React.createElement(ApproveRequisition, { req: selectedReq, user: currentUser, data, setView, loadData }),
        view === 'purchase-orders' && React.createElement(PurchaseOrders, { user: currentUser }),
        view === 'admin' && React.createElement(AdminPanel, { data, loadData }),
        view === 'budget' && React.createElement(BudgetManagement, { user: currentUser }),
        view === 'fx-rates' && React.createElement(FXRatesManagement, { user: currentUser }),
        view === 'reports' && React.createElement(Reports, { data }),
        view === 'analytics' && React.createElement(AnalyticsDashboard, { user: currentUser }),
        view === 'quotes-adjudication' && React.createElement(QuotesAndAdjudication, { user: currentUser, setView, loadData })
      )
    )
  );
}

function LoginScreen({ setCurrentUser, setView }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.login(username, password);
      setCurrentUser(response.user);
      setView('dashboard');
    } catch (err) {
      setError('Invalid username or password. Make sure backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement('div', {
    className: "min-h-screen flex items-center justify-center p-4 transition-all relative",
    style: {
      background: 'linear-gradient(135deg, #0070AF 0%, #58A6D0 50%, #D0E3F2 100%)'
    }
  },
    // Theme toggle in top right
    React.createElement('div', {
      className: "absolute top-4 right-4 z-10"
    },
      React.createElement(ThemeToggle)
    ),
    React.createElement('div', {
      className: "rounded-lg p-8 w-full max-w-md transition-all",
      style: {
        backgroundColor: 'var(--bg-primary)',
        boxShadow: 'var(--shadow-lg)'
      }
    },
      React.createElement('div', { className: "text-center mb-8" },
        React.createElement('h1', {
          className: "text-3xl font-bold mb-2 transition-colors",
          style: { color: 'var(--text-primary)' }
        }, "Purchase Requisition Approval System (PRAS)"),
        React.createElement('p', {
          className: "transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, "Sign in to continue")
      ),
      React.createElement('div', { className: "space-y-4" },
        React.createElement('div', null,
          React.createElement('label', {
            className: "block text-sm font-medium mb-2 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, "Username"),
          React.createElement('input', {
            type: "text",
            value: username,
            onChange: (e) => setUsername(e.target.value),
            onKeyPress: (e) => e.key === 'Enter' && handleLogin(),
            className: "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-all",
            style: {
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              '--tw-ring-color': '#0070AF'
            },
            placeholder: "Enter username"
          })
        ),
        React.createElement('div', null,
          React.createElement('label', {
            className: "block text-sm font-medium mb-2 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, "Password"),
          React.createElement('input', {
            type: "password",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            onKeyPress: (e) => e.key === 'Enter' && handleLogin(),
            className: "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-all",
            style: {
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              '--tw-ring-color': '#0070AF'
            },
            placeholder: "Enter password"
          })
        ),
        error && React.createElement('div', {
          className: "px-4 py-3 rounded-lg text-sm",
          style: {
            backgroundColor: 'var(--color-danger-bg)',
            borderColor: 'var(--color-danger)',
            color: 'var(--color-danger-dark)'
          }
        }, error),
        React.createElement('button', {
          onClick: handleLogin,
          disabled: loading,
          className: "w-full text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50",
          style: {
            backgroundColor: 'var(--color-primary)',
            boxShadow: 'var(--shadow-md)'
          }
        }, loading ? 'Signing in...' : 'Sign In')
      )
      // Demo Accounts section commented out for production
      // React.createElement('div', {
      //   className: "mt-6 p-4 rounded-lg transition-colors",
      //   style: { backgroundColor: 'var(--bg-secondary)' }
      // },
      //   React.createElement('p', { className: "text-xs text-gray-600 font-semibold mb-2" }, "Demo Accounts:"),
      //   React.createElement('div', { className: "space-y-1 text-xs text-gray-500" },
      //     React.createElement('p', null, React.createElement('strong', null, "Initiator:"), " john.banda / password123"),
      //     React.createElement('p', null, React.createElement('strong', null, "HOD:"), " sarah.mwansa / password123"),
      //     React.createElement('p', null, React.createElement('strong', null, "Procurement:"), " michael.phiri / password123"),
      //     React.createElement('p', null, React.createElement('strong', null, "Finance:"), " grace.banda / password123"),
      //     React.createElement('p', null, React.createElement('strong', null, "MD:"), " robert.mulenga / password123"),
      //     React.createElement('p', null, React.createElement('strong', null, "Admin:"), " admin / admin123")
      //   )
      // )
    )
  );
}

// ============================================
// CHART HELPER FUNCTIONS
// ============================================

// Get theme-aware colors for charts
const getChartColors = () => {
  const isDark = getTheme() === 'dark';
  return {
    primary: '#0070AF',
    primaryLight: '#58A6D0',
    primaryPale: '#D0E3F2',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    neutral: '#6B7280',
    text: isDark ? '#F1F5F9' : '#1E293B',
    grid: isDark ? '#334155' : '#E2E8F0',
    background: isDark ? '#1E293B' : '#FFFFFF'
  };
};

// Create line chart
const createLineChart = (canvasId, data, options = {}) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const colors = getChartColors();

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: options.showLegend !== false,
        labels: { color: colors.text }
      },
      tooltip: {
        backgroundColor: colors.background,
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.grid,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: colors.text },
        grid: { color: colors.grid }
      },
      y: {
        ticks: { color: colors.text },
        grid: { color: colors.grid }
      }
    },
    onClick: options.onClick || null
  };

  return new Chart(ctx, {
    type: 'line',
    data: data,
    options: { ...defaultOptions, ...options }
  });
};

// Create pie/doughnut chart
const createPieChart = (canvasId, data, type = 'pie', onClick = null) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const colors = getChartColors();

  return new Chart(ctx, {
    type: type,
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: colors.text }
        },
        tooltip: {
          backgroundColor: colors.background,
          titleColor: colors.text,
          bodyColor: colors.text,
          borderColor: colors.grid,
          borderWidth: 1
        }
      },
      onClick: onClick || null
    }
  });
};

// Create bar chart
const createBarChart = (canvasId, data, options = {}) => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const colors = getChartColors();

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: options.showLegend !== false,
        labels: { color: colors.text }
      },
      tooltip: {
        backgroundColor: colors.background,
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.grid,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: colors.text },
        grid: { color: colors.grid }
      },
      y: {
        ticks: { color: colors.text },
        grid: { color: colors.grid },
        beginAtZero: true
      }
    },
    onClick: options.onClick || null
  };

  return new Chart(ctx, {
    type: options.horizontal ? 'bar' : 'bar',
    data: data,
    options: {
      ...defaultOptions,
      ...options,
      indexAxis: options.horizontal ? 'y' : 'x'
    }
  });
};

// Theme Toggle Component - Beautiful animated switch
function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme());

  const handleToggle = () => {
    const newTheme = toggleTheme();
    setThemeState(newTheme);
  };

  const isDark = theme === 'dark';

  return React.createElement('div', {
    className: "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
    style: {
      backgroundColor: 'var(--bg-tertiary)'
    }
  },
    React.createElement('span', {
      className: "text-xs font-medium transition-colors",
      style: { color: 'var(--text-secondary)' }
    }, isDark ? '🌙' : '☀️'),
    React.createElement('button', {
      onClick: handleToggle,
      className: "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
      style: {
        backgroundColor: isDark ? '#0070AF' : '#58A6D0',
        boxShadow: 'var(--shadow-sm)'
      },
      'aria-label': 'Toggle theme'
    },
      React.createElement('span', {
        className: "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
        style: {
          transform: isDark ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }
      })
    ),
    React.createElement('span', {
      className: "text-xs font-medium transition-colors",
      style: { color: 'var(--text-tertiary)' }
    }, isDark ? 'Dark' : 'Light')
  );
}

// Sidebar Component - Left Navigation
function Sidebar({ user, logout, setView, view }) {
  const [expandedMenus, setExpandedMenus] = useState({});

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const menuItems = [
    { id: 'requisitions', label: 'Requisitions', icon: '📋', show: true },
    { id: 'create', label: 'Create Requisition', icon: '➕', show: user.role === 'initiator' || user.role === 'procurement' },
    {
      id: 'approval-console-group',
      label: 'Approval Console',
      icon: '✅',
      show: ['hod', 'procurement', 'finance', 'md', 'admin'].includes(user.role),
      isGroup: true,
      children: [
        { id: 'approval-console', label: 'Pending Requisitions', icon: '⏳', show: ['hod', 'finance', 'md', 'admin'].includes(user.role) },
        { id: 'purchase-orders', label: 'Approved Requisitions', icon: '✓', show: ['initiator', 'hod', 'procurement', 'finance', 'md', 'admin'].includes(user.role) },
        { id: 'rejected', label: 'Rejected Requisitions', icon: '❌', show: user.role === 'procurement' || user.role === 'admin' }
      ]
    },
    {
      id: 'fin-planning-group',
      label: 'Fin. Planning',
      icon: '💼',
      show: user.role === 'finance' || user.role === 'md' || user.role === 'admin',
      isGroup: true,
      children: [
        { id: 'budget', label: 'Budgets', icon: '💰', show: user.role === 'finance' || user.role === 'md' || user.role === 'admin' },
        { id: 'fx-rates', label: 'FX Rates', icon: '💱', show: user.role === 'finance' || user.role === 'md' || user.role === 'procurement' || user.role === 'admin' }
      ]
    },
    { id: 'quotes-adjudication', label: 'Quotes & Adjudication', icon: '📝', show: user.role === 'procurement' || user.role === 'finance' || user.role === 'md' || user.role === 'admin' },
    { id: 'reports', label: 'Reports', icon: '📈', show: true, disabled: user.role === 'initiator' },
    { id: 'analytics', label: 'Analytics', icon: '📊', show: user.role === 'finance' || user.role === 'md' || user.role === 'admin' },
    { id: 'admin', label: 'Admin Panel', icon: '⚙️', show: user.role === 'admin' }
  ];

  return React.createElement('aside', {
    className: "w-64 shadow-lg min-h-screen flex flex-col relative transition-colors",
    style: {
      backgroundColor: 'var(--bg-primary)',
      borderRight: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)'
    }
  },
    // Logo and Title
    React.createElement('div', {
      className: "p-6 transition-colors",
      style: { borderBottom: '1px solid var(--border-color)' }
    },
      React.createElement('h1', {
        className: "text-xl font-bold",
        style: { color: 'var(--color-primary)' }
      }, "Purchase Requisition"),
      React.createElement('p', {
        className: "text-xs mt-1 transition-colors",
        style: { color: 'var(--text-tertiary)' }
      }, "System")
    ),

    // Navigation Menu - with flex-1 to push user section to bottom
    React.createElement('nav', { className: "p-4 flex-1 overflow-y-auto" },
      menuItems.filter(item => item.show).map(item => {
        if (item.isGroup) {
          // Group menu item with collapsible children
          const isExpanded = expandedMenus[item.id];
          return React.createElement('div', { key: item.id, className: "mb-2" },
            // Group header - toggle button
            React.createElement('button', {
              onClick: () => toggleMenu(item.id),
              className: "w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-all",
              style: {
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-secondary)'
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              }
            },
              React.createElement('div', { className: "flex items-center gap-3" },
                React.createElement('span', { className: "text-lg" }, item.icon),
                React.createElement('span', null, item.label)
              ),
              React.createElement('span', {
                className: "text-sm transition-transform",
                style: { transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }
              }, '▶')
            ),
            // Children - shown when expanded
            isExpanded && React.createElement('div', { className: "ml-4 mt-1 space-y-1" },
              item.children.filter(child => child.show).map(child =>
                React.createElement('button', {
                  key: child.id,
                  onClick: () => setView(child.id),
                  className: "w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  style: view === child.id ? {
                    backgroundColor: 'var(--color-primary)',
                    color: '#FFFFFF',
                    boxShadow: 'var(--shadow-sm)'
                  } : {
                    color: 'var(--text-secondary)',
                    backgroundColor: 'transparent'
                  },
                  onMouseEnter: (e) => {
                    if (view !== child.id) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  },
                  onMouseLeave: (e) => {
                    if (view !== child.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }
                },
                  React.createElement('span', null, child.icon),
                  React.createElement('span', null, child.label)
                )
              )
            )
          );
        } else {
          // Regular menu item
          return React.createElement('button', {
            key: item.id,
            onClick: () => !item.disabled && setView(item.id),
            className: "w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg font-medium transition-all",
            style: item.disabled ? {
              color: 'var(--text-tertiary)',
              backgroundColor: 'transparent',
              opacity: 0.5,
              cursor: 'not-allowed'
            } : view === item.id ? {
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              boxShadow: 'var(--shadow-md)'
            } : {
              color: 'var(--text-primary)',
              backgroundColor: 'transparent'
            },
            onMouseEnter: (e) => {
              if (!item.disabled && view !== item.id) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }
            },
            onMouseLeave: (e) => {
              if (!item.disabled && view !== item.id) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            },
            disabled: item.disabled
          },
            React.createElement('span', { className: "text-lg" }, item.icon),
            React.createElement('span', null, item.label)
          );
        }
      })
    ),

    // User Info and Logout at bottom
    React.createElement('div', {
      className: "p-4 border-t mt-auto transition-colors",
      style: { backgroundColor: 'var(--bg-secondary)' }
    },
      React.createElement('div', { className: "mb-3" },
        React.createElement('p', {
          className: "text-sm font-medium truncate transition-colors",
          style: { color: 'var(--text-primary)' }
        }, user.full_name || user.name),
        React.createElement('p', {
          className: "text-xs transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, user.department),
        React.createElement('span', {
          className: "inline-block mt-1 px-2 py-1 text-xs rounded-full font-medium",
          style: {
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary)'
          }
        }, user.role ? user.role.toUpperCase() : 'USER')
      ),
      // Theme Toggle
      React.createElement('div', { className: "mb-3" },
        React.createElement(ThemeToggle)
      ),
      React.createElement('button', {
        onClick: logout,
        className: "w-full px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all text-sm font-medium",
        style: {
          backgroundColor: 'var(--color-danger)',
          boxShadow: 'var(--shadow-sm)'
        }
      }, "🚪 Logout")
    )
  );
}

// Top Bar Component - User Info and Context
function TopBar({ user }) {
  return React.createElement('div', {
    className: "px-6 py-4 transition-colors",
    style: {
      backgroundColor: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)'
    }
  },
    React.createElement('div', { className: "flex items-center justify-between" },
      React.createElement('div', null,
        React.createElement('h2', {
          className: "text-2xl font-bold transition-colors",
          style: { color: 'var(--text-primary)' }
        }, "Welcome Back"),
        React.createElement('p', {
          className: "text-sm transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, `Logged in as ${user.full_name || user.name} - ${user.role ? user.role.toUpperCase() : 'USER'}`)
      ),
      React.createElement('div', { className: "text-right" },
        React.createElement('p', {
          className: "text-sm transition-colors",
          style: { color: 'var(--text-tertiary)' }
        }, new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }))
      )
    )
  );
}

// Legacy Header Component (kept for backward compatibility)
function Header({ user, logout, setView, view }) {
  return React.createElement('header', { className: "bg-white shadow-sm border-b" },
    React.createElement('div', { className: "container mx-auto px-4 py-4" },
      React.createElement('div', { className: "flex items-center justify-between" },
        React.createElement('div', { className: "flex items-center gap-4" },
          React.createElement('h1', { className: "text-2xl font-bold text-blue-600" }, "Purchase Requisition Approval System (PRAS)"),
          React.createElement('span', { className: "px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium" },
            user.role ? user.role.toUpperCase() : 'USER'
          )
        ),
        React.createElement('nav', { className: "flex items-center gap-4" },
          React.createElement('button', {
            onClick: () => setView('dashboard'),
            className: `px-4 py-2 rounded-lg font-medium transition-colors ${view === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
          }, "Dashboard"),
          user.role === 'initiator' && React.createElement('button', {
            onClick: () => setView('create'),
            className: `px-4 py-2 rounded-lg font-medium transition-colors ${view === 'create' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
          }, "Create Requisition"),
          user.role === 'admin' && React.createElement('button', {
            onClick: () => setView('admin'),
            className: `px-4 py-2 rounded-lg font-medium transition-colors ${view === 'admin' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
          }, "Admin Panel"),
          (user.role === 'finance' || user.role === 'md' || user.role === 'admin') && React.createElement('button', {
            onClick: () => setView('budget'),
            className: `px-4 py-2 rounded-lg font-medium transition-colors ${view === 'budget' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
          }, "Budget"),
          (user.role === 'finance' || user.role === 'procurement' || user.role === 'admin') && React.createElement('button', {
            onClick: () => setView('fx-rates'),
            className: `px-4 py-2 rounded-lg font-medium transition-colors ${view === 'fx-rates' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
          }, "FX Rates"),
          React.createElement('button', {
            onClick: () => setView('reports'),
            className: `px-4 py-2 rounded-lg font-medium transition-colors ${view === 'reports' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
          }, "Reports"),
          React.createElement('div', { className: "flex items-center gap-3 ml-4 pl-4 border-l" },
            React.createElement('div', { className: "text-right" },
              React.createElement('p', { className: "text-sm font-medium text-gray-700" }, user.full_name || user.name),
              React.createElement('p', { className: "text-xs text-gray-500" }, user.department)
            ),
            React.createElement('button', {
              onClick: logout,
              className: "p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors",
              title: "Logout"
            }, "Logout")
          )
        )
      )
    )
  );
}

function Dashboard({ user, data, setView, setSelectedReq }) {
  const [showBreakdown, setShowBreakdown] = useState(null); // 'total', 'pending', 'approved', or null

  const getRequisitionsForUser = () => {
    switch (user.role) {
      case 'initiator':
        return data.requisitions.filter(r => r.created_by === user.id);
      case 'hod':
        return data.requisitions.filter(r => r.department === user.department && r.status === 'pending_hod');
      case 'procurement':
        return data.requisitions.filter(r => r.status === 'pending_procurement');
      case 'finance':
        return data.requisitions.filter(r => r.status === 'pending_finance');
      case 'md':
        return data.requisitions.filter(r => r.status === 'pending_md');
      case 'admin':
        return data.requisitions;
      default:
        return [];
    }
  };

  const requisitions = getRequisitionsForUser();
  const pendingApprovals = requisitions.filter(r => r.status.includes('pending')).length;
  const pendingRequisitions = requisitions.filter(r => r.status.includes('pending'));
  const approvedRequisitions = requisitions.filter(r => r.status === 'approved');

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      pending_hod: 'bg-yellow-100 text-yellow-700',
      pending_procurement: 'bg-blue-100 text-blue-700',
      pending_finance: 'bg-purple-100 text-purple-700',
      pending_md: 'bg-orange-100 text-orange-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusText = (status) => {
    const text = {
      draft: 'Draft',
      pending_hod: 'Pending HOD',
      pending_procurement: 'Pending Procurement',
      pending_finance: 'Pending Finance',
      pending_md: 'Pending MD',
      approved: 'Approved',
      rejected: 'Rejected'
    };
    return text[status] || status;
  };

  const handleViewReq = (req) => {
    setSelectedReq(req);
    setView('approve');
  };

  const downloadRequisitionPDF = async (reqId, reqNumber) => {
    try {
      const blob = await api.downloadRequisitionPDF(reqId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Requisition_${reqNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading requisition PDF:', error);
      alert(error.message || 'Failed to download requisition PDF. Please check your permissions.');
    }
  };

  return React.createElement('div', { className: "space-y-6" },
    // Header with Initiate Requisition button for procurement
    user.role === 'procurement' && React.createElement('div', { className: "flex justify-between items-center" },
      React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Dashboard"),
      React.createElement('button', {
        onClick: () => setView('create'),
        className: "px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
      },
        React.createElement('span', { className: "text-lg" }, "➕"),
        "Initiate Purchase Requisition"
      )
    ),
    React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-4 gap-4" },
      // Total Requisitions Card - Clickable
      React.createElement('div', {
        className: "rounded-lg shadow-sm border p-6 cursor-pointer hover:shadow-lg transition-all",
        style: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderColor: 'transparent'
        },
        onClick: () => setShowBreakdown('total')
      },
        React.createElement('div', { className: "flex items-center justify-between" },
          React.createElement('div', null,
            React.createElement('p', {
              className: "text-sm mb-1",
              style: { color: 'rgba(255, 255, 255, 0.9)' }
            }, "Total Requisitions"),
            React.createElement('p', {
              className: "text-2xl font-bold",
              style: { color: '#FFFFFF' }
            }, requisitions.length)
          ),
          React.createElement('span', {
            className: "text-2xl",
            style: { opacity: 0.9 }
          }, '📊')
        )
      ),
      // Pending Approvals Card - Clickable
      React.createElement('div', {
        className: "rounded-lg shadow-sm border p-6 cursor-pointer hover:shadow-lg transition-all",
        style: {
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderColor: 'transparent'
        },
        onClick: () => setShowBreakdown('pending')
      },
        React.createElement('div', { className: "flex items-center justify-between" },
          React.createElement('div', null,
            React.createElement('p', {
              className: "text-sm mb-1",
              style: { color: 'rgba(255, 255, 255, 0.9)' }
            }, "Pending Approvals"),
            React.createElement('p', {
              className: "text-2xl font-bold",
              style: { color: '#FFFFFF' }
            }, pendingApprovals)
          ),
          React.createElement('span', {
            className: "text-2xl",
            style: { opacity: 0.9 }
          }, '⏳')
        )
      ),
      // Approved Card - Clickable
      React.createElement('div', {
        className: "rounded-lg shadow-sm border p-6 cursor-pointer hover:shadow-lg transition-all",
        style: {
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderColor: 'transparent'
        },
        onClick: () => setShowBreakdown('approved')
      },
        React.createElement('div', { className: "flex items-center justify-between" },
          React.createElement('div', null,
            React.createElement('p', {
              className: "text-sm mb-1",
              style: { color: 'rgba(255, 255, 255, 0.9)' }
            }, "Approved"),
            React.createElement('p', {
              className: "text-2xl font-bold",
              style: { color: '#FFFFFF' }
            }, approvedRequisitions.length)
          ),
          React.createElement('span', {
            className: "text-2xl",
            style: { opacity: 0.9 }
          }, '✓')
        )
      ),
      // Total Value Card - Not clickable
      React.createElement('div', {
        className: "rounded-lg shadow-sm border p-6",
        style: {
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          borderColor: 'transparent'
        }
      },
        React.createElement('div', { className: "flex items-center justify-between" },
          React.createElement('div', null,
            React.createElement('p', {
              className: "text-sm mb-1",
              style: { color: 'rgba(255, 255, 255, 0.9)' }
            }, "Total Value"),
            React.createElement('p', {
              className: "text-xl font-bold",
              style: { color: '#FFFFFF' }
            },
              `ZMW ${requisitions.reduce((sum, r) => sum + (r.amount || r.total_amount || 0), 0).toLocaleString()}`
            )
          ),
          React.createElement('span', {
            className: "text-2xl",
            style: { opacity: 0.9 }
          }, '💰')
        )
      )
    ),

    // Breakdown Modal
    showBreakdown && React.createElement('div', {
      className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",
      onClick: () => setShowBreakdown(null)
    },
      React.createElement('div', {
        className: "rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-lg)'
        },
        onClick: (e) => e.stopPropagation()
      },
        // Modal Header
        React.createElement('div', {
          className: "flex items-center justify-between mb-6 pb-4",
          style: { borderBottom: '1px solid var(--border-color)' }
        },
          React.createElement('h2', {
            className: "text-2xl font-bold transition-colors",
            style: { color: 'var(--text-primary)' }
          },
            showBreakdown === 'total' ? `All Requisitions (${requisitions.length})` :
            showBreakdown === 'pending' ? `Pending Approvals (${pendingApprovals})` :
            `Approved Requisitions (${approvedRequisitions.length})`
          ),
          React.createElement('button', {
            onClick: () => setShowBreakdown(null),
            className: "text-2xl font-bold hover:opacity-70 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, '×')
        ),

        // Modal Content - Requisitions List
        React.createElement('div', { className: "space-y-3" },
          (showBreakdown === 'total' ? requisitions :
           showBreakdown === 'pending' ? pendingRequisitions :
           approvedRequisitions).map(req =>
            React.createElement('div', {
              key: req.id,
              className: "rounded-lg p-4 cursor-pointer hover:opacity-90 transition-all",
              style: {
                backgroundColor: 'var(--bg-secondary)',
                borderWidth: '1px',
                borderColor: 'var(--border-color)'
              },
              onClick: () => {
                setShowBreakdown(null);
                handleViewReq(req);
              }
            },
              React.createElement('div', { className: "flex items-center justify-between mb-2" },
                React.createElement('h3', {
                  className: "font-bold transition-colors",
                  style: { color: 'var(--color-primary)' }
                }, req.req_number),
                React.createElement('span', {
                  className: `px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(req.status)}`
                }, getStatusText(req.status))
              ),
              React.createElement('p', {
                className: "text-sm mb-2 transition-colors",
                style: { color: 'var(--text-secondary)' }
              }, req.description || req.title),
              React.createElement('div', { className: "flex items-center justify-between text-sm" },
                React.createElement('span', {
                  className: "transition-colors",
                  style: { color: 'var(--text-tertiary)' }
                }, `${req.department} • Created: ${new Date(req.created_at).toLocaleDateString()}`),
                React.createElement('span', {
                  className: "font-bold transition-colors",
                  style: { color: 'var(--text-primary)' }
                }, `ZMW ${(req.amount || req.total_amount || 0).toLocaleString()}`)
              )
            )
          )
        )
      )
    ),
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border" },
      React.createElement('div', { className: "px-6 py-4 border-b" },
        React.createElement('h2', { className: "text-xl font-semibold text-gray-800" },
          user.role === 'initiator' ? 'My Requisitions' : 'Requisitions for Review'
        )
      ),
      React.createElement('div', { className: "overflow-x-auto" },
        React.createElement('table', { className: "w-full" },
          React.createElement('thead', { className: "bg-gray-50" },
            React.createElement('tr', null,
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Req Number"),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Description"),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Department"),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Amount"),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Status"),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Action")
            )
          ),
          React.createElement('tbody', { className: "divide-y divide-gray-200" },
            requisitions.length === 0 
              ? React.createElement('tr', null,
                  React.createElement('td', { colSpan: "6", className: "px-6 py-8 text-center text-gray-500" }, "No requisitions found")
                )
              : requisitions.map(req =>
                  React.createElement('tr', { key: req.id, className: "hover:bg-gray-50" },
                    React.createElement('td', { className: "px-6 py-4 text-sm font-medium text-gray-900" }, req.req_number),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-700" }, req.description || req.title),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-700" }, req.department),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-700" }, `ZMW ${(req.amount || req.total_amount || 0).toLocaleString()}`),
                    React.createElement('td', { className: "px-6 py-4" },
                      React.createElement('span', { className: `px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(req.status)}` },
                        getStatusText(req.status)
                      )
                    ),
                    React.createElement('td', { className: "px-6 py-4" },
                      React.createElement('div', { className: "flex items-center gap-3" },
                        React.createElement('button', {
                          onClick: () => handleViewReq(req),
                          className: "text-blue-600 hover:text-blue-800 text-sm font-medium"
                        }, user.role === 'initiator' ? 'View' : 'Review'),
                        // Show PDF download button for approved requisitions
                        (req.status !== 'pending' && req.status !== 'rejected') && React.createElement('button', {
                          onClick: () => downloadRequisitionPDF(req.id, req.req_number),
                          className: "text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1",
                          title: "Download Requisition PDF"
                        },
                          React.createElement('svg', { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                            React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" })
                          ),
                          'PDF'
                        )
                      )
                    )
                  )
                )
          )
        )
      )
    )
  );
}

function CreateRequisition({ user, setView, loadData }) {
  const [formData, setFormData] = useState({
    description: '',
    quantity: 1,
    dateRequired: '',
    justification: '',
    department: user.department,
    urgency: 'standard',
    selectedHod: '' // For procurement to select HOD
  });
  const [loading, setLoading] = useState(false);
  const [hodUsers, setHodUsers] = useState([]);

  // Generate PR Number: KSB-DeptCode-Initials-FullTimeStamp
  const generatePRNumber = () => {
    const deptCode = user.department ? user.department.substring(0, 3).toUpperCase() : 'GEN';
    const initials = (user.full_name || user.name)
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase();
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14); // YYYYMMDDHHmmss
    return `KSB-${deptCode}-${initials}-${timestamp}`;
  };

  const [prNumber] = useState(generatePRNumber());

  // Load HOD users if procurement is creating the requisition
  useEffect(() => {
    if (user.role === 'procurement') {
      const fetchHodUsers = async () => {
        try {
          const users = await api.getUsers();
          const hods = users.filter(u => u.role === 'hod');
          setHodUsers(hods);
        } catch (error) {
          console.error('Error loading HOD users:', error);
        }
      };
      fetchHodUsers();
    }
  }, [user.role]);

  // Get department code
  const getDeptCode = () => {
    return user.department ? user.department.substring(0, 3).toUpperCase() : 'GEN';
  };

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const handleSaveAsDraft = async () => {
    if (!formData.description || !formData.quantity || !formData.dateRequired || !formData.justification) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const reqData = {
        description: formData.description,
        delivery_location: 'Office',
        urgency: formData.urgency,
        required_date: formData.dateRequired,
        account_code: null,
        initiatorId: user.id,
        items: [{
          item_name: formData.description,
          quantity: formData.quantity,
          specifications: formData.justification
        }]
      };

      const response = await api.createRequisition(reqData);
      await loadData();
      alert('Requisition saved as draft successfully!');
      setView('dashboard');
    } catch (error) {
      console.error('Error saving requisition:', error);
      alert(`Error saving requisition: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!formData.description || !formData.quantity || !formData.dateRequired || !formData.justification) {
      alert('Please fill in all required fields');
      return;
    }

    // If procurement is creating, they must select an HOD
    if (user.role === 'procurement' && !formData.selectedHod) {
      alert('Please select an HOD approver');
      return;
    }

    setLoading(true);
    try {
      // First create as draft
      const reqData = {
        description: formData.description,
        delivery_location: 'Office',
        urgency: formData.urgency,
        required_date: formData.dateRequired,
        account_code: null,
        initiatorId: user.id,
        items: [{
          item_name: formData.description,
          quantity: formData.quantity,
          specifications: formData.justification
        }]
      };

      const response = await api.createRequisition(reqData);

      // Then submit for approval
      if (response.requisition_id) {
        await api.submitRequisition(response.requisition_id, user.id, formData.selectedHod);
      }
      
      await loadData();
      alert('Requisition submitted for approval successfully!');
      setView('dashboard');
    } catch (error) {
      console.error('Error submitting requisition:', error);
      alert(`Error submitting requisition: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement('div', { className: "max-w-3xl mx-auto" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-8" },
      React.createElement('h2', { className: "text-2xl font-bold text-gray-800 mb-6" }, "Create New Requisition"),

      // Auto-generated information section
      React.createElement('div', { className: "mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200" },
        React.createElement('h3', { className: "text-sm font-semibold text-blue-900 mb-3" }, "📋 Auto-Generated Information"),
        React.createElement('div', { className: "grid grid-cols-3 gap-4" },
          React.createElement('div', null,
            React.createElement('label', { className: "block text-xs font-medium text-gray-600 mb-1" }, "PR Number"),
            React.createElement('div', { className: "px-3 py-2 bg-white border border-blue-300 rounded text-sm font-semibold text-blue-900" },
              prNumber
            )
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-xs font-medium text-gray-600 mb-1" }, "Department"),
            React.createElement('div', { className: "px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900" },
              user.department || 'N/A'
            )
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-xs font-medium text-gray-600 mb-1" }, "Dept Code"),
            React.createElement('div', { className: "px-3 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-gray-900" },
              getDeptCode()
            )
          )
        )
      ),

      React.createElement('div', { className: "space-y-6" },
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Item Description *"),
          React.createElement('input', {
            type: "text",
            value: formData.description,
            onChange: (e) => setFormData({...formData, description: e.target.value}),
            className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
            placeholder: "e.g., Office Supplies, Laptops, Furniture"
          })
        ),
        React.createElement('div', { className: "grid grid-cols-2 gap-4" },
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Quantity *"),
            React.createElement('input', {
              type: "number",
              min: "1",
              value: formData.quantity,
              onChange: (e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1}),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
              placeholder: "Enter quantity"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Date Required *"),
            React.createElement('input', {
              type: "date",
              value: formData.dateRequired,
              min: getCurrentDate(),
              onChange: (e) => setFormData({...formData, dateRequired: e.target.value}),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            })
          )
        ),
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Current Date"),
          React.createElement('div', { className: "px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900" },
            getCurrentDate()
          )
        ),
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Urgency Level *"),
          React.createElement('select', {
            value: formData.urgency,
            onChange: (e) => setFormData({...formData, urgency: e.target.value}),
            className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          },
            React.createElement('option', { value: "standard" }, "Standard (30 days)"),
            React.createElement('option', { value: "urgent" }, "Urgent (15 days)"),
            React.createElement('option', { value: "critical" }, "Critical (7 days)")
          )
        ),
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Justification *"),
          React.createElement('textarea', {
            rows: "4",
            value: formData.justification,
            onChange: (e) => setFormData({...formData, justification: e.target.value}),
            className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
            placeholder: "Explain the business need for this requisition..."
          })
        ),
        // HOD Selection for Procurement
        user.role === 'procurement' && React.createElement('div', { className: "p-4 bg-yellow-50 border border-yellow-200 rounded-lg" },
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" },
            "Select HOD Approver *",
            React.createElement('span', { className: "text-xs text-gray-500 ml-2" }, "(Required for procurement-initiated requisitions)")
          ),
          React.createElement('select', {
            value: formData.selectedHod,
            onChange: (e) => setFormData({...formData, selectedHod: e.target.value}),
            className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          },
            React.createElement('option', { value: "" }, "-- Select HOD Approver --"),
            hodUsers.map(hod =>
              React.createElement('option', { key: hod.id, value: hod.id },
                `${hod.full_name || hod.name} (${hod.department})`
              )
            )
          )
        ),
        React.createElement('div', { className: "flex gap-3" },
          React.createElement('button', {
            onClick: handleSubmitForApproval,
            disabled: loading,
            className: "flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          }, loading ? 'Submitting...' : 'Submit for Approval'),
          React.createElement('button', {
            onClick: handleSaveAsDraft,
            disabled: loading,
            className: "flex-1 bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors disabled:bg-gray-400"
          }, loading ? 'Saving...' : 'Save as Draft'),
          React.createElement('button', {
            onClick: () => setView('dashboard'),
            disabled: loading,
            className: "px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:bg-gray-200"
          }, "Cancel")
        )
      )
    )
  );
}

function ApproveRequisition({ req, user, data, setView, loadData }) {
  const [comment, setComment] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(req?.selected_vendor || '');
  const [vendorCurrency, setVendorCurrency] = useState(req?.vendor_currency || 'ZMW');
  const [unitPrice, setUnitPrice] = useState(req?.unit_price || req?.estimated_cost || '');
  const [quantity, setQuantity] = useState(req?.quantity || 1);
  const [description, setDescription] = useState(req?.description || '');
  const [justification, setJustification] = useState(req?.justification || '');
  const [urgency, setUrgency] = useState(req?.urgency || 'standard');
  const [fxRates, setFXRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [adjudication, setAdjudication] = useState(null);

  // Load FX rates when component mounts
  useEffect(() => {
    // Load FX rates for all roles that review requisitions
    if (['procurement', 'finance', 'hod', 'md', 'admin'].includes(user.role)) {
      fetch(`${API_URL}/fx-rates`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })
      .then(res => res.json())
      .then(rates => {
        // Ensure rates is always an array
        if (Array.isArray(rates)) {
          setFXRates(rates);
        } else if (rates && Array.isArray(rates.data)) {
          setFXRates(rates.data);
        } else {
          console.error('FX rates response is not an array:', rates);
          setFXRates([]);
        }
      })
      .catch(err => {
        console.error('Error loading FX rates:', err);
        setFXRates([]);
      });
    }
  }, [user.role]);

  // Load quotes and adjudication for Finance and MD
  useEffect(() => {
    if (req && req.has_quotes && ['finance', 'md', 'admin'].includes(user.role)) {
      // Load quotes
      api.getQuotes(req.id)
        .then(quotesData => setQuotes(quotesData))
        .catch(err => console.error('Error loading quotes:', err));

      // Load adjudication if it exists
      if (req.has_adjudication) {
        api.getAdjudication(req.id)
          .then(adjData => setAdjudication(adjData))
          .catch(err => console.error('Error loading adjudication:', err));
      }
    }
  }, [req, user.role]);

  if (!req) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-500" }, "No requisition selected"),
      React.createElement('button', {
        onClick: () => setView('dashboard'),
        className: "mt-4 text-blue-600 hover:text-blue-800"
      }, "Back to Dashboard")
    );
  }

  // Calculate total cost for display purposes
  const totalCost = quantity * (parseFloat(unitPrice) || 0);
  const selectedRate = Array.isArray(fxRates) ? fxRates.find(r => r.currency_code === vendorCurrency) : null;
  const totalCostZMW = vendorCurrency === 'ZMW' ? totalCost : (totalCost * (selectedRate?.rate_to_zmw || 1));

  const handleProcurementApprove = async () => {
    if (!selectedVendor) {
      alert('Please select a vendor');
      return;
    }
    if (!unitPrice || unitPrice <= 0) {
      alert('Please enter a valid unit price');
      return;
    }

    setLoading(true);
    try {
      await fetch(`${API_URL}/requisitions/${req.id}/procurement-update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          description,
          selected_vendor: selectedVendor,
          vendor_currency: vendorCurrency,
          unit_price: parseFloat(unitPrice),
          total_cost: totalCostZMW,
          justification,
          urgency,
          status: 'pending_finance',
          approval: {
            role: user.role,
            userName: user.name,
            action: 'approved',
            comment: comment || `Vendor: ${selectedVendor}, Total: ${vendorCurrency} ${totalCost.toLocaleString()}`
          }
        })
      });

      await loadData();
      alert('Requisition adjudication complete! Sent to Finance for review.');
      setView('dashboard');
    } catch (error) {
      console.error('Error processing requisition:', error);
      alert('Error processing requisition. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    // For procurement role, use the enhanced handler
    if (user.role === 'procurement') {
      return handleProcurementApprove();
    }

    // For other roles, use role-specific approval endpoints
    setLoading(true);
    try {
      let endpoint = '';
      let successMessage = '';

      if (user.role === 'hod') {
        endpoint = `${API_URL}/requisitions/${req.id}/hod-approve`;
        successMessage = 'Requisition approved and sent to Procurement';
      } else if (user.role === 'finance') {
        endpoint = `${API_URL}/requisitions/${req.id}/finance-approve`;
        successMessage = 'Requisition approved and sent to MD';
      } else if (user.role === 'md') {
        endpoint = `${API_URL}/requisitions/${req.id}/md-approve`;
        successMessage = 'Requisition fully approved!';
      } else {
        alert('Invalid role for approval');
        setLoading(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          approved: true,
          comments: comment || 'Approved'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Approval failed');
      }

      await loadData();
      alert(successMessage);
      setView('dashboard');
    } catch (error) {
      console.error('Error approving requisition:', error);
      alert('Error approving requisition. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    // For procurement, this is "Save as Draft" - no comment required
    if (user.role !== 'procurement' && !comment.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    try {
      if (user.role === 'procurement') {
        // Save as draft - update procurement details without changing status
        await fetch(`${API_URL}/requisitions/${req.id}/procurement-update`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            description,
            selected_vendor: selectedVendor || null,
            vendor_currency: vendorCurrency,
            unit_price: unitPrice ? parseFloat(unitPrice) : null,
            total_cost: totalCost || null,
            status: 'pending_procurement' // Keep in pending_procurement status
          })
        });
        await loadData();
        alert('Draft saved successfully!');
      } else {
        // Regular rejection - use role-specific endpoint
        let endpoint = '';
        if (user.role === 'hod') {
          endpoint = `${API_URL}/requisitions/${req.id}/hod-approve`;
        } else if (user.role === 'finance') {
          endpoint = `${API_URL}/requisitions/${req.id}/finance-approve`;
        } else if (user.role === 'md') {
          endpoint = `${API_URL}/requisitions/${req.id}/md-approve`;
        }

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            user_id: user.id,
            approved: false,
            comments: comment
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Rejection failed');
        }

        await loadData();
        alert('Requisition rejected');
      }
      setView('dashboard');
    } catch (error) {
      console.error('Error processing requisition:', error);
      alert('Error processing requisition. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canApprove = req.status === `pending_${user.role}` || (user.role === 'admin');
  const isDraftEditable = user.role === 'initiator' && req.status === 'draft' && req.created_by === user.id;

  const handleUpdateDraft = async () => {
    if (!description || !quantity) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/requisitions/${req.id}/update-draft`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          description,
          quantity,
          required_date: req.required_date,
          justification,
          urgency,
          user_id: user.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update draft');
      }

      await loadData();
      alert('Draft updated successfully!');
      setView('dashboard');
    } catch (error) {
      console.error('Error updating draft:', error);
      alert('Error updating draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDraft = async () => {
    if (!description || !quantity) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/requisitions/${req.id}/submit`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ user_id: user.id })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit requisition');
      }

      await loadData();
      alert('Requisition submitted for approval!');
      setView('dashboard');
    } catch (error) {
      console.error('Error submitting requisition:', error);
      alert('Error submitting requisition. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement('div', { className: "max-w-4xl mx-auto" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-8" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, isDraftEditable ? "Edit Draft Requisition" : "Review Requisition"),
        React.createElement('span', {
          className: `px-4 py-2 rounded-full text-sm font-medium ${req.status === 'approved' ? 'bg-green-100 text-green-700' : req.status === 'draft' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'}`
        }, req.status.replace('_', ' ').toUpperCase())
      ),
      React.createElement('div', { className: "space-y-6" },
        React.createElement('div', { className: "grid grid-cols-2 gap-6" },
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Requisition Number"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, req.req_number)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Submitted By"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, req.initiator_name || req.created_by_name)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Department"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, req.department)
          )
        ),

        // Editable fields for draft requisitions
        isDraftEditable ? React.createElement('div', { className: "space-y-4 p-6 bg-blue-50 rounded-lg border border-blue-200" },
          React.createElement('h3', { className: "text-lg font-semibold text-blue-900 mb-4" }, "📝 Edit Requisition Details"),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Item Description *"),
            React.createElement('input', {
              type: "text",
              value: description,
              onChange: (e) => setDescription(e.target.value),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            })
          ),
          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Quantity *"),
              React.createElement('input', {
                type: "number",
                min: "1",
                value: quantity,
                onChange: (e) => setQuantity(parseInt(e.target.value) || 1),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Urgency"),
              React.createElement('select', {
                value: urgency,
                onChange: (e) => setUrgency(e.target.value),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              },
                React.createElement('option', { value: "standard" }, "Standard (30 days)"),
                React.createElement('option', { value: "urgent" }, "Urgent (15 days)"),
                React.createElement('option', { value: "critical" }, "Critical (7 days)")
              )
            )
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Justification *"),
            React.createElement('textarea', {
              rows: "3",
              value: justification,
              onChange: (e) => setJustification(e.target.value),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
              placeholder: "Explain the business need..."
            })
          )
        ) : React.createElement(React.Fragment, null,
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Item Description"),
            React.createElement('p', { className: "text-base text-gray-900" }, req.description)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Justification"),
            React.createElement('p', { className: "text-base text-gray-900" }, req.justification)
          )
        ),

        // Procurement Details Display (for Finance and MD)
        (user.role === 'finance' || user.role === 'md') && (req.selected_vendor || req.unit_price || selectedVendor || unitPrice) && React.createElement('div', { className: "p-6 bg-purple-50 rounded-lg border border-purple-200" },
          React.createElement('h3', { className: "text-lg font-semibold text-purple-900 mb-4" }, "💰 Procurement Details"),
          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Vendor"),
              React.createElement('p', { className: "text-base font-semibold text-gray-900" },
                data.vendors.find(v => v.id === (req.selected_vendor || selectedVendor))?.name || 'Not assigned'
              )
            ),
            React.createElement('div', null,
              React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Unit Price"),
              React.createElement('p', { className: "text-base font-semibold text-gray-900" },
                `ZMW ${parseFloat(req.unit_price || unitPrice || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
              )
            ),
            React.createElement('div', null,
              React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Quantity"),
              React.createElement('p', { className: "text-base font-semibold text-gray-900" }, req.quantity || quantity || 0)
            ),
            React.createElement('div', null,
              React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Total Cost"),
              React.createElement('p', { className: "text-lg font-bold text-purple-900" },
                `ZMW ${((req.unit_price || unitPrice || 0) * (req.quantity || quantity || 0)).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
              )
            )
          )
        ),

        req.approvals && req.approvals.length > 0 && React.createElement('div', null,
          React.createElement('p', { className: "text-sm font-medium text-gray-700 mb-3" }, "Approval History"),
          React.createElement('div', { className: "space-y-2" },
            req.approvals.map((approval, index) =>
              React.createElement('div', { key: index, className: "p-3 bg-gray-50 rounded-lg" },
                React.createElement('p', { className: "text-sm font-medium text-gray-900" },
                  `${approval.user_name} (${approval.role ? approval.role.toUpperCase() : 'USER'}) - ${approval.action}`
                ),
                React.createElement('p', { className: "text-sm text-gray-600" }, approval.comment),
                React.createElement('p', { className: "text-xs text-gray-500 mt-1" },
                  new Date(approval.timestamp).toLocaleString()
                )
              )
            )
          )
        ),
        // Procurement-specific fields with editing capabilities
        user.role === 'procurement' && canApprove && React.createElement('div', { className: "space-y-6 p-6 bg-blue-50 rounded-lg border border-blue-200" },
          React.createElement('h3', { className: "text-lg font-semibold text-blue-900 mb-4" }, "📋 Procurement Adjudication"),

          // Editable description
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Item Description *"),
            React.createElement('input', {
              type: "text",
              value: description,
              onChange: (e) => setDescription(e.target.value),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            })
          ),

          // Quantity and unit price in a grid
          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Quantity *"),
              React.createElement('div', { className: "px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-lg font-semibold text-gray-700" },
                quantity
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Unit Price *"),
              React.createElement('input', {
                type: "number",
                min: "0",
                step: "0.01",
                value: unitPrice,
                onChange: (e) => setUnitPrice(e.target.value),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              })
            )
          ),

          // Vendor and currency selection
          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Select Vendor *"),
              React.createElement('select', {
                value: selectedVendor,
                onChange: (e) => setSelectedVendor(e.target.value),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              },
                React.createElement('option', { value: "" }, "-- Select Vendor --"),
                data.vendors.filter(v => v.status === 'active').map(vendor =>
                  React.createElement('option', { key: vendor.id, value: vendor.name },
                    vendor.name
                  )
                )
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Vendor Currency *"),
              React.createElement('select', {
                value: vendorCurrency,
                onChange: (e) => setVendorCurrency(e.target.value),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              },
                React.createElement('option', { value: "ZMW" }, "ZMW (Zambian Kwacha)"),
                Array.isArray(fxRates) && fxRates.map(rate =>
                  React.createElement('option', { key: rate.id, value: rate.currency_code },
                    `${rate.currency_code} (${rate.currency_name}) - Rate: ${rate.rate_to_zmw}`
                  )
                )
              )
            )
          ),

          // Total cost calculation
          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Total Cost (Vendor Currency)"),
              React.createElement('div', { className: "px-4 py-3 bg-white border border-gray-300 rounded-lg text-lg font-semibold text-blue-600" },
                `${vendorCurrency} ${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
              )
            ),
            vendorCurrency !== 'ZMW' && React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Total Cost (ZMW)"),
              React.createElement('div', { className: "px-4 py-3 bg-green-50 border border-green-300 rounded-lg text-lg font-semibold text-green-700" },
                `ZMW ${totalCostZMW.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
              )
            )
          ),

          // Editable urgency
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Urgency Level *"),
            React.createElement('select', {
              value: urgency,
              onChange: (e) => setUrgency(e.target.value),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            },
              React.createElement('option', { value: "standard" }, "Standard (30 days)"),
              React.createElement('option', { value: "urgent" }, "Urgent (15 days)"),
              React.createElement('option', { value: "critical" }, "Critical (7 days)")
            )
          ),

          // Editable justification
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Justification *"),
            React.createElement('textarea', {
              rows: "3",
              value: justification,
              onChange: (e) => setJustification(e.target.value),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            })
          )
        ),

        // Display Quotes and Adjudication for Finance and MD
        ['finance', 'md', 'admin'].includes(user.role) && quotes.length > 0 && React.createElement('div', { className: "space-y-4 p-6 bg-purple-50 rounded-lg border border-purple-200" },
          React.createElement('h3', { className: "text-lg font-semibold text-purple-900 mb-4" }, "📋 Vendor Quotes & Adjudication"),

          // Display quotes
          React.createElement('div', { className: "space-y-3" },
            React.createElement('h4', { className: "font-semibold text-gray-900" }, "Vendor Quotes:"),
            quotes.map((quote, idx) =>
              React.createElement('div', {
                key: quote.id,
                className: "bg-white p-4 rounded-lg border border-purple-200"
              },
                React.createElement('div', null,
                  React.createElement('p', { className: "font-semibold text-gray-900" }, `Quote ${idx + 1}: ${quote.vendor_name}`),
                  React.createElement('p', { className: "text-sm text-gray-600" }, `Quote #: ${quote.quote_number}`),
                  React.createElement('p', { className: "text-lg font-bold text-purple-700 mt-1" },
                    `${quote.currency} ${parseFloat(quote.quote_amount).toLocaleString()}`
                  ),
                  quote.notes && React.createElement('p', { className: "text-sm text-gray-600 mt-1" }, quote.notes)
                )
              )
            )
          ),

          // Display adjudication if exists
          adjudication && React.createElement('div', { className: "mt-6 pt-6 border-t border-purple-300" },
            React.createElement('h4', { className: "font-semibold text-gray-900 mb-3 flex items-center gap-2" },
              "Adjudication Summary",
              React.createElement('span', { className: "text-xs px-2 py-1 bg-green-100 text-green-700 rounded" }, "✓ Complete")
            ),
            React.createElement('div', { className: "bg-green-50 p-4 rounded-lg border border-green-200 space-y-3" },
              React.createElement('div', null,
                React.createElement('p', { className: "font-semibold text-gray-900" }, "Recommended Vendor:"),
                React.createElement('p', { className: "text-xl font-bold text-green-700" }, adjudication.recommended_vendor_name),
                React.createElement('p', { className: "text-lg text-gray-900" },
                  `${adjudication.currency} ${parseFloat(adjudication.recommended_amount).toLocaleString()}`
                )
              ),
              React.createElement('div', null,
                React.createElement('p', { className: "font-semibold text-gray-900 mb-1" }, "Executive Summary:"),
                React.createElement('p', { className: "text-gray-700" }, adjudication.summary)
              ),
              adjudication.recommendation_rationale && React.createElement('div', null,
                React.createElement('p', { className: "font-semibold text-gray-900 mb-1" }, "Recommendation Rationale:"),
                React.createElement('p', { className: "text-gray-700" }, adjudication.recommendation_rationale)
              ),
              adjudication.pricing_analysis && React.createElement('div', null,
                React.createElement('p', { className: "font-semibold text-gray-900 mb-1" }, "Pricing Analysis:"),
                React.createElement('p', { className: "text-gray-700 whitespace-pre-wrap" }, adjudication.pricing_analysis)
              ),
              React.createElement('div', { className: "pt-3 border-t border-green-300 text-sm text-gray-600" },
                React.createElement('p', null, `Adjudicated by: ${adjudication.created_by_name}`),
                React.createElement('p', null, `Date: ${new Date(adjudication.created_at).toLocaleString()}`)
              )
            )
          )
        ),

        canApprove && React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" },
            `Comments ${user.role === 'hod' || user.role === 'md' ? '(Optional)' : '*'}`
          ),
          React.createElement('textarea', {
            rows: "3",
            value: comment,
            onChange: (e) => setComment(e.target.value),
            className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
            placeholder: "Add your comments..."
          })
        ),
        React.createElement('div', { className: "flex flex-wrap gap-3 pt-4" },
          isDraftEditable ? React.createElement(React.Fragment, null,
            React.createElement('button', {
              onClick: handleSubmitDraft,
              disabled: loading,
              className: "flex-1 min-w-[140px] bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            }, loading ? 'Submitting...' : 'Submit for Approval'),
            React.createElement('button', {
              onClick: handleUpdateDraft,
              disabled: loading,
              className: "flex-1 min-w-[140px] bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            }, loading ? 'Updating...' : 'Update Draft')
          ) : canApprove && React.createElement(React.Fragment, null,
            React.createElement('button', {
              onClick: handleApprove,
              disabled: loading || (user.role === 'procurement' && !selectedVendor),
              className: "flex-1 min-w-[140px] bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            }, loading ? 'Processing...' : (user.role === 'procurement' ? 'Submit' : 'Approve')),
            React.createElement('button', {
              onClick: handleReject,
              disabled: loading,
              className: `flex-1 min-w-[140px] ${user.role === 'procurement' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} text-white py-3 px-4 rounded-lg font-semibold transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed`
            }, loading ? 'Processing...' : (user.role === 'procurement' ? 'Save as Draft' : 'Reject'))
          ),
          React.createElement('button', {
            onClick: () => setView('dashboard'),
            className: "px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          }, "Back")
        )
      )
    )
  );
}

function AdminPanel({ data, loadData }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingVendor, setEditingVendor] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'initiator',
    department: 'IT',
    is_hod: 0
  });
  const [vendorForm, setVendorForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  // New state for departments
  const [departments, setDepartments] = useState([]);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    code: '',
    description: '',
    is_active: 1
  });

  // New state for department codes
  const [departmentCodes, setDepartmentCodes] = useState([]);
  const [editingCode, setEditingCode] = useState(null);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [codeForm, setCodeForm] = useState({
    department_id: '',
    code: '',
    description: '',
    is_active: 1
  });

  // New state for rerouting
  const [rerouteUsers, setRerouteUsers] = useState([]);
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [rerouteReqId, setRerouteReqId] = useState(null);
  const [rerouteForm, setRerouteForm] = useState({
    to_user_id: '',
    reason: '',
    new_status: ''
  });

  // Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [usersData, vendorsData, departmentsData, codesData] = await Promise.all([
        api.getAdminUsers(),
        api.getVendors(),
        api.getAdminDepartments(),
        api.getDepartmentCodes()
      ]);
      setUsers(usersData);
      setVendors(vendorsData);
      setDepartments(departmentsData);
      setDepartmentCodes(codesData);
    } catch (error) {
      alert('Failed to load admin data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        await api.updateAdminUser(editingUser.id, userForm);
        alert('User updated successfully');
      } else {
        await api.createAdminUser(userForm);
        alert('User created successfully');
      }
      setShowUserForm(false);
      setEditingUser(null);
      setUserForm({
        username: '',
        password: '',
        full_name: '',
        email: '',
        role: 'initiator',
        department: 'IT',
        is_hod: 0
      });
      loadAdminData();
      if (loadData) loadData();
    } catch (error) {
      alert('Error saving user: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.deleteAdminUser(userId);
      alert('User deleted successfully');
      loadAdminData();
      if (loadData) loadData();
    } catch (error) {
      alert('Error deleting user: ' + error.message);
    }
  };

  const handleSaveVendor = async () => {
    try {
      if (editingVendor) {
        await api.updateAdminVendor(editingVendor.id, vendorForm);
        alert('Vendor updated successfully');
      } else {
        await api.createAdminVendor(vendorForm);
        alert('Vendor created successfully');
      }
      setShowVendorForm(false);
      setEditingVendor(null);
      setVendorForm({
        name: '',
        email: '',
        phone: '',
        address: ''
      });
      loadAdminData();
      if (loadData) loadData();
    } catch (error) {
      alert('Error saving vendor: ' + error.message);
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    try {
      await api.deleteAdminVendor(vendorId);
      alert('Vendor deleted successfully');
      loadAdminData();
      if (loadData) loadData();
    } catch (error) {
      alert('Error deleting vendor: ' + error.message);
    }
  };

  // Department handlers
  const handleSaveDepartment = async () => {
    try {
      if (editingDepartment) {
        await api.updateDepartment(editingDepartment.id, departmentForm);
        alert('Department updated successfully');
      } else {
        await api.createDepartment(departmentForm);
        alert('Department created successfully');
      }
      setShowDepartmentForm(false);
      setEditingDepartment(null);
      setDepartmentForm({ name: '', code: '', description: '', is_active: 1 });
      loadAdminData();
    } catch (error) {
      alert('Error saving department: ' + error.message);
    }
  };

  const handleDeleteDepartment = async (deptId) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await api.deleteDepartment(deptId);
      alert('Department deleted successfully');
      loadAdminData();
    } catch (error) {
      alert('Error deleting department: ' + error.message);
    }
  };

  // Department code handlers
  const handleSaveCode = async () => {
    try {
      if (editingCode) {
        await api.updateDepartmentCode(editingCode.id, codeForm);
        alert('Department code updated successfully');
      } else {
        await api.createDepartmentCode(codeForm);
        alert('Department code created successfully');
      }
      setShowCodeForm(false);
      setEditingCode(null);
      setCodeForm({ department_id: '', code: '', description: '', is_active: 1 });
      loadAdminData();
    } catch (error) {
      alert('Error saving department code: ' + error.message);
    }
  };

  const handleDeleteCode = async (codeId) => {
    if (!confirm('Are you sure you want to delete this code?')) return;
    try {
      await api.deleteDepartmentCode(codeId);
      alert('Department code deleted successfully');
      loadAdminData();
    } catch (error) {
      alert('Error deleting code: ' + error.message);
    }
  };

  // Password reset handler
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    try {
      await api.resetUserPassword(resetUserId, newPassword);
      alert('Password reset successfully');
      setShowPasswordReset(false);
      setResetUserId(null);
      setNewPassword('');
    } catch (error) {
      alert('Error resetting password: ' + error.message);
    }
  };

  // Reroute handlers
  const handleOpenReroute = async (reqId) => {
    setRerouteReqId(reqId);
    setShowRerouteModal(true);
    try {
      const users = await api.getRerouteUsers();
      setRerouteUsers(users);
    } catch (error) {
      alert('Error loading users: ' + error.message);
    }
  };

  const handleReroute = async () => {
    if (!rerouteForm.to_user_id || !rerouteForm.reason) {
      alert('Please select a user and provide a reason');
      return;
    }
    try {
      await api.rerouteRequisition(
        rerouteReqId,
        rerouteForm.to_user_id,
        rerouteForm.reason,
        rerouteForm.new_status
      );
      alert('Requisition rerouted successfully');
      setShowRerouteModal(false);
      setRerouteReqId(null);
      setRerouteForm({ to_user_id: '', reason: '', new_status: '' });
      if (loadData) loadData();
    } catch (error) {
      alert('Error rerouting requisition: ' + error.message);
    }
  };

  if (loading && users.length === 0) {
    return React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('p', { className: "text-center text-gray-600" }, "Loading admin data...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h2', { className: "text-2xl font-bold text-gray-800 mb-4" }, "Admin Panel"),
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" },
        React.createElement('div', { className: "p-4 bg-blue-50 rounded-lg" },
          React.createElement('p', { className: "font-semibold text-blue-900" }, "Total Users"),
          React.createElement('p', { className: "text-3xl font-bold text-blue-700" }, users.length)
        ),
        React.createElement('div', { className: "p-4 bg-green-50 rounded-lg" },
          React.createElement('p', { className: "font-semibold text-green-900" }, "Total Vendors"),
          React.createElement('p', { className: "text-3xl font-bold text-green-700" }, vendors.length)
        ),
        React.createElement('div', { className: "p-4 bg-purple-50 rounded-lg" },
          React.createElement('p', { className: "font-semibold text-purple-900" }, "Total Requisitions"),
          React.createElement('p', { className: "text-3xl font-bold text-purple-700" }, data.requisitions.length)
        )
      ),
      React.createElement('div', { className: "flex flex-wrap gap-2 mb-4" },
        React.createElement('button', {
          onClick: () => setActiveTab('users'),
          className: `px-4 py-2 rounded-lg font-medium ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`
        }, "Manage Users"),
        React.createElement('button', {
          onClick: () => setActiveTab('vendors'),
          className: `px-4 py-2 rounded-lg font-medium ${activeTab === 'vendors' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`
        }, "Manage Vendors"),
        React.createElement('button', {
          onClick: () => setActiveTab('departments'),
          className: `px-4 py-2 rounded-lg font-medium ${activeTab === 'departments' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`
        }, "Departments"),
        React.createElement('button', {
          onClick: () => setActiveTab('codes'),
          className: `px-4 py-2 rounded-lg font-medium ${activeTab === 'codes' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`
        }, "Dept Codes"),
        React.createElement('button', {
          onClick: () => setActiveTab('reroute'),
          className: `px-4 py-2 rounded-lg font-medium ${activeTab === 'reroute' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`
        }, "Reroute Reqs")
      )
    ),
    activeTab === 'users' && React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-4" },
        React.createElement('h3', { className: "text-xl font-bold text-gray-800" }, "User Management"),
        React.createElement('button', {
          onClick: () => {
            setShowUserForm(true);
            setEditingUser(null);
            setUserForm({
              username: '',
              password: '',
              full_name: '',
              email: '',
              role: 'initiator',
              department: 'IT',
              is_hod: 0
            });
          },
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        }, "+ Add User")
      ),
      showUserForm && React.createElement('div', { className: "mb-6 p-4 bg-gray-50 rounded-lg" },
        React.createElement('h4', { className: "font-semibold mb-4" }, editingUser ? 'Edit User' : 'New User'),
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
          React.createElement('input', {
            type: "text",
            placeholder: "Username",
            value: userForm.username,
            onChange: (e) => setUserForm({ ...userForm, username: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "password",
            placeholder: "Password",
            value: userForm.password,
            onChange: (e) => setUserForm({ ...userForm, password: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "text",
            placeholder: "Full Name",
            value: userForm.full_name,
            onChange: (e) => setUserForm({ ...userForm, full_name: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "email",
            placeholder: "Email",
            value: userForm.email,
            onChange: (e) => setUserForm({ ...userForm, email: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('select', {
            value: userForm.role,
            onChange: (e) => setUserForm({ ...userForm, role: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          },
            React.createElement('option', { value: "initiator" }, "Initiator"),
            React.createElement('option', { value: "hod" }, "HOD"),
            React.createElement('option', { value: "procurement" }, "Procurement"),
            React.createElement('option', { value: "finance" }, "Finance"),
            React.createElement('option', { value: "md" }, "MD"),
            React.createElement('option', { value: "admin" }, "Admin")
          ),
          React.createElement('select', {
            value: userForm.department,
            onChange: (e) => setUserForm({ ...userForm, department: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          },
            React.createElement('option', { value: "IT" }, "IT"),
            React.createElement('option', { value: "HR" }, "HR"),
            React.createElement('option', { value: "Finance" }, "Finance"),
            React.createElement('option', { value: "Operations" }, "Operations"),
            React.createElement('option', { value: "Procurement" }, "Procurement"),
            React.createElement('option', { value: "Executive" }, "Executive")
          ),
          React.createElement('label', { className: "flex items-center gap-2" },
            React.createElement('input', {
              type: "checkbox",
              checked: userForm.is_hod === 1,
              onChange: (e) => setUserForm({ ...userForm, is_hod: e.target.checked ? 1 : 0 }),
              className: "w-4 h-4"
            }),
            React.createElement('span', null, "Is HOD")
          )
        ),
        React.createElement('div', { className: "flex gap-2 mt-4" },
          React.createElement('button', {
            onClick: handleSaveUser,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, "Save User"),
          React.createElement('button', {
            onClick: () => {
              setShowUserForm(false);
              setEditingUser(null);
            },
            className: "px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          }, "Cancel")
        )
      ),
      React.createElement('table', { className: "w-full" },
        React.createElement('thead', null,
          React.createElement('tr', { className: "border-b" },
            React.createElement('th', { className: "text-left py-2 px-4" }, "Username"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Full Name"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Email"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Role"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Department"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Actions")
          )
        ),
        React.createElement('tbody', null,
          users.map(user =>
            React.createElement('tr', { key: user.id, className: "border-b hover:bg-gray-50" },
              React.createElement('td', { className: "py-2 px-4" }, user.username),
              React.createElement('td', { className: "py-2 px-4" }, user.full_name),
              React.createElement('td', { className: "py-2 px-4 text-sm" }, user.email),
              React.createElement('td', { className: "py-2 px-4" },
                React.createElement('span', { className: "px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded" }, user.role)
              ),
              React.createElement('td', { className: "py-2 px-4" }, user.department),
              React.createElement('td', { className: "py-2 px-4" },
                React.createElement('div', { className: "flex gap-2" },
                  React.createElement('button', {
                    onClick: () => {
                      setEditingUser(user);
                      setUserForm({
                        username: user.username,
                        password: '',
                        full_name: user.full_name,
                        email: user.email,
                        role: user.role,
                        department: user.department,
                        is_hod: user.is_hod
                      });
                      setShowUserForm(true);
                    },
                    className: "px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded hover:bg-yellow-200"
                  }, "Edit"),
                  React.createElement('button', {
                    onClick: () => handleDeleteUser(user.id),
                    className: "px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                  }, "Delete"),
                  React.createElement('button', {
                    onClick: () => {
                      setResetUserId(user.id);
                      setShowPasswordReset(true);
                    },
                    className: "px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded hover:bg-purple-200 ml-1"
                  }, "Reset Pwd")
                )
              )
            )
          )
        )
      ),
      showPasswordReset && React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" },
        React.createElement('div', { className: "bg-white rounded-lg p-6 max-w-md w-full" },
          React.createElement('h3', { className: "text-lg font-bold mb-4" }, "Reset User Password"),
          React.createElement('input', {
            type: "password",
            placeholder: "New Password (min 6 characters)",
            value: newPassword,
            onChange: (e) => setNewPassword(e.target.value),
            className: "w-full px-3 py-2 border rounded-lg mb-4"
          }),
          React.createElement('div', { className: "flex gap-2" },
            React.createElement('button', {
              onClick: handleResetPassword,
              className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            }, "Reset Password"),
            React.createElement('button', {
              onClick: () => {
                setShowPasswordReset(false);
                setResetUserId(null);
                setNewPassword('');
              },
              className: "px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            }, "Cancel")
          )
        )
      )
    ),
    activeTab === 'vendors' && React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-4" },
        React.createElement('h3', { className: "text-xl font-bold text-gray-800" }, "Vendor Management"),
        React.createElement('button', {
          onClick: () => {
            setShowVendorForm(true);
            setEditingVendor(null);
            setVendorForm({
              name: '',
              email: '',
              phone: '',
              address: ''
            });
          },
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        }, "+ Add Vendor")
      ),
      showVendorForm && React.createElement('div', { className: "mb-6 p-4 bg-gray-50 rounded-lg" },
        React.createElement('h4', { className: "font-semibold mb-4" }, editingVendor ? 'Edit Vendor' : 'New Vendor'),
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
          React.createElement('input', {
            type: "text",
            placeholder: "Vendor Name",
            value: vendorForm.name,
            onChange: (e) => setVendorForm({ ...vendorForm, name: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "email",
            placeholder: "Email",
            value: vendorForm.email,
            onChange: (e) => setVendorForm({ ...vendorForm, email: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "text",
            placeholder: "Phone",
            value: vendorForm.phone,
            onChange: (e) => setVendorForm({ ...vendorForm, phone: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "text",
            placeholder: "Address",
            value: vendorForm.address,
            onChange: (e) => setVendorForm({ ...vendorForm, address: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          })
        ),
        React.createElement('div', { className: "flex gap-2 mt-4" },
          React.createElement('button', {
            onClick: handleSaveVendor,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, "Save Vendor"),
          React.createElement('button', {
            onClick: () => {
              setShowVendorForm(false);
              setEditingVendor(null);
            },
            className: "px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          }, "Cancel")
        )
      ),
      React.createElement('table', { className: "w-full" },
        React.createElement('thead', null,
          React.createElement('tr', { className: "border-b" },
            React.createElement('th', { className: "text-left py-2 px-4" }, "Name"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Email"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Phone"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Address"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Actions")
          )
        ),
        React.createElement('tbody', null,
          vendors.map(vendor =>
            React.createElement('tr', { key: vendor.id, className: "border-b hover:bg-gray-50" },
              React.createElement('td', { className: "py-2 px-4 font-semibold" }, vendor.name),
              React.createElement('td', { className: "py-2 px-4 text-sm" }, vendor.email),
              React.createElement('td', { className: "py-2 px-4 text-sm" }, vendor.phone),
              React.createElement('td', { className: "py-2 px-4 text-sm" }, vendor.address),
              React.createElement('td', { className: "py-2 px-4" },
                React.createElement('div', { className: "flex gap-2" },
                  React.createElement('button', {
                    onClick: () => {
                      setEditingVendor(vendor);
                      setVendorForm({
                        name: vendor.name,
                        email: vendor.email,
                        phone: vendor.phone,
                        address: vendor.address
                      });
                      setShowVendorForm(true);
                    },
                    className: "px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded hover:bg-yellow-200"
                  }, "Edit"),
                  React.createElement('button', {
                    onClick: () => handleDeleteVendor(vendor.id),
                    className: "px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                  }, "Delete")
                )
              )
            )
          )
        )
      )
    ),

    // Departments Tab
    activeTab === 'departments' && React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-4" },
        React.createElement('h3', { className: "text-xl font-bold text-gray-800" }, "Department Management"),
        React.createElement('button', {
          onClick: () => {
            setShowDepartmentForm(true);
            setEditingDepartment(null);
            setDepartmentForm({ name: '', code: '', description: '', is_active: 1 });
          },
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        }, "+ Add Department")
      ),
      showDepartmentForm && React.createElement('div', { className: "mb-6 p-4 bg-gray-50 rounded-lg" },
        React.createElement('h4', { className: "font-semibold mb-4" }, editingDepartment ? 'Edit Department' : 'New Department'),
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
          React.createElement('input', {
            type: "text",
            placeholder: "Department Name",
            value: departmentForm.name,
            onChange: (e) => setDepartmentForm({ ...departmentForm, name: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "text",
            placeholder: "Department Code",
            value: departmentForm.code,
            onChange: (e) => setDepartmentForm({ ...departmentForm, code: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "text",
            placeholder: "Description",
            value: departmentForm.description,
            onChange: (e) => setDepartmentForm({ ...departmentForm, description: e.target.value }),
            className: "px-3 py-2 border rounded-lg md:col-span-2"
          }),
          React.createElement('label', { className: "flex items-center gap-2" },
            React.createElement('input', {
              type: "checkbox",
              checked: departmentForm.is_active === 1,
              onChange: (e) => setDepartmentForm({ ...departmentForm, is_active: e.target.checked ? 1 : 0 }),
              className: "w-4 h-4"
            }),
            React.createElement('span', null, "Active")
          )
        ),
        React.createElement('div', { className: "flex gap-2 mt-4" },
          React.createElement('button', {
            onClick: handleSaveDepartment,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, "Save Department"),
          React.createElement('button', {
            onClick: () => {
              setShowDepartmentForm(false);
              setEditingDepartment(null);
            },
            className: "px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          }, "Cancel")
        )
      ),
      React.createElement('table', { className: "w-full" },
        React.createElement('thead', { className: "bg-gray-50" },
          React.createElement('tr', null,
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Name"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Code"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Description"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Status"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Actions")
          )
        ),
        React.createElement('tbody', null,
          departments.map(dept =>
            React.createElement('tr', { key: dept.id, className: "border-b hover:bg-gray-50" },
              React.createElement('td', { className: "px-4 py-2" }, dept.name),
              React.createElement('td', { className: "px-4 py-2" }, dept.code),
              React.createElement('td', { className: "px-4 py-2" }, dept.description || '-'),
              React.createElement('td', { className: "px-4 py-2" },
                React.createElement('span', {
                  className: `px-2 py-1 rounded text-xs ${dept.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`
                }, dept.is_active ? 'Active' : 'Inactive')
              ),
              React.createElement('td', { className: "px-4 py-2" },
                React.createElement('button', {
                  onClick: () => {
                    setEditingDepartment(dept);
                    setDepartmentForm(dept);
                    setShowDepartmentForm(true);
                  },
                  className: "text-blue-600 hover:text-blue-800 text-sm mr-2"
                }, "Edit"),
                React.createElement('button', {
                  onClick: () => handleDeleteDepartment(dept.id),
                  className: "text-red-600 hover:text-red-800 text-sm"
                }, "Delete")
              )
            )
          )
        )
      )
    ),

    // Department Codes Tab
    activeTab === 'codes' && React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-4" },
        React.createElement('h3', { className: "text-xl font-bold text-gray-800" }, "Department Codes Management"),
        React.createElement('button', {
          onClick: () => {
            setShowCodeForm(true);
            setEditingCode(null);
            setCodeForm({ department_id: '', code: '', description: '', is_active: 1 });
          },
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        }, "+ Add Code")
      ),
      showCodeForm && React.createElement('div', { className: "mb-6 p-4 bg-gray-50 rounded-lg" },
        React.createElement('h4', { className: "font-semibold mb-4" }, editingCode ? 'Edit Code' : 'New Code'),
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
          React.createElement('select', {
            value: codeForm.department_id,
            onChange: (e) => setCodeForm({ ...codeForm, department_id: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          },
            React.createElement('option', { value: "" }, "Select Department"),
            departments.map(dept =>
              React.createElement('option', { key: dept.id, value: dept.id }, dept.name)
            )
          ),
          React.createElement('input', {
            type: "text",
            placeholder: "Code",
            value: codeForm.code,
            onChange: (e) => setCodeForm({ ...codeForm, code: e.target.value }),
            className: "px-3 py-2 border rounded-lg"
          }),
          React.createElement('input', {
            type: "text",
            placeholder: "Description",
            value: codeForm.description,
            onChange: (e) => setCodeForm({ ...codeForm, description: e.target.value }),
            className: "px-3 py-2 border rounded-lg md:col-span-2"
          }),
          React.createElement('label', { className: "flex items-center gap-2" },
            React.createElement('input', {
              type: "checkbox",
              checked: codeForm.is_active === 1,
              onChange: (e) => setCodeForm({ ...codeForm, is_active: e.target.checked ? 1 : 0 }),
              className: "w-4 h-4"
            }),
            React.createElement('span', null, "Active")
          )
        ),
        React.createElement('div', { className: "flex gap-2 mt-4" },
          React.createElement('button', {
            onClick: handleSaveCode,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, "Save Code"),
          React.createElement('button', {
            onClick: () => {
              setShowCodeForm(false);
              setEditingCode(null);
            },
            className: "px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          }, "Cancel")
        )
      ),
      React.createElement('table', { className: "w-full" },
        React.createElement('thead', { className: "bg-gray-50" },
          React.createElement('tr', null,
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Code"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Department"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Description"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Status"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Actions")
          )
        ),
        React.createElement('tbody', null,
          departmentCodes.map(code =>
            React.createElement('tr', { key: code.id, className: "border-b hover:bg-gray-50" },
              React.createElement('td', { className: "px-4 py-2 font-semibold" }, code.code),
              React.createElement('td', { className: "px-4 py-2" }, code.department_name || '-'),
              React.createElement('td', { className: "px-4 py-2" }, code.description || '-'),
              React.createElement('td', { className: "px-4 py-2" },
                React.createElement('span', {
                  className: `px-2 py-1 rounded text-xs ${code.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`
                }, code.is_active ? 'Active' : 'Inactive')
              ),
              React.createElement('td', { className: "px-4 py-2" },
                React.createElement('button', {
                  onClick: () => {
                    setEditingCode(code);
                    setCodeForm(code);
                    setShowCodeForm(true);
                  },
                  className: "text-blue-600 hover:text-blue-800 text-sm mr-2"
                }, "Edit"),
                React.createElement('button', {
                  onClick: () => handleDeleteCode(code.id),
                  className: "text-red-600 hover:text-red-800 text-sm"
                }, "Delete")
              )
            )
          )
        )
      )
    ),

    // Reroute Requisitions Tab
    activeTab === 'reroute' && React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h3', { className: "text-xl font-bold text-gray-800 mb-4" }, "Reroute Requisitions"),
      showRerouteModal && React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" },
        React.createElement('div', { className: "bg-white rounded-lg p-6 max-w-md w-full" },
          React.createElement('h3', { className: "text-lg font-bold mb-4" }, "Reroute Requisition"),
          React.createElement('select', {
            value: rerouteForm.to_user_id,
            onChange: (e) => setRerouteForm({ ...rerouteForm, to_user_id: e.target.value }),
            className: "w-full px-3 py-2 border rounded-lg mb-3"
          },
            React.createElement('option', { value: "" }, "Select User"),
            rerouteUsers.map(user =>
              React.createElement('option', { key: user.id, value: user.id }, `${user.full_name} (${user.role})`)
            )
          ),
          React.createElement('textarea', {
            placeholder: "Reason for rerouting (required)",
            value: rerouteForm.reason,
            onChange: (e) => setRerouteForm({ ...rerouteForm, reason: e.target.value }),
            className: "w-full px-3 py-2 border rounded-lg mb-3",
            rows: 3
          }),
          React.createElement('select', {
            value: rerouteForm.new_status,
            onChange: (e) => setRerouteForm({ ...rerouteForm, new_status: e.target.value }),
            className: "w-full px-3 py-2 border rounded-lg mb-4"
          },
            React.createElement('option', { value: "" }, "Keep Current Status"),
            React.createElement('option', { value: "pending_hod" }, "Pending HOD"),
            React.createElement('option', { value: "pending_procurement" }, "Pending Procurement"),
            React.createElement('option', { value: "pending_finance" }, "Pending Finance"),
            React.createElement('option', { value: "pending_md" }, "Pending MD")
          ),
          React.createElement('div', { className: "flex gap-2" },
            React.createElement('button', {
              onClick: handleReroute,
              className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            }, "Reroute"),
            React.createElement('button', {
              onClick: () => {
                setShowRerouteModal(false);
                setRerouteReqId(null);
                setRerouteForm({ to_user_id: '', reason: '', new_status: '' });
              },
              className: "px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            }, "Cancel")
          )
        )
      ),
      React.createElement('table', { className: "w-full" },
        React.createElement('thead', { className: "bg-gray-50" },
          React.createElement('tr', null,
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Req #"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Title"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Status"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Created By"),
            React.createElement('th', { className: "px-4 py-2 text-left" }, "Actions")
          )
        ),
        React.createElement('tbody', null,
          data.requisitions.map(req =>
            React.createElement('tr', { key: req.id, className: "border-b hover:bg-gray-50" },
              React.createElement('td', { className: "px-4 py-2" }, req.req_number || req.id),
              React.createElement('td', { className: "px-4 py-2" }, req.title || req.description),
              React.createElement('td', { className: "px-4 py-2" }, req.status),
              React.createElement('td', { className: "px-4 py-2" }, req.created_by_name),
              React.createElement('td', { className: "px-4 py-2" },
                React.createElement('button', {
                  onClick: () => handleOpenReroute(req.id),
                  className: "px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 text-sm"
                }, "Reroute")
              )
            )
          )
        )
      )
    )
  );
}

function Reports({ data }) {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    department: ''
  });

  const totalReqs = data.requisitions.length;
  const approvedReqs = data.requisitions.filter(r => r.status === 'completed' || r.status === 'approved').length;
  const pendingReqs = data.requisitions.filter(r => r.status.includes('pending') || r.status === 'hod_approved' || r.status === 'finance_approved').length;
  const rejectedReqs = data.requisitions.filter(r => r.status === 'rejected').length;
  const totalValue = data.requisitions.reduce((sum, r) => sum + (r.total_amount || r.amount || 0), 0);

  const handleDownloadExcel = () => {
    const params = {};
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.status) params.status = filters.status;
    if (filters.department) params.department = filters.department;
    api.downloadRequisitionsExcel(params);
  };

  const handleDownloadPDF = () => {
    const params = {};
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.status) params.status = filters.status;
    if (filters.department) params.department = filters.department;
    api.downloadRequisitionsPDF(params);
  };

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h2', { className: "text-2xl font-bold text-gray-800 mb-6" }, "System Reports"),
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" },
        React.createElement('div', { className: "p-4 bg-blue-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-blue-600 font-medium mb-1" }, "Total Requisitions"),
          React.createElement('p', { className: "text-3xl font-bold text-blue-900" }, totalReqs)
        ),
        React.createElement('div', { className: "p-4 bg-green-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-green-600 font-medium mb-1" }, "Approved/Completed"),
          React.createElement('p', { className: "text-3xl font-bold text-green-900" }, approvedReqs)
        ),
        React.createElement('div', { className: "p-4 bg-yellow-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-yellow-600 font-medium mb-1" }, "Pending"),
          React.createElement('p', { className: "text-3xl font-bold text-yellow-900" }, pendingReqs)
        ),
        React.createElement('div', { className: "p-4 bg-red-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-red-600 font-medium mb-1" }, "Rejected"),
          React.createElement('p', { className: "text-3xl font-bold text-red-900" }, rejectedReqs)
        )
      ),
      React.createElement('div', { className: "p-4 bg-purple-50 rounded-lg mb-6" },
        React.createElement('p', { className: "text-sm text-purple-600 font-medium mb-1" }, "Total Value (All Requisitions)"),
        React.createElement('p', { className: "text-3xl font-bold text-purple-900" }, `ZMW ${totalValue.toLocaleString()}`)
      )
    ),
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h3', { className: "text-xl font-bold text-gray-800 mb-4" }, "Export Requisitions Report"),
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4" },
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Date From"),
          React.createElement('input', {
            type: "date",
            value: filters.dateFrom,
            onChange: (e) => setFilters({ ...filters, dateFrom: e.target.value }),
            className: "w-full px-3 py-2 border border-gray-300 rounded-lg"
          })
        ),
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Date To"),
          React.createElement('input', {
            type: "date",
            value: filters.dateTo,
            onChange: (e) => setFilters({ ...filters, dateTo: e.target.value }),
            className: "w-full px-3 py-2 border border-gray-300 rounded-lg"
          })
        ),
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Status"),
          React.createElement('select', {
            value: filters.status,
            onChange: (e) => setFilters({ ...filters, status: e.target.value }),
            className: "w-full px-3 py-2 border border-gray-300 rounded-lg"
          },
            React.createElement('option', { value: "" }, "All Statuses"),
            React.createElement('option', { value: "draft" }, "Draft"),
            React.createElement('option', { value: "pending" }, "Pending"),
            React.createElement('option', { value: "hod_approved" }, "HOD Approved"),
            React.createElement('option', { value: "finance_approved" }, "Finance Approved"),
            React.createElement('option', { value: "completed" }, "Completed"),
            React.createElement('option', { value: "rejected" }, "Rejected")
          )
        ),
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Department"),
          React.createElement('select', {
            value: filters.department,
            onChange: (e) => setFilters({ ...filters, department: e.target.value }),
            className: "w-full px-3 py-2 border border-gray-300 rounded-lg"
          },
            React.createElement('option', { value: "" }, "All Departments"),
            React.createElement('option', { value: "IT" }, "IT"),
            React.createElement('option', { value: "HR" }, "HR"),
            React.createElement('option', { value: "Finance" }, "Finance"),
            React.createElement('option', { value: "Operations" }, "Operations"),
            React.createElement('option', { value: "Procurement" }, "Procurement")
          )
        )
      ),
      React.createElement('div', { className: "flex gap-4" },
        React.createElement('button', {
          onClick: handleDownloadExcel,
          className: "flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
        }, "Download Excel Report"),
        React.createElement('button', {
          onClick: handleDownloadPDF,
          className: "flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
        }, "Download PDF Report")
      )
    )
  );
}

// ============================================
// ANALYTICS UTILITY FUNCTIONS
// ============================================

// Get date range presets
const getDatePresets = () => {
  const today = new Date();
  const formatDate = (date) => date.toISOString().split('T')[0];

  return {
    'today': {
      label: 'Today',
      dateFrom: formatDate(today),
      dateTo: formatDate(today)
    },
    'last7days': {
      label: 'Last 7 Days',
      dateFrom: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      dateTo: formatDate(today)
    },
    'last30days': {
      label: 'Last 30 Days',
      dateFrom: formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
      dateTo: formatDate(today)
    },
    'thisMonth': {
      label: 'This Month',
      dateFrom: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      dateTo: formatDate(today)
    },
    'lastMonth': {
      label: 'Last Month',
      dateFrom: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      dateTo: formatDate(new Date(today.getFullYear(), today.getMonth(), 0))
    },
    'thisYear': {
      label: 'This Year',
      dateFrom: formatDate(new Date(today.getFullYear(), 0, 1)),
      dateTo: formatDate(today)
    },
    'all': {
      label: 'All Time',
      dateFrom: '',
      dateTo: ''
    }
  };
};

// Convert JSON to Excel (CSV format)
const downloadExcelFromJSON = (data, filename) => {
  // Create workbook-like structure
  const sheets = [];

  // Overview sheet
  if (data.overview) {
    const overview = data.overview;
    sheets.push('Overview');
    sheets.push('Metric,Value');
    sheets.push(`Total Spend,ZMW ${parseFloat(overview.totalSpend || 0).toLocaleString()}`);
    sheets.push(`Total Requisitions,${overview.totalRequisitions || 0}`);
    sheets.push(`Completed,${overview.completedRequisitions || 0}`);
    sheets.push(`Pending,${overview.pendingRequisitions || 0}`);
    sheets.push(`Rejected,${overview.rejectedRequisitions || 0}`);
    sheets.push(`Avg Processing Time,${parseFloat(overview.avgProcessingTime || 0).toFixed(1)} days`);
    sheets.push('');
  }

  // Departments sheet
  if (data.departments && data.departments.length > 0) {
    sheets.push('Department Breakdown');
    sheets.push('Department,Count,Total Amount (ZMW)');
    data.departments.forEach(dept => {
      sheets.push(`${dept.department},${dept.count},${parseFloat(dept.total_amount || 0).toFixed(2)}`);
    });
    sheets.push('');
  }

  // Status sheet
  if (data.statuses && data.statuses.length > 0) {
    sheets.push('Status Distribution');
    sheets.push('Status,Count,Total Amount (ZMW)');
    data.statuses.forEach(status => {
      sheets.push(`${status.status},${status.count},${parseFloat(status.total_amount || 0).toFixed(2)}`);
    });
    sheets.push('');
  }

  // Export info
  sheets.push('Export Information');
  sheets.push(`Export Date,${new Date(data.exportDate).toLocaleString()}`);
  if (data.filters.dateFrom) sheets.push(`Date From,${data.filters.dateFrom}`);
  if (data.filters.dateTo) sheets.push(`Date To,${data.filters.dateTo}`);
  if (data.filters.department) sheets.push(`Department,${data.filters.department}`);

  // Create blob and download
  const csv = sheets.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================
// ANALYTICS DASHBOARD COMPONENT
// ============================================

function AnalyticsDashboard({ user }) {
  // State for analytics data
  const [overview, setOverview] = useState(null);
  const [spendingTrend, setSpendingTrend] = useState(null);
  const [departmentBreakdown, setDepartmentBreakdown] = useState(null);
  const [approvalFlow, setApprovalFlow] = useState(null);
  const [duration, setDuration] = useState(null);
  const [statusDistribution, setStatusDistribution] = useState(null);
  const [topVendors, setTopVendors] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    department: '',
    period: 'monthly'
  });

  // Chart instances
  const [charts, setCharts] = useState({});

  // Load all analytics data
  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const filterParams = {};
      if (filters.dateFrom) filterParams.dateFrom = filters.dateFrom;
      if (filters.dateTo) filterParams.dateTo = filters.dateTo;
      if (filters.department) filterParams.department = filters.department;

      const [
        overviewData,
        trendData,
        deptData,
        flowData,
        durationData,
        statusData,
        vendorData
      ] = await Promise.all([
        api.analytics.getOverview(filterParams),
        api.analytics.getSpendingTrend({ ...filterParams, period: filters.period }),
        api.analytics.getDepartmentBreakdown(filterParams),
        api.analytics.getApprovalFlow(filterParams),
        api.analytics.getDuration(filterParams),
        api.analytics.getStatusDistribution(filterParams),
        api.analytics.getTopVendors({ ...filterParams, limit: 10 })
      ]);

      setOverview(overviewData);
      setSpendingTrend(trendData);
      setDepartmentBreakdown(deptData);
      setApprovalFlow(flowData);
      setDuration(durationData);
      setStatusDistribution(statusData);
      setTopVendors(vendorData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      alert('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and filter changes
  useEffect(() => {
    loadAnalytics();
  }, [filters]);

  // Render charts after data loads
  useEffect(() => {
    if (!loading && spendingTrend && departmentBreakdown && statusDistribution && duration) {
      // Destroy existing charts
      Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
      });

      const colors = getChartColors();
      const newCharts = {};

      // Spending Trend Line Chart
      if (spendingTrend && spendingTrend.data && spendingTrend.data.length > 0) {
        newCharts.trend = createLineChart('trendChart', {
          labels: spendingTrend.data.map(d => d.period),
          datasets: [
            {
              label: 'Approved',
              data: spendingTrend.data.map(d => d.approved),
              borderColor: colors.success,
              backgroundColor: colors.success + '20',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Pending',
              data: spendingTrend.data.map(d => d.pending),
              borderColor: colors.warning,
              backgroundColor: colors.warning + '20',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Rejected',
              data: spendingTrend.data.map(d => d.rejected),
              borderColor: colors.danger,
              backgroundColor: colors.danger + '20',
              tension: 0.4,
              fill: true
            }
          ]
        });
      }

      // Department Breakdown Pie Chart with click handler
      if (departmentBreakdown && departmentBreakdown.length > 0) {
        const deptClickHandler = (event, activeElements) => {
          if (activeElements.length > 0) {
            const index = activeElements[0].index;
            const dept = departmentBreakdown[index].department;
            setFilters({ ...filters, department: dept });
            alert(`Filtered by ${dept}\nTotal Amount: ZMW ${parseFloat(departmentBreakdown[index].total_amount).toLocaleString()}\nCount: ${departmentBreakdown[index].count}`);
          }
        };

        newCharts.department = createPieChart('deptChart', {
          labels: departmentBreakdown.map(d => d.department),
          datasets: [{
            data: departmentBreakdown.map(d => d.total_amount),
            backgroundColor: [
              colors.primary,
              colors.primaryLight,
              colors.success,
              colors.warning,
              colors.info,
              colors.neutral
            ]
          }]
        }, 'doughnut', deptClickHandler);
      }

      // Status Distribution Pie Chart
      if (statusDistribution && statusDistribution.length > 0) {
        const statusColors = {
          'completed': colors.success,
          'pending': colors.warning,
          'hod_approved': colors.info,
          'finance_approved': colors.primaryLight,
          'md_approved': colors.primary,
          'rejected': colors.danger,
          'draft': colors.neutral
        };

        newCharts.status = createPieChart('statusChart', {
          labels: statusDistribution.map(d => d.status.replace('_', ' ').toUpperCase()),
          datasets: [{
            data: statusDistribution.map(d => d.count),
            backgroundColor: statusDistribution.map(d => statusColors[d.status] || colors.neutral)
          }]
        }, 'pie');
      }

      // Duration Bar Chart
      if (duration) {
        const stages = [];
        const durations = [];

        if (duration.hod_stage) {
          stages.push('HOD Stage');
          durations.push(parseFloat(duration.hod_stage) || 0);
        }
        if (duration.procurement_stage) {
          stages.push('Procurement');
          durations.push(parseFloat(duration.procurement_stage) || 0);
        }
        if (duration.finance_stage) {
          stages.push('Finance');
          durations.push(parseFloat(duration.finance_stage) || 0);
        }
        if (duration.md_stage) {
          stages.push('MD Stage');
          durations.push(parseFloat(duration.md_stage) || 0);
        }

        if (stages.length > 0) {
          newCharts.duration = createBarChart('durationChart', {
            labels: stages,
            datasets: [{
              label: 'Average Days',
              data: durations,
              backgroundColor: [
                colors.primary,
                colors.primaryLight,
                colors.info,
                colors.success
              ]
            }]
          }, { horizontal: true });
        }
      }

      setCharts(newCharts);
    }
  }, [loading, spendingTrend, departmentBreakdown, statusDistribution, duration]);

  // Cleanup charts on unmount
  useEffect(() => {
    return () => {
      Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
      });
    };
  }, []);

  if (loading) {
    return React.createElement('div', {
      className: "flex items-center justify-center min-h-screen"
    },
      React.createElement('div', {
        className: "animate-spin rounded-full h-12 w-12 border-b-2",
        style: { borderColor: 'var(--color-primary)' }
      })
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    // Header
    React.createElement('div', {
      className: "rounded-lg p-6 transition-all",
      style: {
        backgroundColor: 'var(--bg-primary)',
        boxShadow: 'var(--shadow-sm)',
        borderWidth: '1px',
        borderColor: 'var(--border-color)'
      }
    },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', {
          className: "text-2xl font-bold transition-colors",
          style: { color: 'var(--text-primary)' }
        }, "Analytics Dashboard"),
        React.createElement('div', {
          className: "text-sm px-3 py-2 rounded-lg transition-colors",
          style: {
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)'
          }
        }, "💡 Tip: Click on department chart to filter data")
      ),

      // Filters
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" },
        React.createElement('div', null,
          React.createElement('label', {
            className: "block text-sm font-medium mb-2 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, "Date From"),
          React.createElement('input', {
            type: "date",
            value: filters.dateFrom,
            onChange: (e) => setFilters({ ...filters, dateFrom: e.target.value }),
            className: "w-full px-3 py-2 border rounded-lg transition-colors",
            style: {
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }
          })
        ),
        React.createElement('div', null,
          React.createElement('label', {
            className: "block text-sm font-medium mb-2 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, "Date To"),
          React.createElement('input', {
            type: "date",
            value: filters.dateTo,
            onChange: (e) => setFilters({ ...filters, dateTo: e.target.value }),
            className: "w-full px-3 py-2 border rounded-lg transition-colors",
            style: {
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }
          })
        ),
        React.createElement('div', null,
          React.createElement('label', {
            className: "block text-sm font-medium mb-2 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, "Department"),
          React.createElement('select', {
            value: filters.department,
            onChange: (e) => setFilters({ ...filters, department: e.target.value }),
            className: "w-full px-3 py-2 border rounded-lg transition-colors",
            style: {
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }
          },
            React.createElement('option', { value: "" }, "All Departments"),
            React.createElement('option', { value: "IT" }, "IT"),
            React.createElement('option', { value: "HR" }, "HR"),
            React.createElement('option', { value: "Finance" }, "Finance"),
            React.createElement('option', { value: "Operations" }, "Operations"),
            React.createElement('option', { value: "Procurement" }, "Procurement")
          )
        ),
        React.createElement('div', null,
          React.createElement('label', {
            className: "block text-sm font-medium mb-2 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, "Period"),
          React.createElement('select', {
            value: filters.period,
            onChange: (e) => setFilters({ ...filters, period: e.target.value }),
            className: "w-full px-3 py-2 border rounded-lg transition-colors",
            style: {
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }
          },
            React.createElement('option', { value: "daily" }, "Daily"),
            React.createElement('option', { value: "weekly" }, "Weekly"),
            React.createElement('option', { value: "monthly" }, "Monthly")
          )
        )
      ),

      // Date Range Presets
      React.createElement('div', { className: "mb-4" },
        React.createElement('label', {
          className: "block text-sm font-medium mb-2 transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, "Quick Date Ranges"),
        React.createElement('div', { className: "flex flex-wrap gap-2" },
          Object.entries(getDatePresets()).map(([key, preset]) =>
            React.createElement('button', {
              key: key,
              onClick: () => setFilters({ ...filters, dateFrom: preset.dateFrom, dateTo: preset.dateTo }),
              className: "px-3 py-1 rounded-lg text-sm font-medium transition-all",
              style: {
                backgroundColor: (filters.dateFrom === preset.dateFrom && filters.dateTo === preset.dateTo) ? '#0070AF' : 'var(--bg-tertiary)',
                color: (filters.dateFrom === preset.dateFrom && filters.dateTo === preset.dateTo) ? '#FFFFFF' : 'var(--text-primary)',
                borderWidth: '1px',
                borderColor: 'var(--border-color)'
              }
            }, preset.label)
          )
        )
      ),

      // Export Buttons
      React.createElement('div', { className: "flex flex-wrap gap-3 pt-4 border-t", style: { borderColor: 'var(--border-color)' } },
        React.createElement('button', {
          onClick: () => api.analytics.exportCSV(filters),
          className: "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
          style: {
            backgroundColor: 'var(--color-success)',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-sm)'
          }
        }, '📄 Export CSV'),
        React.createElement('button', {
          onClick: async () => {
            try {
              const data = await api.analytics.exportJSON(filters);
              downloadExcelFromJSON(data, `analytics-export-${Date.now()}.csv`);
            } catch (error) {
              alert('Failed to export data: ' + error.message);
            }
          },
          className: "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
          style: {
            backgroundColor: 'var(--color-success-dark)',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-sm)'
          }
        }, '📊 Export Excel'),
        React.createElement('button', {
          onClick: () => {
            alert('Generating PDF report...\nThis feature will capture all charts and data into a professional PDF document.');
          },
          className: "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
          style: {
            backgroundColor: 'var(--color-danger)',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-sm)'
          }
        }, '📑 Export PDF')
      )
    ),

    // KPI Cards
    overview && React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" },
      React.createElement('div', {
        className: "p-6 rounded-lg transition-all",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-md)',
          borderWidth: '1px',
          borderColor: 'var(--border-color)',
          borderLeftWidth: '4px',
          borderLeftColor: '#0070AF'
        }
      },
        React.createElement('p', {
          className: "text-sm font-medium mb-2 transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, "Total Spend"),
        React.createElement('p', {
          className: "text-3xl font-bold transition-colors",
          style: { color: 'var(--text-primary)' }
        }, `ZMW ${parseFloat(overview.totalSpend || 0).toLocaleString()}`)
      ),
      React.createElement('div', {
        className: "p-6 rounded-lg transition-all",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-md)',
          borderWidth: '1px',
          borderColor: 'var(--border-color)',
          borderLeftWidth: '4px',
          borderLeftColor: '#10B981'
        }
      },
        React.createElement('p', {
          className: "text-sm font-medium mb-2 transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, "Avg Processing Time"),
        React.createElement('p', {
          className: "text-3xl font-bold transition-colors",
          style: { color: 'var(--text-primary)' }
        }, `${parseFloat(overview.avgProcessingTime || 0).toFixed(1)} days`)
      ),
      React.createElement('div', {
        className: "p-6 rounded-lg transition-all",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-md)',
          borderWidth: '1px',
          borderColor: 'var(--border-color)',
          borderLeftWidth: '4px',
          borderLeftColor: '#3B82F6'
        }
      },
        React.createElement('p', {
          className: "text-sm font-medium mb-2 transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, "Total Requisitions"),
        React.createElement('p', {
          className: "text-3xl font-bold transition-colors",
          style: { color: 'var(--text-primary)' }
        }, overview.totalRequisitions || 0)
      ),
      React.createElement('div', {
        className: "p-6 rounded-lg transition-all",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-md)',
          borderWidth: '1px',
          borderColor: 'var(--border-color)',
          borderLeftWidth: '4px',
          borderLeftColor: '#F59E0B'
        }
      },
        React.createElement('p', {
          className: "text-sm font-medium mb-2 transition-colors",
          style: { color: 'var(--text-secondary)' }
        }, "POs Generated"),
        React.createElement('p', {
          className: "text-3xl font-bold transition-colors",
          style: { color: 'var(--text-primary)' }
        }, overview.posGenerated || 0)
      )
    ),

    // Charts Grid
    React.createElement('div', { className: "grid grid-cols-1 lg:grid-cols-2 gap-6" },
      // Spending Trend Chart
      React.createElement('div', {
        className: "p-6 rounded-lg transition-all",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-sm)',
          borderWidth: '1px',
          borderColor: 'var(--border-color)'
        }
      },
        React.createElement('h3', {
          className: "text-lg font-semibold mb-4 transition-colors",
          style: { color: 'var(--text-primary)' }
        }, "Spending Trend"),
        React.createElement('div', { style: { height: '300px' } },
          React.createElement('canvas', { id: 'trendChart' })
        )
      ),

      // Department Breakdown Chart
      React.createElement('div', {
        className: "p-6 rounded-lg transition-all",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-sm)',
          borderWidth: '1px',
          borderColor: 'var(--border-color)'
        }
      },
        React.createElement('h3', {
          className: "text-lg font-semibold mb-4 transition-colors",
          style: { color: 'var(--text-primary)' }
        }, "Department Breakdown"),
        React.createElement('div', { style: { height: '300px' } },
          React.createElement('canvas', { id: 'deptChart' })
        )
      ),

      // Status Distribution Chart
      React.createElement('div', {
        className: "p-6 rounded-lg transition-all",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-sm)',
          borderWidth: '1px',
          borderColor: 'var(--border-color)'
        }
      },
        React.createElement('h3', {
          className: "text-lg font-semibold mb-4 transition-colors",
          style: { color: 'var(--text-primary)' }
        }, "Status Distribution"),
        React.createElement('div', { style: { height: '300px' } },
          React.createElement('canvas', { id: 'statusChart' })
        )
      ),

      // Duration Analysis Chart
      React.createElement('div', {
        className: "p-6 rounded-lg transition-all",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-sm)',
          borderWidth: '1px',
          borderColor: 'var(--border-color)'
        }
      },
        React.createElement('h3', {
          className: "text-lg font-semibold mb-4 transition-colors",
          style: { color: 'var(--text-primary)' }
        }, "Processing Duration by Stage"),
        React.createElement('div', { style: { height: '300px' } },
          React.createElement('canvas', { id: 'durationChart' })
        )
      )
    ),

    // Top Vendors Table
    topVendors && topVendors.length > 0 && React.createElement('div', {
      className: "p-6 rounded-lg transition-all",
      style: {
        backgroundColor: 'var(--bg-primary)',
        boxShadow: 'var(--shadow-sm)',
        borderWidth: '1px',
        borderColor: 'var(--border-color)'
      }
    },
      React.createElement('h3', {
        className: "text-lg font-semibold mb-4 transition-colors",
        style: { color: 'var(--text-primary)' }
      }, "Top Vendors"),
      React.createElement('div', { className: "overflow-x-auto" },
        React.createElement('table', { className: "min-w-full" },
          React.createElement('thead', null,
            React.createElement('tr', {
              style: { backgroundColor: 'var(--bg-secondary)' }
            },
              React.createElement('th', {
                className: "px-4 py-3 text-left text-sm font-semibold transition-colors",
                style: { color: 'var(--text-primary)' }
              }, "Vendor"),
              React.createElement('th', {
                className: "px-4 py-3 text-left text-sm font-semibold transition-colors",
                style: { color: 'var(--text-primary)' }
              }, "PO Count"),
              React.createElement('th', {
                className: "px-4 py-3 text-left text-sm font-semibold transition-colors",
                style: { color: 'var(--text-primary)' }
              }, "Total Spend")
            )
          ),
          React.createElement('tbody', null,
            topVendors.map((vendor, idx) =>
              React.createElement('tr', {
                key: idx,
                className: "border-t transition-colors",
                style: { borderColor: 'var(--border-color)' }
              },
                React.createElement('td', {
                  className: "px-4 py-3 transition-colors",
                  style: { color: 'var(--text-primary)' }
                }, vendor.vendor_name),
                React.createElement('td', {
                  className: "px-4 py-3 transition-colors",
                  style: { color: 'var(--text-secondary)' }
                }, vendor.po_count),
                React.createElement('td', {
                  className: "px-4 py-3 font-semibold transition-colors",
                  style: { color: 'var(--text-primary)' }
                }, `ZMW ${parseFloat(vendor.total_spend || 0).toLocaleString()}`)
              )
            )
          )
        )
      )
    )
  );
}

// ============================================
// APPROVAL CONSOLE COMPONENT
// ============================================
function ApprovalConsole({ user, setView, setSelectedReq, loadData }) {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchPendingRequisitions();
  }, []);

  const fetchPendingRequisitions = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/requisitions`);
      if (!res.ok) throw new Error('Failed to fetch requisitions');
      const data = await res.json();

      // Filter based on user role
      let filtered = [];
      if (user.role === 'hod') {
        // HOD sees requisitions pending HOD approval
        filtered = data.filter(req => req.status === 'pending_hod');
      } else if (user.role === 'finance') {
        // Finance sees requisitions pending finance approval
        filtered = data.filter(req => req.status === 'pending_finance');
      } else if (user.role === 'md') {
        // MD sees requisitions pending MD approval
        filtered = data.filter(req => req.status === 'pending_md');
      } else if (user.role === 'admin') {
        // Admin sees all pending requisitions
        filtered = data.filter(req =>
          req.status === 'pending_hod' ||
          req.status === 'pending_finance' ||
          req.status === 'pending_md'
        );
      }

      setRequisitions(filtered);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      alert('Failed to load pending requisitions');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (req) => {
    setSelectedReq(req);
    setView('approve');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pending_hod': { label: 'Pending HOD', color: 'bg-yellow-100 text-yellow-800' },
      'pending_finance': { label: 'Pending Finance', color: 'bg-blue-100 text-blue-800' },
      'pending_md': { label: 'Pending MD', color: 'bg-purple-100 text-purple-800' }
    };
    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return React.createElement('span', {
      className: `px-2 py-1 text-xs font-semibold rounded-full ${config.color}`
    }, config.label);
  };

  if (loading) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-600" }, "Loading Approval Console...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    // Header
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" },
          `✅ Approval Console - ${user.role.toUpperCase()}`
        ),
        React.createElement('button', {
          onClick: fetchPendingRequisitions,
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        }, '🔄 Refresh')
      ),

      // Summary Cards
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" },
        React.createElement('div', { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4" },
          React.createElement('div', { className: "text-yellow-800 text-sm font-medium" }, "Pending Your Approval"),
          React.createElement('div', { className: "text-3xl font-bold text-yellow-900 mt-2" }, requisitions.length)
        ),
        React.createElement('div', { className: "bg-green-50 border border-green-200 rounded-lg p-4" },
          React.createElement('div', { className: "text-green-800 text-sm font-medium" }, "Total Amount"),
          React.createElement('div', { className: "text-3xl font-bold text-green-900 mt-2" },
            `${requisitions.reduce((sum, req) => sum + (parseFloat(req.total_amount) || 0), 0).toLocaleString()} ZMW`
          )
        ),
        React.createElement('div', { className: "bg-blue-50 border border-blue-200 rounded-lg p-4" },
          React.createElement('div', { className: "text-blue-800 text-sm font-medium" }, "Urgent"),
          React.createElement('div', { className: "text-3xl font-bold text-blue-900 mt-2" },
            requisitions.filter(req => req.urgency === 'High' || req.urgency === 'Emergency').length
          )
        )
      ),

      // Requisitions Table
      requisitions.length === 0
        ? React.createElement('div', { className: "text-center py-12" },
            React.createElement('p', { className: "text-gray-500 text-lg" }, "No requisitions pending your approval"),
            React.createElement('p', { className: "text-gray-400 text-sm mt-2" }, "Great! You're all caught up.")
          )
        : React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Req #"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Description"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Amount"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Urgency"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Initiator"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Status"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Created"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Action")
                )
              ),
              React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                requisitions.map(req =>
                  React.createElement('tr', {
                    key: req.id,
                    className: "hover:bg-gray-50 transition-colors"
                  },
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600" }, req.req_number),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-900" },
                      React.createElement('div', { className: "max-w-xs truncate" }, req.description || req.title)
                    ),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900" },
                      `${parseFloat(req.total_amount || 0).toLocaleString()} ZMW`
                    ),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                      React.createElement('span', {
                        className: `px-2 py-1 text-xs font-semibold rounded-full ${
                          req.urgency === 'Emergency' ? 'bg-red-100 text-red-800' :
                          req.urgency === 'High' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`
                      }, req.urgency || 'Standard')
                    ),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-600" }, req.created_by_name || 'N/A'),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" }, getStatusBadge(req.status)),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" },
                      new Date(req.created_at).toLocaleDateString()
                    ),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                      React.createElement('button', {
                        onClick: () => handleReview(req),
                        className: "px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      }, 'Review & Approve')
                    )
                  )
                )
              )
            )
          )
    )
  );
}

// ============================================
// REQUISITION ADJUDICATION COMPONENT (FOR PROCUREMENT)
// ============================================
function RequisitionProcessing({ user, setView, setSelectedReq, loadData }) {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingRequisitions();
  }, []);

  const fetchPendingRequisitions = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/requisitions`);
      if (!res.ok) throw new Error('Failed to fetch requisitions');
      const data = await res.json();

      // Procurement sees requisitions that are:
      // 1. Approved by HOD (status: pending_procurement)
      const filtered = data.filter(req => req.status === 'pending_procurement');

      setRequisitions(filtered);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      alert('Failed to load pending requisitions');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = (req) => {
    setSelectedReq(req);
    setView('approve'); // Reuse the approve view for processing
  };

  if (loading) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-600" }, "Loading Requisition Adjudication...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    // Header
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, '⚙️ Requisition Adjudication'),
        React.createElement('button', {
          onClick: fetchPendingRequisitions,
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        }, '🔄 Refresh')
      ),

      // Summary Card
      React.createElement('div', { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6" },
        React.createElement('div', { className: "text-blue-800 text-sm font-medium" }, "Awaiting Processing"),
        React.createElement('div', { className: "text-3xl font-bold text-blue-900 mt-2" }, requisitions.length),
        React.createElement('p', { className: "text-blue-600 text-sm mt-2" },
          "These requisitions have been approved by HOD and require adjudication (vendor selection, quotes, & evaluation)"
        )
      ),

      // Requisitions Table
      requisitions.length === 0
        ? React.createElement('div', { className: "text-center py-12" },
            React.createElement('p', { className: "text-gray-500 text-lg" }, "No requisitions awaiting adjudication"),
            React.createElement('p', { className: "text-gray-400 text-sm mt-2" }, "All requisitions are up to date!")
          )
        : React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Req #"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Description"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Quantity"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Urgency"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Department"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "HOD Approved"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Action")
                )
              ),
              React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                requisitions.map(req =>
                  React.createElement('tr', {
                    key: req.id,
                    className: "hover:bg-gray-50 transition-colors"
                  },
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600" }, req.req_number),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-900" },
                      React.createElement('div', { className: "max-w-xs truncate" }, req.description || req.title)
                    ),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" }, req.quantity || 'N/A'),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                      React.createElement('span', {
                        className: `px-2 py-1 text-xs font-semibold rounded-full ${
                          req.urgency === 'Emergency' ? 'bg-red-100 text-red-800' :
                          req.urgency === 'High' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`
                      }, req.urgency || 'Standard')
                    ),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-600" }, req.created_by_department || 'N/A'),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" },
                      req.hod_approved_at ? new Date(req.hod_approved_at).toLocaleDateString() : 'N/A'
                    ),
                    React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                      React.createElement('button', {
                        onClick: () => handleProcess(req),
                        className: "px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                      }, 'Adjudicate')
                    )
                  )
                )
              )
            )
          )
    )
  );
}

// ============================================
// REJECTED REQUISITIONS COMPONENT (FOR PROCUREMENT)
// ============================================
function RejectedRequisitions({ user, setView, setSelectedReq, loadData }) {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingReq, setEditingReq] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRejectedRequisitions();
    fetchVendors();
  }, []);

  const fetchRejectedRequisitions = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/requisitions`);
      if (!res.ok) throw new Error('Failed to fetch requisitions');
      const data = await res.json();

      // Show only rejected requisitions
      const filtered = data.filter(req => req.status === 'rejected');

      setRequisitions(filtered);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      alert('Failed to load rejected requisitions');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/vendors`);
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const handleEdit = (req) => {
    setEditingReq(req.id);
    setEditForm({
      description: req.description || '',
      delivery_location: req.delivery_location || '',
      urgency: req.urgency || 'Standard',
      required_date: req.required_date || '',
      account_code: req.account_code || '',
      quantity: req.quantity || 1,
      unit_price: req.unit_price || '',
      selected_vendor: req.selected_vendor || '',
      vendor_currency: req.vendor_currency || 'ZMW'
    });
  };

  const handleCancelEdit = () => {
    setEditingReq(null);
    setEditForm({});
  };

  const handleSaveEdit = async (reqId) => {
    setSaving(true);
    try {
      const totalCost = (parseFloat(editForm.quantity) || 0) * (parseFloat(editForm.unit_price) || 0);

      const res = await fetchWithAuth(`${API_URL}/requisitions/${reqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          total_cost: totalCost
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }

      alert('Changes saved successfully!');
      setEditingReq(null);
      setEditForm({});
      fetchRejectedRequisitions();
      if (loadData) loadData();
    } catch (error) {
      console.error('Error saving changes:', error);
      alert(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleResubmit = async (req) => {
    if (!confirm(`Resubmit requisition ${req.req_number}? This will send it back to HOD for approval.`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/requisitions/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pending_hod',
          rejection_reason: null,
          rejected_by: null,
          rejected_at: null
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to resubmit requisition');
      }

      alert('Requisition resubmitted successfully!');
      fetchRejectedRequisitions();
      if (loadData) loadData();
    } catch (error) {
      console.error('Error resubmitting requisition:', error);
      alert(error.message || 'Failed to resubmit requisition');
    }
  };

  if (loading) {
    return React.createElement('div', {
      className: "text-center py-12",
      style: { color: 'var(--text-secondary)' }
    },
      React.createElement('p', null, "Loading Rejected Requisitions...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    // Header
    React.createElement('div', {
      className: "rounded-lg shadow-sm border p-6 transition-colors",
      style: {
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)'
      }
    },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', {
          className: "text-2xl font-bold",
          style: { color: 'var(--text-primary)' }
        }, '❌ Rejected Requisitions'),
        React.createElement('button', {
          onClick: fetchRejectedRequisitions,
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        }, '🔄 Refresh')
      ),

      // Summary Card - Optimized colors for both modes
      React.createElement('div', {
        className: "rounded-lg p-4 mb-6 border-2 transition-colors",
        style: {
          backgroundColor: 'rgba(239, 68, 68, 0.1)', // red-500 with 10% opacity
          borderColor: 'rgb(239, 68, 68)' // red-500
        }
      },
        React.createElement('div', {
          className: "text-sm font-semibold",
          style: { color: 'rgb(220, 38, 38)' } // red-600 - readable in both modes
        }, "Total Rejected"),
        React.createElement('div', {
          className: "text-3xl font-bold mt-2",
          style: { color: 'rgb(185, 28, 28)' } // red-700 - strong contrast
        }, requisitions.length),
        React.createElement('p', {
          className: "text-sm mt-2 font-medium",
          style: { color: 'rgb(220, 38, 38)' } // red-600
        },
          "Review, edit, and resubmit rejected requisitions"
        )
      ),

      // Requisitions List
      requisitions.length === 0
        ? React.createElement('div', {
            className: "text-center py-12",
            style: { color: 'var(--text-secondary)' }
          },
            React.createElement('p', { className: "text-lg" }, "No rejected requisitions"),
            React.createElement('p', {
              className: "text-sm mt-2",
              style: { color: 'var(--text-tertiary)' }
            }, "Great! All requisitions are on track.")
          )
        : React.createElement('div', { className: "space-y-4" },
            requisitions.map(req =>
              React.createElement('div', {
                key: req.id,
                className: "rounded-lg border p-6 transition-colors",
                style: {
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)'
                }
              },
                // Header Row
                React.createElement('div', { className: "flex items-center justify-between mb-4" },
                  React.createElement('div', null,
                    React.createElement('h3', {
                      className: "text-lg font-bold",
                      style: { color: 'var(--color-primary)' } // Brand color - readable in both modes
                    }, req.req_number),
                    React.createElement('p', {
                      className: "text-sm mt-1",
                      style: { color: 'var(--text-tertiary)' }
                    }, `Rejected by ${req.rejected_by_name || 'Unknown'} on ${req.rejected_at ? new Date(req.rejected_at).toLocaleDateString() : 'N/A'}`)
                  ),
                  editingReq !== req.id && React.createElement('div', { className: "flex gap-2" },
                    React.createElement('button', {
                      onClick: () => handleEdit(req),
                      className: "px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors font-medium"
                    }, '✏️ Edit'),
                    React.createElement('button', {
                      onClick: () => handleResubmit(req),
                      className: "px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
                    }, '↩️ Resubmit')
                  )
                ),

                // Rejection Reason Alert - Optimized for visibility
                React.createElement('div', {
                  className: "rounded-lg p-3 mb-4 border-l-4",
                  style: {
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderLeftColor: 'rgb(220, 38, 38)'
                  }
                },
                  React.createElement('p', {
                    className: "text-sm font-semibold",
                    style: { color: 'rgb(185, 28, 28)' }
                  }, '⚠️ Rejection Reason:'),
                  React.createElement('p', {
                    className: "text-sm mt-1",
                    style: { color: 'var(--text-primary)' }
                  }, req.rejection_reason || 'No reason provided')
                ),

                // Edit Mode or View Mode
                editingReq === req.id
                  ? React.createElement('div', { className: "space-y-4" },
                      // Description
                      React.createElement('div', null,
                        React.createElement('label', {
                          className: "block text-sm font-semibold mb-2",
                          style: { color: 'var(--text-primary)' }
                        }, 'Description'),
                        React.createElement('textarea', {
                          value: editForm.description,
                          onChange: (e) => setEditForm({ ...editForm, description: e.target.value }),
                          className: "w-full px-3 py-2 border rounded-lg transition-colors",
                          style: {
                            backgroundColor: 'var(--bg-primary)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-primary)'
                          },
                          rows: 3
                        })
                      ),

                      // Two Column Layout
                      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                        // Delivery Location
                        React.createElement('div', null,
                          React.createElement('label', {
                            className: "block text-sm font-semibold mb-2",
                            style: { color: 'var(--text-primary)' }
                          }, 'Delivery Location'),
                          React.createElement('input', {
                            type: "text",
                            value: editForm.delivery_location,
                            onChange: (e) => setEditForm({ ...editForm, delivery_location: e.target.value }),
                            className: "w-full px-3 py-2 border rounded-lg transition-colors",
                            style: {
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }
                          })
                        ),

                        // Urgency
                        React.createElement('div', null,
                          React.createElement('label', {
                            className: "block text-sm font-semibold mb-2",
                            style: { color: 'var(--text-primary)' }
                          }, 'Urgency'),
                          React.createElement('select', {
                            value: editForm.urgency,
                            onChange: (e) => setEditForm({ ...editForm, urgency: e.target.value }),
                            className: "w-full px-3 py-2 border rounded-lg transition-colors",
                            style: {
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }
                          },
                            React.createElement('option', { value: 'Standard' }, 'Standard'),
                            React.createElement('option', { value: 'High' }, 'High'),
                            React.createElement('option', { value: 'Emergency' }, 'Emergency')
                          )
                        ),

                        // Required Date
                        React.createElement('div', null,
                          React.createElement('label', {
                            className: "block text-sm font-semibold mb-2",
                            style: { color: 'var(--text-primary)' }
                          }, 'Required Date'),
                          React.createElement('input', {
                            type: "date",
                            value: editForm.required_date,
                            onChange: (e) => setEditForm({ ...editForm, required_date: e.target.value }),
                            className: "w-full px-3 py-2 border rounded-lg transition-colors",
                            style: {
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }
                          })
                        ),

                        // Account Code
                        React.createElement('div', null,
                          React.createElement('label', {
                            className: "block text-sm font-semibold mb-2",
                            style: { color: 'var(--text-primary)' }
                          }, 'Account Code'),
                          React.createElement('input', {
                            type: "text",
                            value: editForm.account_code,
                            onChange: (e) => setEditForm({ ...editForm, account_code: e.target.value }),
                            className: "w-full px-3 py-2 border rounded-lg transition-colors",
                            style: {
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }
                          })
                        ),

                        // Quantity
                        React.createElement('div', null,
                          React.createElement('label', {
                            className: "block text-sm font-semibold mb-2",
                            style: { color: 'var(--text-primary)' }
                          }, 'Quantity'),
                          React.createElement('input', {
                            type: "number",
                            value: editForm.quantity,
                            onChange: (e) => setEditForm({ ...editForm, quantity: e.target.value }),
                            min: "1",
                            className: "w-full px-3 py-2 border rounded-lg transition-colors",
                            style: {
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }
                          })
                        ),

                        // Unit Price
                        React.createElement('div', null,
                          React.createElement('label', {
                            className: "block text-sm font-semibold mb-2",
                            style: { color: 'var(--text-primary)' }
                          }, 'Unit Price'),
                          React.createElement('input', {
                            type: "number",
                            value: editForm.unit_price,
                            onChange: (e) => setEditForm({ ...editForm, unit_price: e.target.value }),
                            step: "0.01",
                            min: "0",
                            className: "w-full px-3 py-2 border rounded-lg transition-colors",
                            style: {
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }
                          })
                        ),

                        // Vendor
                        React.createElement('div', null,
                          React.createElement('label', {
                            className: "block text-sm font-semibold mb-2",
                            style: { color: 'var(--text-primary)' }
                          }, 'Vendor'),
                          React.createElement('select', {
                            value: editForm.selected_vendor,
                            onChange: (e) => setEditForm({ ...editForm, selected_vendor: e.target.value }),
                            className: "w-full px-3 py-2 border rounded-lg transition-colors",
                            style: {
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }
                          },
                            React.createElement('option', { value: '' }, 'Select Vendor'),
                            vendors.filter(v => v.status === 'active').map(v =>
                              React.createElement('option', { key: v.id, value: v.name }, v.name)
                            )
                          )
                        ),

                        // Currency
                        React.createElement('div', null,
                          React.createElement('label', {
                            className: "block text-sm font-semibold mb-2",
                            style: { color: 'var(--text-primary)' }
                          }, 'Currency'),
                          React.createElement('select', {
                            value: editForm.vendor_currency,
                            onChange: (e) => setEditForm({ ...editForm, vendor_currency: e.target.value }),
                            className: "w-full px-3 py-2 border rounded-lg transition-colors",
                            style: {
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }
                          },
                            React.createElement('option', { value: 'ZMW' }, 'ZMW'),
                            React.createElement('option', { value: 'USD' }, 'USD'),
                            React.createElement('option', { value: 'EUR' }, 'EUR'),
                            React.createElement('option', { value: 'GBP' }, 'GBP'),
                            React.createElement('option', { value: 'ZAR' }, 'ZAR')
                          )
                        )
                      ),

                      // Total Cost Display
                      React.createElement('div', {
                        className: "p-3 rounded-lg",
                        style: {
                          backgroundColor: 'rgba(34, 197, 94, 0.1)', // green with 10% opacity
                          borderLeft: '4px solid rgb(34, 197, 94)'
                        }
                      },
                        React.createElement('span', {
                          className: "font-semibold",
                          style: { color: 'rgb(21, 128, 61)' } // green-700
                        }, 'Total Cost: '),
                        React.createElement('span', {
                          className: "text-lg font-bold",
                          style: { color: 'rgb(21, 128, 61)' }
                        }, `${((parseFloat(editForm.quantity) || 0) * (parseFloat(editForm.unit_price) || 0)).toLocaleString()} ${editForm.vendor_currency}`)
                      ),

                      // Action Buttons
                      React.createElement('div', { className: "flex gap-3 justify-end pt-4 border-t", style: { borderColor: 'var(--border-color)' } },
                        React.createElement('button', {
                          onClick: handleCancelEdit,
                          disabled: saving,
                          className: "px-6 py-2 border rounded-lg font-medium transition-colors",
                          style: {
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-primary)'
                          }
                        }, 'Cancel'),
                        React.createElement('button', {
                          onClick: () => handleSaveEdit(req.id),
                          disabled: saving,
                          className: "px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                        }, saving ? 'Saving...' : '💾 Save Changes')
                      )
                    )
                  : React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                      React.createElement('div', null,
                        React.createElement('p', {
                          className: "text-sm font-semibold",
                          style: { color: 'var(--text-secondary)' }
                        }, 'Description:'),
                        React.createElement('p', {
                          className: "mt-1",
                          style: { color: 'var(--text-primary)' }
                        }, req.description || 'N/A')
                      ),
                      React.createElement('div', null,
                        React.createElement('p', {
                          className: "text-sm font-semibold",
                          style: { color: 'var(--text-secondary)' }
                        }, 'Delivery Location:'),
                        React.createElement('p', {
                          className: "mt-1",
                          style: { color: 'var(--text-primary)' }
                        }, req.delivery_location || 'N/A')
                      ),
                      React.createElement('div', null,
                        React.createElement('p', {
                          className: "text-sm font-semibold",
                          style: { color: 'var(--text-secondary)' }
                        }, 'Urgency:'),
                        React.createElement('p', {
                          className: "mt-1",
                          style: { color: 'var(--text-primary)' }
                        }, req.urgency || 'Standard')
                      ),
                      React.createElement('div', null,
                        React.createElement('p', {
                          className: "text-sm font-semibold",
                          style: { color: 'var(--text-secondary)' }
                        }, 'Required Date:'),
                        React.createElement('p', {
                          className: "mt-1",
                          style: { color: 'var(--text-primary)' }
                        }, req.required_date || 'N/A')
                      ),
                      React.createElement('div', null,
                        React.createElement('p', {
                          className: "text-sm font-semibold",
                          style: { color: 'var(--text-secondary)' }
                        }, 'Account Code:'),
                        React.createElement('p', {
                          className: "mt-1",
                          style: { color: 'var(--text-primary)' }
                        }, req.account_code || 'N/A')
                      ),
                      React.createElement('div', null,
                        React.createElement('p', {
                          className: "text-sm font-semibold",
                          style: { color: 'var(--text-secondary)' }
                        }, 'Quantity:'),
                        React.createElement('p', {
                          className: "mt-1",
                          style: { color: 'var(--text-primary)' }
                        }, req.quantity || 'N/A')
                      ),
                      React.createElement('div', null,
                        React.createElement('p', {
                          className: "text-sm font-semibold",
                          style: { color: 'var(--text-secondary)' }
                        }, 'Unit Price:'),
                        React.createElement('p', {
                          className: "mt-1 font-semibold",
                          style: { color: 'var(--text-primary)' }
                        }, req.unit_price ? `${parseFloat(req.unit_price).toLocaleString()} ${req.vendor_currency || 'ZMW'}` : 'N/A')
                      ),
                      React.createElement('div', null,
                        React.createElement('p', {
                          className: "text-sm font-semibold",
                          style: { color: 'var(--text-secondary)' }
                        }, 'Vendor:'),
                        React.createElement('p', {
                          className: "mt-1",
                          style: { color: 'var(--text-primary)' }
                        }, req.selected_vendor || 'N/A')
                      )
                    )
              )
            )
          )
    )
  );
}

// Purchase Orders Component
function PurchaseOrders({ user }) {
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPOs();
  }, []);

  const loadPOs = async () => {
    setLoading(true);
    try {
      const data = await api.getPurchaseOrders();
      setPOs(data);
    } catch (error) {
      console.error('Error loading POs:', error);
      alert('Failed to load Purchase Orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (po) => {
    try {
      const blob = await api.downloadPOPDF(po.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PO_${po.po_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PO PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  if (loading) {
    return React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('p', { className: "text-center text-gray-600" }, "Loading Purchase Orders...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h2', { className: "text-2xl font-bold text-gray-800 mb-6" }, "📄 Purchase Orders"),

      pos.length === 0
        ? React.createElement('div', { className: "text-center py-12" },
            React.createElement('p', { className: "text-gray-500 text-lg mb-2" }, "No Purchase Orders Found"),
            React.createElement('p', { className: "text-gray-400 text-sm" },
              user.role === 'initiator'
                ? "You'll see Purchase Orders here once your requisitions are approved by MD"
                : "Purchase Orders will appear here once requisitions are approved by MD"
            )
          )
        : React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "PO Number"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Requisition"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Description"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Department"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Total Amount"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Created"),
                  React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Action")
                )
              ),
              React.createElement('tbody', { className: "divide-y divide-gray-200" },
                pos.map(po =>
                  React.createElement('tr', { key: po.id, className: "hover:bg-gray-50" },
                    React.createElement('td', { className: "px-6 py-4" },
                      React.createElement('span', { className: "text-sm font-medium text-blue-600" }, po.po_number)
                    ),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-700" }, po.req_number),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-700" },
                      React.createElement('div', { className: "max-w-xs truncate", title: po.description }, po.description || 'N/A')
                    ),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-700" }, po.department),
                    React.createElement('td', { className: "px-6 py-4 text-sm font-semibold text-gray-900" },
                      `ZMW ${(po.total_amount || 0).toLocaleString()}`
                    ),
                    React.createElement('td', { className: "px-6 py-4 text-sm text-gray-500" },
                      new Date(po.created_at).toLocaleDateString()
                    ),
                    React.createElement('td', { className: "px-6 py-4" },
                      React.createElement('button', {
                        onClick: () => handleDownloadPDF(po),
                        className: "px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      }, "⬇️ Download PDF")
                    )
                  )
                )
              )
            )
          )
    )
  );
}

function BudgetManagement({ user }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState('2025');
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptDetails, setDeptDetails] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);
  const [newAllocation, setNewAllocation] = useState('');

  useEffect(() => {
    loadBudgets();
  }, [fiscalYear]);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const data = await api.getBudgetOverview(fiscalYear);
      setBudgets(data);
    } catch (error) {
      alert('Failed to load budgets: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDeptDetails = async (department) => {
    try {
      const data = await api.getDepartmentBudget(department, fiscalYear);
      setDeptDetails(data);
      setSelectedDept(department);
    } catch (error) {
      alert('Failed to load department details: ' + error.message);
    }
  };

  const handleUpdateAllocation = async (budgetId) => {
    if (!newAllocation || newAllocation <= 0) {
      alert('Please enter a valid allocation amount');
      return;
    }
    try {
      await api.updateBudgetAllocation(budgetId, parseFloat(newAllocation));
      alert('Budget allocation updated successfully');
      setEditingBudget(null);
      setNewAllocation('');
      loadBudgets();
      if (selectedDept) {
        loadDeptDetails(selectedDept);
      }
    } catch (error) {
      alert('Failed to update budget allocation: ' + error.message);
    }
  };

  const getUtilizationColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50';
    if (percentage >= 75) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('p', { className: "text-center text-gray-600" }, "Loading budget data...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Budget Management"),
        React.createElement('div', { className: "flex items-center gap-4" },
          React.createElement('select', {
            value: fiscalYear,
            onChange: (e) => setFiscalYear(e.target.value),
            className: "px-4 py-2 border border-gray-300 rounded-lg"
          },
            React.createElement('option', { value: "2024" }, "FY 2024"),
            React.createElement('option', { value: "2025" }, "FY 2025"),
            React.createElement('option', { value: "2026" }, "FY 2026")
          ),
          React.createElement('button', {
            onClick: () => api.downloadBudgetExcel(fiscalYear),
            className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          }, "Download Excel"),
          React.createElement('button', {
            onClick: () => api.downloadBudgetPDF(fiscalYear),
            className: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          }, "Download PDF")
        )
      ),
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" },
        budgets.map(budget =>
          React.createElement('div', {
            key: budget.id,
            className: "p-4 border rounded-lg hover:shadow-md transition-shadow"
          },
            React.createElement('h3', {
              onClick: () => loadDeptDetails(budget.department),
              className: "font-semibold text-gray-800 mb-2 cursor-pointer hover:text-blue-600"
            }, budget.department),
            editingBudget === budget.id ? React.createElement('div', { className: "space-y-2 mb-2" },
              React.createElement('input', {
                type: "number",
                value: newAllocation,
                onChange: (e) => setNewAllocation(e.target.value),
                placeholder: "New allocation",
                className: "w-full px-2 py-1 border rounded text-sm"
              }),
              React.createElement('div', { className: "flex gap-1" },
                React.createElement('button', {
                  onClick: () => handleUpdateAllocation(budget.id),
                  className: "flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                }, "Save"),
                React.createElement('button', {
                  onClick: () => {
                    setEditingBudget(null);
                    setNewAllocation('');
                  },
                  className: "flex-1 px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                }, "Cancel")
              )
            ) : React.createElement('div', null,
              React.createElement('p', { className: "text-sm text-gray-600 mb-1" },
                `Allocated: ZMW ${(budget.allocated_amount || 0).toLocaleString()}`
              ),
              React.createElement('p', { className: "text-sm text-gray-600 mb-1" },
                `Committed: ZMW ${(budget.committed_amount || 0).toLocaleString()}`
              ),
              React.createElement('p', { className: "text-sm text-gray-600 mb-2" },
                `Available: ZMW ${(budget.available_amount || 0).toLocaleString()}`
              )
            ),
            React.createElement('div', {
              className: `px-3 py-1 rounded-full text-xs font-semibold mb-2 ${getUtilizationColor(budget.utilization_percentage || 0)}`
            }, `${(budget.utilization_percentage || 0).toFixed(1)}% Used`),
            React.createElement('div', { className: "flex gap-1 mt-2" },
              (user.role === 'finance' || user.role === 'md' || user.role === 'admin') && editingBudget !== budget.id && React.createElement('button', {
                onClick: () => {
                  setEditingBudget(budget.id);
                  setNewAllocation(budget.allocated_amount);
                },
                className: "flex-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
              }, "Edit"),
              React.createElement('button', {
                onClick: () => api.downloadDepartmentPDF(budget.department, fiscalYear),
                className: "flex-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
              }, "PDF")
            )
          )
        )
      )
    ),
    selectedDept && deptDetails && React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h3', { className: "text-xl font-bold text-gray-800 mb-4" },
        `${selectedDept} Department - Detailed View`
      ),
      React.createElement('div', { className: "mb-4" },
        React.createElement('p', { className: "text-sm text-gray-600" },
          `Budget: ZMW ${(deptDetails.budget.allocated_amount || 0).toLocaleString()} | `,
          `Committed: ZMW ${(deptDetails.budget.committed_amount || 0).toLocaleString()} | `,
          `Available: ZMW ${(deptDetails.budget.available_amount || 0).toLocaleString()}`
        )
      ),
      deptDetails.expenses.length > 0 ? React.createElement('table', { className: "w-full" },
        React.createElement('thead', null,
          React.createElement('tr', { className: "border-b" },
            React.createElement('th', { className: "text-left py-2 px-4" }, "Requisition"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Title"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Amount (ZMW)"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Type"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Date")
          )
        ),
        React.createElement('tbody', null,
          deptDetails.expenses.map(expense =>
            React.createElement('tr', { key: expense.id, className: "border-b hover:bg-gray-50" },
              React.createElement('td', { className: "py-2 px-4" }, expense.req_number),
              React.createElement('td', { className: "py-2 px-4" }, expense.title),
              React.createElement('td', { className: "py-2 px-4" }, (expense.amount || 0).toLocaleString()),
              React.createElement('td', { className: "py-2 px-4" },
                React.createElement('span', {
                  className: `px-2 py-1 rounded-full text-xs ${expense.expense_type === 'committed' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`
                }, expense.expense_type)
              ),
              React.createElement('td', { className: "py-2 px-4 text-sm text-gray-600" },
                new Date(expense.created_at).toLocaleDateString()
              )
            )
          )
        )
      ) : React.createElement('p', { className: "text-gray-600 text-center py-4" }, "No expenses recorded for this department")
    )
  );
}

function FXRatesManagement({ user }) {
  const [rates, setRates] = useState([]);
  const [allRates, setAllRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [formData, setFormData] = useState({
    currency_code: 'USD',
    currency_name: 'US Dollar',
    rate_to_zmw: '',
    effective_from: new Date().toISOString().split('T')[0],
    change_reason: ''
  });

  useEffect(() => {
    loadRates();
    if (user.role === 'finance' || user.role === 'md' || user.role === 'admin') {
      loadAllRates();
    }
  }, []);

  const loadRates = async () => {
    setLoading(true);
    try {
      const data = await api.getFXRates();
      setRates(data);
    } catch (error) {
      alert('Failed to load FX rates: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAllRates = async () => {
    try {
      const data = await api.getAllFXRates();
      setAllRates(data);
    } catch (error) {
      console.error('Failed to load all FX rates:', error.message);
    }
  };

  const loadHistory = async (currencyCode) => {
    try {
      const data = await api.getFXRateHistory(currencyCode);
      setHistory(data);
      setSelectedCurrency(currencyCode);
      setShowHistory(true);
    } catch (error) {
      alert('Failed to load FX rate history: ' + error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.updateFXRate(formData);
      alert('FX rate updated successfully');
      loadRates();
      if (user.role === 'finance' || user.role === 'md' || user.role === 'admin') {
        loadAllRates();
      }
      setFormData({
        currency_code: 'USD',
        currency_name: 'US Dollar',
        rate_to_zmw: '',
        effective_from: new Date().toISOString().split('T')[0],
        change_reason: ''
      });
    } catch (error) {
      alert('Failed to update FX rate: ' + error.message);
    }
  };

  const handleDeactivate = async (rateId) => {
    if (!confirm('Are you sure you want to deactivate this FX rate?')) return;
    try {
      await api.deactivateFXRate(rateId);
      alert('FX rate deactivated successfully');
      loadRates();
      loadAllRates();
    } catch (error) {
      alert('Failed to deactivate FX rate: ' + error.message);
    }
  };

  if (loading) {
    return React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('p', { className: "text-center text-gray-600" }, "Loading FX rates...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "FX Rate Management"),
        React.createElement('button', {
          onClick: () => api.downloadFXRatesExcel(),
          className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        }, "Download Excel Report")
      ),
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" },
        rates.map(rate =>
          React.createElement('div', { key: rate.id, className: "p-4 border rounded-lg" },
            React.createElement('div', { className: "flex items-center justify-between mb-2" },
              React.createElement('h3', { className: "text-xl font-bold text-gray-800" }, rate.currency_code),
              rate.is_active && React.createElement('span', { className: "px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full" }, "Active")
            ),
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, rate.currency_name),
            React.createElement('p', { className: "text-2xl font-bold text-blue-600" },
              `1 ${rate.currency_code} = ${rate.rate_to_zmw} ZMW`
            ),
            React.createElement('p', { className: "text-xs text-gray-500 mt-2" },
              `Updated: ${new Date(rate.updated_at).toLocaleDateString()}`
            ),
            React.createElement('p', { className: "text-xs text-gray-500" },
              `By: ${rate.updated_by_name}`
            ),
            React.createElement('div', { className: "flex gap-2 mt-3" },
              (user.role === 'finance' || user.role === 'md' || user.role === 'admin') && React.createElement('button', {
                onClick: () => loadHistory(rate.currency_code),
                className: "flex-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
              }, "View History"),
              (user.role === 'finance' || user.role === 'md' || user.role === 'admin') && rate.is_active && React.createElement('button', {
                onClick: () => handleDeactivate(rate.id),
                className: "flex-1 px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
              }, "Deactivate")
            )
          )
        )
      )
    ),
    showHistory && React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-4" },
        React.createElement('h3', { className: "text-xl font-bold text-gray-800" },
          `Rate History - ${selectedCurrency}`
        ),
        React.createElement('button', {
          onClick: () => setShowHistory(false),
          className: "px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        }, "Close")
      ),
      history.length > 0 ? React.createElement('table', { className: "w-full" },
        React.createElement('thead', null,
          React.createElement('tr', { className: "border-b" },
            React.createElement('th', { className: "text-left py-2 px-4" }, "Date"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Old Rate"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "New Rate"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Changed By"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Reason")
          )
        ),
        React.createElement('tbody', null,
          history.map((item, idx) =>
            React.createElement('tr', { key: idx, className: "border-b hover:bg-gray-50" },
              React.createElement('td', { className: "py-2 px-4 text-sm" },
                new Date(item.created_at).toLocaleString()
              ),
              React.createElement('td', { className: "py-2 px-4" }, item.old_rate),
              React.createElement('td', { className: "py-2 px-4 font-semibold" }, item.new_rate),
              React.createElement('td', { className: "py-2 px-4 text-sm" }, item.changed_by_name),
              React.createElement('td', { className: "py-2 px-4 text-sm text-gray-600" }, item.change_reason)
            )
          )
        )
      ) : React.createElement('p', { className: "text-gray-600 text-center py-4" }, "No history available")
    ),
    (user.role === 'finance' || user.role === 'md' || user.role === 'admin') && allRates.length > 0 && React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h3', { className: "text-xl font-bold text-gray-800 mb-4" }, "All FX Rates (Including Inactive)"),
      React.createElement('table', { className: "w-full" },
        React.createElement('thead', null,
          React.createElement('tr', { className: "border-b" },
            React.createElement('th', { className: "text-left py-2 px-4" }, "Currency"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Rate to ZMW"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Status"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Effective From"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Updated"),
            React.createElement('th', { className: "text-left py-2 px-4" }, "Updated By")
          )
        ),
        React.createElement('tbody', null,
          allRates.map(rate =>
            React.createElement('tr', { key: `${rate.id}-${rate.created_at}`, className: "border-b hover:bg-gray-50" },
              React.createElement('td', { className: "py-2 px-4 font-semibold" },
                `${rate.currency_code} - ${rate.currency_name}`
              ),
              React.createElement('td', { className: "py-2 px-4" }, rate.rate_to_zmw),
              React.createElement('td', { className: "py-2 px-4" },
                React.createElement('span', {
                  className: `px-2 py-1 rounded-full text-xs ${rate.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`
                }, rate.is_active ? 'Active' : 'Inactive')
              ),
              React.createElement('td', { className: "py-2 px-4 text-sm" },
                new Date(rate.effective_from).toLocaleDateString()
              ),
              React.createElement('td', { className: "py-2 px-4 text-sm" },
                new Date(rate.updated_at).toLocaleDateString()
              ),
              React.createElement('td', { className: "py-2 px-4 text-sm" }, rate.updated_by_name)
            )
          )
        )
      )
    ),
    (user.role === 'finance' || user.role === 'md' || user.role === 'procurement' || user.role === 'admin') &&
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h3', { className: "text-xl font-bold text-gray-800 mb-4" }, "Update FX Rate"),
      React.createElement('form', { onSubmit: handleSubmit, className: "space-y-4" },
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Currency"),
            React.createElement('select', {
              value: formData.currency_code,
              onChange: (e) => {
                const code = e.target.value;
                const names = { 'USD': 'US Dollar', 'EUR': 'Euro', 'ZAR': 'South African Rand', 'ZMW': 'Zambian Kwacha' };
                setFormData({ ...formData, currency_code: code, currency_name: names[code] });
              },
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg"
            },
              React.createElement('option', { value: "USD" }, "USD - US Dollar"),
              React.createElement('option', { value: "EUR" }, "EUR - Euro"),
              React.createElement('option', { value: "ZAR" }, "ZAR - South African Rand"),
              React.createElement('option', { value: "ZMW" }, "ZMW - Zambian Kwacha")
            )
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Rate to ZMW"),
            React.createElement('input', {
              type: "number",
              step: "0.01",
              required: true,
              value: formData.rate_to_zmw,
              onChange: (e) => setFormData({ ...formData, rate_to_zmw: e.target.value }),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Effective From"),
            React.createElement('input', {
              type: "date",
              required: true,
              value: formData.effective_from,
              onChange: (e) => setFormData({ ...formData, effective_from: e.target.value }),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Reason for Change"),
            React.createElement('input', {
              type: "text",
              required: true,
              value: formData.change_reason,
              onChange: (e) => setFormData({ ...formData, change_reason: e.target.value }),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg",
              placeholder: "e.g., Monthly update based on BOZ rate"
            })
          )
        ),
        React.createElement('button', {
          type: "submit",
          className: "w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
        }, "Update FX Rate")
      )
    )
  );
}

// ============================================
// QUOTES AND ADJUDICATION MANAGEMENT
// ============================================

function QuotesAndAdjudication({ user, setView, loadData }) {
  const [requisitions, setRequisitions] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [adjudication, setAdjudication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showAdjudicationForm, setShowAdjudicationForm] = useState(false);
  const [vendors, setVendors] = useState([]);

  // Three separate quote forms
  const [quote1, setQuote1] = useState({
    vendor_id: '',
    vendor_name: '',
    quote_number: '',
    quote_amount: '',
    currency: 'ZMW',
    notes: '',
    file: null
  });

  const [quote2, setQuote2] = useState({
    vendor_id: '',
    vendor_name: '',
    quote_number: '',
    quote_amount: '',
    currency: 'ZMW',
    notes: '',
    file: null
  });

  const [quote3, setQuote3] = useState({
    vendor_id: '',
    vendor_name: '',
    quote_number: '',
    quote_amount: '',
    currency: 'ZMW',
    notes: '',
    file: null
  });

  const [adjForm, setAdjForm] = useState({
    recommended_vendor_id: '',
    recommended_vendor_name: '',
    recommended_amount: '',
    currency: 'ZMW',
    summary: '',
    evaluation_criteria: '',
    technical_compliance: '',
    pricing_analysis: '',
    delivery_terms: '',
    payment_terms: '',
    recommendation_rationale: ''
  });

  // Load requisitions and vendors
  useEffect(() => {
    loadRequisitions();
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const response = await fetch(`${API_URL}/vendors`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });
      const data = await response.json();
      console.log('Vendors loaded:', data);
      // Filter active vendors (status === 'active')
      const activeVendors = Array.isArray(data) ? data.filter(v => v.status === 'active') : [];
      console.log('Active vendors:', activeVendors);
      setVendors(activeVendors);
    } catch (error) {
      console.error('Error loading vendors:', error);
      setVendors([]);
    }
  };

  const loadRequisitions = async () => {
    setLoading(true);
    try {
      const data = await api.getRequisitions();
      // Filter requisitions that need quotes/adjudication or are in later stages
      const filtered = data.filter(r =>
        r.status === 'pending_procurement' || r.status === 'pending_finance' || r.status === 'pending_md' || r.status === 'approved'
      );
      setRequisitions(filtered);
    } catch (error) {
      console.error('Error loading requisitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuotesForReq = async (reqId) => {
    try {
      const quotesData = await api.getQuotes(reqId);
      setQuotes(quotesData);

      // Load adjudication if exists
      try {
        const adjData = await api.getAdjudication(reqId);
        setAdjudication(adjData);
      } catch (e) {
        setAdjudication(null);
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
      setQuotes([]);
    }
  };

  const handleSelectRequisition = async (req) => {
    setSelectedReq(req);
    await loadQuotesForReq(req.id);
    setShowUploadForm(false);
    setShowAdjudicationForm(false);
  };

  const handleVendorChange = (quoteNum, vendorId) => {
    const vendor = vendors.find(v => v.id == vendorId);
    const setter = quoteNum === 1 ? setQuote1 : quoteNum === 2 ? setQuote2 : setQuote3;
    const quote = quoteNum === 1 ? quote1 : quoteNum === 2 ? quote2 : quote3;

    if (vendor) {
      setter({
        ...quote,
        vendor_id: vendor.id,
        vendor_name: vendor.name
      });
    }
  };

  const handleFileChange = (e, quoteNum) => {
    const file = e.target.files[0];
    const setter = quoteNum === 1 ? setQuote1 : quoteNum === 2 ? setQuote2 : setQuote3;
    const quote = quoteNum === 1 ? quote1 : quoteNum === 2 ? quote2 : quote3;

    if (file && file.type === 'application/pdf') {
      setter({ ...quote, file });
    } else {
      alert('Please select a PDF file');
      e.target.value = '';
    }
  };

  const handleUploadAllQuotes = async (e) => {
    e.preventDefault();

    // Validate all 3 quotes
    if (!quote1.vendor_id || !quote1.quote_amount || !quote1.file) {
      alert('Please complete Quote 1 (Vendor, Amount, and PDF required)');
      return;
    }
    if (!quote2.vendor_id || !quote2.quote_amount || !quote2.file) {
      alert('Please complete Quote 2 (Vendor, Amount, and PDF required)');
      return;
    }
    if (!quote3.vendor_id || !quote3.quote_amount || !quote3.file) {
      alert('Please complete Quote 3 (Vendor, Amount, and PDF required)');
      return;
    }

    setUploading(true);
    try {
      // Upload all 3 quotes
      for (const quoteData of [quote1, quote2, quote3]) {
        const formData = new FormData();
        formData.append('quoteFile', quoteData.file);
        formData.append('vendor_id', quoteData.vendor_id);
        formData.append('vendor_name', quoteData.vendor_name);
        formData.append('quote_number', quoteData.quote_number);
        formData.append('quote_amount', quoteData.quote_amount);
        formData.append('currency', quoteData.currency);
        formData.append('notes', quoteData.notes);

        await api.uploadQuote(selectedReq.id, formData);
      }

      alert('All 3 quotes uploaded successfully! You can now create the adjudication.');

      // Reset forms
      const emptyQuote = { vendor_id: '', vendor_name: '', quote_number: '', quote_amount: '', currency: 'ZMW', notes: '', file: null };
      setQuote1({...emptyQuote});
      setQuote2({...emptyQuote});
      setQuote3({...emptyQuote});

      // Reload quotes
      await loadQuotesForReq(selectedReq.id);
      setShowUploadForm(false);
    } catch (error) {
      alert('Error uploading quotes: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!confirm('Are you sure you want to delete this quote?')) return;

    try {
      await api.deleteQuote(quoteId);
      alert('Quote deleted successfully');
      await loadQuotesForReq(selectedReq.id);
    } catch (error) {
      alert('Error deleting quote: ' + error.message);
    }
  };

  const handleSubmitAdjudication = async (e) => {
    e.preventDefault();

    if (quotes.length < 3) {
      alert('Please upload all 3 vendor quotes before creating adjudication');
      return;
    }

    setUploading(true);
    try {
      await api.createAdjudication(selectedReq.id, adjForm);
      alert('Adjudication created successfully and sent to Finance for review!');
      await loadRequisitions(); // Reload list as status changed
      setSelectedReq(null);
      setShowAdjudicationForm(false);
    } catch (error) {
      alert('Error creating adjudication: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const canUploadQuotes = user.role === 'procurement' || user.role === 'admin';
  const canViewQuotes = user.role === 'procurement' || user.role === 'finance' || user.role === 'md' || user.role === 'admin';

  if (loading) {
    return React.createElement('div', { className: "flex items-center justify-center p-8" },
      React.createElement('p', { className: "text-gray-600" }, "Loading requisitions...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h2', { className: "text-2xl font-bold text-gray-800 mb-4" }, "Quotes & Adjudication Management"),

      // Requisitions list
      !selectedReq && React.createElement('div', null,
        React.createElement('p', { className: "text-gray-600 mb-4" },
          canUploadQuotes
            ? "Upload 3 vendor quotes (PDF) for HOD-approved requisitions, then create the adjudication summary"
            : "View vendor quotes and adjudication details for requisitions"
        ),
        React.createElement('div', { className: "space-y-3" },
          requisitions.length === 0
            ? React.createElement('p', { className: "text-center text-gray-500 py-8" }, "No requisitions available for quotes")
            : requisitions.map(req =>
                React.createElement('div', {
                  key: req.id,
                  onClick: () => handleSelectRequisition(req),
                  className: "p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                },
                  React.createElement('div', { className: "flex justify-between items-start" },
                    React.createElement('div', null,
                      React.createElement('h3', { className: "font-semibold text-gray-900" }, req.req_number || req.id),
                      React.createElement('p', { className: "text-sm text-gray-600" }, req.title || req.description),
                      React.createElement('div', { className: "flex gap-2 mt-2" },
                        React.createElement('span', { className: "text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded" }, req.department),
                        req.status === 'pending_procurement' && !req.has_quotes && React.createElement('span', { className: "text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded" }, "⚠ Needs Quotes"),
                        req.has_quotes && React.createElement('span', { className: "text-xs px-2 py-1 bg-green-100 text-green-700 rounded" }, "✓ Quotes"),
                        req.has_adjudication && React.createElement('span', { className: "text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded" }, "✓ Adjudication")
                      )
                    ),
                    React.createElement('button', {
                      className: "text-blue-600 hover:text-blue-800"
                    }, "View →")
                  )
                )
              )
        )
      ),

      // Selected requisition view
      selectedReq && React.createElement('div', null,
        React.createElement('div', { className: "flex items-center justify-between mb-6" },
          React.createElement('div', null,
            React.createElement('button', {
              onClick: () => {
                setSelectedReq(null);
                setQuotes([]);
                setAdjudication(null);
              },
              className: "text-blue-600 hover:text-blue-800 mb-2"
            }, "← Back to List"),
            React.createElement('h3', { className: "text-xl font-bold text-gray-900" }, selectedReq.req_number || selectedReq.id),
            React.createElement('p', { className: "text-sm text-gray-600" }, selectedReq.title || selectedReq.description)
          ),
          canUploadQuotes && quotes.length < 3 && React.createElement('button', {
            onClick: () => setShowUploadForm(!showUploadForm),
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, showUploadForm ? "Cancel" : "Upload Quote")
        ),

        // Three-Form Upload Section
        showUploadForm && canUploadQuotes && React.createElement('form', {
          onSubmit: handleUploadAllQuotes,
          className: "bg-blue-50 p-6 rounded-lg border border-blue-200 mb-6"
        },
          React.createElement('h4', { className: "font-semibold text-gray-900 mb-4" }, "Upload 3 Vendor Quotes"),
          React.createElement('p', { className: "text-sm text-gray-600 mb-4" }, "Fill in all three quote forms below, then submit all at once"),

          // Grid of 3 forms
          React.createElement('div', { className: "grid grid-cols-3 gap-4 mb-6" },
            // Quote 1
            React.createElement('div', { className: "bg-white p-4 rounded-lg border-2 border-purple-300" },
              React.createElement('h5', { className: "font-semibold text-purple-900 mb-3" }, "Quote 1"),
              React.createElement('div', { className: "space-y-3" },
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Vendor *"),
                  React.createElement('select', {
                    required: true,
                    value: quote1.vendor_id,
                    onChange: (e) => handleVendorChange(1, e.target.value),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  },
                    React.createElement('option', { value: "" }, "-- Select Vendor --"),
                    vendors.map(v => React.createElement('option', { key: v.id, value: v.id }, v.name))
                  )
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Quote #"),
                  React.createElement('input', {
                    type: "text",
                    value: quote1.quote_number,
                    onChange: (e) => setQuote1({ ...quote1, quote_number: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Amount *"),
                  React.createElement('input', {
                    type: "number",
                    step: "0.01",
                    required: true,
                    value: quote1.quote_amount,
                    onChange: (e) => setQuote1({ ...quote1, quote_amount: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Currency"),
                  React.createElement('select', {
                    value: quote1.currency,
                    onChange: (e) => setQuote1({ ...quote1, currency: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  },
                    React.createElement('option', { value: "ZMW" }, "ZMW"),
                    React.createElement('option', { value: "USD" }, "USD"),
                    React.createElement('option', { value: "EUR" }, "EUR"),
                    React.createElement('option', { value: "ZAR" }, "ZAR")
                  )
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "PDF File *"),
                  React.createElement('input', {
                    type: "file",
                    accept: ".pdf",
                    required: true,
                    onChange: (e) => handleFileChange(e, 1),
                    className: "w-full text-xs"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Notes"),
                  React.createElement('textarea', {
                    rows: "2",
                    value: quote1.notes,
                    onChange: (e) => setQuote1({ ...quote1, notes: e.target.value }),
                    className: "w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                  })
                )
              )
            ),

            // Quote 2
            React.createElement('div', { className: "bg-white p-4 rounded-lg border-2 border-green-300" },
              React.createElement('h5', { className: "font-semibold text-green-900 mb-3" }, "Quote 2"),
              React.createElement('div', { className: "space-y-3" },
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Vendor *"),
                  React.createElement('select', {
                    required: true,
                    value: quote2.vendor_id,
                    onChange: (e) => handleVendorChange(2, e.target.value),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  },
                    React.createElement('option', { value: "" }, "-- Select Vendor --"),
                    vendors.map(v => React.createElement('option', { key: v.id, value: v.id }, v.name))
                  )
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Quote #"),
                  React.createElement('input', {
                    type: "text",
                    value: quote2.quote_number,
                    onChange: (e) => setQuote2({ ...quote2, quote_number: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Amount *"),
                  React.createElement('input', {
                    type: "number",
                    step: "0.01",
                    required: true,
                    value: quote2.quote_amount,
                    onChange: (e) => setQuote2({ ...quote2, quote_amount: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Currency"),
                  React.createElement('select', {
                    value: quote2.currency,
                    onChange: (e) => setQuote2({ ...quote2, currency: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  },
                    React.createElement('option', { value: "ZMW" }, "ZMW"),
                    React.createElement('option', { value: "USD" }, "USD"),
                    React.createElement('option', { value: "EUR" }, "EUR"),
                    React.createElement('option', { value: "ZAR" }, "ZAR")
                  )
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "PDF File *"),
                  React.createElement('input', {
                    type: "file",
                    accept: ".pdf",
                    required: true,
                    onChange: (e) => handleFileChange(e, 2),
                    className: "w-full text-xs"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Notes"),
                  React.createElement('textarea', {
                    rows: "2",
                    value: quote2.notes,
                    onChange: (e) => setQuote2({ ...quote2, notes: e.target.value }),
                    className: "w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                  })
                )
              )
            ),

            // Quote 3
            React.createElement('div', { className: "bg-white p-4 rounded-lg border-2 border-orange-300" },
              React.createElement('h5', { className: "font-semibold text-orange-900 mb-3" }, "Quote 3"),
              React.createElement('div', { className: "space-y-3" },
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Vendor *"),
                  React.createElement('select', {
                    required: true,
                    value: quote3.vendor_id,
                    onChange: (e) => handleVendorChange(3, e.target.value),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  },
                    React.createElement('option', { value: "" }, "-- Select Vendor --"),
                    vendors.map(v => React.createElement('option', { key: v.id, value: v.id }, v.name))
                  )
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Quote #"),
                  React.createElement('input', {
                    type: "text",
                    value: quote3.quote_number,
                    onChange: (e) => setQuote3({ ...quote3, quote_number: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Amount *"),
                  React.createElement('input', {
                    type: "number",
                    step: "0.01",
                    required: true,
                    value: quote3.quote_amount,
                    onChange: (e) => setQuote3({ ...quote3, quote_amount: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Currency"),
                  React.createElement('select', {
                    value: quote3.currency,
                    onChange: (e) => setQuote3({ ...quote3, currency: e.target.value }),
                    className: "w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  },
                    React.createElement('option', { value: "ZMW" }, "ZMW"),
                    React.createElement('option', { value: "USD" }, "USD"),
                    React.createElement('option', { value: "EUR" }, "EUR"),
                    React.createElement('option', { value: "ZAR" }, "ZAR")
                  )
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "PDF File *"),
                  React.createElement('input', {
                    type: "file",
                    accept: ".pdf",
                    required: true,
                    onChange: (e) => handleFileChange(e, 3),
                    className: "w-full text-xs"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-xs font-medium text-gray-700 mb-1" }, "Notes"),
                  React.createElement('textarea', {
                    rows: "2",
                    value: quote3.notes,
                    onChange: (e) => setQuote3({ ...quote3, notes: e.target.value }),
                    className: "w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                  })
                )
              )
            )
          ),

          // Submit button
          React.createElement('button', {
            type: "submit",
            disabled: uploading,
            className: "w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
          }, uploading ? "Uploading All Quotes..." : "Upload All 3 Quotes")
        ),

        // Quotes list
        React.createElement('div', { className: "mb-6" },
          React.createElement('h4', { className: "font-semibold text-gray-900 mb-3" }, `Vendor Quotes (${quotes.length}/3)`),
          quotes.length === 0
            ? React.createElement('p', { className: "text-gray-500 text-center py-4" }, "No quotes uploaded yet")
            : React.createElement('div', { className: "space-y-3" },
                quotes.map((quote, idx) =>
                  React.createElement('div', {
                    key: quote.id,
                    className: "p-4 border rounded-lg bg-gray-50"
                  },
                    React.createElement('div', { className: "flex justify-between items-start" },
                      React.createElement('div', null,
                        React.createElement('h5', { className: "font-semibold text-gray-900" }, `Quote ${idx + 1}: ${quote.vendor_name}`),
                        React.createElement('p', { className: "text-sm text-gray-600" }, `Amount: ${quote.currency} ${parseFloat(quote.quote_amount).toLocaleString()}`),
                        quote.quote_number && React.createElement('p', { className: "text-sm text-gray-600" }, `Quote #: ${quote.quote_number}`),
                        React.createElement('p', { className: "text-xs text-gray-500 mt-1" }, `Uploaded: ${new Date(quote.uploaded_at).toLocaleString()}`)
                      ),
                      React.createElement('div', { className: "flex gap-2" },
                        React.createElement('button', {
                          onClick: () => api.downloadQuote(quote.id),
                          className: "px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        }, "Download PDF"),
                        canUploadQuotes && !adjudication && React.createElement('button', {
                          onClick: () => handleDeleteQuote(quote.id),
                          className: "px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        }, "Delete")
                      )
                    )
                  )
                )
              )
        ),

        // Adjudication section
        canUploadQuotes && quotes.length === 3 && !adjudication && React.createElement('div', { className: "border-t pt-6" },
          // Quotes Summary for Reference
          React.createElement('div', { className: "mb-6 bg-gray-50 p-4 rounded-lg" },
            React.createElement('h4', { className: "font-semibold text-gray-900 mb-3" }, "📊 Uploaded Quotes Summary"),
            React.createElement('p', { className: "text-sm text-gray-600 mb-3" }, "Review the quotes below before creating your adjudication:"),
            React.createElement('div', { className: "grid grid-cols-3 gap-3" },
              quotes.map((quote, idx) =>
                React.createElement('div', {
                  key: quote.id,
                  className: "bg-white p-3 rounded border"
                },
                  React.createElement('div', { className: "font-semibold text-sm text-gray-900 mb-1" }, `Quote ${idx + 1}: ${quote.vendor_name}`),
                  React.createElement('div', { className: "text-lg font-bold text-blue-600" }, `${quote.currency} ${parseFloat(quote.quote_amount).toLocaleString()}`),
                  quote.quote_number && React.createElement('div', { className: "text-xs text-gray-600 mt-1" }, `Quote #: ${quote.quote_number}`),
                  quote.notes && React.createElement('div', { className: "text-xs text-gray-500 mt-1" }, quote.notes),
                  React.createElement('a', {
                    href: `${API_URL}/quotes/${quote.id}/download`,
                    target: "_blank",
                    className: "text-xs text-blue-600 hover:underline mt-2 inline-block"
                  }, "View PDF →")
                )
              )
            )
          ),

          React.createElement('div', { className: "flex justify-between items-center mb-4" },
            React.createElement('h4', { className: "font-semibold text-gray-900" }, "Create Adjudication Summary"),
            React.createElement('button', {
              onClick: () => setShowAdjudicationForm(!showAdjudicationForm),
              className: "px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            }, showAdjudicationForm ? "Cancel" : "Create Adjudication")
          ),

          showAdjudicationForm && React.createElement('form', {
            onSubmit: handleSubmitAdjudication,
            className: "bg-purple-50 p-6 rounded-lg border border-purple-200 space-y-4"
          },
            React.createElement('p', { className: "text-sm text-gray-700 mb-4 bg-yellow-50 p-3 rounded border border-yellow-200" },
              "💡 Manually enter your analysis below. Review the quotes above and provide your professional assessment."
            ),
            React.createElement('div', { className: "grid grid-cols-3 gap-4" },
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Recommended Vendor *"),
                React.createElement('select', {
                  required: true,
                  value: adjForm.recommended_vendor_id,
                  onChange: (e) => {
                    const quote = quotes.find(q => q.vendor_id == e.target.value);
                    setAdjForm({
                      ...adjForm,
                      recommended_vendor_id: e.target.value,
                      recommended_vendor_name: quote ? quote.vendor_name : '',
                      currency: quote ? quote.currency : 'ZMW'
                    });
                  },
                  className: "w-full px-4 py-2 border border-gray-300 rounded-lg"
                },
                  React.createElement('option', { value: "" }, "-- Select Vendor --"),
                  quotes.map(q => React.createElement('option', { key: q.id, value: q.vendor_id },
                    q.vendor_name
                  ))
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Recommended Amount *"),
                React.createElement('input', {
                  type: "number",
                  step: "0.01",
                  required: true,
                  value: adjForm.recommended_amount,
                  onChange: (e) => setAdjForm({ ...adjForm, recommended_amount: e.target.value }),
                  placeholder: "Enter amount",
                  className: "w-full px-4 py-2 border border-gray-300 rounded-lg"
                })
              ),
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Currency"),
                React.createElement('select', {
                  value: adjForm.currency,
                  onChange: (e) => setAdjForm({ ...adjForm, currency: e.target.value }),
                  className: "w-full px-4 py-2 border border-gray-300 rounded-lg"
                },
                  React.createElement('option', { value: "ZMW" }, "ZMW"),
                  React.createElement('option', { value: "USD" }, "USD"),
                  React.createElement('option', { value: "EUR" }, "EUR"),
                  React.createElement('option', { value: "ZAR" }, "ZAR")
                )
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Executive Summary *"),
              React.createElement('textarea', {
                rows: "3",
                required: true,
                value: adjForm.summary,
                onChange: (e) => setAdjForm({ ...adjForm, summary: e.target.value }),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg",
                placeholder: "Brief summary of the adjudication process and quotes received..."
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Evaluation Criteria"),
              React.createElement('textarea', {
                rows: "2",
                value: adjForm.evaluation_criteria,
                onChange: (e) => setAdjForm({ ...adjForm, evaluation_criteria: e.target.value }),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg",
                placeholder: "Criteria used to evaluate quotes (price, quality, delivery, etc.)..."
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Technical Compliance"),
              React.createElement('textarea', {
                rows: "2",
                value: adjForm.technical_compliance,
                onChange: (e) => setAdjForm({ ...adjForm, technical_compliance: e.target.value }),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg",
                placeholder: "Assessment of technical specifications and compliance..."
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Pricing Analysis"),
              React.createElement('textarea', {
                rows: "3",
                value: adjForm.pricing_analysis,
                onChange: (e) => setAdjForm({ ...adjForm, pricing_analysis: e.target.value }),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg",
                placeholder: "Comparison of the 3 vendor quotes and pricing breakdown..."
              })
            ),
            React.createElement('div', { className: "grid grid-cols-2 gap-4" },
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Delivery Terms"),
                React.createElement('textarea', {
                  rows: "2",
                  value: adjForm.delivery_terms,
                  onChange: (e) => setAdjForm({ ...adjForm, delivery_terms: e.target.value }),
                  className: "w-full px-4 py-2 border border-gray-300 rounded-lg"
                })
              ),
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Payment Terms"),
                React.createElement('textarea', {
                  rows: "2",
                  value: adjForm.payment_terms,
                  onChange: (e) => setAdjForm({ ...adjForm, payment_terms: e.target.value }),
                  className: "w-full px-4 py-2 border border-gray-300 rounded-lg"
                })
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Recommendation Rationale *"),
              React.createElement('textarea', {
                rows: "4",
                required: true,
                value: adjForm.recommendation_rationale,
                onChange: (e) => setAdjForm({ ...adjForm, recommendation_rationale: e.target.value }),
                className: "w-full px-4 py-2 border border-gray-300 rounded-lg",
                placeholder: "Detailed justification for the recommended vendor..."
              })
            ),
            React.createElement('button', {
              type: "submit",
              disabled: uploading,
              className: "w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400"
            }, uploading ? "Submitting..." : "Submit Adjudication")
          )
        ),

        // View adjudication
        adjudication && React.createElement('div', { className: "border-t pt-6" },
          React.createElement('h4', { className: "font-semibold text-gray-900 mb-4 flex items-center gap-2" },
            "Adjudication Summary",
            React.createElement('span', { className: "text-xs px-2 py-1 bg-green-100 text-green-700 rounded" }, "✓ Complete")
          ),
          React.createElement('div', { className: "bg-green-50 p-6 rounded-lg border border-green-200 space-y-4" },
            React.createElement('div', { className: "pb-4 border-b" },
              React.createElement('h5', { className: "font-semibold text-lg text-gray-900 mb-2" }, "Recommended Vendor"),
              React.createElement('p', { className: "text-xl font-bold text-green-700" }, adjudication.recommended_vendor_name),
              React.createElement('p', { className: "text-lg text-gray-900" },
                `${adjudication.currency} ${parseFloat(adjudication.recommended_amount).toLocaleString()}`
              )
            ),
            React.createElement('div', null,
              React.createElement('h6', { className: "font-semibold text-gray-900 mb-1" }, "Executive Summary"),
              React.createElement('p', { className: "text-gray-700" }, adjudication.summary)
            ),
            adjudication.evaluation_criteria && React.createElement('div', null,
              React.createElement('h6', { className: "font-semibold text-gray-900 mb-1" }, "Evaluation Criteria"),
              React.createElement('p', { className: "text-gray-700" }, adjudication.evaluation_criteria)
            ),
            adjudication.technical_compliance && React.createElement('div', null,
              React.createElement('h6', { className: "font-semibold text-gray-900 mb-1" }, "Technical Compliance"),
              React.createElement('p', { className: "text-gray-700" }, adjudication.technical_compliance)
            ),
            adjudication.pricing_analysis && React.createElement('div', null,
              React.createElement('h6', { className: "font-semibold text-gray-900 mb-1" }, "Pricing Analysis"),
              React.createElement('p', { className: "text-gray-700 whitespace-pre-wrap" }, adjudication.pricing_analysis)
            ),
            adjudication.recommendation_rationale && React.createElement('div', null,
              React.createElement('h6', { className: "font-semibold text-gray-900 mb-1" }, "Recommendation Rationale"),
              React.createElement('p', { className: "text-gray-700" }, adjudication.recommendation_rationale)
            ),
            React.createElement('div', { className: "pt-4 border-t text-sm text-gray-600" },
              React.createElement('p', null, `Created by: ${adjudication.created_by_name}`),
              React.createElement('p', null, `Date: ${new Date(adjudication.created_at).toLocaleString()}`)
            )
          )
        )
      )
    )
  );
}

// Mount the application using React 18 API
(function() {
  console.log('🚀 Mounting Purchase Requisition Approval System (PRAS)...');

  try {
    const rootElement = document.getElementById('root');

    if (!rootElement) {
      console.error('❌ Root element not found!');
      return;
    }

    // Clear loading screen
    rootElement.innerHTML = '';

    // Create root and render (React 18 way)
    if (ReactDOM.createRoot) {
      console.log('✓ Using React 18 createRoot API');
      const root = ReactDOM.createRoot(rootElement);
      root.render(React.createElement(App));
    } else {
      console.log('✓ Using legacy ReactDOM.render API');
      ReactDOM.render(React.createElement(App), rootElement);
    }

    console.log('✅ Application mounted successfully');
  } catch (error) {
    console.error('❌ Failed to mount application:', error);

    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #fef2f2; padding: 20px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px;">
            <h2 style="color: #dc2626; margin: 0 0 15px 0;">⚠️ Failed to Mount Application</h2>
            <p><strong>Error:</strong> ${error.message}</p>
            <pre style="background: #f9fafb; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${error.stack}</pre>
            <button onclick="location.reload(true)" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
              Reload Page
            </button>
          </div>
        </div>
      `;
    }
  }
})();