const { db, createTables } = require('./database');

console.log('🔄 Creating petty cash tables...');

try {
    // Create all tables (including the new petty cash tables)
    createTables();

    // Verify tables were created
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'petty_cash%'").all();

    console.log('\n✅ Petty cash tables created successfully!');
    console.log('Tables found:');
    tables.forEach(table => {
        console.log(`  - ${table.name}`);
    });

    // Show count of existing records (should be 0 for new tables)
    const requisitionsCount = db.prepare('SELECT COUNT(*) as count FROM petty_cash_requisitions').get();
    const itemsCount = db.prepare('SELECT COUNT(*) as count FROM petty_cash_items').get();

    console.log('\nTable statistics:');
    console.log(`  - petty_cash_requisitions: ${requisitionsCount.count} records`);
    console.log(`  - petty_cash_items: ${itemsCount.count} records`);

    console.log('\n✅ All done!');
    process.exit(0);
} catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
}
