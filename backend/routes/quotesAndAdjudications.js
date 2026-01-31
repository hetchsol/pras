/**
 * Quotes and Adjudications Routes
 *
 * Handles:
 * - Uploading vendor quotes (PDF files)
 * - Creating adjudication summaries
 * - Viewing quotes for Finance and MD
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../database');

module.exports = function setupQuotesAndAdjudications(app, db, authenticate, authorize) {
    const { AppError } = require('../middleware/errorHandler');
    const { logError } = require('../utils/logger');

    // Configure multer for PDF uploads
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, '../uploads/quotes');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `quote-${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    });

    const upload = multer({
        storage: storage,
        fileFilter: (req, file, cb) => {
            if (file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                cb(new Error('Only PDF files are allowed'), false);
            }
        },
        limits: {
            fileSize: 10 * 1024 * 1024 // 10MB limit
        }
    });

    // ============================================
    // UPLOAD VENDOR QUOTES
    // ============================================

    /**
     * POST /api/requisitions/:id/quotes
     * Upload a vendor quote (PDF)
     * Access: Procurement, Admin
     */
    app.post('/api/requisitions/:id/quotes',
        authenticate,
        authorize('procurement', 'admin'),
        upload.single('quoteFile'),
        (req, res, next) => {
            try {
                const reqId = req.params.id;
                const { vendor_id, vendor_name, quote_number, quote_amount, currency, notes } = req.body;

                console.log('📤 Quote upload request received:', {
                    reqId,
                    vendor_name,
                    quote_amount,
                    hasFile: !!req.file,
                    fileOriginalName: req.file?.originalname
                });

                if (!req.file) {
                    return res.status(400).json({ error: 'Quote PDF file is required' });
                }

                if (!vendor_name || !quote_amount) {
                    // Delete uploaded file if validation fails
                    fs.unlinkSync(req.file.path);
                    return res.status(400).json({ error: 'Vendor name and quote amount are required' });
                }

                // Generate vendor_id from vendor_name if not provided
                const actualVendorId = vendor_id || vendor_name.toLowerCase().replace(/\s+/g, '_');

                // Check how many quotes already exist for this requisition
                pool.query(`SELECT COUNT(*) as count FROM vendor_quotes WHERE requisition_id = $1`,
                    [reqId],
                    async (err, result) => {
                        if (err) {
                            logError(err, { context: 'check_quote_count', reqId });
                            fs.unlinkSync(req.file.path);
                            return next(new AppError('Database error', 500));
                        }

                        if (parseInt(result.rows[0].count) >= 3) {
                            fs.unlinkSync(req.file.path);
                            return res.status(400).json({ error: 'Maximum 3 quotes allowed per requisition' });
                        }

                        try {
                            // Insert quote record
                            const insertResult = await pool.query(`
                                INSERT INTO vendor_quotes (
                                    requisition_id, vendor_id, vendor_name, quote_number,
                                    quote_amount, currency, quote_file_path, quote_file_name,
                                    uploaded_by, notes
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                                RETURNING id
                            `, [
                                reqId, actualVendorId, vendor_name, quote_number || null,
                                quote_amount, currency || 'ZMW', req.file.path, req.file.originalname,
                                req.user.id, notes || null
                            ]);

                            // Update requisition has_quotes flag
                            await pool.query(`UPDATE requisitions SET has_quotes = true WHERE id = $1`, [reqId]);

                            res.json({
                                success: true,
                                message: 'Quote uploaded successfully',
                                quote_id: insertResult.rows[0].id
                            });
                        } catch (insertErr) {
                            logError(insertErr, { context: 'insert_quote', reqId });
                            fs.unlinkSync(req.file.path);
                            return next(new AppError('Failed to save quote', 500));
                        }
                    });
            } catch (error) {
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }
                next(error);
            }
        }
    );

    /**
     * GET /api/requisitions/:id/quotes
     * Get all quotes for a requisition
     * Access: Procurement, Finance, MD, Admin
     */
    app.get('/api/requisitions/:id/quotes',
        authenticate,
        authorize('procurement', 'finance', 'md', 'admin'),
        async (req, res, next) => {
            try {
                const reqId = req.params.id;

                const result = await pool.query(`
                    SELECT q.*, u.full_name as uploaded_by_name
                    FROM vendor_quotes q
                    LEFT JOIN users u ON q.uploaded_by = u.id
                    WHERE q.requisition_id = $1
                    ORDER BY q.uploaded_at ASC
                `, [reqId]);

                res.json(result.rows || []);
            } catch (err) {
                logError(err, { context: 'get_quotes', reqId: req.params.id });
                next(new AppError('Database error', 500));
            }
        }
    );

    /**
     * GET /api/quotes/:id/download
     * Download a quote PDF
     * Access: Procurement, Finance, MD, Admin
     */
    app.get('/api/quotes/:id/download',
        authenticate,
        authorize('procurement', 'finance', 'md', 'admin'),
        async (req, res, next) => {
            try {
                const quoteId = req.params.id;

                const result = await pool.query(`SELECT * FROM vendor_quotes WHERE id = $1`, [quoteId]);

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Quote not found' });
                }

                const quote = result.rows[0];

                if (!fs.existsSync(quote.quote_file_path)) {
                    return res.status(404).json({ error: 'Quote file not found' });
                }

                res.download(quote.quote_file_path, quote.quote_file_name);
            } catch (err) {
                logError(err, { context: 'get_quote_for_download', quoteId: req.params.id });
                next(new AppError('Database error', 500));
            }
        }
    );

    /**
     * DELETE /api/quotes/:id
     * Delete a quote
     * Access: Procurement, Admin
     */
    app.delete('/api/quotes/:id',
        authenticate,
        authorize('procurement', 'admin'),
        async (req, res, next) => {
            try {
                const quoteId = req.params.id;

                const result = await pool.query(`SELECT * FROM vendor_quotes WHERE id = $1`, [quoteId]);

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Quote not found' });
                }

                const quote = result.rows[0];

                // Delete file
                if (fs.existsSync(quote.quote_file_path)) {
                    fs.unlinkSync(quote.quote_file_path);
                }

                // Delete record
                await pool.query(`DELETE FROM vendor_quotes WHERE id = $1`, [quoteId]);

                // Check if there are any quotes left
                const countResult = await pool.query(`SELECT COUNT(*) as count FROM vendor_quotes WHERE requisition_id = $1`,
                    [quote.requisition_id]);

                if (parseInt(countResult.rows[0].count) === 0) {
                    await pool.query(`UPDATE requisitions SET has_quotes = false WHERE id = $1`, [quote.requisition_id]);
                }

                res.json({
                    success: true,
                    message: 'Quote deleted successfully'
                });
            } catch (err) {
                logError(err, { context: 'delete_quote', quoteId: req.params.id });
                next(new AppError('Failed to delete quote', 500));
            }
        }
    );

    // ============================================
    // ADJUDICATIONS
    // ============================================

    /**
     * POST /api/requisitions/:id/adjudication
     * Create adjudication summary
     * Access: Procurement, Admin
     */
    app.post('/api/requisitions/:id/adjudication',
        authenticate,
        authorize('procurement', 'admin'),
        async (req, res, next) => {
            try {
                const reqId = req.params.id;
                const {
                    recommended_vendor_id,
                    recommended_vendor_name,
                    recommended_amount,
                    currency,
                    summary,
                    evaluation_criteria,
                    technical_compliance,
                    pricing_analysis,
                    delivery_terms,
                    payment_terms,
                    recommendation_rationale
                } = req.body;

                if (!recommended_vendor_id || !recommended_vendor_name || !recommended_amount ||
                    !summary || !recommendation_rationale) {
                    return res.status(400).json({
                        error: 'Required fields: recommended vendor, amount, summary, and rationale'
                    });
                }

                // Check if requisition has quotes
                const reqResult = await pool.query(`SELECT has_quotes FROM requisitions WHERE id = $1`, [reqId]);

                if (reqResult.rows.length === 0 || !reqResult.rows[0].has_quotes) {
                    return res.status(400).json({
                        error: 'Please upload vendor quotes before creating adjudication'
                    });
                }

                // Check if adjudication already exists
                const existingResult = await pool.query(`SELECT id FROM adjudications WHERE requisition_id = $1`, [reqId]);

                if (existingResult.rows.length > 0) {
                    return res.status(400).json({
                        error: 'Adjudication already exists for this requisition. Please update instead.'
                    });
                }

                // Insert adjudication
                const insertResult = await pool.query(`
                    INSERT INTO adjudications (
                        requisition_id, recommended_vendor_id, recommended_vendor_name,
                        recommended_amount, currency, summary, evaluation_criteria,
                        technical_compliance, pricing_analysis, delivery_terms,
                        payment_terms, recommendation_rationale, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    RETURNING id
                `, [
                    reqId, recommended_vendor_id, recommended_vendor_name,
                    recommended_amount, currency || 'ZMW', summary, evaluation_criteria || null,
                    technical_compliance || null, pricing_analysis || null, delivery_terms || null,
                    payment_terms || null, recommendation_rationale, req.user.id
                ]);

                // Update requisition flag and status
                await pool.query(`
                    UPDATE requisitions
                    SET has_adjudication = true,
                        status = 'pending_finance',
                        procurement_status = 'completed',
                        procurement_completed_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [reqId]);

                res.json({
                    success: true,
                    message: 'Adjudication created successfully and sent to Finance for review',
                    adjudication_id: insertResult.rows[0].id
                });
            } catch (err) {
                logError(err, { context: 'create_adjudication', reqId: req.params.id });
                next(new AppError('Failed to create adjudication', 500));
            }
        }
    );

    /**
     * GET /api/requisitions/:id/adjudication
     * Get adjudication for a requisition
     * Access: Procurement, Finance, MD, Admin
     */
    app.get('/api/requisitions/:id/adjudication',
        authenticate,
        authorize('procurement', 'finance', 'md', 'admin'),
        async (req, res, next) => {
            try {
                const reqId = req.params.id;

                const result = await pool.query(`
                    SELECT a.*,
                           u1.full_name as created_by_name,
                           u2.full_name as reviewed_by_finance_name,
                           u3.full_name as reviewed_by_md_name
                    FROM adjudications a
                    LEFT JOIN users u1 ON a.created_by = u1.id
                    LEFT JOIN users u2 ON a.reviewed_by_finance = u2.id
                    LEFT JOIN users u3 ON a.reviewed_by_md = u3.id
                    WHERE a.requisition_id = $1
                `, [reqId]);

                res.json(result.rows[0] || null);
            } catch (err) {
                logError(err, { context: 'get_adjudication', reqId: req.params.id });
                next(new AppError('Database error', 500));
            }
        }
    );

    console.log('✅ Quotes and Adjudications routes loaded');
};
