/**
 * Vendor Import Script
 * Imports vendors from vendorlist.xlsx into the database
 *
 * Usage: node scripts/importVendors.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const ExcelJS = require('exceljs');
const { promisify } = require('util');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

async function updateVendorSchema() {
  console.log('📋 Updating vendor table schema...');

  try {
    // Check if new columns already exist
    const tableInfo = await dbAll("PRAGMA table_info(vendors)");
    const existingColumns = tableInfo.map(col => col.name);

    // Add new columns if they don't exist
    if (!existingColumns.includes('type')) {
      await dbRun('ALTER TABLE vendors ADD COLUMN type TEXT');
      console.log('✅ Added column: type');
    }

    if (!existingColumns.includes('currency')) {
      await dbRun('ALTER TABLE vendors ADD COLUMN currency TEXT DEFAULT "ZMW"');
      console.log('✅ Added column: currency');
    }

    if (!existingColumns.includes('country')) {
      await dbRun('ALTER TABLE vendors ADD COLUMN country TEXT');
      console.log('✅ Added column: country');
    }

    if (!existingColumns.includes('tax_id')) {
      await dbRun('ALTER TABLE vendors ADD COLUMN tax_id TEXT');
      console.log('✅ Added column: tax_id');
    }

    console.log('✅ Schema update complete\n');
  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    throw error;
  }
}

async function importVendors() {
  const excelPath = path.join(__dirname, '..', 'vendorlist.xlsx');

  console.log('📂 Reading Excel file:', excelPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const worksheet = workbook.worksheets[0];
  console.log(`📊 Found worksheet: "${worksheet.name}"\n`);

  // Get headers from first row
  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  console.log('📋 Column headers:', headers.filter(h => h).join(', '));
  console.log('');

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  // Process each row (skip header row)
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    rows.push({ row, rowNumber });
  });

  for (const { row, rowNumber } of rows) {
    try {
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = cell.value;
        }
      });

      // Map spreadsheet columns to database fields
      const vendorCode = rowData['Vendor Code']?.toString().trim();
      const vendorName = rowData['Vendor Name']?.toString().trim();
      const active = rowData['Active']?.toString().trim();
      const type = rowData['Type']?.toString().trim() || null;
      const currency = rowData['Currency']?.toString().trim() || 'ZMW';
      const country = rowData['Country']?.toString().trim() || null;
      const taxId = rowData['TPIN (Federal Tax ID)']?.toString().trim() || null;
      const phone = (rowData['Phone  Number'] || rowData['Phone Number'])?.toString().trim() || null;

      // Validate required fields
      if (!vendorCode || !vendorName) {
        skipped++;
        errors.push(`Row ${rowNumber}: Missing vendor code or name`);
        continue;
      }

      // Determine status
      const status = (active && (active.toLowerCase() === 'yes' || active.toLowerCase() === 'true' || active === '1'))
        ? 'active'
        : 'inactive';

      // Check if vendor exists
      const existing = await dbGet('SELECT id FROM vendors WHERE code = ?', [vendorCode]);

      if (existing) {
        // Update existing vendor
        await dbRun(`
          UPDATE vendors
          SET name = ?, status = ?, type = ?, currency = ?, country = ?, tax_id = ?, phone = ?
          WHERE code = ?
        `, [vendorName, status, type, currency, country, taxId, phone, vendorCode]);
        updated++;
        console.log(`✏️  Updated: ${vendorCode} - ${vendorName}`);
      } else {
        // Insert new vendor (with default values for tier, rating, category)
        await dbRun(`
          INSERT INTO vendors (code, name, status, type, currency, country, tax_id, phone, tier, rating, category, email)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          vendorCode,
          vendorName,
          status,
          type,
          currency,
          country,
          taxId,
          phone,
          1, // default tier
          0, // default rating
          type || 'General', // category (use type or 'General')
          null // email (not in spreadsheet)
        ]);
        imported++;
        console.log(`➕ Imported: ${vendorCode} - ${vendorName}`);
      }
    } catch (error) {
      skipped++;
      errors.push(`Row ${rowNumber}: ${error.message}`);
      console.error(`❌ Error on row ${rowNumber}:`, error.message);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ New vendors imported: ${imported}`);
  console.log(`✏️  Existing vendors updated: ${updated}`);
  console.log(`⚠️  Rows skipped: ${skipped}`);
  console.log(`📝 Total rows processed: ${imported + updated + skipped}`);

  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    errors.forEach(err => console.log(`   - ${err}`));
  }

  console.log('='.repeat(60) + '\n');
}

async function main() {
  try {
    console.log('🚀 Starting vendor import process...\n');

    // Step 1: Update database schema
    await updateVendorSchema();

    // Step 2: Import vendors
    await importVendors();

    console.log('✅ Vendor import completed successfully!');

    // Close database connection
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      process.exit(0);
    });
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);

    // Close database connection
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      process.exit(1);
    });
  }
}

// Run the import
main();
