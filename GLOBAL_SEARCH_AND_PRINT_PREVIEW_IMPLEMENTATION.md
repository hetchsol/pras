# Global Search and Print Preview Implementation Guide

**Date:** December 2, 2025
**Status:** Ready for Implementation

---

## Overview

This document outlines the implementation of two major features:
1. **Global Search** - Search across requisitions, EFTs, expense claims, and users
2. **Print Preview** - Preview reports before printing

---

## 1. Global Search Feature

### Frontend Implementation

#### A. Create Global Search Component

Add this component before the `Header` function in `frontend/app.js` (around line 1786):

```javascript
// Global Search Component
function GlobalSearch({ setView, setSelectedReq }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search function
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults(null);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.globalSearch(searchQuery);
        setSearchResults(results);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleResultClick = (result) => {
    setShowResults(false);
    setSearchQuery('');

    if (result.type === 'requisition') {
      setSelectedReq(result.data);
      setView('requisition-detail');
    } else if (result.type === 'eft') {
      // Navigate to EFT form dashboard with the EFT selected
      window.location.href = `forms-dashboard.html?id=${result.data.id}`;
    } else if (result.type === 'expense_claim') {
      // Navigate to forms dashboard with expense claim selected
      window.location.href = `forms-dashboard.html?id=${result.data.id}`;
    } else if (result.type === 'user') {
      // Could navigate to admin panel or show user details
      setView('admin');
    }
  };

  const getResultIcon = (type) => {
    const icons = {
      requisition: '📋',
      eft: '💳',
      expense_claim: '📝',
      user: '👤'
    };
    return icons[type] || '📄';
  };

  const getResultLabel = (type) => {
    const labels = {
      requisition: 'Requisition',
      eft: 'EFT Requisition',
      expense_claim: 'Expense Claim',
      user: 'User'
    };
    return labels[type] || type;
  };

  return React.createElement('div', {
    className: "relative w-full max-w-md",
    style: { position: 'relative' }
  },
    // Search Input
    React.createElement('div', { className: "relative" },
      React.createElement('input', {
        type: "text",
        placeholder: "Search requisitions, EFTs, claims, users...",
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        onFocus: () => searchResults && setShowResults(true),
        className: "w-full px-4 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        style: {
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-color)'
        }
      }),
      // Search Icon
      React.createElement('div', {
        className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
      }, '🔍'),
      // Loading Spinner
      isSearching && React.createElement('div', {
        className: "absolute right-3 top-1/2 transform -translate-y-1/2"
      }, React.createElement('div', {
        className: "animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"
      })),
      // Clear Button
      searchQuery && !isSearching && React.createElement('button', {
        onClick: () => {
          setSearchQuery('');
          setSearchResults(null);
          setShowResults(false);
        },
        className: "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
      }, '✕')
    ),

    // Search Results Dropdown
    showResults && searchResults && React.createElement('div', {
      className: "absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50",
      style: {
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)',
        boxShadow: 'var(--shadow-lg)'
      }
    },
      // Results count
      React.createElement('div', {
        className: "px-4 py-2 text-sm text-gray-500 border-b",
        style: { borderColor: 'var(--border-color)', color: 'var(--text-tertiary)' }
      }, `Found ${searchResults.requisitions.length + searchResults.efts.length + searchResults.expense_claims.length + searchResults.users.length} results`),

      // Requisitions
      searchResults.requisitions.length > 0 && [
        React.createElement('div', {
          key: 'req-header',
          className: "px-4 py-2 text-xs font-semibold text-gray-400 bg-gray-50",
          style: { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }
        }, 'REQUISITIONS'),
        ...searchResults.requisitions.map(req =>
          React.createElement('button', {
            key: `req-${req.id}`,
            onClick: () => handleResultClick({ type: 'requisition', data: req }),
            className: "w-full px-4 py-3 text-left hover:bg-gray-50 border-b transition-colors",
            style: {
              borderColor: 'var(--border-color)'
            },
            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)',
            onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent'
          },
            React.createElement('div', { className: "flex items-start gap-3" },
              React.createElement('span', { className: "text-lg" }, '📋'),
              React.createElement('div', { className: "flex-1" },
                React.createElement('div', { className: "font-medium", style: { color: 'var(--text-primary)' } }, req.id),
                React.createElement('div', { className: "text-sm", style: { color: 'var(--text-secondary)' } }, req.description || 'No description'),
                React.createElement('div', { className: "text-xs mt-1", style: { color: 'var(--text-tertiary)' } },
                  `${req.initiator_name} • ${req.department} • ZMW ${(req.total_amount || 0).toLocaleString()}`
                )
              )
            )
          )
        )
      ],

      // EFT Requisitions
      searchResults.efts.length > 0 && [
        React.createElement('div', {
          key: 'eft-header',
          className: "px-4 py-2 text-xs font-semibold text-gray-400 bg-gray-50",
          style: { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }
        }, 'EFT REQUISITIONS'),
        ...searchResults.efts.map(eft =>
          React.createElement('button', {
            key: `eft-${eft.id}`,
            onClick: () => handleResultClick({ type: 'eft', data: eft }),
            className: "w-full px-4 py-3 text-left hover:bg-gray-50 border-b transition-colors",
            style: {
              borderColor: 'var(--border-color)'
            },
            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)',
            onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent'
          },
            React.createElement('div', { className: "flex items-start gap-3" },
              React.createElement('span', { className: "text-lg" }, '💳'),
              React.createElement('div', { className: "flex-1" },
                React.createElement('div', { className: "font-medium", style: { color: 'var(--text-primary)' } }, eft.id),
                React.createElement('div', { className: "text-sm", style: { color: 'var(--text-secondary)' } }, eft.payee_name),
                React.createElement('div', { className: "text-xs mt-1", style: { color: 'var(--text-tertiary)' } },
                  `${eft.initiator_name} • ${eft.department} • ZMW ${(eft.amount || 0).toLocaleString()}`
                )
              )
            )
          )
        )
      ],

      // Expense Claims
      searchResults.expense_claims.length > 0 && [
        React.createElement('div', {
          key: 'claim-header',
          className: "px-4 py-2 text-xs font-semibold text-gray-400 bg-gray-50",
          style: { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }
        }, 'EXPENSE CLAIMS'),
        ...searchResults.expense_claims.map(claim =>
          React.createElement('button', {
            key: `claim-${claim.id}`,
            onClick: () => handleResultClick({ type: 'expense_claim', data: claim }),
            className: "w-full px-4 py-3 text-left hover:bg-gray-50 border-b transition-colors",
            style: {
              borderColor: 'var(--border-color)'
            },
            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)',
            onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent'
          },
            React.createElement('div', { className: "flex items-start gap-3" },
              React.createElement('span', { className: "text-lg" }, '📝'),
              React.createElement('div', { className: "flex-1" },
                React.createElement('div', { className: "font-medium", style: { color: 'var(--text-primary)' } }, claim.id),
                React.createElement('div', { className: "text-sm", style: { color: 'var(--text-secondary)' } }, claim.employee_name),
                React.createElement('div', { className: "text-xs mt-1", style: { color: 'var(--text-tertiary)' } },
                  `${claim.department} • ${claim.reason_for_trip || 'Expense claim'}`
                )
              )
            )
          )
        )
      ],

      // Users
      searchResults.users.length > 0 && [
        React.createElement('div', {
          key: 'user-header',
          className: "px-4 py-2 text-xs font-semibold text-gray-400 bg-gray-50",
          style: { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }
        }, 'USERS'),
        ...searchResults.users.map(user =>
          React.createElement('button', {
            key: `user-${user.id}`,
            onClick: () => handleResultClick({ type: 'user', data: user }),
            className: "w-full px-4 py-3 text-left hover:bg-gray-50 border-b transition-colors",
            style: {
              borderColor: 'var(--border-color)'
            },
            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)',
            onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'transparent'
          },
            React.createElement('div', { className: "flex items-start gap-3" },
              React.createElement('span', { className: "text-lg" }, '👤'),
              React.createElement('div', { className: "flex-1" },
                React.createElement('div', { className: "font-medium", style: { color: 'var(--text-primary)' } }, user.full_name || user.name),
                React.createElement('div', { className: "text-sm", style: { color: 'var(--text-secondary)' } }, user.username),
                React.createElement('div', { className: "text-xs mt-1", style: { color: 'var(--text-tertiary)' } },
                  `${user.department} • ${user.role.toUpperCase()}`
                )
              )
            )
          )
        )
      ],

      // No results
      (searchResults.requisitions.length === 0 &&
       searchResults.efts.length === 0 &&
       searchResults.expense_claims.length === 0 &&
       searchResults.users.length === 0) &&
        React.createElement('div', {
          className: "px-4 py-8 text-center text-gray-500",
          style: { color: 'var(--text-tertiary)' }
        },
          React.createElement('div', { className: "text-4xl mb-2" }, '🔍'),
          React.createElement('div', null, 'No results found'),
          React.createElement('div', { className: "text-sm mt-1" }, `Try searching for "${searchQuery}"`)
        )
    )
  );
}
```

#### B. Add API Method for Global Search

Add this to the `api` object in `frontend/app.js` (around line 200-300 where other API methods are defined):

```javascript
globalSearch: async (query) => {
  const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  if (!response.ok) throw new Error('Search failed');
  return response.json();
},
```

#### C. Update Sidebar Component

Modify the Sidebar component to include the Global Search (around line 1558):

Replace the header section with:

```javascript
// Logo, Title, and Search
React.createElement('div', {
  className: "p-6 transition-colors space-y-4",
  style: { borderBottom: '1px solid var(--border-color)' }
},
  React.createElement('div', null,
    React.createElement('h1', {
      className: "text-xl font-bold",
      style: { color: 'var(--color-primary)' }
    }, "Purchase Requisition"),
    React.createElement('p', {
      className: "text-xs mt-1 transition-colors",
      style: { color: 'var(--text-tertiary)' }
    }, "System")
  ),
  // Global Search
  React.createElement(GlobalSearch, { setView, setSelectedReq: () => {} })
),
```

---

## 2. Print Preview Feature

### A. Add Print Preview Modal Component

Add before the `Reports` function in `frontend/app.js`:

```javascript
// Print Preview Modal Component
function PrintPreviewModal({ isOpen, onClose, content, title }) {
  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @media print {
            @page { margin: 1cm; }
            body { margin: 0; font-family: Arial, sans-serif; }
          }
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #0070AF; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #0070AF; color: white; }
          .summary-card { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .no-print { display: none; }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return React.createElement('div', {
    className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
    onClick: onClose
  },
    React.createElement('div', {
      className: "bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col",
      style: {
        backgroundColor: 'var(--bg-primary)',
        boxShadow: 'var(--shadow-lg)'
      },
      onClick: (e) => e.stopPropagation()
    },
      // Header
      React.createElement('div', {
        className: "flex items-center justify-between px-6 py-4 border-b",
        style: { borderColor: 'var(--border-color)' }
      },
        React.createElement('h2', {
          className: "text-xl font-bold",
          style: { color: 'var(--text-primary)' }
        }, title),
        React.createElement('div', { className: "flex gap-2" },
          React.createElement('button', {
            onClick: handlePrint,
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          }, '🖨️ Print'),
          React.createElement('button', {
            onClick: onClose,
            className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium",
            style: {
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)'
            }
          }, 'Close')
        )
      ),

      // Preview Content
      React.createElement('div', {
        className: "flex-1 overflow-auto p-6",
        dangerouslySetInnerHTML: { __html: content }
      })
    )
  );
}
```

### B. Update Reports Component

Modify the `Reports` function (around line 4458) to add the Print Preview button:

```javascript
function Reports({ data }) {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    department: ''
  });
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  // ... existing code ...

  const handlePrintPreview = () => {
    // Filter data based on current filters
    let filteredReqs = data.requisitions;

    if (filters.dateFrom) {
      filteredReqs = filteredReqs.filter(r => r.created_at >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filteredReqs = filteredReqs.filter(r => r.created_at <= filters.dateTo);
    }
    if (filters.status) {
      filteredReqs = filteredReqs.filter(r => r.status === filters.status);
    }
    if (filters.department) {
      filteredReqs = filteredReqs.filter(r => r.department === filters.department);
    }

    // Generate HTML content
    const content = `
      <h1>Requisitions Report</h1>
      <div class="summary-card">
        <h2>Summary</h2>
        <p><strong>Total Requisitions:</strong> ${filteredReqs.length}</p>
        <p><strong>Approved:</strong> ${filteredReqs.filter(r => r.status === 'completed' || r.status === 'approved').length}</p>
        <p><strong>Pending:</strong> ${filteredReqs.filter(r => r.status.includes('pending')).length}</p>
        <p><strong>Rejected:</strong> ${filteredReqs.filter(r => r.status === 'rejected').length}</p>
        <p><strong>Total Value:</strong> ZMW ${filteredReqs.reduce((sum, r) => sum + (r.total_amount || 0), 0).toLocaleString()}</p>
      </div>

      <h2>Requisitions List</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Description</th>
            <th>Initiator</th>
            <th>Department</th>
            <th>Amount (ZMW)</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${filteredReqs.map(req => `
            <tr>
              <td>${req.id}</td>
              <td>${req.description || 'N/A'}</td>
              <td>${req.initiator_name}</td>
              <td>${req.department}</td>
              <td>${(req.total_amount || 0).toLocaleString()}</td>
              <td>${req.status}</td>
              <td>${new Date(req.created_at).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    setPreviewContent(content);
    setShowPrintPreview(true);
  };

  return React.createElement('div', { className: "space-y-6" },
    // Print Preview Modal
    React.createElement(PrintPreviewModal, {
      isOpen: showPrintPreview,
      onClose: () => setShowPrintPreview(false),
      content: previewContent,
      title: 'Requisitions Report Preview'
    }),

    // ... existing stats cards ...

    React.createElement('div', { className: "bg-white rounded-lg shadow-sm border p-6" },
      React.createElement('h3', { className: "text-xl font-bold text-gray-800 mb-4" }, "Export Requisitions Report"),

      // ... existing filter inputs ...

      React.createElement('div', { className: "flex gap-4" },
        React.createElement('button', {
          onClick: handlePrintPreview,
          className: "flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
        }, "🔍 Print Preview"),
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
```

---

## 3. Backend Implementation

### A. Create Global Search Endpoint

Add to `backend/routes/requisitions.js` or create a new `backend/routes/search.js`:

```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getRequisitions,
  getEFTRequisitions,
  getExpenseClaims,
  getAllUsers
} = require('../database');

// Global search endpoint
router.get('/search', authenticate, (req, res, next) => {
  try {
    const query = req.query.q;

    if (!query || query.length < 3) {
      return res.json({
        requisitions: [],
        efts: [],
        expense_claims: [],
        users: []
      });
    }

    const searchTerm = query.toLowerCase();

    // Search requisitions
    const allRequisitions = getRequisitions();
    const requisitions = allRequisitions.filter(r =>
      r.id.toLowerCase().includes(searchTerm) ||
      (r.description && r.description.toLowerCase().includes(searchTerm)) ||
      r.initiator_name.toLowerCase().includes(searchTerm) ||
      r.department.toLowerCase().includes(searchTerm)
    ).slice(0, 10); // Limit to 10 results

    // Search EFT requisitions
    const allEFTs = getEFTRequisitions();
    const efts = allEFTs.filter(e =>
      e.id.toLowerCase().includes(searchTerm) ||
      (e.payee_name && e.payee_name.toLowerCase().includes(searchTerm)) ||
      e.initiator_name.toLowerCase().includes(searchTerm) ||
      e.department.toLowerCase().includes(searchTerm)
    ).slice(0, 10);

    // Search expense claims
    const allClaims = getExpenseClaims();
    const expense_claims = allClaims.filter(c =>
      c.id.toLowerCase().includes(searchTerm) ||
      c.employee_name.toLowerCase().includes(searchTerm) ||
      c.department.toLowerCase().includes(searchTerm) ||
      (c.reason_for_trip && c.reason_for_trip.toLowerCase().includes(searchTerm))
    ).slice(0, 10);

    // Search users (admin only)
    let users = [];
    if (req.user.role === 'admin') {
      const allUsers = getAllUsers();
      users = allUsers.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(searchTerm)) ||
        u.username.toLowerCase().includes(searchTerm) ||
        (u.department && u.department.toLowerCase().includes(searchTerm))
      ).slice(0, 10);
    }

    res.json({
      requisitions,
      efts,
      expense_claims,
      users
    });

  } catch (error) {
    logger.error('Error in global search:', error);
    next(error);
  }
});

module.exports = router;
```

### B. Register the Search Route

Add to `backend/server.js`:

```javascript
const searchRoutes = require('./routes/search');
app.use('/api', searchRoutes);
```

---

## Testing Checklist

### Global Search
- [ ] Search bar appears in sidebar
- [ ] Typing triggers search after 3+ characters
- [ ] Results show for requisitions
- [ ] Results show for EFTs
- [ ] Results show for expense claims
- [ ] Results show for users (admin only)
- [ ] Clicking result navigates correctly
- [ ] Clear button works
- [ ] Search is case-insensitive
- [ ] Results are limited to 10 per category

### Print Preview
- [ ] Print Preview button appears in Reports
- [ ] Modal opens with formatted content
- [ ] Content respects filters
- [ ] Print button opens print dialog
- [ ] Close button closes modal
- [ ] Print preview is properly formatted
- [ ] All data displays correctly

---

## Benefits

### Global Search
1. **Faster Navigation** - Find any form instantly
2. **Improved UX** - No need to remember which menu to click
3. **Productivity** - Reduce time searching for items
4. **Universal Access** - Search from anywhere in the app

### Print Preview
1. **Review Before Printing** - Check report before printing
2. **Save Paper** - Avoid printing incorrect reports
3. **Professional** - Ensure report looks good
4. **Customizable** - Easy to adjust format

---

## Implementation Priority

1. **High Priority**: Global Search - Most requested feature
2. **Medium Priority**: Print Preview - Nice to have

---

## Next Steps

1. Review this implementation guide
2. Test in development environment
3. Make any necessary adjustments
4. Deploy to production
5. Gather user feedback

---

**Implementation Status:** 📋 Ready for Review
**Estimated Time:** 2-3 hours
**Risk Level:** Low (non-breaking changes)
