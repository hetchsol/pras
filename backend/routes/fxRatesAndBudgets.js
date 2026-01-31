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

const { pool } = require('../database');

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
    app.get('/api/fx-rates', authenticate, async (req, res, next) => {
        try {
            const result = await pool.query(`
                SELECT fr.*, u.full_name as updated_by_name
                FROM fx_rates fr
                LEFT JOIN users u ON fr.updated_by = u.id
                WHERE fr.is_active = true
                ORDER BY fr.currency_code
            `);
            res.json(result.rows || []);
        } catch (err) {
            logError(err, { context: 'get_fx_rates' });
            next(new AppError('Database error', 500));
        }
    });

    /**
     * GET /api/fx-rates/all
     * Get all FX rates including inactive
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/fx-rates/all', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const result = await pool.query(`
                SELECT fr.*, u.full_name as updated_by_name
                FROM fx_rates fr
                LEFT JOIN users u ON fr.updated_by = u.id
                ORDER BY fr.currency_code, fr.created_at DESC
            `);
            res.json(result.rows || []);
        } catch (err) {
            logError(err, { context: 'get_all_fx_rates' });
            next(new AppError('Database error', 500));
        }
    });

    /**
     * POST /api/fx-rates
     * Create or update FX rate
     * Access: Finance Manager, MD, Procurement, Admin
     */
    app.post('/api/fx-rates', authenticate, authorize('finance', 'md', 'procurement', 'admin'), async (req, res, next) => {
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
            const existingResult = await pool.query(
                `SELECT id, rate_to_zmw FROM fx_rates WHERE currency_code = $1 AND is_active = true`,
                [currency_code]
            );

            if (existingResult.rows.length > 0) {
                const existing = existingResult.rows[0];

                // Log the change in history
                try {
                    await pool.query(`
                        INSERT INTO fx_rate_history (fx_rate_id, old_rate, new_rate, changed_by, change_reason)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [existing.id, existing.rate_to_zmw, rate_to_zmw, req.user.id, change_reason || 'Rate update']);
                } catch (histErr) {
                    logError(histErr, { context: 'log_fx_rate_history' });
                }

                // Update existing rate
                await pool.query(`
                    UPDATE fx_rates
                    SET rate_to_zmw = $1,
                        currency_name = $2,
                        updated_by = $3,
                        effective_from = $4,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $5
                `, [rate_to_zmw, currency_name, req.user.id, effective_from, existing.id]);

                res.json({
                    success: true,
                    message: 'FX rate updated successfully',
                    id: existing.id
                });
            } else {
                // Insert new rate
                const insertResult = await pool.query(`
                    INSERT INTO fx_rates (currency_code, currency_name, rate_to_zmw, updated_by, effective_from)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                `, [currency_code, currency_name, rate_to_zmw, req.user.id, effective_from]);

                res.json({
                    success: true,
                    message: 'FX rate created successfully',
                    id: insertResult.rows[0].id
                });
            }
        } catch (err) {
            logError(err, { context: 'create_or_update_fx_rate' });
            next(new AppError('Failed to save FX rate', 500));
        }
    });

    /**
     * DELETE /api/fx-rates/:id
     * Deactivate FX rate (soft delete)
     * Access: Finance Manager, MD, Admin
     */
    app.delete('/api/fx-rates/:id', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const rateId = req.params.id;

            const result = await pool.query(`UPDATE fx_rates SET is_active = false WHERE id = $1`, [rateId]);

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'FX rate not found' });
            }

            res.json({
                success: true,
                message: 'FX rate deactivated successfully'
            });
        } catch (err) {
            logError(err, { context: 'deactivate_fx_rate', rateId: req.params.id });
            next(new AppError('Failed to deactivate FX rate', 500));
        }
    });

    /**
     * GET /api/fx-rates/:code/history
     * Get FX rate change history
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/fx-rates/:code/history', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const currencyCode = req.params.code;

            const result = await pool.query(`
                SELECT frh.*, u.full_name as changed_by_name, fr.currency_name
                FROM fx_rate_history frh
                JOIN fx_rates fr ON frh.fx_rate_id = fr.id
                LEFT JOIN users u ON frh.changed_by = u.id
                WHERE fr.currency_code = $1
                ORDER BY frh.created_at DESC
            `, [currencyCode]);

            res.json(result.rows || []);
        } catch (err) {
            logError(err, { context: 'get_fx_rate_history', currencyCode: req.params.code });
            next(new AppError('Database error', 500));
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
    app.get('/api/budgets/overview', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            const result = await pool.query(`
                SELECT
                    b.*,
                    (b.allocated_amount - b.committed_amount - b.spent_amount) as available_amount,
                    CASE
                        WHEN b.allocated_amount > 0
                        THEN ((b.committed_amount + b.spent_amount) / b.allocated_amount) * 100
                        ELSE 0
                    END as utilization_percentage
                FROM budgets b
                WHERE b.fiscal_year = $1
                ORDER BY b.department
            `, [fiscalYear]);

            res.json(result.rows || []);
        } catch (err) {
            logError(err, { context: 'get_budget_overview' });
            next(new AppError('Database error', 500));
        }
    });

    /**
     * GET /api/budgets/department/:department
     * Get detailed budget for specific department
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/budgets/department/:department', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const department = req.params.department;
            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            const budgetResult = await pool.query(`
                SELECT * FROM budgets
                WHERE department = $1 AND fiscal_year = $2
            `, [department, fiscalYear]);

            if (budgetResult.rows.length === 0) {
                return res.status(404).json({ error: 'Budget not found' });
            }

            const budget = budgetResult.rows[0];

            // Get expense details
            const expensesResult = await pool.query(`
                SELECT be.*, r.req_number, r.title, u.full_name as recorded_by_name
                FROM budget_expenses be
                JOIN requisitions r ON be.requisition_id = r.id
                LEFT JOIN users u ON be.recorded_by = u.id
                WHERE be.budget_id = $1
                ORDER BY be.created_at DESC
            `, [budget.id]);

            res.json({
                budget,
                expenses: expensesResult.rows || []
            });
        } catch (err) {
            logError(err, { context: 'get_department_budget', department: req.params.department });
            next(new AppError('Database error', 500));
        }
    });

    /**
     * PUT /api/budgets/:id/allocate
     * Update budget allocation
     * Access: Finance Manager, MD, Admin
     */
    app.put('/api/budgets/:id/allocate', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const budgetId = req.params.id;
            const { allocated_amount } = req.body;

            if (!allocated_amount || allocated_amount < 0) {
                return res.status(400).json({ error: 'Valid allocated amount is required' });
            }

            const result = await pool.query(`
                UPDATE budgets
                SET allocated_amount = $1,
                    available_amount = allocated_amount - committed_amount - spent_amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [allocated_amount, budgetId]);

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Budget not found' });
            }

            res.json({
                success: true,
                message: 'Budget allocation updated successfully'
            });
        } catch (err) {
            logError(err, { context: 'update_budget_allocation', budgetId: req.params.id });
            next(new AppError('Failed to update budget allocation', 500));
        }
    });

    /**
     * POST /api/requisitions/:id/budget-check
     * Check budget availability and commit funds
     * Access: Finance Manager, Admin
     */
    app.post('/api/requisitions/:id/budget-check', authenticate, authorize('finance', 'admin'), async (req, res, next) => {
        try {
            const reqId = req.params.id;
            const { approved, comments } = req.body;

            // Get requisition details
            const reqResult = await pool.query(`
                SELECT r.*, u.department
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                WHERE r.id = $1
            `, [reqId]);

            if (reqResult.rows.length === 0) {
                return res.status(404).json({ error: 'Requisition not found' });
            }

            const requisition = reqResult.rows[0];

            // Calculate total amount in ZMW
            const itemsResult = await pool.query(`
                SELECT * FROM requisition_items WHERE requisition_id = $1
            `, [reqId]);

            const totalAmount = itemsResult.rows.reduce((sum, item) => {
                return sum + (item.amount_in_zmw || item.total_price || 0);
            }, 0);

            // Get department budget
            const fiscalYear = new Date().getFullYear().toString();
            const budgetResult = await pool.query(`
                SELECT * FROM budgets
                WHERE department = $1 AND fiscal_year = $2
            `, [requisition.department, fiscalYear]);

            if (budgetResult.rows.length === 0) {
                return res.status(404).json({ error: 'Budget not found for department' });
            }

            const budget = budgetResult.rows[0];
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
                await pool.query(`
                    UPDATE budgets
                    SET committed_amount = committed_amount + $1,
                        available_amount = allocated_amount - committed_amount - spent_amount,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [totalAmount, budget.id]);

                // Record expense
                try {
                    await pool.query(`
                        INSERT INTO budget_expenses (budget_id, requisition_id, department, amount, fiscal_year, expense_type, recorded_by)
                        VALUES ($1, $2, $3, $4, $5, 'committed', $6)
                    `, [budget.id, reqId, requisition.department, totalAmount, fiscalYear, req.user.id]);
                } catch (expenseErr) {
                    logError(expenseErr, { context: 'record_budget_expense' });
                }

                // Update requisition
                await pool.query(`
                    UPDATE requisitions
                    SET budget_checked = true,
                        budget_approved_by = $1,
                        budget_approved_at = CURRENT_TIMESTAMP,
                        budget_comments = $2
                    WHERE id = $3
                `, [req.user.id, comments, reqId]);

                res.json({
                    success: true,
                    message: 'Budget approved and funds committed',
                    committed: totalAmount,
                    remaining: available - totalAmount
                });
            } else {
                // Budget rejected
                await pool.query(`
                    UPDATE requisitions
                    SET budget_checked = true,
                        budget_approved_by = $1,
                        budget_approved_at = CURRENT_TIMESTAMP,
                        budget_comments = $2,
                        status = 'budget_rejected'
                    WHERE id = $3
                `, [req.user.id, comments || 'Budget not approved', reqId]);

                res.json({
                    success: true,
                    message: 'Budget check rejected'
                });
            }
        } catch (err) {
            logError(err, { context: 'budget_check', reqId: req.params.id });
            next(new AppError('Database error', 500));
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
            let paramIndex = 1;

            if (dateFrom) {
                query += ` AND DATE(r.created_at) >= DATE($${paramIndex++})`;
                params.push(dateFrom);
            }

            if (dateTo) {
                query += ` AND DATE(r.created_at) <= DATE($${paramIndex++})`;
                params.push(dateTo);
            }

            if (status) {
                query += ` AND r.status = $${paramIndex++}`;
                params.push(status);
            }

            if (department) {
                query += ` AND u.department = $${paramIndex++}`;
                params.push(department);
            }

            query += ' ORDER BY r.created_at DESC';

            const reqResult = await pool.query(query, params);
            const requisitions = reqResult.rows;

            // Get items for each requisition
            const reqPromises = requisitions.map(async req => {
                const itemsResult = await pool.query(`
                    SELECT ri.*, v.name as vendor_name
                    FROM requisition_items ri
                    LEFT JOIN vendors v ON ri.vendor_id = v.id
                    WHERE ri.requisition_id = $1
                `, [req.id]);
                req.items = itemsResult.rows || [];
                return req;
            });

            const requisitionsWithItems = await Promise.all(reqPromises);

            const excelBuffer = await generateRequisitionSummaryExcel(requisitionsWithItems, { dateFrom, dateTo, status, department });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=requisitions_report_${Date.now()}.xlsx`);
            res.send(excelBuffer);
        } catch (err) {
            logError(err, { context: 'get_requisitions_for_excel' });
            next(new AppError('Database error', 500));
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

            const result = await pool.query(`
                SELECT * FROM budgets
                WHERE fiscal_year = $1
                ORDER BY department
            `, [fiscalYear]);

            const excelBuffer = await generateBudgetReportExcel(result.rows, fiscalYear);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=budget_report_${fiscalYear}_${Date.now()}.xlsx`);
            res.send(excelBuffer);
        } catch (err) {
            logError(err, { context: 'get_budgets_for_excel' });
            next(new AppError('Database error', 500));
        }
    });

    /**
     * GET /api/reports/fx-rates/excel
     * Generate Excel report of FX rates
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/reports/fx-rates/excel', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const result = await pool.query(`
                SELECT fr.*, u.full_name as updated_by_name
                FROM fx_rates fr
                LEFT JOIN users u ON fr.updated_by = u.id
                ORDER BY fr.currency_code, fr.created_at DESC
            `);

            const excelBuffer = await generateFXRatesExcel(result.rows);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=fx_rates_report_${Date.now()}.xlsx`);
            res.send(excelBuffer);
        } catch (err) {
            logError(err, { context: 'get_fx_rates_for_excel' });
            next(new AppError('Database error', 500));
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
    app.get('/api/reports/requisitions/pdf', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const { dateFrom, dateTo, status, department } = req.query;

            let query = `
                SELECT r.*, u.full_name as creator_name, u.department
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;

            if (dateFrom) {
                query += ` AND DATE(r.created_at) >= DATE($${paramIndex++})`;
                params.push(dateFrom);
            }

            if (dateTo) {
                query += ` AND DATE(r.created_at) <= DATE($${paramIndex++})`;
                params.push(dateTo);
            }

            if (status) {
                query += ` AND r.status = $${paramIndex++}`;
                params.push(status);
            }

            if (department) {
                query += ` AND u.department = $${paramIndex++}`;
                params.push(department);
            }

            query += ' ORDER BY r.created_at DESC';

            const reqResult = await pool.query(query, params);
            const requisitions = reqResult.rows;

            if (requisitions.length === 0) {
                const doc = generateRequisitionSummaryPDF([], { dateFrom, dateTo, status, department });

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=requisitions_report_${Date.now()}.pdf`);

                doc.pipe(res);
                doc.end();
                return;
            }

            // Get items for each requisition
            const reqPromises = requisitions.map(async req => {
                const itemsResult = await pool.query(`
                    SELECT ri.*, v.name as vendor_name
                    FROM requisition_items ri
                    LEFT JOIN vendors v ON ri.vendor_id = v.id
                    WHERE ri.requisition_id = $1
                `, [req.id]);
                req.items = itemsResult.rows || [];
                return req;
            });

            await Promise.all(reqPromises);

            const doc = generateRequisitionSummaryPDF(requisitions, { dateFrom, dateTo, status, department });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=requisitions_report_${Date.now()}.pdf`);

            doc.pipe(res);
            doc.end();
        } catch (err) {
            logError(err, { context: 'get_requisitions_for_pdf' });
            next(new AppError('Database error', 500));
        }
    });

    /**
     * GET /api/reports/budgets/pdf
     * Generate PDF report of budgets
     * Access: Finance Manager, MD, Admin
     */
    app.get('/api/reports/budgets/pdf', authenticate, authorize('finance', 'md', 'admin'), async (req, res, next) => {
        try {
            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            const result = await pool.query(`
                SELECT * FROM budgets
                WHERE fiscal_year = $1
                ORDER BY department
            `, [fiscalYear]);

            const doc = generateBudgetReportPDF(result.rows, fiscalYear);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=budget_report_${fiscalYear}_${Date.now()}.pdf`);

            doc.pipe(res);
            doc.end();
        } catch (err) {
            logError(err, { context: 'get_budgets_for_pdf' });
            next(new AppError('Database error', 500));
        }
    });

    /**
     * GET /api/reports/department/:department/pdf
     * Generate departmental spending PDF report
     * Access: Finance Manager, MD, Admin, HOD (own department)
     */
    app.get('/api/reports/department/:department/pdf', authenticate, authorize('finance', 'md', 'admin', 'hod'), async (req, res, next) => {
        try {
            const department = req.params.department;

            // Check if HOD is accessing own department
            if (req.user.role === 'hod' && req.user.department !== department) {
                return res.status(403).json({ error: 'You can only view reports for your own department' });
            }

            const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();

            // Get budget info
            const budgetResult = await pool.query(`
                SELECT * FROM budgets
                WHERE department = $1 AND fiscal_year = $2
            `, [department, fiscalYear]);

            const budget = budgetResult.rows[0];

            // Get requisitions
            const reqResult = await pool.query(`
                SELECT r.*, u.full_name as creator_name
                FROM requisitions r
                JOIN users u ON r.created_by = u.id
                WHERE u.department = $1
                ORDER BY r.created_at DESC
            `, [department]);

            const requisitions = reqResult.rows;

            if (requisitions.length === 0) {
                const doc = generateDepartmentalSpendingPDF(department, [], budget);

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=dept_${department}_report_${Date.now()}.pdf`);

                doc.pipe(res);
                doc.end();
                return;
            }

            // Get items for requisitions
            const reqPromises = requisitions.map(async req => {
                const itemsResult = await pool.query(`SELECT * FROM requisition_items WHERE requisition_id = $1`,
                    [req.id]);
                req.items = itemsResult.rows || [];
                return req;
            });

            await Promise.all(reqPromises);

            const doc = generateDepartmentalSpendingPDF(department, requisitions, budget);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=dept_${department}_report_${Date.now()}.pdf`);

            doc.pipe(res);
            doc.end();
        } catch (err) {
            logError(err, { context: 'get_dept_report', department: req.params.department });
            next(new AppError('Database error', 500));
        }
    });

    console.log('✅ FX Rates, Budget Management, and Reporting routes loaded');
};
