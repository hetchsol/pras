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
                db.get(`SELECT COUNT(*) as count FROM vendor_quotes WHERE requisition_id = ?`,
                    [reqId],
                    (err, result) => {
                        if (err) {
                            logError(err, { context: 'check_quote_count', reqId });
                            fs.unlinkSync(req.file.path);
                            return next(new AppError('Database error', 500));
                        }

                        if (result.count >= 3) {
                            fs.unlinkSync(req.file.path);
                            return res.status(400).json({ error: 'Maximum 3 quotes allowed per requisition' });
                        }

                        // Insert quote record
                        db.run(`
                            INSERT INTO vendor_quotes (
                                requisition_id, vendor_id, vendor_name, quote_number,
                                quote_amount, currency, quote_file_path, quote_file_name,
                                uploaded_by, notes
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            reqId, actualVendorId, vendor_name, quote_number || null,
                            quote_amount, currency || 'ZMW', req.file.path, req.file.originalname,
                            req.user.id, notes || null
                        ], function(insertErr) {
                            if (insertErr) {
                                logError(insertErr, { context: 'insert_quote', reqId });
                                fs.unlinkSync(req.file.path);
                                return next(new AppError('Failed to save quote', 500));
                            }

                            // Update requisition has_quotes flag
                            db.run(`UPDATE requisitions SET has_quotes = 1 WHERE id = ?`, [reqId]);

                            res.json({
                                success: true,
                                message: 'Quote uploaded successfully',
                                quote_id: this.lastID
                            });
                        });
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
        (req, res, next) => {
            try {
                const reqId = req.params.id;

                db.all(`
                    SELECT q.*, u.full_name as uploaded_by_name
                    FROM vendor_quotes q
                    LEFT JOIN users u ON q.uploaded_by = u.id
                    WHERE q.requisition_id = ?
                    ORDER BY q.uploaded_at ASC
                `, [reqId], (err, quotes) => {
                    if (err) {
                        logError(err, { context: 'get_quotes', reqId });
                        return next(new AppError('Database error', 500));
                    }
                    res.json(quotes || []);
                });
            } catch (error) {
                next(error);
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
        (req, res, next) => {
            try {
                const quoteId = req.params.id;

                db.get(`SELECT * FROM vendor_quotes WHERE id = ?`, [quoteId], (err, quote) => {
                    if (err) {
                        logError(err, { context: 'get_quote_for_download', quoteId });
                        return next(new AppError('Database error', 500));
                    }

                    if (!quote) {
                        return res.status(404).json({ error: 'Quote not found' });
                    }

                    if (!fs.existsSync(quote.quote_file_path)) {
                        return res.status(404).json({ error: 'Quote file not found' });
                    }

                    res.download(quote.quote_file_path, quote.quote_file_name);
                });
            } catch (error) {
                next(error);
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
        (req, res, next) => {
            try {
                const quoteId = req.params.id;

                db.get(`SELECT * FROM vendor_quotes WHERE id = ?`, [quoteId], (err, quote) => {
                    if (err) {
                        logError(err, { context: 'get_quote_for_delete', quoteId });
                        return next(new AppError('Database error', 500));
                    }

                    if (!quote) {
                        return res.status(404).json({ error: 'Quote not found' });
                    }

                    // Delete file
                    if (fs.existsSync(quote.quote_file_path)) {
                        fs.unlinkSync(quote.quote_file_path);
                    }

                    // Delete record
                    db.run(`DELETE FROM vendor_quotes WHERE id = ?`, [quoteId], function(delErr) {
                        if (delErr) {
                            logError(delErr, { context: 'delete_quote', quoteId });
                            return next(new AppError('Failed to delete quote', 500));
                        }

                        // Check if there are any quotes left
                        db.get(`SELECT COUNT(*) as count FROM vendor_quotes WHERE requisition_id = ?`,
                            [quote.requisition_id],
                            (countErr, result) => {
                                if (!countErr && result.count === 0) {
                                    db.run(`UPDATE requisitions SET has_quotes = 0 WHERE id = ?`, [quote.requisition_id]);
                                }
                            });

                        res.json({
                            success: true,
                            message: 'Quote deleted successfully'
                        });
                    });
                });
            } catch (error) {
                next(error);
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
        (req, res, next) => {
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
                db.get(`SELECT has_quotes FROM requisitions WHERE id = ?`, [reqId], (err, req_data) => {
                    if (err) {
                        logError(err, { context: 'check_requisition_quotes', reqId });
                        return next(new AppError('Database error', 500));
                    }

                    if (!req_data || !req_data.has_quotes) {
                        return res.status(400).json({
                            error: 'Please upload vendor quotes before creating adjudication'
                        });
                    }

                    // Check if adjudication already exists
                    db.get(`SELECT id FROM adjudications WHERE requisition_id = ?`, [reqId], (checkErr, existing) => {
                        if (checkErr) {
                            logError(checkErr, { context: 'check_adjudication_exists', reqId });
                            return next(new AppError('Database error', 500));
                        }

                        if (existing) {
                            return res.status(400).json({
                                error: 'Adjudication already exists for this requisition. Please update instead.'
                            });
                        }

                        // Insert adjudication
                        db.run(`
                            INSERT INTO adjudications (
                                requisition_id, recommended_vendor_id, recommended_vendor_name,
                                recommended_amount, currency, summary, evaluation_criteria,
                                technical_compliance, pricing_analysis, delivery_terms,
                                payment_terms, recommendation_rationale, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            reqId, recommended_vendor_id, recommended_vendor_name,
                            recommended_amount, currency || 'ZMW', summary, evaluation_criteria || null,
                            technical_compliance || null, pricing_analysis || null, delivery_terms || null,
                            payment_terms || null, recommendation_rationale, req.user.id
                        ], function(insertErr) {
                            if (insertErr) {
                                logError(insertErr, { context: 'create_adjudication', reqId });
                                return next(new AppError('Failed to create adjudication', 500));
                            }

                            // Update requisition flag and status
                            db.run(`
                                UPDATE requisitions
                                SET has_adjudication = 1,
                                    status = 'pending_finance',
                                    procurement_status = 'completed',
                                    procurement_completed_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [reqId]);

                            res.json({
                                success: true,
                                message: 'Adjudication created successfully and sent to Finance for review',
                                adjudication_id: this.lastID
                            });
                        });
                    });
                });
            } catch (error) {
                next(error);
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
        (req, res, next) => {
            try {
                const reqId = req.params.id;

                db.get(`
                    SELECT a.*,
                           u1.full_name as created_by_name,
                           u2.full_name as reviewed_by_finance_name,
                           u3.full_name as reviewed_by_md_name
                    FROM adjudications a
                    LEFT JOIN users u1 ON a.created_by = u1.id
                    LEFT JOIN users u2 ON a.reviewed_by_finance = u2.id
                    LEFT JOIN users u3 ON a.reviewed_by_md = u3.id
                    WHERE a.requisition_id = ?
                `, [reqId], (err, adjudication) => {
                    if (err) {
                        logError(err, { context: 'get_adjudication', reqId });
                        return next(new AppError('Database error', 500));
                    }
                    res.json(adjudication || null);
                });
            } catch (error) {
                next(error);
            }
        }
    );

    console.log('✅ Quotes and Adjudications routes loaded');
};
