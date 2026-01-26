const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function exportUsers() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(__dirname, 'Users_Depts (1).xlsx'));

  const sheet = workbook.getWorksheet('Sheet1');
  const users = [];
  let isHeader = true;

  sheet.eachRow((row) => {
    if (isHeader) { isHeader = false; return; }
    const v = row.values;
    if (!v[4] || !v[3]) return;

    const email = typeof v[5] === 'object' ? v[5].text : v[5];
    users.push({
      employee_number: v[2] || '',
      full_name: v[3],
      username: v[4],
      email: email || v[4] + '@ksb.com',
      role: v[6] || 'Initiator',
      department: v[7] || 'General',
      supervisor: v[8] || ''
    });
  });

  fs.writeFileSync(path.join(__dirname, 'users_export.json'), JSON.stringify(users, null, 2));
  console.log('Exported ' + users.length + ' users to users_export.json');
}

exportUsers().catch(console.error);
