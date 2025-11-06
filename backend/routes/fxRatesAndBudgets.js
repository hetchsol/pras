/**
 * FX Rates, Budget Management, and Reporting Routes
 *
 * This module contains all API endpoints for:
 * - FX rate management (Finance Manager, Procurement, Admin)
 * - Budget management (Finance Manager, MD, Admin)
 * - Multi-currency support
 * - PDF and Excel report generation
 */

// This file will be imported in server.js
// Add this before the 404 handler in server.js:
// const setupFXAndBudgetRoutes = require('./routes/fxRatesAndBudgets');
// setupFXAndBudgetRoutes(app, db, authenticate, authorize);

module.exports = function setupFXAndBudgetRoutes(app, db, authenticate, authorize) {
    const { generateRequisitionSummaryExcel, generateBudgetReportExcel, generateFXRatesExcel } = require('../utils/excelReportGenerator');
    const { generateRequisitionSummaryPDF, generateBudgetReportPDF, generateDepartmentalSpendingPDF } = require('../utils/reportPDFGenerator');
    const { AppError } = require('../middleware/errorHandler');
    const { logError } = require('../utils/logger');

    // ============================================
    // FX RATES MANAGEMENT
    // ============================================

    /**
     * GET /api/fx-rates
     * Get all active FX rates
     * Access: All authenticated users
     */
    app.get('/api/fx-rates', authenticate, (req, res, next) => {
        try {
            db.all(`
                SELECT fr.*, u.full_name as updated_by_name
                FROM fx_rates fr
                LEFT JOIN users u ON fr.updated_by = u.id
                WHERE fr.is_active = 1
                ORDER BY fr.currency_code
            `, [], (err, rates) => {
                if (err) {
                    logError(err, { context: 'get_fx_rates' });
                    return next(new AppError('Database error', 500));
                }
                res.json(rates || []);
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/fx-rates/all
     * Get all FX rates including inactive
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/fx-rates/all', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
        try {
            db.all(`
                SELECT fr.*, u.full_name as updated_by_name
                FROM fx_rates fr
                LEFT JOIN users u ON fr.updated_by = u.id
                ORDER BY fr.currency_code, fr.created_at DESC
            `, [], (err, rates) => {
                if (err) {
                    logError(err, { context: 'get_all_fx_rates' });
                    return next(new AppError('Database error', 500));
                }
                res.json(rates || []);
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /api/fx-rates
     * Create or update FX rate
     * Access: Finance Manager, MD, Procurement, Admin
     */
    app.post('/api/fx-rates', authenticate, authorize('finance', 'md', 'procurement', 'admin'), (req, res, next) => {
        try {
            const { currency_code, currency_name, rate_to_zmw, effective_from, change_reason } = req.body;

            if (!currency_code || !currency_name || !rate_to_zmw || !effective_from) {
                return res.status(400).json({
                    error: 'Currency code, name, rate, and effective date are required'
                });
            }

            if (rate_to_zmw <= 0) {
                return res.status(400).json({ error: 'Exchange rate must be greater than 0' });
            }

            // Check if currency already exists
            db.get(`SELECT id, rate_to_zmw FROM fx_rates WHERE currency_code = ? AND is_active = 1`,
                [currency_code],
                (err, existing) => {
                    if (err) {
                        logError(err, { context: 'check_fx_rate_exists' });
                        return next(new AppError('Database error', 500));
                    }

                    if (existing) {
                        // Log the change in history
                        db.run(`
                            INSERT INTO fx_rate_history (fx_rate_id, old_rate, new_rate, changed_by, change_reason)
                            VALUES (?, ?, ?, ?, ?)
                        `, [existing.id, existing.rate_to_zmw, rate_to_zmw, req.user.id, change_reason || 'Rate update'],
                        (histErr) => {
                            if (histErr) {
                                logError(histErr, { context: 'log_fx_rate_history' });
                            }
                        });

                        // Update existing rate
                        db.run(`
                            UPDATE fx_rates
                            SET rate_to_zmw = ?,
                                currency_name = ?,
                                updated_by = ?,
                                effective_from = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [rate_to_zmw, currency_name, req.user.id, effective_from, existing.id],
                        function(updateErr) {
                            if (updateErr) {
                                logError(updateErr, { context: 'update_fx_rate' });
                                return next(new AppError('Failed to update FX rate', 500));
                            }

                            res.json({
                                success: true,
                                message: 'FX rate updated successfully',
                                id: existing.id
                            });
                        });
                    } else {
                        // Insert new rate
                        db.run(`
                            INSERT INTO fx_rates (currency_code, currency_name, rate_to_zmw, updated_by, effective_from)
                            VALUES (?, ?, ?, ?, ?)
                        `, [currency_code, currency_name, rate_to_zmw, req.user.id, effective_from],
                        function(insertErr) {
                            if (insertErr) {
                                logError(insertErr, { context: 'create_fx_rate' });
                                return next(new AppError('Failed to create FX rate', 500));
                            }

                            res.json({
                                success: true,
                                message: 'FX rate created successfully',
                                id: this.lastID
                            });
                        });
                    }
                });
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /api/fx-rates/:id
     * Deactivate FX rate (soft delete)
     * Access: Finance Manager, MD, Admin
     */
    app.delete('/api/fx-rates/:id', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
        try {
            const rateId = req.params.id;

            db.run(`UPDATE fx_rates SET is_active = 0 WHERE id = ?`, [rateId], function(err) {
                if (err) {
                    logError(err, { context: 'deactivate_fx_rate', rateId });
                    return next(new AppError('Failed to deactivate FX rate', 500));
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'FX rate not found' });
                }

                res.json({
                    success: true,
                    message: 'FX rate deactivated successfully'
                });
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/fx-rates/:code/history
     * Get FX rate change history
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/fx-rates/:code/history', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
        try {
            const currencyCode = req.params.code;

            db.all(`
                SELECT frh.*, u.full_name as changed_by_name, fr.currency_name
                FROM fx_rate_history frh
                JOIN fx_rates fr ON frh.fx_rate_id = fr.id
                LEFT JOIN users u ON frh.changed_by = u.id
                WHERE fr.currency_code = ?
                ORDER BY frh.created_at DESC
            `, [currencyCode], (err, history) => {
                if (err) {
                    logError(err, { context: 'get_fx_rate_history', currencyCode });
                    return next(new AppError('Database error', 500));
                }
                res.json(history || []);
            });
        } catch (error) {
            next(error);
        }
    });

    // ============================================
    // BUDGET MANAGEMENT (Enhanced)
    // ============================================

    /**
     * GET /api/budgets/overview
     * Get budget overview with spending details
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/budgets/overview', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
        try {
            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            db.all(`
                SELECT
                    b.*,
                    (b.allocated_amount - b.committed_amount - b.spent_amount) as available_amount,
                    CASE
                        WHEN b.allocated_amount > 0
                        THEN ((b.committed_amount + b.spent_amount) / b.allocated_amount) * 100
                        ELSE 0
                    END as utilization_percentage
                FROM budgets b
                WHERE b.fiscal_year = ?
                ORDER BY b.department
            `, [fiscalYear], (err, budgets) => {
                if (err) {
                    logError(err, { context: 'get_budget_overview' });
                    return next(new AppError('Database error', 500));
                }
                res.json(budgets || []);
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/budgets/department/:department
     * Get detailed budget for specific department
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/budgets/department/:department', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
        try {
            const department = req.params.department;
            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            db.get(`
                SELECT * FROM budgets
                WHERE department = ? AND fiscal_year = ?
            `, [department, fiscalYear], (err, budget) => {
                if (err) {
                    logError(err, { context: 'get_department_budget', department });
                    return next(new AppError('Database error', 500));
                }

                if (!budget) {
                    return res.status(404).json({ error: 'Budget not found' });
                }

                // Get expense details
                db.all(`
                    SELECT be.*, r.req_number, r.title, u.full_name as recorded_by_name
                    FROM budget_expenses be
                    JOIN requisitions r ON be.requisition_id = r.id
                    LEFT JOIN users u ON be.recorded_by = u.id
                    WHERE be.budget_id = ?
                    ORDER BY be.created_at DESC
                `, [budget.id], (expErr, expenses) => {
                    if (expErr) {
                        logError(expErr, { context: 'get_budget_expenses', budgetId: budget.id });
                        return next(new AppError('Database error', 500));
                    }

                    res.json({
                        budget,
                        expenses: expenses || []
                    });
                });
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * PUT /api/budgets/:id/allocate
     * Update budget allocation
     * Access: Finance Manager, MD, Admin
     */
    app.put('/api/budgets/:id/allocate', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
        try {
            const budgetId = req.params.id;
            const { allocated_amount } = req.body;

            if (!allocated_amount || allocated_amount < 0) {
                return res.status(400).json({ error: 'Valid allocated amount is required' });
            }

            db.run(`
                UPDATE budgets
                SET allocated_amount = ?,
                    available_amount = allocated_amount - committed_amount - spent_amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [allocated_amount, budgetId], function(err) {
                if (err) {
                    logError(err, { context: 'update_budget_allocation', budgetId });
                    return next(new AppError('Failed to update budget allocation', 500));
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Budget not found' });
                }

                res.json({
                    success: true,
                    message: 'Budget allocation updated successfully'
                });
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /api/requisitions/:id/budget-check
     * Check budget availability and commit funds
     * Access: Finance Manager, Admin
     */
    app.post('/api/requisitions/:id/budget-check', authenticate, authorize('finance', 'admin'), (req, res, next) => {
        try {
            const reqId = req.params.id;
            const { approved, comments } = req.body;

            // Get requisition details
            db.get(`
                SELECT r.*, u.department
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                WHERE r.id = ?
            `, [reqId], (err, requisition) => {
                if (err) {
                    logError(err, { context: 'get_requisition_for_budget_check', reqId });
                    return next(new AppError('Database error', 500));
                }

                if (!requisition) {
                    return res.status(404).json({ error: 'Requisition not found' });
                }

                // Calculate total amount in ZMW
                db.all(`
                    SELECT * FROM requisition_items WHERE requisition_id = ?
                `, [reqId], (itemsErr, items) => {
                    if (itemsErr) {
                        logError(itemsErr, { context: 'get_items_for_budget_check', reqId });
                        return next(new AppError('Database error', 500));
                    }

                    const totalAmount = items.reduce((sum, item) => {
                        return sum + (item.amount_in_zmw || item.total_price || 0);
                    }, 0);

                    // Get department budget
                    const fiscalYear = new Date().getFullYear().toString();
                    db.get(`
                        SELECT * FROM budgets
                        WHERE department = ? AND fiscal_year = ?
                    `, [requisition.department, fiscalYear], (budgetErr, budget) => {
                        if (budgetErr) {
                            logError(budgetErr, { context: 'get_budget_for_check' });
                            return next(new AppError('Database error', 500));
                        }

                        if (!budget) {
                            return res.status(404).json({ error: 'Budget not found for department' });
                        }

                        const available = budget.allocated_amount - budget.committed_amount - budget.spent_amount;

                        if (approved) {
                            if (totalAmount > available) {
                                return res.status(400).json({
                                    error: 'Insufficient budget',
                                    available,
                                    required: totalAmount
                                });
                            }

                            // Commit funds
                            db.run(`
                                UPDATE budgets
                                SET committed_amount = committed_amount + ?,
                                    available_amount = allocated_amount - committed_amount - spent_amount,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [totalAmount, budget.id], (updateErr) => {
                                if (updateErr) {
                                    logError(updateErr, { context: 'commit_budget' });
                                    return next(new AppError('Failed to commit budget', 500));
                                }

                                // Record expense
                                db.run(`
                                    INSERT INTO budget_expenses (budget_id, requisition_id, department, amount, fiscal_year, expense_type, recorded_by)
                                    VALUES (?, ?, ?, ?, ?, 'committed', ?)
                                `, [budget.id, reqId, requisition.department, totalAmount, fiscalYear, req.user.id],
                                (expenseErr) => {
                                    if (expenseErr) {
                                        logError(expenseErr, { context: 'record_budget_expense' });
                                    }
                                });

                                // Update requisition
                                db.run(`
                                    UPDATE requisitions
                                    SET budget_checked = 1,
                                        budget_approved_by = ?,
                                        budget_approved_at = CURRENT_TIMESTAMP,
                                        budget_comments = ?
                                    WHERE id = ?
                                `, [req.user.id, comments, reqId], (reqUpdateErr) => {
                                    if (reqUpdateErr) {
                                        logError(reqUpdateErr, { context: 'update_requisition_budget_check' });
                                        return next(new AppError('Failed to update requisition', 500));
                                    }

                                    res.json({
                                        success: true,
                                        message: 'Budget approved and funds committed',
                                        committed: totalAmount,
                                        remaining: available - totalAmount
                                    });
                                });
                            });
                        } else {
                            // Budget rejected
                            db.run(`
                                UPDATE requisitions
                                SET budget_checked = 1,
                                    budget_approved_by = ?,
                                    budget_approved_at = CURRENT_TIMESTAMP,
                                    budget_comments = ?,
                                    status = 'budget_rejected'
                                WHERE id = ?
                            `, [req.user.id, comments || 'Budget not approved', reqId], (reqUpdateErr) => {
                                if (reqUpdateErr) {
                                    logError(reqUpdateErr, { context: 'reject_budget' });
                                    return next(new AppError('Failed to update requisition', 500));
                                }

                                res.json({
                                    success: true,
                                    message: 'Budget check rejected'
                                });
                            });
                        }
                    });
                });
            });
        } catch (error) {
            next(error);
        }
    });

    // ============================================
    // REPORTS - EXCEL
    // ============================================

    /**
     * GET /api/reports/requisitions/excel
     * Generate Excel report of requisitions
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/reports/requisitions/excel', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const { dateFrom, dateTo, status, department } = req.query;

            let query = `
                SELECT r.*, u.full_name as creator_name, u.department
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                WHERE 1=1
            `;
            const params = [];

            if (dateFrom) {
                query += ' AND DATE(r.created_at) >= DATE(?)';
                params.push(dateFrom);
            }

            if (dateTo) {
                query += ' AND DATE(r.created_at) <= DATE(?)';
                params.push(dateTo);
            }

            if (status) {
                query += ' AND r.status = ?';
                params.push(status);
            }

            if (department) {
                query += ' AND u.department = ?';
                params.push(department);
            }

            query += ' ORDER BY r.created_at DESC';

            db.all(query, params, async (err, requisitions) => {
                if (err) {
                    logError(err, { context: 'get_requisitions_for_excel' });
                    return next(new AppError('Database error', 500));
                }

                // Get items for each requisition
                const reqPromises = requisitions.map(req => {
                    return new Promise((resolve) => {
                        db.all(`
                            SELECT ri.*, v.name as vendor_name
                            FROM requisition_items ri
                            LEFT JOIN vendors v ON ri.vendor_id = v.id
                            WHERE ri.requisition_id = ?
                        `, [req.id], (itemsErr, items) => {
                            req.items = items || [];
                            resolve(req);
                        });
                    });
                });

                const requisitionsWithItems = await Promise.all(reqPromises);

                const excelBuffer = await generateRequisitionSummaryExcel(requisitionsWithItems, { dateFrom, dateTo, status, department });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=requisitions_report_${Date.now()}.xlsx`);
                res.send(excelBuffer);
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/reports/budgets/excel
     * Generate Excel report of budgets
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/reports/budgets/excel', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            db.all(`
                SELECT * FROM budgets
                WHERE fiscal_year = ?
                ORDER BY department
            `, [fiscalYear], async (err, budgets) => {
                if (err) {
                    logError(err, { context: 'get_budgets_for_excel' });
                    return next(new AppError('Database error', 500));
                }

                const excelBuffer = await generateBudgetReportExcel(budgets, fiscalYear);

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=budget_report_${fiscalYear}_${Date.now()}.xlsx`);
                res.send(excelBuffer);
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/reports/fx-rates/excel
     * Generate Excel report of FX rates
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/reports/fx-rates/excel', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            db.all(`
                SELECT fr.*, u.full_name as updated_by_name
                FROM fx_rates fr
                LEFT JOIN users u ON fr.updated_by = u.id
                ORDER BY fr.currency_code, fr.created_at DESC
            `, [], async (err, rates) => {
                if (err) {
                    logError(err, { context: 'get_fx_rates_for_excel' });
                    return next(new AppError('Database error', 500));
                }

                const excelBuffer = await generateFXRatesExcel(rates);

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=fx_rates_report_${Date.now()}.xlsx`);
                res.send(excelBuffer);
            });
        } catch (error) {
            next(error);
        }
    });

    // ============================================
    // REPORTS - PDF
    // ============================================

    /**
     * GET /api/reports/requisitions/pdf
     * Generate PDF report of requisitions
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/reports/requisitions/pdf', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
        try {
            const { dateFrom, dateTo, status, department } = req.query;

            let query = `
                SELECT r.*, u.full_name as creator_name, u.department
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                WHERE 1=1
            `;
            const params = [];

            if (dateFrom) {
                query += ' AND DATE(r.created_at) >= DATE(?)';
                params.push(dateFrom);
            }

            if (dateTo) {
                query += ' AND DATE(r.created_at) <= DATE(?)';
                params.push(dateTo);
            }

            if (status) {
                query += ' AND r.status = ?';
                params.push(status);
            }

            if (department) {
                query += ' AND u.department = ?';
                params.push(department);
            }

            query += ' ORDER BY r.created_at DESC';

            db.all(query, params, (err, requisitions) => {
                if (err) {
                    logError(err, { context: 'get_requisitions_for_pdf' });
                    return next(new AppError('Database error', 500));
                }

                // Get items for each requisition
                let completed = 0;
                requisitions.forEach(req => {
                    db.all(`
                        SELECT ri.*, v.name as vendor_name
                        FROM requisition_items ri
                        LEFT JOIN vendors v ON ri.vendor_id = v.id
                        WHERE ri.requisition_id = ?
                    `, [req.id], (itemsErr, items) => {
                        req.items = items || [];
                        completed++;

                        if (completed === requisitions.length) {
                            const doc = generateRequisitionSummaryPDF(requisitions, { dateFrom, dateTo, status, department });

                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', `attachment; filename=requisitions_report_${Date.now()}.pdf`);

                            doc.pipe(res);
                            doc.end();
                        }
                    });
                });

                if (requisitions.length === 0) {
                    const doc = generateRequisitionSummaryPDF([], { dateFrom, dateTo, status, department });

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename=requisitions_report_${Date.now()}.pdf`);

                    doc.pipe(res);
                    doc.end();
                }
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/reports/budgets/pdf
     * Generate PDF report of budgets
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/reports/budgets/pdf', authenticate, authorize('finance', 'md', 'admin'), (req, res, next) => {
        try {
            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            db.all(`
                SELECT * FROM budgets
                WHERE fiscal_year = ?
                ORDER BY department
            `, [fiscalYear], (err, budgets) => {
                if (err) {
                    logError(err, { context: 'get_budgets_for_pdf' });
                    return next(new AppError('Database error', 500));
                }

                const doc = generateBudgetReportPDF(budgets, fiscalYear);

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=budget_report_${fiscalYear}_${Date.now()}.pdf`);

                doc.pipe(res);
                doc.end();
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /api/reports/department/:department/pdf
     * Generate departmental spending PDF report
     * Access: Finance Manager, MD, Admin, HOD (own department)
     */
    app.get('/api/reports/department/:department/pdf', authenticate, authorize('finance', 'md', 'admin', 'hod'), (req, res, next) => {
        try {
            const department = req.params.department;

            // Check if HOD is accessing own department
            if (req.user.role === 'hod' && req.user.department !== department) {
                return res.status(403).json({ error: 'You can only view reports for your own department' });
            }

            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            // Get budget info
            db.get(`
                SELECT * FROM budgets
                WHERE department = ? AND fiscal_year = ?
            `, [department, fiscalYear], (budgetErr, budget) => {
                if (budgetErr) {
                    logError(budgetErr, { context: 'get_dept_budget_for_report', department });
                    return next(new AppError('Database error', 500));
                }

                // Get requisitions
                db.all(`
                    SELECT r.*, u.full_name as creator_name
                    FROM requisitions r
                    JOIN users u ON r.created_by = u.id
                    WHERE u.department = ?
                    ORDER BY r.created_at DESC
                `, [department], (reqErr, requisitions) => {
                    if (reqErr) {
                        logError(reqErr, { context: 'get_dept_requisitions', department });
                        return next(new AppError('Database error', 500));
                    }

                    // Get items for requisitions
                    let completed = 0;
                    if (requisitions.length === 0) {
                        const doc = generateDepartmentalSpendingPDF(department, [], budget);

                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', `attachment; filename=dept_${department}_report_${Date.now()}.pdf`);

                        doc.pipe(res);
                        doc.end();
                        return;
                    }

                    requisitions.forEach(req => {
                        db.all(`SELECT * FROM requisition_items WHERE requisition_id = ?`,
                            [req.id],
                            (itemsErr, items) => {
                                req.items = items || [];
                                completed++;

                                if (completed === requisitions.length) {
                                    const doc = generateDepartmentalSpendingPDF(department, requisitions, budget);

                                    res.setHeader('Content-Type', 'application/pdf');
                                    res.setHeader('Content-Disposition', `attachment; filename=dept_${department}_report_${Date.now()}.pdf`);

                                    doc.pipe(res);
                                    doc.end();
                                }
                            });
                    });
                });
            });
        } catch (error) {
            next(error);
        }
    });

    console.log('✅ FX Rates, Budget Management, and Reporting routes loaded');
};
