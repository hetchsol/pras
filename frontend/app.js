const { useState, useEffect } = React;
// Lucide icons not used in this version - using emoji icons instead
// const { AlertCircle, CheckCircle, Clock, XCircle, LogOut, Plus, Edit, Trash2, FileText, DollarSign, Users, Package } = lucide;

// API URL from config.js or fallback to dynamic detection
const API_URL = window.API_URL || `${window.location.protocol}//${window.location.hostname}:3001/api`;

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

// Helper for case-insensitive role comparison
const hasRole = (userRole, ...allowedRoles) => {
  if (!userRole) return false;
  const normalizedUserRole = userRole.toLowerCase();
  return allowedRoles.some(role => role.toLowerCase() === normalizedUserRole);
};

// Helper to check if user has any of the specified roles
const hasAnyRole = (userRole, roles) => {
  if (!userRole || !Array.isArray(roles)) return false;
  const normalizedUserRole = userRole.toLowerCase();
  return roles.some(role => role.toLowerCase() === normalizedUserRole);
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
      // Refresh failed - just return the 401 response, let the caller handle it
      // Don't force reload or logout here - let the app decide
      console.warn('Token refresh failed:', error.message);
      return response; // Return the original 401 response
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
  
  getRequisitions: async (userId, userRole) => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (userRole) params.append('role', userRole);
    const queryString = params.toString();
    const url = queryString ? `${API_URL}/requisitions?${queryString}` : `${API_URL}/requisitions`;
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch requisitions');
    return res.json();
  },

  createRequisition: async (data) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/simple`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create requisition');
    }
    return res.json();
  },

  updateRequisition: async (id, data) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update requisition');
    return res.json();
  },

  getUsers: async () => {
    const res = await fetchWithAuth(`${API_URL}/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  createUser: async (data) => {
    const res = await fetchWithAuth(`${API_URL}/users`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  },

  deleteUser: async (id) => {
    const res = await fetchWithAuth(`${API_URL}/users/${id}`, {
      method: 'DELETE'
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
    const res = await fetchWithAuth(`${API_URL}/vendors`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create vendor');
    return res.json();
  },

  deleteVendor: async (id) => {
    const res = await fetchWithAuth(`${API_URL}/vendors/${id}`, {
      method: 'DELETE'
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

  // COMMENTED OUT: DEPARTMENTAL REQUEST PDF (Report 2) - Not needed
  /* downloadRequisitionPDF: async (reqId) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${reqId}/pdf`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to download Requisition PDF');
    }
    return res.blob();
  }, */

  // NEW: Download Approved Purchase Requisition PDF (Report 1) after full approval chain
  // This function now gets the PO ID from requisition ID first, then downloads the PO PDF
  downloadRequisitionPDF: async (reqId) => {
    // First, get the purchase order for this requisition
    const poRes = await fetchWithAuth(`${API_URL}/purchase-orders/by-requisition/${reqId}`);
    if (!poRes.ok) {
      const errorText = await poRes.text();
      throw new Error(errorText || 'Purchase order not found for this requisition');
    }
    const po = await poRes.json();

    // Now download the PO PDF
    const res = await fetchWithAuth(`${API_URL}/purchase-orders/${po.id}/pdf`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to download Approved Purchase Requisition PDF');
    }
    return res.blob();
  },

  getDepartments: async () => {
    const res = await fetchWithAuth(`${API_URL}/departments`);
    if (!res.ok) throw new Error('Failed to fetch departments');
    return res.json();
  },

  // ============================================
  // FORMS API - EFT, PETTY CASH, EXPENSE CLAIMS
  // ============================================

  getExpenseClaims: async () => {
    const res = await fetchWithAuth(`${API_URL}/forms/expense-claims`);
    if (!res.ok) throw new Error('Failed to fetch expense claims');
    return res.json();
  },

  getEFTRequisitions: async () => {
    const res = await fetchWithAuth(`${API_URL}/forms/eft-requisitions`);
    if (!res.ok) throw new Error('Failed to fetch EFT requisitions');
    return res.json();
  },

  getPettyCashRequisitions: async () => {
    const res = await fetchWithAuth(`${API_URL}/forms/petty-cash-requisitions`);
    if (!res.ok) throw new Error('Failed to fetch petty cash requisitions');
    return res.json();
  },

  downloadExpenseClaimPDF: async (claimId) => {
    const res = await fetchWithAuth(`${API_URL}/forms/expense-claims/${claimId}/pdf`);
    if (!res.ok) throw new Error('Failed to download expense claim PDF');
    return res.blob();
  },

  downloadEFTRequisitionPDF: async (eftId) => {
    const res = await fetchWithAuth(`${API_URL}/forms/eft-requisitions/${eftId}/pdf`);
    if (!res.ok) throw new Error('Failed to download EFT requisition PDF');
    return res.blob();
  },

  downloadPettyCashPDF: async (pettyCashId) => {
    const res = await fetchWithAuth(`${API_URL}/forms/petty-cash-requisitions/${pettyCashId}/pdf`);
    if (!res.ok) throw new Error('Failed to download petty cash PDF');
    return res.blob();
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

  getAllDepartmentsWithBudgets: async (fiscalYear) => {
    const res = await fetch(`${API_URL}/budgets/all-departments?fiscal_year=${fiscalYear}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch departments with budgets');
    return res.json();
  },

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

  createBudget: async (department, allocatedAmount, fiscalYear) => {
    const res = await fetch(`${API_URL}/budgets/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ department, allocated_amount: allocatedAmount, fiscal_year: fiscalYear })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create budget');
    }
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
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/budget-check`, {
      method: 'POST',
      body: JSON.stringify({ approved, comments })
    });
    if (!res.ok) throw new Error('Failed to perform budget check');
    return res.json();
  },

  // ============================================
  // REQUISITION ITEMS API - MULTI-CURRENCY
  // ============================================

  addRequisitionItem: async (requisitionId, item) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/items`, {
      method: 'POST',
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to add item');
    return res.json();
  },

  updateRequisitionItem: async (requisitionId, itemId, item) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to update item');
    return res.json();
  },

  deleteRequisitionItem: async (requisitionId, itemId) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/items/${itemId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete item');
    return res.json();
  },

  updateRequisitionFields: async (requisitionId, fields) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/update-fields`, {
      method: 'PUT',
      body: JSON.stringify(fields)
    });
    if (!res.ok) throw new Error('Failed to update fields');
    return res.json();
  },

  // ============================================
  // REQUISITION WORKFLOW API
  // ============================================

  submitRequisition: async (requisitionId, userId, selectedHodId = null) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/submit`, {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId, selected_hod_id: selectedHodId })
    });
    if (!res.ok) throw new Error('Failed to submit requisition');
    return res.json();
  },

  hodApprove: async (requisitionId, approved, comments, userId) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/hod-approve`, {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId, approve: approved, comments })
    });
    if (!res.ok) throw new Error('Failed to process HOD approval');
    return res.json();
  },

  financeApprove: async (requisitionId, approved, comments, userId) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/finance-approve`, {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId, approve: approved, comments })
    });
    if (!res.ok) throw new Error('Failed to process finance approval');
    return res.json();
  },

  mdApprove: async (requisitionId, approved, comments, userId) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/md-approve`, {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId, approve: approved, comments })
    });
    if (!res.ok) throw new Error('Failed to process MD approval');
    return res.json();
  },

  completeProcurement: async (requisitionId, comments, procurementAssignedTo) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/procurement`, {
      method: 'PUT',
      body: JSON.stringify({
        comments,
        procurement_assigned_to: procurementAssignedTo
      })
    });
    if (!res.ok) throw new Error('Failed to complete procurement');
    return res.json();
  },

  redirectRequisition: async (requisitionId, newApproverId, reason) => {
    const res = await fetchWithAuth(`${API_URL}/requisitions/${requisitionId}/redirect`, {
      method: 'POST',
      body: JSON.stringify({ new_approver_id: newApproverId, reason })
    });
    if (!res.ok) throw new Error('Failed to redirect requisition');
    return res.json();
  },

  // COMMENTED OUT: DEPARTMENTAL REQUEST PDF (Report 2) - Not needed
  /* getRequisitionPDF: async (requisitionId) => {
    const token = getAuthToken();
    window.open(`${API_URL}/requisitions/${requisitionId}/pdf?token=${token}`, '_blank');
  }, */

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

  // COMMENTED OUT: Departmental PDF download - not needed
  /* downloadDepartmentPDF: (department, fiscalYear) => {
    const params = new URLSearchParams({ fiscal_year: fiscalYear });
    const token = getAuthToken();
    window.open(`${API_URL}/reports/department/${department}/pdf?${params}`, '_blank');
  }, */

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
  },

  // ============================================
  // GLOBAL SEARCH
  // ============================================
  globalSearch: async (query) => {
    if (!query || query.length < 3) {
      return {
        requisitions: [],
        efts: [],
        expense_claims: [],
        users: []
      };
    }

    const res = await fetchWithAuth(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  }
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login');
  const [viewHistory, setViewHistory] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);

  // Custom setView that tracks history
  const navigateTo = (newView) => {
    if (newView !== view && view !== 'login') {
      setViewHistory(prev => [...prev.slice(-10), view]); // Keep last 10 views
    }
    setView(newView);
  };

  // Go back to previous view
  const goBack = () => {
    if (viewHistory.length > 0) {
      const previousView = viewHistory[viewHistory.length - 1];
      setViewHistory(prev => prev.slice(0, -1));
      setView(previousView);
    } else {
      setView('dashboard');
    }
  };

  // Handle browser back button - prevent logout on back
  useEffect(() => {
    const handlePopState = (e) => {
      e.preventDefault();
      if (currentUser && view !== 'login') {
        // Instead of navigating away, go to previous view or dashboard
        goBack();
        // Push state to prevent actual navigation
        window.history.pushState({ view: view }, '', window.location.href);
      }
    };

    // Push initial state
    if (currentUser && view !== 'login') {
      window.history.pushState({ view: view }, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, view, viewHistory]);
  const [data, setData] = useState({
    requisitions: [],
    users: [],
    vendors: [],
    departments: [],
    expenseClaims: [],
    eftRequisitions: [],
    pettyCashRequisitions: []
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
          } else if (res.status === 401 || res.status === 403) {
            // Token is explicitly invalid/expired, clear it
            console.log('Token expired or invalid, clearing auth');
            clearAuthToken();
          } else {
            // Other error (network, server error) - keep user logged in
            console.warn('Auth check returned non-OK status, but keeping session:', res.status);
            setCurrentUser(savedUser);
            setView('dashboard');
          }
        } catch (error) {
          // Network error - don't log out, keep the session
          console.warn('Auth check failed (network error), keeping session:', error.message);
          setCurrentUser(savedUser);
          setView('dashboard');
        }
      }
      setInitializing(false);
    };

    checkAuth();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all requisition types (purchase requisitions and forms)
      const [requisitions, vendors, expenseClaims, eftRequisitions, pettyCashRequisitions] = await Promise.all([
        api.getRequisitions(currentUser?.id, currentUser?.role),
        api.getVendors(),
        api.getExpenseClaims(),
        api.getEFTRequisitions(),
        api.getPettyCashRequisitions()
      ]);
      setData({
        requisitions,
        vendors,
        expenseClaims,
        eftRequisitions,
        pettyCashRequisitions,
        users: [], // Not implemented yet
        departments: [] // Not implemented yet
      });
    } catch (error) {
      console.error('Error loading data:', error);
      // Only logout on explicit 401 Unauthorized, not on other errors
      if (error.message === '401' || error.message === 'Unauthorized' || error.message.includes('Session expired')) {
        clearAuthToken();
        setCurrentUser(null);
        setView('login');
      } else {
        // Show error but don't logout - might be a temporary network issue
        console.warn('Data load error (not logging out):', error.message);
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
      departments: [],
      expenseClaims: [],
      eftRequisitions: [],
      pettyCashRequisitions: []
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
      React.createElement(TopBar, { user: currentUser, logout }),
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
        view === 'quotes-adjudication' && React.createElement(QuotesAndAdjudication, { user: currentUser, setView, loadData }),
        view === 'expense-claims' && React.createElement(ExpenseClaimsList, { user: currentUser, setView, setSelectedReq }),
        view === 'create-expense-claim' && React.createElement(CreateExpenseClaim, { user: currentUser, setView }),
        view === 'approve-expense-claim' && React.createElement(ApproveExpenseClaim, { claim: selectedReq, user: currentUser, setView }),
        view === 'eft-requisitions' && React.createElement(EFTRequisitionsList, { user: currentUser, setView, setSelectedReq }),
        view === 'create-eft-requisition' && React.createElement(CreateEFTRequisition, { user: currentUser, setView }),
        view === 'approve-eft-requisition' && React.createElement(ApproveEFTRequisition, { requisition: selectedReq, user: currentUser, setView }),
        view === 'approve-petty-cash' && React.createElement(ApprovePettyCash, { requisition: selectedReq, user: currentUser, setView }),
        view === 'petty-cash-requisitions' && React.createElement(PettyCashRequisitionsList, { user: currentUser, setView, setSelectedReq })
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
function Sidebar({ user, logout, setView, view, setSelectedReq }) {
  const [expandedMenus, setExpandedMenus] = useState({});

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const menuItems = [
    // Procurement Group - All requisition-related items
    {
      id: 'procurement-group',
      label: 'Procurement',
      icon: '🛒',
      show: true,
      isGroup: true,
      children: [
        { id: 'requisitions', label: 'My Requisitions', icon: '📋', show: true },
        { id: 'create', label: 'Create Requisition', icon: '➕', show: hasRole(user.role, 'initiator', 'procurement') },
        { id: 'approval-console', label: 'Pending Approvals', icon: '⏳', show: hasAnyRole(user.role, ['hod', 'finance', 'md', 'admin']) },
        { id: 'purchase-orders', label: 'Approved Requisitions', icon: '✓', show: hasAnyRole(user.role, ['initiator', 'hod', 'procurement', 'finance', 'md', 'admin']) },
        { id: 'rejected', label: 'Rejected Requisitions', icon: '❌', show: hasRole(user.role, 'procurement', 'admin') },
        { id: 'quotes-adjudication', label: 'Adjudication', icon: '⚖️', show: hasRole(user.role, 'procurement', 'finance', 'md', 'admin') }
      ]
    },
    // Financial Forms Group - All form-related items
    {
      id: 'forms-group',
      label: 'Financial Forms',
      icon: '💳',
      show: true,
      isGroup: true,
      children: [
        { id: 'expense-claims', label: 'Expense Claims', icon: '📋', show: true },
        { id: 'eft-requisitions', label: 'EFT Requisitions', icon: '💳', show: true },
        { id: 'petty-cash-requisitions', label: 'Petty Cash', icon: '💰', show: true },
        { id: 'approval-console', label: 'Pending Approvals', icon: '✅', show: hasAnyRole(user.role, ['hod', 'finance', 'md', 'admin']) }
      ]
    },
    // Financial Planning Group - Budget and FX rates
    {
      id: 'fin-planning-group',
      label: 'Financial Planning',
      icon: '💼',
      show: hasRole(user.role, 'finance', 'md', 'admin'),
      isGroup: true,
      children: [
        { id: 'budget', label: 'Budgets', icon: '💰', show: hasRole(user.role, 'finance', 'md', 'admin') },
        { id: 'fx-rates', label: 'FX Rates', icon: '💱', show: hasRole(user.role, 'finance', 'md', 'procurement', 'admin') }
      ]
    },
    // Reports & Analytics Group
    {
      id: 'insights-group',
      label: 'Reports & Analytics',
      icon: '📊',
      show: !hasRole(user.role, 'initiator'), // Hide entire group from initiators
      isGroup: true,
      children: [
        { id: 'reports', label: 'Reports', icon: '📈', show: true },
        { id: 'analytics', label: 'Analytics', icon: '📊', show: hasRole(user.role, 'finance', 'md', 'admin') }
      ]
    },
    // Admin Panel
    { id: 'admin', label: 'Administration', icon: '⚙️', show: hasRole(user.role, 'admin') }
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

    // Global Search Bar
    React.createElement('div', { className: "px-4 pb-4" },
      React.createElement(GlobalSearch, { setView, setSelectedReq })
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
                child.isLink ?
                  React.createElement('a', {
                    key: child.id,
                    href: child.href,
                    className: "w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    style: {
                      color: 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                      textDecoration: 'none'
                    },
                    onMouseEnter: (e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    },
                    onMouseLeave: (e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  },
                    React.createElement('span', null, child.icon),
                    React.createElement('span', null, child.label)
                  ) :
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

    // User Info at bottom
    React.createElement('div', {
      className: "p-4 border-t mt-auto transition-colors",
      style: { backgroundColor: 'var(--bg-secondary)' }
    },
      React.createElement('div', null,
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
      )
    )
  );
}

// Top Bar Component - User Info and Context
function TopBar({ user, logout }) {
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
      React.createElement('div', { className: "flex flex-col items-end gap-2" },
        // Logout button and Theme toggle row
        React.createElement('div', { className: "flex items-center gap-3" },
          React.createElement(ThemeToggle),
          React.createElement('button', {
            onClick: logout,
            className: "px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all text-sm font-medium flex items-center gap-2",
            style: {
              backgroundColor: 'var(--color-danger)',
              boxShadow: 'var(--shadow-sm)'
            }
          },
            React.createElement('span', null, '🚪'),
            React.createElement('span', null, 'Logout')
          )
        ),
        // Date and time below
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

// ============================================
// GLOBAL SEARCH COMPONENT
// ============================================
function GlobalSearch({ setView, setSelectedReq }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounce search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSearchResults(null);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const results = await api.globalSearch(searchQuery);
        setSearchResults(results);
        setShowResults(true);
        setIsSearching(false);
      } catch (error) {
        console.error('Search error:', error);
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleResultClick = (type, item) => {
    setSearchQuery('');
    setShowResults(false);

    if (type === 'requisition') {
      setSelectedReq(item);
      setView('details');
    } else if (type === 'eft') {
      window.location.href = 'forms-dashboard.html';
    } else if (type === 'expense_claim') {
      window.location.href = 'forms-dashboard.html';
    } else if (type === 'user') {
      setView('admin');
    }
  };

  const totalResults = searchResults ?
    searchResults.requisitions.length +
    searchResults.efts.length +
    searchResults.expense_claims.length +
    searchResults.users.length : 0;

  return React.createElement('div', {
    className: 'relative'
  },
    React.createElement('div', { className: 'relative' },
      React.createElement('input', {
        type: 'text',
        placeholder: 'Search...',
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        onFocus: () => searchResults && setShowResults(true),
        className: 'w-full px-4 py-2 pr-10 rounded-lg text-sm font-medium transition-all focus:outline-none',
        style: {
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)'
        },
        onMouseEnter: (e) => {
          if (!searchQuery) {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        }
      }),
      React.createElement('div', {
        className: 'absolute right-3 top-2.5',
        style: { color: 'var(--text-tertiary)' }
      }, isSearching ? '⏳' : '🔍')
    ),

    showResults && searchResults && React.createElement('div', {
      className: 'absolute top-full mt-2 w-full rounded-lg z-50',
      style: {
        maxHeight: '500px',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-xl)'
      }
    },
      totalResults === 0 ?
        React.createElement('div', {
          className: 'p-4 text-center text-sm',
          style: { color: 'var(--text-tertiary)' }
        }, 'No results found') :
        React.createElement('div', { className: 'py-2' },
          searchResults.requisitions.length > 0 && React.createElement('div', null,
            React.createElement('div', {
              className: 'px-4 py-2 text-xs font-semibold uppercase',
              style: {
                color: 'var(--text-tertiary)',
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)'
              }
            }, `Requisitions (${searchResults.requisitions.length})`),
            searchResults.requisitions.map(req =>
              React.createElement('div', {
                key: req.id,
                className: 'px-4 py-3 cursor-pointer transition-colors',
                style: {
                  borderBottom: '1px solid var(--border-color)'
                },
                onClick: () => handleResultClick('requisition', req),
                onMouseEnter: (e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                },
                onMouseLeave: (e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              },
                React.createElement('div', {
                  className: 'font-medium text-sm',
                  style: { color: 'var(--text-primary)' }
                }, req.id),
                React.createElement('div', {
                  className: 'text-xs mt-1',
                  style: { color: 'var(--text-secondary)' }
                },
                  req.description ? req.description.substring(0, 60) + '...' : 'No description'
                ),
                React.createElement('div', {
                  className: 'text-xs mt-1',
                  style: { color: 'var(--text-tertiary)' }
                },
                  `${req.initiator_name || 'Unknown'} • ${req.department || 'Unknown'}`
                )
              )
            )
          ),

          searchResults.efts.length > 0 && React.createElement('div', null,
            React.createElement('div', {
              className: 'px-4 py-2 text-xs font-semibold uppercase',
              style: {
                color: 'var(--text-tertiary)',
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)'
              }
            }, `EFT Requisitions (${searchResults.efts.length})`),
            searchResults.efts.map(eft =>
              React.createElement('div', {
                key: eft.id,
                className: 'px-4 py-3 cursor-pointer transition-colors',
                style: { borderBottom: '1px solid var(--border-color)' },
                onClick: () => handleResultClick('eft', eft),
                onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; },
                onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = 'transparent'; }
              },
                React.createElement('div', { className: 'font-medium text-sm', style: { color: 'var(--text-primary)' } }, eft.id),
                React.createElement('div', { className: 'text-xs mt-1', style: { color: 'var(--text-secondary)' } },
                  eft.payee_name || 'Unknown payee'
                ),
                React.createElement('div', { className: 'text-xs mt-1', style: { color: 'var(--text-tertiary)' } },
                  `${eft.initiator_name || 'Unknown'} • ${eft.department || 'Unknown'}`
                )
              )
            )
          ),

          searchResults.expense_claims.length > 0 && React.createElement('div', null,
            React.createElement('div', {
              className: 'px-4 py-2 text-xs font-semibold uppercase',
              style: { color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }
            }, `Expense Claims (${searchResults.expense_claims.length})`),
            searchResults.expense_claims.map(claim =>
              React.createElement('div', {
                key: claim.id,
                className: 'px-4 py-3 cursor-pointer transition-colors',
                style: { borderBottom: '1px solid var(--border-color)' },
                onClick: () => handleResultClick('expense_claim', claim),
                onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; },
                onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = 'transparent'; }
              },
                React.createElement('div', { className: 'font-medium text-sm', style: { color: 'var(--text-primary)' } }, claim.id),
                React.createElement('div', { className: 'text-xs mt-1', style: { color: 'var(--text-secondary)' } },
                  claim.employee_name || 'Unknown employee'
                ),
                React.createElement('div', { className: 'text-xs mt-1', style: { color: 'var(--text-tertiary)' } },
                  `${claim.reason_for_trip || 'No reason'} • ${claim.department || 'Unknown'}`
                )
              )
            )
          ),

          searchResults.users.length > 0 && React.createElement('div', null,
            React.createElement('div', {
              className: 'px-4 py-2 text-xs font-semibold uppercase',
              style: { color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }
            }, `Users (${searchResults.users.length})`),
            searchResults.users.map(user =>
              React.createElement('div', {
                key: user.id,
                className: 'px-4 py-3 cursor-pointer transition-colors',
                style: { borderBottom: '1px solid var(--border-color)' },
                onClick: () => handleResultClick('user', user),
                onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; },
                onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = 'transparent'; }
              },
                React.createElement('div', { className: 'font-medium text-sm', style: { color: 'var(--text-primary)' } },
                  user.full_name || user.name || user.username
                ),
                React.createElement('div', { className: 'text-xs mt-1', style: { color: 'var(--text-secondary)' } },
                  `@${user.username} • ${user.role || 'Unknown role'}`
                ),
                React.createElement('div', { className: 'text-xs mt-1', style: { color: 'var(--text-tertiary)' } },
                  user.department || 'No department'
                )
              )
            )
          )
        )
    ),

    showResults && React.createElement('div', {
      className: 'fixed inset-0 z-40',
      onClick: () => setShowResults(false)
    })
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
          hasRole(user.role, 'initiator') && React.createElement('button', {
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

function Dashboard({ user, data, setView, setSelectedReq, loadData }) {
  const [showBreakdown, setShowBreakdown] = useState(null); // 'total', 'pending', 'approved', or null
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [showAdminReroute, setShowAdminReroute] = useState(false);
  const [rerouteForm, setRerouteForm] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [rerouteReason, setRerouteReason] = useState('');
  const [showUserSelection, setShowUserSelection] = useState(false);

  const getRequisitionsForUser = () => {
    let filtered;
    switch (user.role) {
      case 'initiator':
        // Initiators see only their own requisitions
        filtered = data.requisitions.filter(r => r.created_by === user.id);
        break;
      case 'hod':
        // HODs see ALL requisitions from their department (not just pending_hod)
        filtered = data.requisitions.filter(r => r.department === user.department);
        break;
      case 'procurement':
        // Procurement sees ALL requisitions (they manage all procurement)
        filtered = data.requisitions;
        break;
      case 'finance':
        // Finance sees ALL requisitions
        filtered = data.requisitions;
        break;
      case 'md':
        // MD sees ALL requisitions
        filtered = data.requisitions;
        break;
      case 'admin':
        // Admin sees ALL requisitions
        filtered = data.requisitions;
        break;
      default:
        filtered = [];
    }
    // Add formType to purchase requisitions for consistent handling
    return filtered.map(r => ({...r, formType: 'purchase_requisition', displayType: 'Purchase Requisition'}));
  };

  // Get all forms for the user (EFT, Petty Cash, Expense Claims)
  const getAllFormsForUser = () => {
    const expenseClaims = (data.expenseClaims || []).filter(c =>
      user.role === 'initiator' ? c.initiator_id === user.id : true
    ).map(c => ({...c, formType: 'expense_claim', displayType: 'Expense Claim'}));

    const eftReqs = (data.eftRequisitions || []).filter(r =>
      user.role === 'initiator' ? r.initiator_id === user.id : true
    ).map(r => ({...r, formType: 'eft', displayType: 'EFT Requisition'}));

    const pettyCash = (data.pettyCashRequisitions || []).filter(r =>
      user.role === 'initiator' ? r.initiator_id === user.id : true
    ).map(r => ({...r, formType: 'petty_cash', displayType: 'Petty Cash'}));

    return [...expenseClaims, ...eftReqs, ...pettyCash];
  };

  // Helper function to check if a form is approved (any approval status)
  const isApproved = (status) => {
    return status === 'approved' ||
           status === 'completed' ||
           status === 'hod_approved' ||
           status === 'finance_approved' ||
           status === 'md_approved';
  };

  const requisitions = getRequisitionsForUser();
  const allForms = getAllFormsForUser();

  // Combine ALL requisitions (Purchase + EFT + Petty Cash + Expense Claims)
  const allRequisitions = [...requisitions, ...allForms];

  // Pending: ALL forms with pending status
  const pendingPurchaseReqs = requisitions.filter(r => r.status.includes('pending'));
  const pendingForms = allForms.filter(f => f.status.includes('pending'));
  const pendingRequisitions = [...pendingPurchaseReqs, ...pendingForms];
  const pendingApprovals = pendingRequisitions.length;

  // Approved: Purchase Requisitions + ALL approved forms (includes partial approvals)
  const approvedPurchaseRequisitions = requisitions.filter(r => isApproved(r.status));
  const approvedForms = allForms.filter(f => isApproved(f.status));
  const approvedRequisitions = [...approvedPurchaseRequisitions, ...approvedForms];

  // Rejected: Purchase Requisitions + ALL rejected forms
  const rejectedPurchaseRequisitions = requisitions.filter(r => r.status === 'rejected');
  const rejectedForms = allForms.filter(f => f.status === 'rejected');
  const rejectedRequisitions = [...rejectedPurchaseRequisitions, ...rejectedForms];

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      pending_hod: 'bg-yellow-100 text-yellow-700',
      pending_procurement: 'bg-blue-100 text-blue-700',
      pending_finance: 'bg-purple-100 text-purple-700',
      pending_md: 'bg-orange-100 text-orange-700',
      approved: 'bg-green-100 text-green-700',
      completed: 'bg-green-100 text-green-700',
      hod_approved: 'bg-green-100 text-green-700',
      finance_approved: 'bg-green-100 text-green-700',
      md_approved: 'bg-green-100 text-green-700',
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
      completed: 'Approved',
      hod_approved: 'HOD Approved',
      finance_approved: 'Finance Approved',
      md_approved: 'MD Approved',
      rejected: 'Rejected'
    };
    return text[status] || status;
  };

  const handleViewReq = (req) => {
    setSelectedReq(req);
    setView('approve');
  };

  // Handle inline approval/rejection for all form types
  const handleQuickAction = async (form, action) => {
    const comment = action === 'reject'
      ? prompt('Please provide a reason for rejection:')
      : 'Approved';

    if (action === 'reject' && !comment) {
      alert('Rejection reason is required');
      return;
    }

    if (!confirm(`Are you sure you want to ${action} this ${form.displayType || 'form'}?`)) {
      return;
    }

    try {
      let endpoint = '';
      let requestBody = {};

      // Purchase Requisitions use different endpoint structure
      if (form.formType === 'purchase_requisition') {
        // Purchase Requisitions use role-specific approve endpoints
        if (user.role === 'hod') {
          endpoint = `${API_URL}/requisitions/${form.id}/hod-approve`;
        } else if (user.role === 'finance') {
          endpoint = `${API_URL}/requisitions/${form.id}/finance-approve`;
        } else if (user.role === 'md') {
          endpoint = `${API_URL}/requisitions/${form.id}/md-approve`;
        } else if (user.role === 'procurement') {
          endpoint = `${API_URL}/requisitions/${form.id}/procurement-action`;
        }

        // Purchase Requisitions use 'approved' boolean instead of 'action'
        requestBody = {
          user_id: user.id,
          approved: action === 'approve',
          comments: comment
        };
      } else {
        // Forms (EFT, Petty Cash, Expense Claims) use unified approve endpoint
        // Determine form type endpoint
        if (form.formType === 'expense_claim') {
          endpoint = `${API_URL}/forms/expense-claims/${form._id || form.id}/approve`;
        } else if (form.formType === 'eft') {
          endpoint = `${API_URL}/forms/eft-requisitions/${form._id || form.id}/approve`;
        } else if (form.formType === 'petty_cash') {
          endpoint = `${API_URL}/forms/petty-cash-requisitions/${form._id || form.id}/approve`;
        }

        // Forms use unified approve format
        requestBody = {
          approved: action === 'approve',
          approver_role: user.role,
          approver_name: user.name,
          comments: comment
        };
      }

      const response = await fetchWithAuth(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} form`);
      }

      alert(`${form.displayType || 'Form'} ${action}ed successfully!`);

      // Reload data
      await loadData();

    } catch (error) {
      console.error(`Error ${action}ing form:`, error);
      alert(`Error ${action}ing requisition. ${error.message}`);
    }
  };

  // Admin reroute handler
  const handleAdminReroute = (form) => {
    setRerouteForm(form);
    setShowAdminReroute(true);
  };

  const handleRerouteSubmit = async (action) => {
    if (!rerouteForm) return;

    try {
      let endpoint = '';
      let requestBody = {};

      if (action === 'assign_to_user') {
        // Assign to specific user - show user selection modal
        if (!showUserSelection) {
          // Fetch available users
          try {
            const users = await api.getRerouteUsers();
            setAvailableUsers(users);
            setShowUserSelection(true);
            return; // Don't proceed yet, wait for user selection
          } catch (error) {
            alert('Failed to fetch users: ' + error.message);
            return;
          }
        }

        // User has selected someone
        if (!selectedUserId) {
          alert('Please select a user to assign to');
          return;
        }

        if (!rerouteReason.trim()) {
          alert('Please enter a reason for rerouting');
          return;
        }

        // Determine the appropriate new status based on the selected user's role
        const selectedUser = availableUsers.find(u => u.id === parseInt(selectedUserId));
        if (!selectedUser) {
          alert('Selected user not found');
          return;
        }

        let newStatus = rerouteForm.status; // Keep current status by default
        // Map user role to appropriate status
        if (selectedUser.role === 'hod') {
          newStatus = 'pending_hod';
        } else if (selectedUser.role === 'procurement') {
          newStatus = 'pending_procurement';
        } else if (selectedUser.role === 'finance') {
          newStatus = 'pending_finance';
        } else if (selectedUser.role === 'md') {
          newStatus = 'pending_md';
        }

        if (!confirm(`Assign to ${selectedUser.full_name} (${selectedUser.role}) and move to "${newStatus}"?`)) {
          return;
        }

        // Use the generic reroute endpoint (works for all form types)
        endpoint = `${API_URL}/admin/reroute/${rerouteForm.id}`;

        requestBody = {
          to_user_id: parseInt(selectedUserId),
          reason: rerouteReason,
          new_status: newStatus
        };

      } else if (action === 'skip_stage') {
        // Skip current approval stage
        const comment = prompt('Enter reason for skipping approval stage:');
        if (!comment) {
          alert('Reason is required');
          return;
        }

        // Determine next status
        let newStatus;
        if (rerouteForm.status === 'pending_hod') {
          newStatus = rerouteForm.formType === 'purchase_requisition' ? 'pending_procurement' : 'pending_finance';
        } else if (rerouteForm.status === 'pending_procurement') {
          newStatus = 'pending_finance';
        } else if (rerouteForm.status === 'pending_finance') {
          newStatus = 'pending_md';
        } else if (rerouteForm.status === 'pending_md') {
          newStatus = 'approved';
        }

        if (!newStatus) {
          alert('Cannot skip this stage');
          return;
        }

        if (!confirm(`Skip current stage and move to "${newStatus}"?`)) return;

        // Use admin override endpoint
        if (rerouteForm.formType === 'purchase_requisition') {
          endpoint = `${API_URL}/requisitions/${rerouteForm.id}/admin-override`;
        } else if (rerouteForm.formType === 'eft') {
          endpoint = `${API_URL}/forms/eft-requisitions/${rerouteForm.id}/admin-override`;
        } else if (rerouteForm.formType === 'petty_cash') {
          endpoint = `${API_URL}/forms/petty-cash-requisitions/${rerouteForm.id}/admin-override`;
        } else if (rerouteForm.formType === 'expense_claim') {
          endpoint = `${API_URL}/forms/expense-claims/${rerouteForm.id}/admin-override`;
        }

        requestBody = {
          action: 'skip_stage',
          new_status: newStatus,
          comment
        };
      } else if (action === 'reassign_hod') {
        // Reassign to different department/HOD
        const newDept = prompt('Enter new department name:');
        if (!newDept) {
          alert('Department name is required');
          return;
        }

        if (!confirm(`Reassign to department "${newDept}"?`)) return;

        if (rerouteForm.formType === 'purchase_requisition') {
          endpoint = `${API_URL}/requisitions/${rerouteForm.id}/admin-override`;
        } else if (rerouteForm.formType === 'eft') {
          endpoint = `${API_URL}/forms/eft-requisitions/${rerouteForm.id}/admin-override`;
        } else if (rerouteForm.formType === 'petty_cash') {
          endpoint = `${API_URL}/forms/petty-cash-requisitions/${rerouteForm.id}/admin-override`;
        } else if (rerouteForm.formType === 'expense_claim') {
          endpoint = `${API_URL}/forms/expense-claims/${rerouteForm.id}/admin-override`;
        }

        requestBody = {
          action: 'reassign_department',
          new_department: newDept
        };
      }

      // Use POST for assign_to_user (reroute endpoint), PUT for others (admin-override endpoints)
      const httpMethod = action === 'assign_to_user' ? 'POST' : 'PUT';

      const response = await fetchWithAuth(endpoint, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reroute');
      }

      alert('Rerouted successfully!');
      setShowAdminReroute(false);
      setRerouteForm(null);
      setShowUserSelection(false);
      setSelectedUserId('');
      setRerouteReason('');
      setAvailableUsers([]);
      await loadData();

    } catch (error) {
      console.error('Error rerouting:', error);
      alert(`Error rerouting: ${error.message}`);
    }
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

  const downloadFormPDF = async (form) => {
    try {
      let blob, filename;
      switch (form.formType) {
        case 'expense':
          blob = await api.downloadExpenseClaimPDF(form.id);
          filename = `ExpenseClaim_${form.id}.pdf`;
          break;
        case 'eft':
          blob = await api.downloadEFTRequisitionPDF(form.id);
          filename = `EFT_${form.id}.pdf`;
          break;
        case 'petty_cash':
          blob = await api.downloadPettyCashPDF(form.id);
          filename = `PettyCash_${form.id}.pdf`;
          break;
        default:
          throw new Error('Unknown form type');
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading form PDF:', error);
      alert(error.message || 'Failed to download form PDF.');
    }
  };

  const previewFormPDF = async (form) => {
    try {
      let blob, title;
      switch (form.formType) {
        case 'expense':
          blob = await api.downloadExpenseClaimPDF(form.id);
          title = `Expense Claim - ${form.id}`;
          break;
        case 'eft':
          blob = await api.downloadEFTRequisitionPDF(form.id);
          title = `EFT Requisition - ${form.id}`;
          break;
        case 'petty_cash':
          blob = await api.downloadPettyCashPDF(form.id);
          title = `Petty Cash - ${form.id}`;
          break;
        default:
          throw new Error('Unknown form type');
      }
      const url = window.URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
      setPreviewPdfTitle(title);
      setShowPdfPreview(true);
    } catch (error) {
      console.error('Error previewing form PDF:', error);
      alert(error.message || 'Failed to preview form PDF.');
    }
  };

  const previewRequisitionPDF = async (reqId, reqNumber) => {
    try {
      const blob = await api.downloadRequisitionPDF(reqId);
      const url = window.URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
      setPreviewPdfTitle(`Purchase Requisition - ${reqNumber}`);
      setShowPdfPreview(true);
    } catch (error) {
      console.error('Error previewing requisition PDF:', error);
      alert(error.message || 'Failed to preview requisition PDF.');
    }
  };

  const closePdfPreview = () => {
    if (previewPdfUrl) {
      window.URL.revokeObjectURL(previewPdfUrl);
    }
    setShowPdfPreview(false);
    setPreviewPdfUrl(null);
    setPreviewPdfTitle('');
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
            }, allRequisitions.length)
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
      // Rejected Card - Clickable
      React.createElement('div', {
        onClick: () => setShowBreakdown('rejected'),
        className: "rounded-lg shadow-sm border p-6 cursor-pointer hover:opacity-90 transition-opacity",
        style: {
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderColor: 'transparent'
        }
      },
        React.createElement('div', { className: "flex items-center justify-between" },
          React.createElement('div', null,
            React.createElement('p', {
              className: "text-sm mb-1",
              style: { color: 'rgba(255, 255, 255, 0.9)' }
            }, "Rejected"),
            React.createElement('p', {
              className: "text-2xl font-bold",
              style: { color: '#FFFFFF' }
            }, rejectedRequisitions.length)
          ),
          React.createElement('span', {
            className: "text-2xl",
            style: { opacity: 0.9 }
          }, '❌')
        )
      ),
      // Total Value Card - Not clickable (Hidden for initiators)
      !hasRole(user.role, 'initiator') && React.createElement('div', {
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

    // Quick Actions - Forms Section
    React.createElement('div', { className: "mt-6" },
      React.createElement('h3', {
        className: "text-xl font-bold mb-4",
        style: { color: 'var(--text-primary)' }
      }, "Quick Actions - Financial Forms"),
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        // Expense Claim Form Card
        React.createElement('a', {
          href: 'expense-claim.html',
          className: "block rounded-lg shadow-sm border p-4 hover:shadow-lg transition-all cursor-pointer",
          style: {
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            textDecoration: 'none'
          }
        },
          React.createElement('div', { className: "flex items-start gap-3" },
            React.createElement('div', {
              className: "text-3xl flex-shrink-0"
            }, '📋'),
            React.createElement('div', { className: "flex-1" },
              React.createElement('h3', {
                className: "text-base font-semibold mb-1",
                style: { color: 'var(--color-primary)' }
              }, "Expense Claim Form"),
              React.createElement('p', {
                className: "text-xs mb-2",
                style: { color: 'var(--text-secondary)' }
              }, "Submit travel and expense claims for reimbursement"),
              React.createElement('span', {
                className: "inline-block px-2 py-0.5 text-xs rounded-full",
                style: {
                  backgroundColor: 'var(--color-info-bg)',
                  color: 'var(--color-info)'
                }
              }, "FM-FI-014")
            )
          )
        ),

        // EFT/Cheque Requisition Form Card
        React.createElement('a', {
          href: 'eft-requisition.html',
          className: "block rounded-lg shadow-sm border p-4 hover:shadow-lg transition-all cursor-pointer",
          style: {
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            textDecoration: 'none'
          }
        },
          React.createElement('div', { className: "flex items-start gap-3" },
            React.createElement('div', {
              className: "text-3xl flex-shrink-0"
            }, '💳'),
            React.createElement('div', { className: "flex-1" },
              React.createElement('h3', {
                className: "text-base font-semibold mb-1",
                style: { color: 'var(--color-primary)' }
              }, "EFT/Cheque Requisition"),
              React.createElement('p', {
                className: "text-xs mb-2",
                style: { color: 'var(--text-secondary)' }
              }, "Request electronic payment or cheque issuance"),
              React.createElement('span', {
                className: "inline-block px-2 py-0.5 text-xs rounded-full",
                style: {
                  backgroundColor: 'var(--color-success-bg)',
                  color: 'var(--color-success)'
                }
              }, "Electronic Transfer")
            )
          )
        ),

        // Petty Cash Requisition Form Card
        React.createElement('a', {
          href: 'petty-cash-requisition.html',
          className: "block rounded-lg shadow-sm border p-4 hover:shadow-lg transition-all cursor-pointer",
          style: {
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            textDecoration: 'none'
          }
        },
          React.createElement('div', { className: "flex items-start gap-3" },
            React.createElement('div', {
              className: "text-3xl flex-shrink-0"
            }, '💰'),
            React.createElement('div', { className: "flex-1" },
              React.createElement('h3', {
                className: "text-base font-semibold mb-1",
                style: { color: 'var(--color-primary)' }
              }, "Petty Cash Requisition"),
              React.createElement('p', {
                className: "text-xs mb-2",
                style: { color: 'var(--text-secondary)' }
              }, "Request petty cash for minor expenses"),
              React.createElement('span', {
                className: "inline-block px-2 py-0.5 text-xs rounded-full",
                style: {
                  backgroundColor: 'var(--color-warning-bg)',
                  color: 'var(--color-warning)'
                }
              }, "Cash Payment")
            )
          )
        ),

        // Purchase Requisition Card (existing functionality)
        hasRole(user.role, 'initiator', 'procurement') && React.createElement('a', {
          onClick: (e) => {
            e.preventDefault();
            setView('create');
          },
          className: "block rounded-lg shadow-sm border p-4 hover:shadow-lg transition-all cursor-pointer",
          style: {
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            textDecoration: 'none'
          }
        },
          React.createElement('div', { className: "flex items-start gap-3" },
            React.createElement('div', {
              className: "text-3xl flex-shrink-0"
            }, '🛒'),
            React.createElement('div', { className: "flex-1" },
              React.createElement('h3', {
                className: "text-base font-semibold mb-1",
                style: { color: 'var(--color-primary)' }
              }, "Purchase Requisition"),
              React.createElement('p', {
                className: "text-xs mb-2",
                style: { color: 'var(--text-secondary)' }
              }, "Create new purchase requisition for goods/services"),
              React.createElement('span', {
                className: "inline-block px-2 py-0.5 text-xs rounded-full",
                style: {
                  backgroundColor: 'var(--color-warning-bg)',
                  color: 'var(--color-warning)'
                }
              }, "Procurement")
            )
          )
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
            showBreakdown === 'total' ? `All Requisitions (${allRequisitions.length})` :
            showBreakdown === 'pending' ? `Pending Approvals (${pendingApprovals})` :
            showBreakdown === 'rejected' ? `Rejected Requisitions (${rejectedRequisitions.length})` :
            `Approved Requisitions (${approvedRequisitions.length})`
          ),
          React.createElement('button', {
            onClick: () => setShowBreakdown(null),
            className: "text-2xl font-bold hover:opacity-70 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, '×')
        ),

        // Summary Section for Approved Forms (show breakdown by type)
        showBreakdown === 'approved' && React.createElement('div', {
          className: "mb-6 p-4 rounded-lg",
          style: {
            backgroundColor: 'var(--bg-secondary)',
            borderWidth: '1px',
            borderColor: 'var(--border-color)'
          }
        },
          React.createElement('h3', {
            className: "text-sm font-bold mb-3 transition-colors",
            style: { color: 'var(--text-primary)' }
          }, "Breakdown by Form Type:"),
          React.createElement('div', { className: "grid grid-cols-2 gap-3" },
            React.createElement('div', {
              className: "flex items-center justify-between p-2 rounded",
              style: { backgroundColor: 'var(--bg-primary)' }
            },
              React.createElement('span', {
                className: "text-sm transition-colors",
                style: { color: 'var(--text-secondary)' }
              }, "Purchase Requisitions:"),
              React.createElement('span', {
                className: "text-sm font-bold transition-colors",
                style: { color: 'var(--color-primary)' }
              }, approvedPurchaseRequisitions.length)
            ),
            React.createElement('div', {
              className: "flex items-center justify-between p-2 rounded",
              style: { backgroundColor: 'var(--bg-primary)' }
            },
              React.createElement('span', {
                className: "text-sm transition-colors",
                style: { color: 'var(--text-secondary)' }
              }, "EFT Requisitions:"),
              React.createElement('span', {
                className: "text-sm font-bold",
                style: { color: '#1E40AF' }
              }, approvedForms.filter(f => f.formType === 'eft').length)
            ),
            React.createElement('div', {
              className: "flex items-center justify-between p-2 rounded",
              style: { backgroundColor: 'var(--bg-primary)' }
            },
              React.createElement('span', {
                className: "text-sm transition-colors",
                style: { color: 'var(--text-secondary)' }
              }, "Petty Cash:"),
              React.createElement('span', {
                className: "text-sm font-bold",
                style: { color: '#059669' }
              }, approvedForms.filter(f => f.formType === 'petty_cash').length)
            ),
            React.createElement('div', {
              className: "flex items-center justify-between p-2 rounded",
              style: { backgroundColor: 'var(--bg-primary)' }
            },
              React.createElement('span', {
                className: "text-sm transition-colors",
                style: { color: 'var(--text-secondary)' }
              }, "Expense Claims:"),
              React.createElement('span', {
                className: "text-sm font-bold",
                style: { color: '#D97706' }
              }, approvedForms.filter(f => f.formType === 'expense').length)
            )
          ),
          React.createElement('div', {
            className: "mt-3 pt-3 flex items-center justify-between",
            style: { borderTop: '1px solid var(--border-color)' }
          },
            React.createElement('span', {
              className: "text-sm font-bold transition-colors",
              style: { color: 'var(--text-primary)' }
            }, "Total:"),
            React.createElement('span', {
              className: "text-lg font-bold transition-colors",
              style: { color: 'var(--color-primary)' }
            }, approvedRequisitions.length)
          )
        ),

        // Modal Content - Requisitions and Forms List
        React.createElement('div', { className: "space-y-3" },
          (showBreakdown === 'total' ? allRequisitions :
           showBreakdown === 'pending' ? pendingRequisitions :
           showBreakdown === 'rejected' ? rejectedRequisitions :
           approvedRequisitions).map(req =>
            React.createElement('div', {
              key: `${req.formType || 'req'}-${req.id}`,
              className: "rounded-lg p-4 transition-all",
              style: {
                backgroundColor: 'var(--bg-secondary)',
                borderWidth: '1px',
                borderColor: 'var(--border-color)'
              }
            },
              React.createElement('div', { className: "flex items-center justify-between mb-2" },
                React.createElement('div', { className: "flex items-center gap-2" },
                  // Show form type badge for forms
                  req.formType && React.createElement('span', {
                    className: "px-2 py-1 text-xs font-semibold rounded",
                    style: {
                      backgroundColor: req.formType === 'expense' ? '#FEF3C7' :
                                      req.formType === 'eft' ? '#DBEAFE' : '#D1FAE5',
                      color: req.formType === 'expense' ? '#D97706' :
                             req.formType === 'eft' ? '#1E40AF' : '#059669'
                    }
                  }, req.displayType),
                  React.createElement('h3', {
                    className: "font-bold transition-colors",
                    style: { color: 'var(--color-primary)' }
                  }, req.req_number || req.id)
                ),
                React.createElement('div', { className: "flex items-center gap-2" },
                  // Show preview and download buttons for approved items (any approval status) - Available to ALL roles
                  isApproved(req.status) &&
                  React.createElement(React.Fragment, null,
                    // Preview Button
                    React.createElement('button', {
                      onClick: (e) => {
                        e.stopPropagation();
                        if (req.formType) {
                          previewFormPDF(req);
                        } else {
                          previewRequisitionPDF(req.id, req.req_number);
                        }
                      },
                      className: "px-2 py-1 text-xs font-medium rounded hover:opacity-80 transition-all flex items-center gap-1",
                      style: {
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF'
                      },
                      title: `Preview ${req.displayType || 'Requisition'} PDF`
                    },
                      React.createElement('svg', { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" }),
                        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" })
                      ),
                      'Preview'
                    ),
                    // Download Button
                    React.createElement('button', {
                      onClick: (e) => {
                        e.stopPropagation();
                        if (req.formType) {
                          downloadFormPDF(req);
                        } else {
                          downloadRequisitionPDF(req.id, req.req_number);
                        }
                      },
                      className: "px-2 py-1 text-xs font-medium rounded hover:opacity-80 transition-all flex items-center gap-1",
                      style: {
                        backgroundColor: 'var(--color-success)',
                        color: '#FFFFFF'
                      },
                      title: `Download ${req.displayType || 'Requisition'} PDF`
                    },
                      React.createElement('svg', { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" })
                      ),
                      'Download'
                    )
                  ),
                  React.createElement('span', {
                    className: `px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(req.status)}`
                  }, getStatusText(req.status))
                )
              ),
              // Quick Approval Buttons for HOD, Finance, and MD (NOT Procurement)
              showBreakdown === 'pending' && (
                (user.role === 'hod' && req.status === 'pending_hod') ||
                (user.role === 'finance' && (req.status === 'pending_finance' || req.status === 'hod_approved')) ||
                (user.role === 'md' && (req.status === 'pending_md' || req.status === 'finance_approved'))
              ) &&
              React.createElement('div', { className: "flex items-center gap-2 mt-3" },
                React.createElement('button', {
                  onClick: async (e) => {
                    e.stopPropagation();
                    await handleQuickAction(req, 'approve');
                  },
                  className: "flex-1 px-3 py-1.5 text-xs font-medium rounded hover:opacity-90 transition-all",
                  style: {
                    backgroundColor: 'var(--color-success)',
                    color: '#FFFFFF'
                  }
                }, 'Approve'),
                React.createElement('button', {
                  onClick: async (e) => {
                    e.stopPropagation();
                    await handleQuickAction(req, 'reject');
                  },
                  className: "flex-1 px-3 py-1.5 text-xs font-medium rounded hover:opacity-90 transition-all",
                  style: {
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF'
                  }
                }, 'Reject')
              ),
              // Adjudicate Button for Procurement (only for Purchase Requisitions)
              showBreakdown === 'pending' &&
              user.role === 'procurement' &&
              req.status === 'pending_procurement' &&
              req.formType === 'purchase_requisition' &&
              React.createElement('div', { className: "mt-3" },
                React.createElement('button', {
                  onClick: (e) => {
                    e.stopPropagation();
                    setView('quotes-adjudication');
                  },
                  className: "w-full px-3 py-1.5 text-xs font-medium rounded hover:opacity-90 transition-all",
                  style: {
                    backgroundColor: '#8B5CF6',
                    color: '#FFFFFF'
                  }
                }, '⚖️ Adjudicate')
              ),
              // Admin Reroute Button (ONLY for purchase requisitions, not forms)
              showBreakdown === 'pending' &&
              user.role === 'admin' &&
              (!req.formType || req.formType === 'purchase_requisition') &&
              React.createElement('div', { className: "mt-3" },
                React.createElement('button', {
                  onClick: (e) => {
                    e.stopPropagation();
                    handleAdminReroute(req);
                  },
                  className: "w-full px-3 py-1.5 text-xs font-medium rounded hover:opacity-90 transition-all",
                  style: {
                    backgroundColor: '#F59E0B',
                    color: '#FFFFFF'
                  }
                }, '🔀 Admin Reroute')
              ),
              React.createElement('p', {
                className: "text-sm mb-2 transition-colors",
                style: { color: 'var(--text-secondary)' }
              }, req.description || req.title || req.purpose || req.employee_name || 'No description'),
              React.createElement('div', { className: "flex items-center justify-between text-sm" },
                React.createElement('span', {
                  className: "transition-colors",
                  style: { color: 'var(--text-tertiary)' }
                }, `${req.department || 'N/A'} • Created: ${new Date(req.created_at).toLocaleDateString()}`),
                React.createElement('span', {
                  className: "font-bold transition-colors",
                  style: { color: 'var(--text-primary)' }
                }, `ZMW ${(req.amount || req.total_amount || req.total_claim || 0).toLocaleString()}`)
              )
            )
          )
        )
      )
    ),
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border" },
      React.createElement('div', { className: "px-6 py-4 border-b" },
        React.createElement('h2', { className: "text-xl font-semibold text-gray-800" },
          hasRole(user.role, 'initiator') ? 'My Requisitions' : 'Requisitions for Review'
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
                        }, hasRole(user.role, 'initiator') ? 'View' : 'Review'),
                        // Show PDF download button for approved/completed requisitions only - Available to ALL roles
                        (req.status === 'approved' || req.status === 'completed') &&
                        React.createElement('button', {
                          onClick: () => downloadRequisitionPDF(req.id, req.req_number),
                          className: "text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1",
                          title: "Download Approved Requisition PDF"
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
    ),

    // PDF Preview Modal
    showPdfPreview && React.createElement('div', {
      className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",
      onClick: closePdfPreview
    },
      React.createElement('div', {
        className: "rounded-lg p-6 w-full h-full max-w-6xl max-h-[90vh] flex flex-col",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-lg)'
        },
        onClick: (e) => e.stopPropagation()
      },
        // Modal Header
        React.createElement('div', {
          className: "flex items-center justify-between mb-4 pb-4",
          style: { borderBottom: '1px solid var(--border-color)' }
        },
          React.createElement('h2', {
            className: "text-2xl font-bold transition-colors",
            style: { color: 'var(--text-primary)' }
          }, previewPdfTitle),
          React.createElement('button', {
            onClick: closePdfPreview,
            className: "text-2xl font-bold hover:opacity-70 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, '×')
        ),
        // PDF iframe
        React.createElement('div', {
          className: "flex-1 overflow-hidden"
        },
          React.createElement('iframe', {
            src: previewPdfUrl,
            className: "w-full h-full border-0"
          })
        )
      )
    ),

    // Admin Reroute Modal
    showAdminReroute && rerouteForm && React.createElement('div', {
      className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",
      onClick: () => setShowAdminReroute(false)
    },
      React.createElement('div', {
        className: "rounded-lg p-6 w-full max-w-md",
        style: {
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-lg)'
        },
        onClick: (e) => e.stopPropagation()
      },
        // Modal Header
        React.createElement('div', {
          className: "flex items-center justify-between mb-4 pb-4",
          style: { borderBottom: '1px solid var(--border-color)' }
        },
          React.createElement('h2', {
            className: "text-xl font-bold transition-colors",
            style: { color: 'var(--text-primary)' }
          }, '🔀 Admin Reroute'),
          React.createElement('button', {
            onClick: () => setShowAdminReroute(false),
            className: "text-2xl font-bold hover:opacity-70 transition-colors",
            style: { color: 'var(--text-secondary)' }
          }, '×')
        ),
        // Modal Body
        React.createElement('div', { className: "space-y-4" },
          React.createElement('div', {
            className: "p-3 rounded",
            style: { backgroundColor: 'var(--bg-secondary)' }
          },
            React.createElement('p', {
              className: "text-sm font-medium",
              style: { color: 'var(--text-secondary)' }
            }, `${rerouteForm.displayType}: ${rerouteForm.id}`),
            React.createElement('p', {
              className: "text-sm",
              style: { color: 'var(--text-tertiary)' }
            }, `Current Status: ${rerouteForm.status}`)
          ),
          React.createElement('h3', {
            className: "font-semibold",
            style: { color: 'var(--text-primary)' }
          }, 'Reroute Options:'),
          React.createElement('button', {
            onClick: () => handleRerouteSubmit('skip_stage'),
            className: "w-full px-4 py-3 rounded text-left hover:opacity-90 transition-all",
            style: {
              backgroundColor: '#F59E0B',
              color: '#FFFFFF'
            }
          },
            React.createElement('div', { className: "font-semibold" }, '⏭️ Skip Current Approval Stage'),
            React.createElement('div', { className: "text-sm opacity-90" }, 'Move to next approval stage')
          ),
          React.createElement('button', {
            onClick: () => handleRerouteSubmit('reassign_hod'),
            className: "w-full px-4 py-3 rounded text-left hover:opacity-90 transition-all",
            style: {
              backgroundColor: '#8B5CF6',
              color: '#FFFFFF'
            }
          },
            React.createElement('div', { className: "font-semibold" }, '🔄 Reassign to Different HOD'),
            React.createElement('div', { className: "text-sm opacity-90" }, 'Change department/HOD')
          ),
          React.createElement('button', {
            onClick: () => handleRerouteSubmit('assign_to_user'),
            className: "w-full px-4 py-3 rounded text-left hover:opacity-90 transition-all",
            style: {
              backgroundColor: '#10B981',
              color: '#FFFFFF'
            }
          },
            React.createElement('div', { className: "font-semibold" }, '👤 Assign to Specific User'),
            React.createElement('div', { className: "text-sm opacity-90" }, 'Choose a user to assign this form to')
          ),
          // User Selection Interface (shown when assign_to_user is clicked)
          showUserSelection && React.createElement('div', {
            className: "p-4 rounded border-2",
            style: {
              borderColor: '#10B981',
              backgroundColor: 'var(--bg-secondary)'
            }
          },
            React.createElement('h4', {
              className: "font-semibold mb-3",
              style: { color: 'var(--text-primary)' }
            }, 'Select User and Enter Reason:'),
            React.createElement('select', {
              value: selectedUserId,
              onChange: (e) => setSelectedUserId(e.target.value),
              className: "w-full p-2 mb-3 rounded border",
              style: {
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }
            },
              React.createElement('option', { value: '' }, '-- Select User --'),
              availableUsers.map(u =>
                React.createElement('option', { key: u.id, value: u.id },
                  `${u.full_name} (${u.role} - ${u.department})`
                )
              )
            ),
            React.createElement('textarea', {
              value: rerouteReason,
              onChange: (e) => setRerouteReason(e.target.value),
              placeholder: 'Enter reason for rerouting...',
              className: "w-full p-2 mb-3 rounded border",
              rows: 3,
              style: {
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }
            }),
            React.createElement('div', { className: "flex gap-2" },
              React.createElement('button', {
                onClick: () => handleRerouteSubmit('assign_to_user'),
                className: "flex-1 px-4 py-2 rounded font-semibold hover:opacity-90 transition-all",
                style: {
                  backgroundColor: '#10B981',
                  color: '#FFFFFF'
                }
              }, 'Submit Assignment'),
              React.createElement('button', {
                onClick: () => {
                  setShowUserSelection(false);
                  setSelectedUserId('');
                  setRerouteReason('');
                },
                className: "flex-1 px-4 py-2 rounded hover:opacity-90 transition-all",
                style: {
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)'
                }
              }, 'Back')
            )
          ),
          React.createElement('button', {
            onClick: () => {
              setShowAdminReroute(false);
              setShowUserSelection(false);
              setSelectedUserId('');
              setRerouteReason('');
              setAvailableUsers([]);
            },
            className: "w-full px-4 py-2 rounded hover:opacity-90 transition-all",
            style: {
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)'
            }
          }, 'Cancel')
        )
      )
    )
  );
}

function CreateRequisition({ user, setView, loadData }) {
  const [formData, setFormData] = useState({
    dateRequired: '',
    justification: '',
    department: user.department,
    urgency: 'standard',
    selectedHod: '', // For procurement to select HOD
    taxType: user.role === 'procurement' ? 'VAT' : null // Only for procurement
  });
  const [lineItems, setLineItems] = useState([
    { item_name: '', quantity: 1, unit_price: '' }
  ]);
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
          // Filter users with role 'hod' and ensure they have proper data
          const hods = Array.isArray(users) ? users.filter(u => u.role === 'hod' && u.id) : [];
          console.log('Fetched HOD users:', hods); // Debug log
          setHodUsers(hods);
        } catch (error) {
          console.error('Error loading HOD users:', error);
          setHodUsers([]); // Set empty array on error
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

  const addLineItem = () => {
    if (lineItems.length >= 15) {
      alert('Maximum of 15 line items allowed');
      return;
    }
    setLineItems([...lineItems, { item_name: '', quantity: 1, unit_price: '' }]);
  };

  // Calculate totals for display
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
    // TOT = no tax calculated, VAT = 16% tax, null = initiator (no tax selection yet)
    const tax = formData.taxType === 'VAT' ? subtotal * 0.16 : 0;
    const grandTotal = subtotal + tax;
    return { subtotal, tax, grandTotal, taxType: formData.taxType };
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) {
      alert('At least one line item is required');
      return;
    }
    const newItems = lineItems.filter((_, i) => i !== index);
    setLineItems(newItems);
  };

  const updateLineItem = (index, field, value) => {
    const newItems = [...lineItems];
    newItems[index][field] = value;
    setLineItems(newItems);
  };

  const handleSaveAsDraft = async () => {
    // Validate at least one item has description
    const validItems = lineItems.filter(item => item.item_name.trim() !== '');
    if (validItems.length === 0) {
      alert('Please add at least one item with a description');
      return;
    }

    if (!formData.dateRequired) {
      alert('Please select a required date');
      return;
    }

    setLoading(true);
    try {
      // Add justification and calculate total_price for each item
      const itemsWithSpecs = validItems.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        return {
          item_name: item.item_name,
          quantity: qty,
          unit_price: price,
          total_price: qty * price,
          specifications: formData.justification || 'Draft - No justification provided yet',
          currency: 'ZMW'
        };
      });

      const reqData = {
        description: validItems[0].item_name, // Primary description from first item
        delivery_location: 'Office',
        urgency: formData.urgency,
        required_date: formData.dateRequired,
        account_code: null,
        initiatorId: user.id,
        items: itemsWithSpecs,
        tax_type: formData.taxType // Include tax type
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
    // Validate at least one item has description
    const validItems = lineItems.filter(item => item.item_name.trim() !== '');
    if (validItems.length === 0) {
      alert('Please add at least one item with a description');
      return;
    }

    if (!formData.dateRequired) {
      alert('Please select a required date');
      return;
    }

    if (!formData.justification || formData.justification.trim() === '') {
      alert('Please provide a justification for this requisition');
      return;
    }

    // Validate that items with pricing have unit prices (only for procurement)
    if (user.role === 'procurement') {
      const itemsWithPrices = validItems.filter(item => item.unit_price && parseFloat(item.unit_price) > 0);
      if (itemsWithPrices.length === 0) {
        alert('Please provide unit price for at least one item');
        return;
      }
    }

    // If procurement is creating, they must select an HOD
    if (user.role === 'procurement' && !formData.selectedHod) {
      alert('Please select an HOD approver');
      return;
    }

    setLoading(true);
    try {
      // Add justification and calculate total_price for each item
      const itemsWithSpecs = validItems.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        return {
          item_name: item.item_name,
          quantity: qty,
          unit_price: price,
          total_price: qty * price,
          specifications: formData.justification,
          currency: 'ZMW'
        };
      });

      // First create as draft
      const reqData = {
        description: validItems[0].item_name, // Primary description from first item
        delivery_location: 'Office',
        urgency: formData.urgency,
        required_date: formData.dateRequired,
        account_code: null,
        initiatorId: user.id,
        items: itemsWithSpecs,
        tax_type: formData.taxType // Include tax type
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
    // Navigation Header
    React.createElement('div', { className: "flex gap-3 mb-4" },
      React.createElement('button', {
        onClick: () => setView('dashboard'),
        className: "inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-semibold hover:bg-blue-600 hover:text-white transition-all"
      }, "\u{1F3E0} Home"),
      React.createElement('button', {
        onClick: () => setView('dashboard'),
        className: "inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-200 transition-all"
      }, "\u2190 Back")
    ),
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
        // Line Items Section
        React.createElement('div', { className: "border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50" },
          React.createElement('div', { className: "flex items-center justify-between mb-4" },
            React.createElement('h3', { className: "text-lg font-semibold text-gray-800" },
              `Line Items (${lineItems.length}/15)`
            ),
            React.createElement('button', {
              onClick: addLineItem,
              disabled: lineItems.length >= 15,
              className: "px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            },
              React.createElement('span', null, '➕'),
              'Add Item'
            )
          ),
          React.createElement('div', { className: "space-y-4" },
            lineItems.map((item, index) =>
              React.createElement('div', {
                key: index,
                className: "bg-white border border-gray-300 rounded-lg p-4 relative"
              },
                React.createElement('div', { className: "flex items-center justify-between mb-3" },
                  React.createElement('span', { className: "text-sm font-semibold text-gray-700" },
                    `Item ${index + 1}`
                  ),
                  lineItems.length > 1 && React.createElement('button', {
                    onClick: () => removeLineItem(index),
                    className: "text-red-600 hover:text-red-800 font-medium text-sm flex items-center gap-1"
                  },
                    React.createElement('span', null, '🗑️'),
                    'Remove'
                  )
                ),
                React.createElement('div', { className: "grid grid-cols-3 gap-3" },
                  React.createElement('div', null,
                    React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" },
                      "Item Description *"
                    ),
                    React.createElement('input', {
                      type: "text",
                      value: item.item_name,
                      onChange: (e) => updateLineItem(index, 'item_name', e.target.value),
                      className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
                      placeholder: "e.g., Office Supplies"
                    })
                  ),
                  React.createElement('div', null,
                    React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" },
                      "Quantity *"
                    ),
                    React.createElement('input', {
                      type: "number",
                      min: "1",
                      value: item.quantity,
                      onChange: (e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1),
                      className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
                      placeholder: "Qty"
                    })
                  ),
                  React.createElement('div', null,
                    React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" },
                      hasRole(user.role, 'initiator') ? "Unit Price (ZMW)" : "Unit Price (ZMW) *"
                    ),
                    React.createElement('input', {
                      type: "number",
                      min: "0",
                      step: "0.01",
                      value: item.unit_price,
                      onChange: (e) => updateLineItem(index, 'unit_price', e.target.value),
                      disabled: hasRole(user.role, 'initiator'),
                      className: `w-full px-3 py-2 border rounded-lg ${hasRole(user.role, 'initiator') ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'}`,
                      placeholder: hasRole(user.role, 'initiator') ? 'To be filled by Procurement' : '0.00',
                      title: hasRole(user.role, 'initiator') ? 'Unit price will be filled by Procurement' : 'Enter unit price'
                    })
                  )
                ),
                // Display item total
                (item.quantity && item.unit_price) && React.createElement('div', { className: "mt-2 text-right" },
                  React.createElement('span', { className: "text-sm font-semibold text-gray-700" },
                    `Item Total: ZMW ${((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )
                )
              )
            )
          ),
          // Totals Summary (only show for procurement or if there are prices)
          (user.role === 'procurement' || calculateTotals().subtotal > 0) && React.createElement('div', { className: "mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg" },
            React.createElement('h4', { className: "text-sm font-semibold text-blue-900 mb-3" }, "💰 Requisition Totals"),
            hasRole(user.role, 'initiator') && calculateTotals().subtotal === 0 ?
              React.createElement('p', { className: "text-sm text-gray-600 italic" },
                "Unit prices will be filled by Procurement"
              ) :
              React.createElement('div', { className: "space-y-2" },
                React.createElement('div', { className: "flex justify-between text-sm" },
                  React.createElement('span', { className: "text-gray-700" }, "Subtotal:"),
                  React.createElement('span', { className: "font-semibold text-gray-900" },
                    `ZMW ${calculateTotals().subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )
                ),
                // Only show tax line for procurement users
                user.role === 'procurement' && formData.taxType === 'VAT' && React.createElement('div', { className: "flex justify-between text-sm" },
                  React.createElement('span', { className: "text-gray-700" }, "VAT (16%):"),
                  React.createElement('span', { className: "font-semibold text-gray-900" },
                    `ZMW ${calculateTotals().tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )
                ),
                // Show TOT notice if TOT is selected (procurement only)
                user.role === 'procurement' && formData.taxType === 'TOT' && React.createElement('div', { className: "flex justify-between text-sm" },
                  React.createElement('span', { className: "text-gray-700 italic" }, "Tax:"),
                  React.createElement('span', { className: "font-semibold text-gray-600 italic" }, "TOT - No Tax Applied")
                ),
                // Show note for initiators that tax will be determined by procurement
                hasRole(user.role, 'initiator') && calculateTotals().subtotal > 0 && React.createElement('div', { className: "flex justify-between text-sm" },
                  React.createElement('span', { className: "text-gray-700 italic" }, "Tax:"),
                  React.createElement('span', { className: "font-semibold text-gray-600 italic text-xs" }, "Will be determined by Procurement")
                ),
                React.createElement('div', { className: "flex justify-between text-base pt-2 border-t border-blue-300" },
                  React.createElement('span', { className: "font-bold text-blue-900" },
                    hasRole(user.role, 'initiator') ? "Subtotal:" : "Grand Total:"
                  ),
                  React.createElement('span', { className: "font-bold text-blue-900 text-lg" },
                    `ZMW ${calculateTotals().grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )
                )
              )
          )
        ),
        // General Requisition Details
        React.createElement('div', { className: "grid grid-cols-2 gap-4" },
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Date Required *"),
            React.createElement('input', {
              type: "date",
              value: formData.dateRequired,
              min: getCurrentDate(),
              onChange: (e) => setFormData({...formData, dateRequired: e.target.value}),
              className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Current Date"),
            React.createElement('div', { className: "px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900" },
              getCurrentDate()
            )
          )
        ),
        // Urgency and Tax Type (tax only for procurement)
        user.role === 'procurement'
          ? React.createElement('div', { className: "grid grid-cols-2 gap-4" },
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
                React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Tax Type *"),
                React.createElement('select', {
                  value: formData.taxType,
                  onChange: (e) => setFormData({...formData, taxType: e.target.value}),
                  className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                },
                  React.createElement('option', { value: "VAT" }, "VAT (16% Tax)"),
                  React.createElement('option', { value: "TOT" }, "TOT (No Tax)")
                )
              )
            )
          : React.createElement('div', null,
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
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Justification for Requisition *"),
          React.createElement('textarea', {
            rows: "4",
            value: formData.justification,
            onChange: (e) => setFormData({...formData, justification: e.target.value}),
            className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
            placeholder: "Explain the business need for this requisition and all items listed above..."
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

  // Download Approved Purchase Requisition PDF
  const downloadApprovedPDF = async () => {
    try {
      const blob = await api.downloadRequisitionPDF(req.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Approved_PR_${req.req_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(error.message || 'Failed to download Approved Purchase Requisition PDF.');
    }
  };

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
        // Finance can approve as HOD for pre-adjudication requisitions
        if (req.status === 'pending_hod' && !req.has_adjudication) {
          endpoint = `${API_URL}/requisitions/${req.id}/hod-approve`;
          successMessage = 'Requisition approved as HOD and sent to Procurement';
        } else {
          endpoint = `${API_URL}/requisitions/${req.id}/finance-approve`;
          successMessage = 'Requisition approved and sent to MD';
        }
      } else if (user.role === 'md') {
        // MD can approve as HOD for pre-adjudication requisitions
        if (req.status === 'pending_hod' && !req.has_adjudication) {
          endpoint = `${API_URL}/requisitions/${req.id}/hod-approve`;
          successMessage = 'Requisition approved as HOD and sent to Procurement';
        } else {
          endpoint = `${API_URL}/requisitions/${req.id}/md-approve`;
          successMessage = 'Requisition fully approved!';
        }
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
          // Finance can reject as HOD for pre-adjudication requisitions
          if (req.status === 'pending_hod' && !req.has_adjudication) {
            endpoint = `${API_URL}/requisitions/${req.id}/hod-approve`;
          } else {
            endpoint = `${API_URL}/requisitions/${req.id}/finance-approve`;
          }
        } else if (user.role === 'md') {
          // MD can reject as HOD for pre-adjudication requisitions
          if (req.status === 'pending_hod' && !req.has_adjudication) {
            endpoint = `${API_URL}/requisitions/${req.id}/hod-approve`;
          } else {
            endpoint = `${API_URL}/requisitions/${req.id}/md-approve`;
          }
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
  const isDraftEditable = hasRole(user.role, 'initiator') && req.status === 'draft' && req.created_by === user.id;
  const isInitiatorViewingApproved = hasRole(user.role, 'initiator') && (req.status === 'approved' || req.status === 'completed');

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
          ) : canApprove && !isInitiatorViewingApproved && React.createElement(React.Fragment, null,
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
          // Show greyed out buttons for initiators viewing approved requisitions
          isInitiatorViewingApproved && React.createElement(React.Fragment, null,
            React.createElement('button', {
              disabled: true,
              className: "flex-1 min-w-[140px] bg-gray-300 text-gray-500 py-3 px-4 rounded-lg font-semibold cursor-not-allowed opacity-60",
              title: "Initiators cannot approve requisitions"
            }, "Approve (Not Available)"),
            React.createElement('button', {
              disabled: true,
              className: "flex-1 min-w-[140px] bg-gray-300 text-gray-500 py-3 px-4 rounded-lg font-semibold cursor-not-allowed opacity-60",
              title: "Initiators cannot reject requisitions"
            }, "Reject (Not Available)")
          ),
          (req.status === 'approved' || req.status === 'completed') && React.createElement('button', {
            onClick: downloadApprovedPDF,
            className: "px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          },
            React.createElement('svg', {
              className: "h-5 w-5",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24"
            },
              React.createElement('path', {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              })
            ),
            "Download Approved PR"
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
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAllPendingItems();
  }, []);

  const fetchAllPendingItems = async () => {
    setLoading(true);
    try {
      // Fetch all types of requisitions/forms
      const [reqRes, expRes, eftRes, pcRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/requisitions`),
        fetchWithAuth(`${API_URL}/forms/expense-claims`),
        fetchWithAuth(`${API_URL}/forms/eft-requisitions`),
        fetchWithAuth(`${API_URL}/forms/petty-cash-requisitions`)
      ]);

      const requisitions = reqRes.ok ? await reqRes.json() : [];
      const expenseClaims = expRes.ok ? await expRes.json() : [];
      const eftRequisitions = eftRes.ok ? await eftRes.json() : [];
      const pettyCash = pcRes.ok ? await pcRes.json() : [];

      // Add type identifier to each item
      const taggedReqs = requisitions.map(r => ({ ...r, formType: 'purchase_requisition', displayType: 'Purchase Req' }));
      const taggedExp = expenseClaims.map(r => ({ ...r, formType: 'expense_claim', displayType: 'Expense Claim' }));
      const taggedEft = eftRequisitions.map(r => ({ ...r, formType: 'eft_requisition', displayType: 'EFT' }));
      const taggedPc = pettyCash.map(r => ({ ...r, formType: 'petty_cash', displayType: 'Petty Cash' }));

      const combinedItems = [...taggedReqs, ...taggedExp, ...taggedEft, ...taggedPc];

      // Filter based on user role and status
      let filtered = [];
      if (user.role === 'hod') {
        filtered = combinedItems.filter(item => item.status === 'pending_hod');
      } else if (user.role === 'finance') {
        filtered = combinedItems.filter(item =>
          item.status === 'pending_finance' ||
          item.status === 'hod_approved' ||
          (item.status === 'pending_hod' && !item.has_adjudication)
        );
      } else if (user.role === 'md') {
        filtered = combinedItems.filter(item =>
          item.status === 'pending_md' ||
          item.status === 'finance_approved' ||
          (item.status === 'pending_hod' && !item.has_adjudication)
        );
      } else if (user.role === 'admin') {
        filtered = combinedItems.filter(item =>
          item.status === 'pending_hod' ||
          item.status === 'pending_finance' ||
          item.status === 'pending_md' ||
          item.status === 'hod_approved' ||
          item.status === 'finance_approved'
        );
      }

      // Sort by created date, newest first
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setAllItems(filtered);
    } catch (error) {
      console.error('Error fetching items:', error);
      alert('Failed to load pending items');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (item) => {
    setSelectedReq(item);
    // Navigate to appropriate approval view based on form type
    if (item.formType === 'expense_claim') {
      setView('approve-expense-claim');
    } else if (item.formType === 'eft_requisition') {
      setView('approve-eft-requisition');
    } else if (item.formType === 'petty_cash') {
      setView('approve-petty-cash');
    } else {
      setView('approve');
    }
  };

  // Filter items based on selected filter
  const filteredItems = filter === 'all' ? allItems : allItems.filter(item => item.formType === filter);

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pending_hod': { label: 'Pending HOD', color: 'bg-yellow-100 text-yellow-800' },
      'pending_finance': { label: 'Pending Finance', color: 'bg-blue-100 text-blue-800' },
      'pending_md': { label: 'Pending MD', color: 'bg-purple-100 text-purple-800' },
      'hod_approved': { label: 'HOD Approved', color: 'bg-green-100 text-green-800' },
      'finance_approved': { label: 'Finance Approved', color: 'bg-green-100 text-green-800' }
    };
    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return React.createElement('span', {
      className: `px-2 py-1 text-xs font-semibold rounded-full ${config.color}`
    }, config.label);
  };

  const getTypeBadge = (displayType) => {
    const typeColors = {
      'Purchase Req': 'bg-indigo-100 text-indigo-800',
      'Expense Claim': 'bg-pink-100 text-pink-800',
      'EFT': 'bg-cyan-100 text-cyan-800',
      'Petty Cash': 'bg-orange-100 text-orange-800'
    };
    return React.createElement('span', {
      className: `px-2 py-1 text-xs font-semibold rounded-full ${typeColors[displayType] || 'bg-gray-100 text-gray-800'}`
    }, displayType);
  };

  const getItemAmount = (item) => {
    return item.total_amount || item.total_claim || item.amount || 0;
  };

  const getItemDescription = (item) => {
    return item.description || item.purpose || item.reason_for_trip || item.in_favour_of || 'N/A';
  };

  const getItemInitiator = (item) => {
    return item.created_by_name || item.initiator_name || item.employee_name || item.payee_name || 'N/A';
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
          `Approval Console - ${user.role.toUpperCase()}`
        ),
        React.createElement('div', { className: "flex gap-3" },
          React.createElement('select', {
            value: filter,
            onChange: (e) => setFilter(e.target.value),
            className: "px-3 py-2 border border-gray-300 rounded-lg text-sm"
          },
            React.createElement('option', { value: 'all' }, 'All Types'),
            React.createElement('option', { value: 'purchase_requisition' }, 'Purchase Requisitions'),
            React.createElement('option', { value: 'expense_claim' }, 'Expense Claims'),
            React.createElement('option', { value: 'eft_requisition' }, 'EFT Requisitions'),
            React.createElement('option', { value: 'petty_cash' }, 'Petty Cash')
          ),
          React.createElement('button', {
            onClick: fetchAllPendingItems,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          }, 'Refresh')
        )
      ),

      // Summary Cards
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" },
        React.createElement('div', { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4" },
          React.createElement('div', { className: "text-yellow-800 text-sm font-medium" }, "Pending Approval"),
          React.createElement('div', { className: "text-3xl font-bold text-yellow-900 mt-2" }, filteredItems.length)
        ),
        React.createElement('div', { className: "bg-green-50 border border-green-200 rounded-lg p-4" },
          React.createElement('div', { className: "text-green-800 text-sm font-medium" }, "Total Amount"),
          React.createElement('div', { className: "text-3xl font-bold text-green-900 mt-2" },
            `K ${filteredItems.reduce((sum, item) => sum + (parseFloat(getItemAmount(item)) || 0), 0).toLocaleString()}`
          )
        ),
        React.createElement('div', { className: "bg-indigo-50 border border-indigo-200 rounded-lg p-4" },
          React.createElement('div', { className: "text-indigo-800 text-sm font-medium" }, "Purchase Reqs"),
          React.createElement('div', { className: "text-3xl font-bold text-indigo-900 mt-2" },
            allItems.filter(i => i.formType === 'purchase_requisition').length
          )
        ),
        React.createElement('div', { className: "bg-pink-50 border border-pink-200 rounded-lg p-4" },
          React.createElement('div', { className: "text-pink-800 text-sm font-medium" }, "Forms"),
          React.createElement('div', { className: "text-3xl font-bold text-pink-900 mt-2" },
            allItems.filter(i => i.formType !== 'purchase_requisition').length
          )
        )
      ),

      // Items Table
      filteredItems.length === 0
        ? React.createElement('div', { className: "text-center py-12" },
            React.createElement('p', { className: "text-gray-500 text-lg" }, "No items pending your approval"),
            React.createElement('p', { className: "text-gray-400 text-sm mt-2" }, "Great! You're all caught up.")
          )
        : React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Type"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Ref #"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Description"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Amount"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Initiator"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Status"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Date"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Action")
                )
              ),
              React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                filteredItems.map(item =>
                  React.createElement('tr', {
                    key: item.id || item._id,
                    className: "hover:bg-gray-50 transition-colors"
                  },
                    React.createElement('td', { className: "px-4 py-4 whitespace-nowrap" }, getTypeBadge(item.displayType)),
                    React.createElement('td', { className: "px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600" },
                      item.req_number || item.id || 'N/A'
                    ),
                    React.createElement('td', { className: "px-4 py-4 text-sm text-gray-900" },
                      React.createElement('div', { className: "max-w-xs truncate" }, getItemDescription(item))
                    ),
                    React.createElement('td', { className: "px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900" },
                      `K ${parseFloat(getItemAmount(item)).toLocaleString()}`
                    ),
                    React.createElement('td', { className: "px-4 py-4 whitespace-nowrap text-sm text-gray-600" }, getItemInitiator(item)),
                    React.createElement('td', { className: "px-4 py-4 whitespace-nowrap" }, getStatusBadge(item.status)),
                    React.createElement('td', { className: "px-4 py-4 whitespace-nowrap text-sm text-gray-500" },
                      new Date(item.created_at).toLocaleDateString()
                    ),
                    React.createElement('td', { className: "px-4 py-4 whitespace-nowrap" },
                      React.createElement('button', {
                        onClick: () => handleReview(item),
                        className: "px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      }, 'Review')
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
// APPROVE EXPENSE CLAIM COMPONENT
// ============================================
function ApproveExpenseClaim({ claim, user, setView }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  if (!claim) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-500" }, "No expense claim selected"),
      React.createElement('button', {
        onClick: () => setView('approval-console'),
        className: "mt-4 text-blue-600 hover:text-blue-800"
      }, "Back to Approval Console")
    );
  }

  const handleApprove = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/forms/expense-claims/${claim._id || claim.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          approver_role: user.role,
          approver_name: user.name,
          comments: comment || 'Approved'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Approval failed');
      }

      alert('Expense claim approved successfully!');
      setView('approval-console');
    } catch (error) {
      console.error('Error approving expense claim:', error);
      alert(error.message || 'Error approving expense claim');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/forms/expense-claims/${claim._id || claim.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: false,
          approver_role: user.role,
          approver_name: user.name,
          comments: comment
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Rejection failed');
      }

      alert('Expense claim rejected');
      setView('approval-console');
    } catch (error) {
      console.error('Error rejecting expense claim:', error);
      alert(error.message || 'Error rejecting expense claim');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement('div', { className: "max-w-4xl mx-auto" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-8" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Review Expense Claim"),
        React.createElement('span', {
          className: `px-4 py-2 rounded-full text-sm font-medium bg-pink-100 text-pink-700`
        }, claim.status?.replace('_', ' ').toUpperCase() || 'PENDING')
      ),

      // Claim Details
      React.createElement('div', { className: "space-y-6" },
        React.createElement('div', { className: "grid grid-cols-2 gap-6" },
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Claim ID"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, claim.id)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Employee"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, claim.employee_name || claim.initiator_name)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Department"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, claim.department)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Total Claim Amount"),
            React.createElement('p', { className: "text-2xl font-bold text-green-600" }, `K ${parseFloat(claim.total_claim || claim.amount || 0).toLocaleString()}`)
          )
        ),

        // Items Section
        claim.items && claim.items.length > 0 && React.createElement('div', { className: "mt-6" },
          React.createElement('h3', { className: "text-lg font-semibold text-gray-800 mb-3" }, "Expense Items"),
          React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full border" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-4 py-2 text-left text-xs font-medium text-gray-500" }, "#"),
                  React.createElement('th', { className: "px-4 py-2 text-left text-xs font-medium text-gray-500" }, "Description"),
                  React.createElement('th', { className: "px-4 py-2 text-left text-xs font-medium text-gray-500" }, "Amount")
                )
              ),
              React.createElement('tbody', null,
                claim.items.map((item, idx) =>
                  React.createElement('tr', { key: idx, className: "border-t" },
                    React.createElement('td', { className: "px-4 py-2 text-sm" }, idx + 1),
                    React.createElement('td', { className: "px-4 py-2 text-sm" }, item.description || item.item_description),
                    React.createElement('td', { className: "px-4 py-2 text-sm font-semibold" }, `K ${parseFloat(item.amount || item.total || 0).toLocaleString()}`)
                  )
                )
              )
            )
          )
        ),

        // Purpose/Reason
        React.createElement('div', { className: "p-4 bg-gray-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Purpose / Reason for Trip"),
          React.createElement('p', { className: "text-gray-900" }, claim.reason_for_trip || claim.purpose || 'N/A')
        ),

        // Comments Section
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Comments"),
          React.createElement('textarea', {
            value: comment,
            onChange: (e) => setComment(e.target.value),
            placeholder: "Add your comments here (required for rejection)...",
            className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
            rows: 3
          })
        ),

        // Action Buttons
        React.createElement('div', { className: "flex gap-4 mt-6" },
          React.createElement('button', {
            onClick: handleApprove,
            disabled: loading,
            className: "flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
          }, loading ? 'Processing...' : 'Approve'),
          React.createElement('button', {
            onClick: handleReject,
            disabled: loading,
            className: "flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          }, loading ? 'Processing...' : 'Reject'),
          React.createElement('button', {
            onClick: () => setView('approval-console'),
            className: "px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          }, 'Cancel')
        )
      )
    )
  );
}

// ============================================
// APPROVE EFT REQUISITION COMPONENT
// ============================================
function ApproveEFTRequisition({ requisition, user, setView }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  if (!requisition) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-500" }, "No EFT requisition selected"),
      React.createElement('button', {
        onClick: () => setView('approval-console'),
        className: "mt-4 text-blue-600 hover:text-blue-800"
      }, "Back to Approval Console")
    );
  }

  const handleApprove = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/forms/eft-requisitions/${requisition._id || requisition.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          approver_role: user.role,
          approver_name: user.name,
          comments: comment || 'Approved'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Approval failed');
      }

      alert('EFT requisition approved successfully!');
      setView('approval-console');
    } catch (error) {
      console.error('Error approving EFT requisition:', error);
      alert(error.message || 'Error approving EFT requisition');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/forms/eft-requisitions/${requisition._id || requisition.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: false,
          approver_role: user.role,
          approver_name: user.name,
          comments: comment
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Rejection failed');
      }

      alert('EFT requisition rejected');
      setView('approval-console');
    } catch (error) {
      console.error('Error rejecting EFT requisition:', error);
      alert(error.message || 'Error rejecting EFT requisition');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement('div', { className: "max-w-4xl mx-auto" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-8" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Review EFT Requisition"),
        React.createElement('span', {
          className: `px-4 py-2 rounded-full text-sm font-medium bg-cyan-100 text-cyan-700`
        }, requisition.status?.replace('_', ' ').toUpperCase() || 'PENDING')
      ),

      // Requisition Details
      React.createElement('div', { className: "space-y-6" },
        React.createElement('div', { className: "grid grid-cols-2 gap-6" },
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Requisition ID"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.id)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Initiator"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.initiator_name)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Department"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.department)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Amount"),
            React.createElement('p', { className: "text-2xl font-bold text-green-600" }, `K ${parseFloat(requisition.amount || 0).toLocaleString()}`)
          )
        ),

        // Payment Details
        React.createElement('div', { className: "grid grid-cols-2 gap-6 p-4 bg-blue-50 rounded-lg" },
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "In Favour Of"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.in_favour_of || 'N/A')
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Bank"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.bank_name || 'N/A')
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Account Number"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.bank_account_number || requisition.account_number || 'N/A')
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Branch"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.branch || requisition.branch_code || 'N/A')
          )
        ),

        // Purpose
        React.createElement('div', { className: "p-4 bg-gray-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Purpose"),
          React.createElement('p', { className: "text-gray-900" }, requisition.purpose || requisition.description || 'N/A')
        ),

        // Amount in Words
        requisition.amount_in_words && React.createElement('div', { className: "p-4 bg-yellow-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Amount in Words"),
          React.createElement('p', { className: "text-gray-900 italic" }, requisition.amount_in_words)
        ),

        // Comments Section
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Comments"),
          React.createElement('textarea', {
            value: comment,
            onChange: (e) => setComment(e.target.value),
            placeholder: "Add your comments here (required for rejection)...",
            className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
            rows: 3
          })
        ),

        // Action Buttons
        React.createElement('div', { className: "flex gap-4 mt-6" },
          React.createElement('button', {
            onClick: handleApprove,
            disabled: loading,
            className: "flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
          }, loading ? 'Processing...' : 'Approve'),
          React.createElement('button', {
            onClick: handleReject,
            disabled: loading,
            className: "flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          }, loading ? 'Processing...' : 'Reject'),
          React.createElement('button', {
            onClick: () => setView('approval-console'),
            className: "px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          }, 'Cancel')
        )
      )
    )
  );
}

// ============================================
// APPROVE PETTY CASH COMPONENT
// ============================================
function ApprovePettyCash({ requisition, user, setView }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  if (!requisition) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-500" }, "No petty cash requisition selected"),
      React.createElement('button', {
        onClick: () => setView('approval-console'),
        className: "mt-4 text-blue-600 hover:text-blue-800"
      }, "Back to Approval Console")
    );
  }

  const handleApprove = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/forms/petty-cash-requisitions/${requisition._id || requisition.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          approver_role: user.role,
          approver_name: user.name,
          comments: comment || 'Approved'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Approval failed');
      }

      alert('Petty cash requisition approved successfully!');
      setView('approval-console');
    } catch (error) {
      console.error('Error approving petty cash requisition:', error);
      alert(error.message || 'Error approving petty cash requisition');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/forms/petty-cash-requisitions/${requisition._id || requisition.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: false,
          approver_role: user.role,
          approver_name: user.name,
          comments: comment
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Rejection failed');
      }

      alert('Petty cash requisition rejected');
      setView('approval-console');
    } catch (error) {
      console.error('Error rejecting petty cash requisition:', error);
      alert(error.message || 'Error rejecting petty cash requisition');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement('div', { className: "max-w-4xl mx-auto" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-8" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Review Petty Cash Requisition"),
        React.createElement('span', {
          className: `px-4 py-2 rounded-full text-sm font-medium bg-orange-100 text-orange-700`
        }, requisition.status?.replace('_', ' ').toUpperCase() || 'PENDING')
      ),

      // Requisition Details
      React.createElement('div', { className: "space-y-6" },
        React.createElement('div', { className: "grid grid-cols-2 gap-6" },
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Requisition ID"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.id)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Payee"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.payee_name || requisition.initiator_name)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Department"),
            React.createElement('p', { className: "text-lg font-semibold text-gray-900" }, requisition.department)
          ),
          React.createElement('div', null,
            React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Total Amount"),
            React.createElement('p', { className: "text-2xl font-bold text-green-600" }, `K ${parseFloat(requisition.amount || 0).toLocaleString()}`)
          )
        ),

        // Items Section
        requisition.items && requisition.items.length > 0 && React.createElement('div', { className: "mt-6" },
          React.createElement('h3', { className: "text-lg font-semibold text-gray-800 mb-3" }, "Items"),
          React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full border" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-4 py-2 text-left text-xs font-medium text-gray-500" }, "#"),
                  React.createElement('th', { className: "px-4 py-2 text-left text-xs font-medium text-gray-500" }, "Description"),
                  React.createElement('th', { className: "px-4 py-2 text-left text-xs font-medium text-gray-500" }, "Qty"),
                  React.createElement('th', { className: "px-4 py-2 text-left text-xs font-medium text-gray-500" }, "Amount")
                )
              ),
              React.createElement('tbody', null,
                requisition.items.map((item, idx) =>
                  React.createElement('tr', { key: idx, className: "border-t" },
                    React.createElement('td', { className: "px-4 py-2 text-sm" }, item.item_no || idx + 1),
                    React.createElement('td', { className: "px-4 py-2 text-sm" }, item.description),
                    React.createElement('td', { className: "px-4 py-2 text-sm" }, item.quantity || 1),
                    React.createElement('td', { className: "px-4 py-2 text-sm font-semibold" }, `K ${parseFloat(item.amount || 0).toLocaleString()}`)
                  )
                )
              )
            )
          )
        ),

        // Purpose
        React.createElement('div', { className: "p-4 bg-gray-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Purpose"),
          React.createElement('p', { className: "text-gray-900" }, requisition.purpose || requisition.description || 'N/A')
        ),

        // Amount in Words
        requisition.amount_in_words && React.createElement('div', { className: "p-4 bg-yellow-50 rounded-lg" },
          React.createElement('p', { className: "text-sm text-gray-600 mb-1" }, "Amount in Words"),
          React.createElement('p', { className: "text-gray-900 italic" }, requisition.amount_in_words)
        ),

        // Comments Section
        React.createElement('div', null,
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, "Comments"),
          React.createElement('textarea', {
            value: comment,
            onChange: (e) => setComment(e.target.value),
            placeholder: "Add your comments here (required for rejection)...",
            className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
            rows: 3
          })
        ),

        // Action Buttons
        React.createElement('div', { className: "flex gap-4 mt-6" },
          React.createElement('button', {
            onClick: handleApprove,
            disabled: loading,
            className: "flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
          }, loading ? 'Processing...' : 'Approve'),
          React.createElement('button', {
            onClick: handleReject,
            disabled: loading,
            className: "flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          }, loading ? 'Processing...' : 'Reject'),
          React.createElement('button', {
            onClick: () => setView('approval-console'),
            className: "px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          }, 'Cancel')
        )
      )
    )
  );
}

// ============================================
// PETTY CASH REQUISITIONS LIST COMPONENT
// ============================================
function PettyCashRequisitionsList({ user, setView, setSelectedReq }) {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPettyCashRequisitions();
  }, []);

  const fetchPettyCashRequisitions = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/forms/petty-cash-requisitions`);
      if (!res.ok) throw new Error('Failed to fetch petty cash requisitions');
      const data = await res.json();
      setRequisitions(data);
    } catch (error) {
      console.error('Error fetching petty cash requisitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (req) => {
    setSelectedReq(req);
    setView('approve-petty-cash');
  };

  if (loading) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-600" }, "Loading petty cash requisitions...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Petty Cash Requisitions"),
        React.createElement('button', {
          onClick: fetchPettyCashRequisitions,
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        }, 'Refresh')
      ),

      requisitions.length === 0
        ? React.createElement('div', { className: "text-center py-12" },
            React.createElement('p', { className: "text-gray-500" }, "No petty cash requisitions found")
          )
        : React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "ID"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Payee"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Purpose"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Amount"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Status"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Date"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Action")
                )
              ),
              React.createElement('tbody', { className: "divide-y divide-gray-200" },
                requisitions.map(req =>
                  React.createElement('tr', { key: req._id || req.id, className: "hover:bg-gray-50" },
                    React.createElement('td', { className: "px-4 py-3 text-sm font-medium text-blue-600" }, req.id),
                    React.createElement('td', { className: "px-4 py-3 text-sm" }, req.payee_name),
                    React.createElement('td', { className: "px-4 py-3 text-sm" }, req.purpose),
                    React.createElement('td', { className: "px-4 py-3 text-sm font-semibold" }, `K ${parseFloat(req.amount || 0).toLocaleString()}`),
                    React.createElement('td', { className: "px-4 py-3" },
                      React.createElement('span', {
                        className: `px-2 py-1 text-xs font-semibold rounded-full ${
                          req.status === 'approved' ? 'bg-green-100 text-green-800' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`
                      }, req.status?.replace('_', ' ').toUpperCase() || 'PENDING')
                    ),
                    React.createElement('td', { className: "px-4 py-3 text-sm text-gray-500" },
                      new Date(req.created_at).toLocaleDateString()
                    ),
                    React.createElement('td', { className: "px-4 py-3" },
                      React.createElement('button', {
                        onClick: () => handleView(req),
                        className: "px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      }, 'View')
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
// EXPENSE CLAIMS LIST COMPONENT
// ============================================
function ExpenseClaimsList({ user, setView, setSelectedReq }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenseClaims();
  }, []);

  const fetchExpenseClaims = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/forms/expense-claims`);
      if (!res.ok) throw new Error('Failed to fetch expense claims');
      const data = await res.json();
      setClaims(data);
    } catch (error) {
      console.error('Error fetching expense claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (claim) => {
    setSelectedReq(claim);
    setView('approve-expense-claim');
  };

  const canApprove = (claim) => {
    if (user.role === 'hod' && claim.status === 'pending_hod') return true;
    if (user.role === 'finance' && (claim.status === 'pending_finance' || claim.status === 'hod_approved')) return true;
    if (user.role === 'md' && (claim.status === 'pending_md' || claim.status === 'finance_approved')) return true;
    if (user.role === 'admin') return true;
    return false;
  };

  if (loading) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-600" }, "Loading expense claims...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Expense Claims"),
        React.createElement('div', { className: "flex gap-3" },
          React.createElement('a', {
            href: 'expense-claim.html',
            className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          }, '+ New Expense Claim'),
          React.createElement('button', {
            onClick: fetchExpenseClaims,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, 'Refresh')
        )
      ),

      claims.length === 0
        ? React.createElement('div', { className: "text-center py-12" },
            React.createElement('p', { className: "text-gray-500" }, "No expense claims found")
          )
        : React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "ID"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Employee"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Reason"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Amount"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Status"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Date"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Action")
                )
              ),
              React.createElement('tbody', { className: "divide-y divide-gray-200" },
                claims.map(claim =>
                  React.createElement('tr', { key: claim._id || claim.id, className: "hover:bg-gray-50" },
                    React.createElement('td', { className: "px-4 py-3 text-sm font-medium text-blue-600" }, claim.id),
                    React.createElement('td', { className: "px-4 py-3 text-sm" }, claim.employee_name || claim.initiator_name),
                    React.createElement('td', { className: "px-4 py-3 text-sm max-w-xs truncate" }, claim.reason_for_trip || 'N/A'),
                    React.createElement('td', { className: "px-4 py-3 text-sm font-semibold" }, `K ${parseFloat(claim.total_claim || claim.amount || 0).toLocaleString()}`),
                    React.createElement('td', { className: "px-4 py-3" },
                      React.createElement('span', {
                        className: `px-2 py-1 text-xs font-semibold rounded-full ${
                          claim.status === 'approved' ? 'bg-green-100 text-green-800' :
                          claim.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`
                      }, claim.status?.replace('_', ' ').toUpperCase() || 'PENDING')
                    ),
                    React.createElement('td', { className: "px-4 py-3 text-sm text-gray-500" },
                      new Date(claim.created_at).toLocaleDateString()
                    ),
                    React.createElement('td', { className: "px-4 py-3" },
                      React.createElement('div', { className: "flex gap-2" },
                        React.createElement('button', {
                          onClick: () => handleView(claim),
                          className: "px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        }, 'View'),
                        canApprove(claim) && claim.status.includes('pending') && React.createElement('button', {
                          onClick: () => handleView(claim),
                          className: "px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        }, 'Review')
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

// ============================================
// EFT REQUISITIONS LIST COMPONENT
// ============================================
function EFTRequisitionsList({ user, setView, setSelectedReq }) {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEFTRequisitions();
  }, []);

  const fetchEFTRequisitions = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/forms/eft-requisitions`);
      if (!res.ok) throw new Error('Failed to fetch EFT requisitions');
      const data = await res.json();
      setRequisitions(data);
    } catch (error) {
      console.error('Error fetching EFT requisitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (req) => {
    setSelectedReq(req);
    setView('approve-eft-requisition');
  };

  const canApprove = (req) => {
    if (user.role === 'hod' && req.status === 'pending_hod') return true;
    if (user.role === 'finance' && (req.status === 'pending_finance' || req.status === 'hod_approved')) return true;
    if (user.role === 'md' && (req.status === 'pending_md' || req.status === 'finance_approved')) return true;
    if (user.role === 'admin') return true;
    return false;
  };

  if (loading) {
    return React.createElement('div', { className: "text-center py-12" },
      React.createElement('p', { className: "text-gray-600" }, "Loading EFT requisitions...")
    );
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('div', { className: "flex items-center justify-between mb-6" },
        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "EFT Requisitions"),
        React.createElement('div', { className: "flex gap-3" },
          React.createElement('a', {
            href: 'eft-requisition.html',
            className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          }, '+ New EFT'),
          React.createElement('button', {
            onClick: fetchEFTRequisitions,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, 'Refresh')
        )
      ),

      requisitions.length === 0
        ? React.createElement('div', { className: "text-center py-12" },
            React.createElement('p', { className: "text-gray-500" }, "No EFT requisitions found")
          )
        : React.createElement('div', { className: "overflow-x-auto" },
            React.createElement('table', { className: "w-full" },
              React.createElement('thead', { className: "bg-gray-50" },
                React.createElement('tr', null,
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "ID"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "In Favour Of"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Purpose"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Amount"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Status"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Date"),
                  React.createElement('th', { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Action")
                )
              ),
              React.createElement('tbody', { className: "divide-y divide-gray-200" },
                requisitions.map(req =>
                  React.createElement('tr', { key: req._id || req.id, className: "hover:bg-gray-50" },
                    React.createElement('td', { className: "px-4 py-3 text-sm font-medium text-blue-600" }, req.id),
                    React.createElement('td', { className: "px-4 py-3 text-sm" }, req.in_favour_of),
                    React.createElement('td', { className: "px-4 py-3 text-sm max-w-xs truncate" }, req.purpose || req.description || 'N/A'),
                    React.createElement('td', { className: "px-4 py-3 text-sm font-semibold" }, `K ${parseFloat(req.amount || 0).toLocaleString()}`),
                    React.createElement('td', { className: "px-4 py-3" },
                      React.createElement('span', {
                        className: `px-2 py-1 text-xs font-semibold rounded-full ${
                          req.status === 'approved' ? 'bg-green-100 text-green-800' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`
                      }, req.status?.replace('_', ' ').toUpperCase() || 'PENDING')
                    ),
                    React.createElement('td', { className: "px-4 py-3 text-sm text-gray-500" },
                      new Date(req.created_at).toLocaleDateString()
                    ),
                    React.createElement('td', { className: "px-4 py-3" },
                      React.createElement('div', { className: "flex gap-2" },
                        React.createElement('button', {
                          onClick: () => handleView(req),
                          className: "px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        }, 'View'),
                        canApprove(req) && req.status.includes('pending') && React.createElement('button', {
                          onClick: () => handleView(req),
                          className: "px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        }, 'Review')
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

// ============================================
// CREATE EXPENSE CLAIM COMPONENT (Redirect to HTML)
// ============================================
function CreateExpenseClaim({ user, setView }) {
  useEffect(() => {
    // Redirect to the HTML form
    window.location.href = 'expense-claim.html';
  }, []);

  return React.createElement('div', { className: "text-center py-12" },
    React.createElement('p', { className: "text-gray-600" }, "Redirecting to Expense Claim form...")
  );
}

// ============================================
// CREATE EFT REQUISITION COMPONENT (Redirect to HTML)
// ============================================
function CreateEFTRequisition({ user, setView }) {
  useEffect(() => {
    // Redirect to the HTML form
    window.location.href = 'eft-requisition.html';
  }, []);

  return React.createElement('div', { className: "text-center py-12" },
    React.createElement('p', { className: "text-gray-600" }, "Redirecting to EFT Requisition form...")
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
              hasRole(user.role, 'initiator')
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
  const [creatingBudget, setCreatingBudget] = useState(null);

  useEffect(() => {
    loadBudgets();
  }, [fiscalYear]);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const data = await api.getAllDepartmentsWithBudgets(fiscalYear);
      setBudgets(data);
    } catch (error) {
      alert('Failed to load departments: ' + error.message);
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

  const handleCreateBudget = async (department) => {
    if (!newAllocation || newAllocation <= 0) {
      alert('Please enter a valid allocation amount');
      return;
    }
    try {
      await api.createBudget(department, parseFloat(newAllocation), fiscalYear);
      alert('Budget created successfully');
      setCreatingBudget(null);
      setNewAllocation('');
      loadBudgets();
    } catch (error) {
      alert('Failed to create budget: ' + error.message);
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
        budgets.map(dept =>
          React.createElement('div', {
            key: dept.dept_id || dept.department,
            className: "p-4 border rounded-lg hover:shadow-md transition-shadow"
          },
            React.createElement('h3', {
              onClick: () => dept.budget_id && loadDeptDetails(dept.department),
              className: `font-semibold text-gray-800 mb-2 ${dept.budget_id ? 'cursor-pointer hover:text-blue-600' : 'text-gray-500'}`
            }, dept.department),
            React.createElement('p', { className: "text-xs text-gray-500 mb-2" }, `Code: ${dept.dept_code || 'N/A'}`),
            !dept.budget_id ? React.createElement('div', { className: "space-y-2" },
              React.createElement('p', { className: "text-sm text-orange-600 font-medium mb-2" }, "No Budget Allocated"),
              creatingBudget === dept.department ? React.createElement('div', { className: "space-y-2" },
                React.createElement('input', {
                  type: "number",
                  value: newAllocation,
                  onChange: (e) => setNewAllocation(e.target.value),
                  placeholder: "Enter allocation",
                  className: "w-full px-2 py-1 border rounded text-sm"
                }),
                React.createElement('div', { className: "flex gap-1" },
                  React.createElement('button', {
                    onClick: () => handleCreateBudget(dept.department),
                    className: "flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  }, "Create"),
                  React.createElement('button', {
                    onClick: () => {
                      setCreatingBudget(null);
                      setNewAllocation('');
                    },
                    className: "flex-1 px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                  }, "Cancel")
                )
              ) : React.createElement('button', {
                onClick: () => {
                  setCreatingBudget(dept.department);
                  setNewAllocation('');
                },
                className: "w-full px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              }, "Allocate Budget")
            ) : editingBudget === dept.budget_id ? React.createElement('div', { className: "space-y-2 mb-2" },
              React.createElement('input', {
                type: "number",
                value: newAllocation,
                onChange: (e) => setNewAllocation(e.target.value),
                placeholder: "New allocation",
                className: "w-full px-2 py-1 border rounded text-sm"
              }),
              React.createElement('div', { className: "flex gap-1" },
                React.createElement('button', {
                  onClick: () => handleUpdateAllocation(dept.budget_id),
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
                `Allocated: ZMW ${(dept.allocated_amount || 0).toLocaleString()}`
              ),
              React.createElement('p', { className: "text-sm text-gray-600 mb-1" },
                `Committed: ZMW ${(dept.committed_amount || 0).toLocaleString()}`
              ),
              React.createElement('p', { className: "text-sm text-gray-600 mb-2" },
                `Available: ZMW ${(dept.available_amount || 0).toLocaleString()}`
              )
            ),
            dept.budget_id && React.createElement('div', {
              className: `px-3 py-1 rounded-full text-xs font-semibold mb-2 ${getUtilizationColor(dept.utilization_percentage || 0)}`
            }, `${(dept.utilization_percentage || 0).toFixed(1)}% Used`),
            dept.budget_id && React.createElement('div', { className: "flex gap-1 mt-2" },
              (user.role === 'finance' || user.role === 'md' || user.role === 'admin') && editingBudget !== dept.budget_id && React.createElement('button', {
                onClick: () => {
                  setEditingBudget(dept.budget_id);
                  setNewAllocation(dept.allocated_amount);
                },
                className: "flex-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
              }, "Edit"),
              // COMMENTED OUT: Departmental PDF download - replaced with approved requisition download for initiators
              /* React.createElement('button', {
                onClick: () => api.downloadDepartmentPDF(dept.department, fiscalYear),
                className: "flex-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
              }, "PDF") */
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
      const data = await api.getRequisitions(user?.id, user?.role);
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
      React.createElement('h2', { className: "text-2xl font-bold text-gray-800 mb-4" }, "Adjudication Management"),

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