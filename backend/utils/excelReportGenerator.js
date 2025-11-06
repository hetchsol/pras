/**
 * Excel Report Generator for Purchase Requisition System
 *
 * Generates comprehensive Excel reports for Finance Manager and MD
 */

const ExcelJS = require('exceljs');

/**
 * Generate Requisition Summary Report
 * @param {Array} requisitions - Array of requisition objects with items
 * @param {Object} filters - Filter parameters (dateFrom, dateTo, status, department)
 * @returns {Buffer} Excel file buffer
 */
async function generateRequisitionSummaryExcel(requisitions, filters = {}) {
    const workbook = new ExcelJS.Workbook();

    // Set workbook properties
    workbook.creator = 'Purchase Requisition System';
    workbook.lastModifiedBy = 'System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Create Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary', {
        properties: { tabColor: { argb: 'FF0066CC' } }
    });

    // Add header
    summarySheet.mergeCells('A1:H1');
    const titleRow = summarySheet.getCell('A1');
    titleRow.value = 'PURCHASE REQUISITION SUMMARY REPORT';
    titleRow.font = { size: 16, bold: true, color: { argb: 'FF0066CC' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add filters info
    summarySheet.getCell('A2').value = 'Report Generated:';
    summarySheet.getCell('B2').value = new Date().toLocaleString();

    if (filters.dateFrom) {
        summarySheet.getCell('A3').value = 'Date From:';
        summarySheet.getCell('B3').value = filters.dateFrom;
    }

    if (filters.dateTo) {
        summarySheet.getCell('A4').value = 'Date To:';
        summarySheet.getCell('B4').value = filters.dateTo;
    }

    // Column headers
    const headerRow = summarySheet.getRow(6);
    headerRow.values = [
        'Req Number',
        'Title',
        'Department',
        'Status',
        'Created By',
        'Total Amount (ZMW)',
        'Currency Mix',
        'Created Date'
    ];

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0066CC' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data rows
    let totalAmount = 0;
    requisitions.forEach((req, index) => {
        const row = summarySheet.getRow(7 + index);

        // Get currency mix
        const currencies = [...new Set(req.items.map(item => item.currency || 'ZMW'))];
        const currencyMix = currencies.join(', ');

        const reqTotal = req.items.reduce((sum, item) => sum + (item.amount_in_zmw || item.total_price || 0), 0);
        totalAmount += reqTotal;

        row.values = [
            req.req_number,
            req.title,
            req.department,
            req.status,
            req.creator_name,
            reqTotal,
            currencyMix,
            new Date(req.created_at).toLocaleDateString()
        ];

        // Apply alternating row colors
        if (index % 2 === 0) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F8FF' }
            };
        }

        // Format currency
        row.getCell(6).numFmt = '#,##0.00';
    });

    // Add totals row
    const totalsRow = summarySheet.getRow(7 + requisitions.length);
    totalsRow.values = ['', '', '', '', 'TOTAL:', totalAmount, '', ''];
    totalsRow.font = { bold: true };
    totalsRow.getCell(6).numFmt = '#,##0.00';
    totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFEB3B' }
    };

    // Set column widths
    summarySheet.columns = [
        { width: 20 },
        { width: 30 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 18 },
        { width: 15 },
        { width: 15 }
    ];

    // Create Detailed Items Sheet
    const detailsSheet = workbook.addWorksheet('Detailed Items', {
        properties: { tabColor: { argb: 'FF00AA00' } }
    });

    // Add header
    detailsSheet.mergeCells('A1:K1');
    const detailsTitleRow = detailsSheet.getCell('A1');
    detailsTitleRow.value = 'DETAILED REQUISITION ITEMS';
    detailsTitleRow.font = { size: 16, bold: true, color: { argb: 'FF00AA00' } };
    detailsTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Column headers
    const detailsHeaderRow = detailsSheet.getRow(3);
    detailsHeaderRow.values = [
        'Req Number',
        'Item Name',
        'Quantity',
        'Unit Price',
        'Currency',
        'Total (Currency)',
        'FX Rate',
        'Total (ZMW)',
        'Vendor',
        'Specifications',
        'Status'
    ];

    detailsHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailsHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00AA00' }
    };
    detailsHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add detailed items
    let rowIndex = 4;
    requisitions.forEach(req => {
        req.items.forEach((item, index) => {
            const row = detailsSheet.getRow(rowIndex);

            row.values = [
                req.req_number,
                item.item_name,
                item.quantity,
                item.unit_price || 0,
                item.currency || 'ZMW',
                item.total_price || 0,
                item.fx_rate_used || 1,
                item.amount_in_zmw || item.total_price || 0,
                item.vendor_name || 'N/A',
                item.specifications || '',
                req.status
            ];

            // Format numbers
            row.getCell(4).numFmt = '#,##0.00';
            row.getCell(6).numFmt = '#,##0.00';
            row.getCell(7).numFmt = '#,##0.0000';
            row.getCell(8).numFmt = '#,##0.00';

            // Alternating colors
            if (rowIndex % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF0FFF0' }
                };
            }

            rowIndex++;
        });
    });

    // Set column widths
    detailsSheet.columns = [
        { width: 20 },
        { width: 30 },
        { width: 10 },
        { width: 12 },
        { width: 10 },
        { width: 15 },
        { width: 10 },
        { width: 15 },
        { width: 20 },
        { width: 30 },
        { width: 15 }
    ];

    return await workbook.xlsx.writeBuffer();
}

/**
 * Generate Budget Report
 * @param {Array} budgets - Array of budget objects with spending details
 * @param {String} fiscalYear - Fiscal year
 * @returns {Buffer} Excel file buffer
 */
async function generateBudgetReportExcel(budgets, fiscalYear) {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Purchase Requisition System';
    workbook.created = new Date();

    // Create Budget Overview Sheet
    const budgetSheet = workbook.addWorksheet('Budget Overview', {
        properties: { tabColor: { argb: 'FFFF6600' } }
    });

    // Add header
    budgetSheet.mergeCells('A1:G1');
    const titleRow = budgetSheet.getCell('A1');
    titleRow.value = `BUDGET REPORT - FISCAL YEAR ${fiscalYear}`;
    titleRow.font = { size: 16, bold: true, color: { argb: 'FFFF6600' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

    budgetSheet.getCell('A2').value = 'Report Generated:';
    budgetSheet.getCell('B2').value = new Date().toLocaleString();

    // Column headers
    const headerRow = budgetSheet.getRow(4);
    headerRow.values = [
        'Department',
        'Allocated Budget',
        'Committed',
        'Spent',
        'Available',
        'Utilization %',
        'Status'
    ];

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF6600' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add budget data
    let totalAllocated = 0;
    let totalCommitted = 0;
    let totalSpent = 0;
    let totalAvailable = 0;

    budgets.forEach((budget, index) => {
        const row = budgetSheet.getRow(5 + index);

        const allocated = budget.allocated_amount || 0;
        const committed = budget.committed_amount || 0;
        const spent = budget.spent_amount || 0;
        const available = allocated - committed - spent;
        const utilization = allocated > 0 ? ((committed + spent) / allocated * 100) : 0;

        let status = 'Normal';
        let statusColor = 'FF00AA00';

        if (utilization >= 90) {
            status = 'Critical';
            statusColor = 'FFFF0000';
        } else if (utilization >= 75) {
            status = 'Warning';
            statusColor = 'FFFFA500';
        }

        row.values = [
            budget.department,
            allocated,
            committed,
            spent,
            available,
            utilization,
            status
        ];

        // Format currency
        row.getCell(2).numFmt = '#,##0.00';
        row.getCell(3).numFmt = '#,##0.00';
        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '0.00"%"';

        // Status color
        row.getCell(7).font = { bold: true, color: { argb: statusColor } };

        // Alternating colors
        if (index % 2 === 0) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF5E6' }
            };
        }

        totalAllocated += allocated;
        totalCommitted += committed;
        totalSpent += spent;
        totalAvailable += available;
    });

    // Add totals row
    const totalsRow = budgetSheet.getRow(5 + budgets.length);
    totalsRow.values = [
        'TOTAL',
        totalAllocated,
        totalCommitted,
        totalSpent,
        totalAvailable,
        totalAllocated > 0 ? ((totalCommitted + totalSpent) / totalAllocated * 100) : 0,
        ''
    ];

    totalsRow.font = { bold: true };
    totalsRow.getCell(2).numFmt = '#,##0.00';
    totalsRow.getCell(3).numFmt = '#,##0.00';
    totalsRow.getCell(4).numFmt = '#,##0.00';
    totalsRow.getCell(5).numFmt = '#,##0.00';
    totalsRow.getCell(6).numFmt = '0.00"%"';
    totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFEB3B' }
    };

    // Set column widths
    budgetSheet.columns = [
        { width: 20 },
        { width: 18 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 12 }
    ];

    return await workbook.xlsx.writeBuffer();
}

/**
 * Generate FX Rates Report
 * @param {Array} fxRates - Array of FX rate objects
 * @returns {Buffer} Excel file buffer
 */
async function generateFXRatesExcel(fxRates) {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Purchase Requisition System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Exchange Rates', {
        properties: { tabColor: { argb: 'FF9C27B0' } }
    });

    // Add header
    sheet.mergeCells('A1:F1');
    const titleRow = sheet.getCell('A1');
    titleRow.value = 'EXCHANGE RATES REPORT';
    titleRow.font = { size: 16, bold: true, color: { argb: 'FF9C27B0' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.getCell('A2').value = 'Report Generated:';
    sheet.getCell('B2').value = new Date().toLocaleString();

    // Column headers
    const headerRow = sheet.getRow(4);
    headerRow.values = [
        'Currency Code',
        'Currency Name',
        'Rate to ZMW',
        'Effective From',
        'Updated By',
        'Status'
    ];

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF9C27B0' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add FX rate data
    fxRates.forEach((rate, index) => {
        const row = sheet.getRow(5 + index);

        row.values = [
            rate.currency_code,
            rate.currency_name,
            rate.rate_to_zmw,
            new Date(rate.effective_from).toLocaleDateString(),
            rate.updated_by_name || 'N/A',
            rate.is_active ? 'Active' : 'Inactive'
        ];

        row.getCell(3).numFmt = '#,##0.0000';

        // Status color
        if (rate.is_active) {
            row.getCell(6).font = { color: { argb: 'FF00AA00' } };
        } else {
            row.getCell(6).font = { color: { argb: 'FFFF0000' } };
        }

        // Alternating colors
        if (index % 2 === 0) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF3E5F5' }
            };
        }
    });

    // Set column widths
    sheet.columns = [
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 12 }
    ];

    return await workbook.xlsx.writeBuffer();
}

module.exports = {
    generateRequisitionSummaryExcel,
    generateBudgetReportExcel,
    generateFXRatesExcel
};
