# User Manual - System Administrator

**Purchase Requisition System v3.0**

---

## Your Role

As **System Administrator**, you manage the system and users.

### Responsibilities
- User account management
- System configuration
- Data backup and security
- Technical support
- System monitoring
- Report generation
- Database maintenance

---

## Getting Started

### Login
1. URL: **http://localhost:3000**
2. Username: `admin`
3. Password: `admin123`
4. **Change password immediately!**

---

## Admin Dashboard

### Overview Panels
- Total users
- Active requisitions
- System health
- Storage usage
- Recent activity
- Error logs

---

## User Management

### Viewing All Users

1. Click "Admin" → "User Management"
2. View user list with:
   - Username
   - Full name
   - Role
   - Department
   - Status (Active/Inactive)
   - Last login

### Adding New User

1. Click "Add User"
2. Fill details:
   - **Username** (unique, lowercase)
   - **Full Name**
   - **Email**
   - **Department**
   - **Role** (Initiator/HOD/Finance/MD/Procurement/Admin)
   - **Initial Password**
3. Click "Create User"
4. User receives email with credentials

**Default Password:** `password123`
*(User must change on first login)*

### Editing User

1. Find user in list
2. Click "Edit"
3. Update:
   - Name
   - Email
   - Department
   - Role
4. Click "Update"

**Note:** Cannot change username

### Resetting Password

1. Find user
2. Click "Reset Password"
3. Choose:
   - **Auto-generate** - System creates password
   - **Manual** - You set password
4. Click "Reset"
5. Provide new password to user securely

### Deactivating User

1. Find user
2. Click "Deactivate"
3. Confirm action
4. User cannot login
5. Data retained

**Reactivating:**
- Click "Activate" to restore access

### Deleting User

1. Find user
2. Click "Delete"
3. Confirm deletion
4. **Warning:** Permanent action
5. Historical data remains but user removed

**Use sparingly** - Prefer deactivation

---

## Role Management

### System Roles

| Role | Capabilities |
|------|--------------|
| **Initiator** | Create requisitions |
| **HOD** | Approve department requests |
| **Finance** | Budget approval |
| **MD** | Final authorization |
| **Procurement** | Process orders, create POs |
| **Admin** | Full system access |

### Assigning Roles

1. Edit user
2. Select role from dropdown
3. Save changes
4. Role effective immediately

### Multiple Roles

Users can have combined roles:
- HOD + Initiator
- Finance + Admin
- Procurement + Initiator

---

## Department Management

### Adding Department

1. Go to "Departments"
2. Click "Add Department"
3. Enter:
   - Department name
   - Department code
   - Budget allocation
   - HOD assignment
4. Click "Save"

### Managing Departments

- Edit department details
- Assign HODs
- Set budget allocations
- View department statistics

---

## System Configuration

### General Settings

1. Go to "Settings" → "General"
2. Configure:
   - **Company Name**
   - **Company Logo**
   - **Contact Information**
   - **System Email**
   - **Timezone**
   - **Currency** (ZMW default)

### Email Configuration

1. Go to "Settings" → "Email"
2. Configure SMTP:
   - Server address
   - Port
   - Username
   - Password
   - Encryption (TLS/SSL)
3. Test email sending
4. Save settings

### Approval Workflow

1. Go to "Settings" → "Workflow"
2. Configure:
   - Approval sequence
   - Authority limits
   - Timeout periods
   - Escalation rules
3. Save changes

**Default Flow:**
```
Initiator → HOD → Finance → MD → Procurement
```

### Notification Settings

Configure notifications:
- Email templates
- SMS alerts (if configured)
- In-app notifications
- Frequency settings

---

## Budget Management

### System-Wide Budgets

1. Go to "Admin" → "Budgets"
2. View all department budgets
3. Actions:
   - Add new budget
   - Edit allocations
   - View utilization
   - Generate reports

### Budget Codes

Manage budget codes:
1. Go to "Budget Codes"
2. Add/edit codes
3. Assign to departments
4. Set amounts
5. Track usage

---

## FX Rate Management

### Updating Exchange Rates

1. Go to "Settings" → "FX Rates"
2. Click "Update Rate"
3. Enter:
   - USD to ZMW rate
   - Effective date
   - Source
4. Save

**Best Practice:** Update weekly or when significant changes

### Rate History

- View historical rates
- Track changes
- Export rate data

---

## Data Management

### Backup Database

**Manual Backup:**
1. Go to "Admin" → "Backup"
2. Click "Create Backup"
3. System creates backup file
4. Download to secure location
5. Label with date

**Backup includes:**
- All requisitions
- User data
- Budgets
- Purchase orders
- Uploaded files

**Backup Schedule:**
- Daily: Automated (if configured)
- Weekly: Manual verification
- Monthly: Archive backup

### Restore Database

1. Go to "Admin" → "Restore"
2. Upload backup file
3. Confirm restore
4. **Warning:** Overwrites current data
5. System restarts

**When to Restore:**
- Data corruption
- Accidental deletion
- System migration
- Testing purposes

### Data Export

Export data:
1. Go to "Reports" → "Data Export"
2. Select:
   - Date range
   - Data type
   - Format (Excel/CSV)
3. Click "Export"
4. Download file

---

## System Monitoring

### Activity Logs

View all system activity:
1. Go to "Admin" → "Activity Logs"
2. Filter by:
   - User
   - Action type
   - Date range
   - Module
3. Export logs

**Logged Actions:**
- Login/logout
- Requisition creation
- Approvals/rejections
- PO creation
- Configuration changes
- User management

### Error Logs

Monitor errors:
1. Go to "Admin" → "Error Logs"
2. View:
   - Error type
   - Timestamp
   - User affected
   - Stack trace
3. Troubleshoot issues

### Performance Monitoring

Track:
- Page load times
- Database queries
- Server response
- User sessions
- Storage usage

---

## File Management

### Uploaded Files

1. Go to "Admin" → "Files"
2. View all uploads
3. Actions:
   - View file
   - Download
   - Delete (if orphaned)
   - Check integrity

### Storage Management

Monitor:
- Total storage used
- Files by type
- Large files
- Orphaned files

**Cleanup:**
- Remove orphaned files
- Archive old files
- Compress large files

---

## Reports and Analytics

### System Reports

Generate:
- User activity report
- Requisition statistics
- Department performance
- Budget utilization
- System usage trends
- Approval efficiency

### Custom Reports

Create custom reports:
1. Go to "Reports" → "Custom"
2. Select:
   - Data sources
   - Fields
   - Filters
   - Grouping
3. Save template
4. Schedule automatic generation

---

## Security

### Password Policy

Configure:
1. Go to "Settings" → "Security"
2. Set:
   - Minimum length
   - Complexity requirements
   - Expiration period
   - History count
3. Enforce for all users

### Session Management

Settings:
- Session timeout
- Concurrent sessions
- Remember me duration
- Force logout

### Access Control

Review:
- Failed login attempts
- Suspicious activity
- IP restrictions (if needed)
- Role permissions

---

## Maintenance

### Regular Tasks

**Daily:**
- Check error logs
- Monitor system performance
- Review backup status
- Check user issues

**Weekly:**
- User access review
- Database optimization
- Storage cleanup
- Security audit

**Monthly:**
- Full system backup
- Performance report
- User activity analysis
- Software updates

### Database Maintenance

1. Go to "Admin" → "Database"
2. Tasks:
   - **Optimize** - Improve performance
   - **Repair** - Fix issues
   - **Analyze** - Check health
   - **Vacuum** - Reclaim space

### System Updates

When updates available:
1. Backup system first
2. Download update
3. Read release notes
4. Apply in test environment
5. Deploy to production
6. Verify functionality
7. Monitor for issues

---

## Troubleshooting

### Common Issues

**Users Cannot Login:**
1. Check account status (active?)
2. Verify password
3. Check session limits
4. Review error logs
5. Reset password if needed

**System Slow:**
1. Check database size
2. Optimize database
3. Clear old logs
4. Check server resources
5. Review recent changes

**Email Not Sending:**
1. Verify SMTP settings
2. Test connection
3. Check credentials
4. Review email logs
5. Verify firewall rules

**Files Not Uploading:**
1. Check storage space
2. Verify file size limits
3. Check file permissions
4. Review error logs
5. Test with small file

---

## Support

### Providing User Support

**Process:**
1. Receive support request
2. Gather information:
   - Username
   - Issue description
   - Error messages
   - Steps to reproduce
3. Check logs
4. Test in admin account
5. Resolve or escalate
6. Document solution

### Escalation

**When to Escalate:**
- System-wide issues
- Security concerns
- Data corruption
- Critical bugs
- Performance problems

**Contact:**
- IT Department
- Software Vendor
- Database Administrator
- Security Team

---

## Best Practices

### Security

- Change default passwords
- Review user access regularly
- Monitor suspicious activity
- Keep software updated
- Backup regularly
- Use strong passwords
- Document changes

### Performance

- Optimize database monthly
- Clean up old files
- Monitor storage
- Archive old data
- Review slow queries
- Update statistics

### Documentation

- Document all changes
- Maintain user list
- Record issues/solutions
- Update procedures
- Keep configuration notes

---

## Quick Reference

### Daily Checklist
- [ ] Check error logs
- [ ] Review failed logins
- [ ] Monitor system performance
- [ ] Check backup status
- [ ] Review support tickets

### Emergency Contacts
- **System Vendor:** vendor@company.com
- **IT Support:** it@company.com
- **Database Team:** dba@company.com

### Key Shortcuts
- Ctrl + U: User management
- Ctrl + L: View logs
- Ctrl + B: Create backup
- Ctrl + R: Reports

---

## System Information

### Current Version
- **Version:** 3.0.1
- **Database:** SQLite
- **Backend:** Node.js + Express
- **Frontend:** HTML/CSS/JavaScript

### Server Details
- **Backend Port:** 3001
- **Frontend Port:** 3000
- **Database Location:** backend/requisitions.db

### File Locations
- **Uploads:** backend/uploads/
- **Logs:** backend/logs/
- **Backups:** ../purchase-requisition-backups/

---

**End of Admin Manual**

*Complete documentation package available:*
- MANUAL_INITIATOR.pdf
- MANUAL_HOD.pdf
- MANUAL_FINANCE.pdf
- MANUAL_MD.pdf
- MANUAL_PROCUREMENT.pdf
- MANUAL_ADMIN.pdf

**Version:** 3.0
**© 2025 Your Company. All rights reserved.**
