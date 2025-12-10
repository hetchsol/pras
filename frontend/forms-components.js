// ============================================
// FINANCIAL FORMS COMPONENTS
// ============================================
// This file contains components for Expense Claims and EFT Requisitions
// To be included in app.js

// Expense Claims List Component
function ExpenseClaimsList({ user, setView, setSelectedReq }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/forms/expense-claims`);
      const data = await response.json();
      setClaims(data);
    } catch (error) {
      console.error('Error loading expense claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewClaim = (claim) => {
    setSelectedReq(claim);
    if (hasRole(user.role, 'finance', 'md', 'admin') &&
        (claim.status === 'pending_finance' || claim.status === 'pending_md')) {
      setView('approve-expense-claim');
    } else {
      // Just view details
      alert(`Expense Claim ${claim.id}\nStatus: ${claim.status}\nEmployee: ${claim.employee_name}\nAmount Due: K${claim.amount_due}`);
    }
  };

  const downloadPDF = async (claimId) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/forms/expense-claims/${claimId}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Expense_Claim_${claimId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      pending_finance: 'bg-yellow-100 text-yellow-700',
      pending_md: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusText = (status) => {
    const text = {
      draft: 'Draft',
      pending_finance: 'Pending Finance',
      pending_md: 'Pending MD',
      approved: 'Approved',
      rejected: 'Rejected'
    };
    return text[status] || status;
  };

  if (loading) {
    return React.createElement('div', { className: "text-center py-10" }, "Loading...");
  }

  return React.createElement('div', { className: "space-y-6" },
    React.createElement('div', { className: "flex items-center justify-between" },
      React.createElement('h2', {
        className: "text-2xl font-bold",
        style: { color: 'var(--text-primary)' }
      }, "Expense Claims"),
      React.createElement('button', {
        onClick: () => setView('create-expense-claim'),
        className: "px-6 py-3 rounded-lg font-medium shadow-sm flex items-center gap-2",
        style: {
          backgroundColor: 'var(--color-primary)',
          color: '#FFFFFF'
        }
      },
        React.createElement('span', null, "➕"),
        "New Expense Claim"
      )
    ),

    claims.length === 0 ?
      React.createElement('div', {
        className: "text-center py-10 rounded-lg border",
        style: {
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-secondary)'
        }
      }, "No expense claims found") :
      React.createElement('div', { className: "space-y-3" },
        claims.map(claim =>
          React.createElement('div', {
            key: claim.id,
            className: "rounded-lg p-6 border cursor-pointer hover:shadow-md transition-all",
            style: {
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)'
            },
            onClick: () => handleViewClaim(claim)
          },
            React.createElement('div', { className: "flex items-center justify-between mb-3" },
              React.createElement('h3', {
                className: "text-lg font-semibold",
                style: { color: 'var(--color-primary)' }
              }, claim.id),
              React.createElement('span', {
                className: `px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(claim.status)}`
              }, getStatusText(claim.status))
            ),
            React.createElement('div', { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-3" },
              React.createElement('div', null,
                React.createElement('p', {
                  className: "text-xs",
                  style: { color: 'var(--text-tertiary)' }
                }, "Employee"),
                React.createElement('p', {
                  className: "font-medium",
                  style: { color: 'var(--text-primary)' }
                }, claim.employee_name)
              ),
              React.createElement('div', null,
                React.createElement('p', {
                  className: "text-xs",
                  style: { color: 'var(--text-tertiary)' }
                }, "Department"),
                React.createElement('p', {
                  className: "font-medium",
                  style: { color: 'var(--text-primary)' }
                }, claim.department)
              ),
              React.createElement('div', null,
                React.createElement('p', {
                  className: "text-xs",
                  style: { color: 'var(--text-tertiary)' }
                }, "Total Claim"),
                React.createElement('p', {
                  className: "font-medium",
                  style: { color: 'var(--text-primary)' }
                }, `K ${(claim.total_claim || 0).toFixed(2)}`)
              ),
              React.createElement('div', null,
                React.createElement('p', {
                  className: "text-xs",
                  style: { color: 'var(--text-tertiary)' }
                }, "Amount Due"),
                React.createElement('p', {
                  className: "font-bold text-lg",
                  style: { color: 'var(--color-success)' }
                }, `K ${(claim.amount_due || 0).toFixed(2)}`)
              )
            ),
            React.createElement('div', { className: "flex gap-2" },
              React.createElement('button', {
                onClick: (e) => {
                  e.stopPropagation();
                  downloadPDF(claim.id);
                },
                className: "px-4 py-2 rounded text-sm font-medium",
                style: {
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)'
                }
              }, "📄 Download PDF"),
              (hasRole(user.role, 'finance') && claim.status === 'pending_finance') &&
                React.createElement('button', {
                  onClick: (e) => {
                    e.stopPropagation();
                    setSelectedReq(claim);
                    setView('approve-expense-claim');
                  },
                  className: "px-4 py-2 rounded text-sm font-medium",
                  style: {
                    backgroundColor: 'var(--color-warning)',
                    color: '#FFFFFF'
                  }
                }, "Review & Approve"),
              (hasRole(user.role, 'md') && claim.status === 'pending_md') &&
                React.createElement('button', {
                  onClick: (e) => {
                    e.stopPropagation();
                    setSelectedReq(claim);
                    setView('approve-expense-claim');
                  },
                  className: "px-4 py-2 rounded text-sm font-medium",
                  style: {
                    backgroundColor: 'var(--color-success)',
                    color: '#FFFFFF'
                  }
                }, "Final Approval")
            )
          )
        )
      )
  );
}
