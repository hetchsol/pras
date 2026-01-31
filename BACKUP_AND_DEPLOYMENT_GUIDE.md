# Database Backup & Deployment Guide
## Purchase Requisition System

This guide covers automated database backups and safe deployment/update procedures.

---

## Table of Contents

1. [Database Backup System](#database-backup-system)
2. [Scheduled Automated Backups](#scheduled-automated-backups)
3. [Database Restore](#database-restore)
4. [Deployment & Update Process](#deployment--update-process)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Database Backup System

### Manual Backup

**Script**: `backup-database.bat`

Creates a timestamped backup of your database with automatic cleanup of old backups.

**Features**:
- Timestamped backups (format: `YYYYMMDD_HHMMSS`)
- Automatic compression (if 7-Zip installed)
- Retention policy: Keeps last 30 backups
- Backup logging
- File size verification

**Usage**:
```bash
# Run manually
backup-database.bat

# Run silently (for automation)
backup-database.bat auto
```

**Backup Location**:
```
C:\Projects\purchase-requisition-system\backups\
```

**Backup Naming**:
```
purchase_requisition_backup_20250125_143022.db
purchase_requisition_backup_20250125_143022.db.zip (if compressed)
```

---

## Scheduled Automated Backups

### Setup Scheduled Backups

**Script**: `schedule-backups.bat`

Automatically sets up Windows Scheduled Tasks for regular backups.

**Run As Administrator**:
```bash
# Right-click → Run as Administrator
schedule-backups.bat
```

**Backup Schedule Created**:

| Frequency | Schedule | Task Name |
|-----------|----------|-----------|
| Daily | 2:00 AM every day | Purchase Requisition - Daily Backup |
| Weekly | 3:00 AM every Sunday | Purchase Requisition - Weekly Backup |
| Monthly | 4:00 AM on 1st of month | Purchase Requisition - Monthly Backup |

### View Scheduled Tasks

**Option 1 - Task Scheduler GUI**:
1. Press `Win + R`
2. Type: `taskschd.msc`
3. Press Enter
4. Look for tasks starting with "Purchase Requisition"

**Option 2 - Command Line**:
```bash
schtasks /query /tn "Purchase Requisition - Daily Backup" /fo LIST
schtasks /query /tn "Purchase Requisition - Weekly Backup" /fo LIST
schtasks /query /tn "Purchase Requisition - Monthly Backup" /fo LIST
```

### Run Backup Task Manually

```bash
# Run daily backup now
schtasks /run /tn "Purchase Requisition - Daily Backup"

# Run weekly backup now
schtasks /run /tn "Purchase Requisition - Weekly Backup"

# Run monthly backup now
schtasks /run /tn "Purchase Requisition - Monthly Backup"
```

### Remove Scheduled Backups

**Script**: `remove-backup-schedule.bat`

Removes all scheduled backup tasks (does NOT delete existing backups).

**Run As Administrator**:
```bash
remove-backup-schedule.bat
```

---

## Database Restore

### Restore from Backup

**Script**: `restore-database.bat`

Safely restores database from a backup with automatic service management.

**Features**:
- Lists all available backups
- Interactive backup selection
- Automatic service stop/start
- Creates safety backup before restore
- Automatic decompression (if backup is zipped)
- Confirmation prompts

**Usage**:
```bash
# Run as Administrator (if services are configured)
restore-database.bat
```

**Restore Process**:
1. Lists all available backups
2. You select which backup to restore
3. Script creates a backup of current database
4. Stops services (if running)
5. Restores selected backup
6. Restarts services
7. Verifies restoration

**Example**:
```
Available Backups:
========================================
1. purchase_requisition_backup_20250125_143022.db
2. purchase_requisition_backup_20250124_020000.db
3. purchase_requisition_backup_20250123_020000.db

Enter backup number to restore (1-3) or 0 to cancel: 2

Selected Backup: purchase_requisition_backup_20250124_020000.db

WARNING: This will replace your current database!

Type YES to confirm restore: YES

[Restoration process begins...]
```

---

## Deployment & Update Process

### Safe Deployment Script

**Script**: `deploy-update.bat`

Comprehensive deployment script with automatic backup, service management, and rollback.

**Features**:
- Pre-deployment system checks
- Automatic database backup
- Configuration backup
- Service stop/start management
- Dependency installation
- Database migrations
- Health checks
- Automatic rollback on failure
- Detailed logging

**Usage**:
```bash
# Run as Administrator
deploy-update.bat
```

### Deployment Process Steps

#### STEP 1: Pre-Deployment Checks
- Verifies NSSM installation
- Checks Nginx installation
- Validates Node.js installation
- Checks backend dependencies

#### STEP 2: Creating Pre-Deployment Backup
- Backs up current database
- Backs up .env configuration
- Creates timestamped backups

#### STEP 3: Stopping Services
- Stops Backend service
- Stops Nginx service
- Waits for graceful shutdown

#### STEP 4: Installing Dependencies
- Runs `npm install --production`
- Installs/updates Node.js packages

#### STEP 5: Database Migration
- Runs migration scripts (if available)
- Updates database schema

#### STEP 6: Configuration Update
- Verifies .env file exists
- Creates from .env.example if missing

#### STEP 7: Starting Services
- Starts Nginx service
- Starts Backend service
- Verifies services are running

#### STEP 8: Health Check
- Tests application accessibility
- Verifies HTTP response

#### STEP 9: Deployment Summary
- Shows deployment status
- Lists created backups
- Displays access URLs

### Automatic Rollback

If deployment fails at any step:

1. **Prompt for rollback**:
   ```
   An error occurred during deployment.
   Do you want to rollback to previous state? (Y/N):
   ```

2. **Rollback actions** (if confirmed):
   - Restores previous database
   - Restores previous configuration
   - Restarts services
   - Logs rollback action

3. **Manual investigation** (if declined):
   - Leaves system in current state
   - Logs error for investigation

---

## Best Practices

### Backup Best Practices

1. **Regular Backups**
   - Enable scheduled backups: `schedule-backups.bat`
   - Test restore process quarterly
   - Keep backups for at least 30 days

2. **Off-Site Backups**
   - Copy backups to network drive
   - Use cloud storage (OneDrive, Google Drive)
   - Maintain 3-2-1 backup strategy:
     - 3 copies of data
     - 2 different storage types
     - 1 off-site copy

3. **Backup Verification**
   - Periodically test restores
   - Verify backup file integrity
   - Check backup file sizes

4. **Security**
   - Protect backup directory access
   - Encrypt sensitive backups
   - Secure backup storage location

### Deployment Best Practices

1. **Before Deployment**
   - Test updates in development environment
   - Review changelog/release notes
   - Schedule during low-usage period
   - Notify users of planned maintenance

2. **During Deployment**
   - Run `deploy-update.bat` as Administrator
   - Monitor deployment log
   - Verify each step completes
   - Check for error messages

3. **After Deployment**
   - Verify application accessibility
   - Test critical functionality
   - Check service status
   - Review deployment logs

4. **If Deployment Fails**
   - Accept rollback when prompted
   - Review error logs
   - Investigate root cause
   - Fix issue before retrying

---

## File Locations

### Backup Files
```
C:\Projects\purchase-requisition-system\backups\
├── purchase_requisition_backup_YYYYMMDD_HHMMSS.db
├── pre_deploy_db_YYYYMMDD_HHMMSS.db
├── pre_restore_backup_YYYYMMDD_HHMMSS.db
└── env_backup_YYYYMMDD_HHMMSS.txt
```

### Log Files
```
C:\Projects\purchase-requisition-system\logs\
├── backup_log.txt
├── restore_log.txt
└── deployment_log.txt
```

### Service Logs
```
C:\nginx\logs\
├── service-stdout.log
├── service-stderr.log
├── access.log
└── error.log

C:\Projects\purchase-requisition-system\backend\logs\
├── service-stdout.log
└── service-stderr.log
```

---

## Troubleshooting

### Backup Issues

**Problem**: Backup script fails with "Access Denied"

**Solution**:
- Ensure you have write permissions to backup directory
- Close any applications accessing the database
- Stop services before backup if needed

**Problem**: Old backups not being deleted

**Solution**:
- Check backup directory permissions
- Manually delete old backups if needed
- Verify cleanup logic in backup script

### Restore Issues

**Problem**: "Database locked" error during restore

**Solution**:
1. Stop all services:
   ```bash
   C:\nssm\nssm.exe stop PurchaseRequisition-Backend
   C:\nssm\nssm.exe stop PurchaseRequisition-Nginx
   ```
2. Run restore again
3. Start services after restore

**Problem**: Restore completes but data is missing

**Solution**:
- Verify you selected correct backup file
- Check backup file size (should not be 0 bytes)
- Try different backup file

### Deployment Issues

**Problem**: npm install fails

**Solution**:
- Check internet connection
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` folder and try again
- Check Node.js version compatibility

**Problem**: Services won't start after deployment

**Solution**:
1. Check service logs:
   ```bash
   type C:\Projects\purchase-requisition-system\backend\logs\service-stderr.log
   ```
2. Test manual start:
   ```bash
   cd C:\Projects\purchase-requisition-system\backend
   node server.js
   ```
3. Fix any errors shown
4. Restart services

**Problem**: Application not accessible after deployment

**Solution**:
1. Check if services are running:
   ```bash
   C:\nssm\nssm.exe status PurchaseRequisition-Nginx
   C:\nssm\nssm.exe status PurchaseRequisition-Backend
   ```
2. Check Nginx configuration
3. Verify firewall rules
4. Test direct backend access: `http://localhost:3001`

---

## Quick Reference Commands

### Backup Operations
```bash
# Manual backup
backup-database.bat

# Setup scheduled backups
schedule-backups.bat

# Remove scheduled backups
remove-backup-schedule.bat

# Restore from backup
restore-database.bat
```

### Deployment Operations
```bash
# Deploy update
deploy-update.bat

# View deployment log
type C:\Projects\purchase-requisition-system\logs\deployment_log.txt

# View last 20 lines of deployment log
powershell -command "Get-Content 'C:\Projects\purchase-requisition-system\logs\deployment_log.txt' -Tail 20"
```

### Backup Management
```bash
# List all backups
dir C:\Projects\purchase-requisition-system\backups\

# View backup log
type C:\Projects\purchase-requisition-system\logs\backup_log.txt

# Manually run scheduled backup
schtasks /run /tn "Purchase Requisition - Daily Backup"
```

---

## Backup Retention Policy

Default retention: **30 backups**

Modify retention in `backup-database.bat`:
```batch
REM Change this line (currently set to 30)
if !COUNT! gtr 30 (
```

**Recommended Retention**:
- Daily backups: 7-14 days
- Weekly backups: 4-8 weeks
- Monthly backups: 12 months

---

## Support

If you encounter issues:

1. Check relevant log files
2. Verify services are running: `check-services.bat`
3. Review error messages carefully
4. Try rollback if deployment failed
5. Consult troubleshooting section above

For database corruption:
1. Stop all services
2. Restore from most recent backup
3. If all backups are corrupt, check file system integrity

---

## Summary

**Automated Backups**: Run `schedule-backups.bat` once to set up automatic backups at 2 AM daily, 3 AM Sunday weekly, and 4 AM monthly.

**Safe Deployments**: Use `deploy-update.bat` for all updates - it automatically backs up, stops services, updates code, and restarts with rollback on failure.

**Quick Recovery**: Use `restore-database.bat` to quickly restore from any backup with interactive selection and automatic service management.

All operations are logged for audit and troubleshooting purposes.
