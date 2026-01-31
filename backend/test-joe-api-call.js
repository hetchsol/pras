const fetch = require('node-fetch');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const API_BASE = 'http://localhost:3001/api';

async function testJoeLogin() {
    console.log('\n=== TESTING JOE MUNTHALI API ACCESS ===\n');

    // 1. Get Joe's credentials from database
    const joe = db.prepare('SELECT * FROM users WHERE username = ?').get('joe.munthali');

    if (!joe) {
        console.log('❌ Joe Munthali not found in database!');
        return;
    }

    console.log('1️⃣ JOE\'S DATABASE RECORD:');
    console.log('   ID:', joe.id);
    console.log('   Username:', joe.username);
    console.log('   Role:', joe.role);
    console.log('   Department:', `"${joe.department}"`);
    console.log('');

    // 2. Create a JWT token for Joe (simulating login)
    const token = jwt.sign(
        {
            id: joe.id,
            username: joe.username,
            role: joe.role,
            department: joe.department,
            full_name: joe.full_name
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    console.log('2️⃣ GENERATED JWT TOKEN:');
    console.log('   Token:', token.substring(0, 50) + '...');
    console.log('');

    // 3. Make API call to get petty cash requisitions
    try {
        console.log('3️⃣ CALLING API: GET /api/forms/petty-cash-requisitions');
        console.log('   URL:', `${API_BASE}/forms/petty-cash-requisitions`);
        console.log('');

        const response = await fetch(`${API_BASE}/forms/petty-cash-requisitions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('4️⃣ API RESPONSE:');
        console.log('   Status:', response.status, response.statusText);
        console.log('');

        if (response.ok) {
            const data = await response.json();
            console.log('5️⃣ RETURNED DATA:');
            console.log('   Count:', data.length);
            console.log('');

            if (data.length === 0) {
                console.log('   ❌ NO REQUISITIONS RETURNED!');
                console.log('');
                console.log('   This is the problem - Joe is getting an empty array from the API');
            } else {
                console.log('   ✅ REQUISITIONS FOUND:');
                data.forEach(req => {
                    console.log('');
                    console.log('      ID:', req.id);
                    console.log('      Payee:', req.payee_name);
                    console.log('      Amount:', req.amount);
                    console.log('      Purpose:', req.purpose);
                    console.log('      Department:', `"${req.department}"`);
                    console.log('      Status:', req.status);
                    console.log('      Initiator ID:', req.initiator_id);
                    console.log('      Initiator Name:', req.initiator_name);
                });
            }
        } else {
            const error = await response.text();
            console.log('   ❌ ERROR RESPONSE:');
            console.log('   ', error);
        }

    } catch (error) {
        console.log('   ❌ FETCH ERROR:', error.message);
        console.log('');
        console.log('   Is the backend server running on port 3001?');
    }

    db.close();
    console.log('\n✅ Test complete!\n');
}

testJoeLogin();
