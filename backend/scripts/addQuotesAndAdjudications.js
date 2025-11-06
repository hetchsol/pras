/**
 * Migration Script: Add quotes and adjudications tables
 *
 * This allows procurement to:
 * 1. Upload 3 vendor quotes (PDFs) in response to RFQs
 * 2. Create adjudication summaries comparing the quotes
 * 3. Finance and MD can review quotes before final approval
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Creating quotes and adjudications tables...\n');

  // Create vendor_quotes table
  db.run(`
    CREATE TABLE IF NOT EXISTS vendor_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requisition_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      vendor_name TEXT NOT NULL,
      quote_number TEXT,
      quote_amount REAL NOT NULL,
      currency TEXT DEFAULT 'ZMW',
      quote_file_path TEXT NOT NULL,
      quote_file_name TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating vendor_quotes table:', err);
    } else {
      console.log('✅ Created vendor_quotes table');
    }
  });

  // Create adjudications table
  db.run(`
    CREATE TABLE IF NOT EXISTS adjudications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requisition_id INTEGER NOT NULL,
      recommended_vendor_id INTEGER NOT NULL,
      recommended_vendor_name TEXT NOT NULL,
      recommended_amount REAL NOT NULL,
      currency TEXT DEFAULT 'ZMW',
      summary TEXT NOT NULL,
      evaluation_criteria TEXT,
      technical_compliance TEXT,
      pricing_analysis TEXT,
      delivery_terms TEXT,
      payment_terms TEXT,
      recommendation_rationale TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      reviewed_by_finance INTEGER,
      reviewed_by_md INTEGER,
      finance_comments TEXT,
      md_comments TEXT,
      FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
      FOREIGN KEY (recommended_vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (reviewed_by_finance) REFERENCES users(id),
      FOREIGN KEY (reviewed_by_md) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating adjudications table:', err);
    } else {
      console.log('✅ Created adjudications table');
    }
  });

  // Add has_quotes and has_adjudication flags to requisitions
  db.all("PRAGMA table_info(requisitions)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking requisitions table:', err);
      return;
    }

    const hasQuotesFlag = columns.some(col => col.name === 'has_quotes');
    const hasAdjudicationFlag = columns.some(col => col.name === 'has_adjudication');

    if (!hasQuotesFlag) {
      db.run(`ALTER TABLE requisitions ADD COLUMN has_quotes INTEGER DEFAULT 0`, (err) => {
        if (err) {
          console.error('❌ Error adding has_quotes column:', err);
        } else {
          console.log('✅ Added has_quotes column to requisitions');
        }
      });
    }

    if (!hasAdjudicationFlag) {
      db.run(`ALTER TABLE requisitions ADD COLUMN has_adjudication INTEGER DEFAULT 0`, (err) => {
        if (err) {
          console.error('❌ Error adding has_adjudication column:', err);
        } else {
          console.log('✅ Added has_adjudication column to requisitions');
        }
      });
    }

    console.log('\n✅ Migration completed successfully!');

    setTimeout(() => {
      db.close();
      process.exit(0);
    }, 500);
  });
});
