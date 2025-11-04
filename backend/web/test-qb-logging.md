# QuickBooks Logging Test Instructions

## Setup Completed
- ✅ Backend rebuilt and restarted with enhanced logging
- ✅ PM2 logs cleared for clean testing
- ✅ Logging code verified in compiled JavaScript

## How to View Console Logs

### Option 1: Real-time PM2 Logs (Recommended)
```bash
# In a terminal, run this to watch logs in real-time:
pm2 logs signhouse-backend

# Or to follow just the output log:
pm2 logs signhouse-backend --out
```

### Option 2: Check Log Files Directly
```bash
# View output logs:
tail -f /home/jon/.pm2/logs/signhouse-backend-out.log

# View error logs:
tail -f /home/jon/.pm2/logs/signhouse-backend-error.log
```

### Option 3: View Recent Logs
```bash
# Show last 100 lines:
pm2 logs signhouse-backend --lines 100 --nostream
```

## What You Should See When Creating a QuickBooks Estimate

When you send an estimate to QuickBooks, you should see this sequence in the logs:

1. **Initial Processing:**
```
↳ Adding Subtotal at line X (Amount: Y) with comment: "..."
↳ Adding Empty Row at line X with comment: "..."
↳ Skipping Divider item at line X
```

2. **Detailed Payload (NEW):**
```
🔍 DETAILED QB API PAYLOAD:
================================
Customer: [QB Customer ID]
Date: 2025-11-03
Total Line Items: X

Line Items Detail:
------------------
[Line 1]
  DetailType: SalesItemLineDetail
  Item: Channel Letters (ID: 123)
  ...

[Line 2]
  DetailType: DescriptionOnly
  Type: DESCRIPTION ONLY
  Description: "Note text here"
  ...

[Line 3]
  DetailType: SubTotalLineDetail
  Type: SUBTOTAL
  Amount: 200
  ...

FULL JSON PAYLOAD:
{
  ... complete JSON structure ...
}
```

3. **API Call:**
```
🌐 QUICKBOOKS API CALL:
=======================
Endpoint: POST /v3/company/[RealmID]/estimate
Environment: sandbox
Line Items Count: X

Line Items Summary:
  1. SalesItemLineDetail
  2. DescriptionOnly: "Note text..."
  3. SubTotalLineDetail
  ...
```

4. **Response:**
```
📥 QUICKBOOKS RESPONSE:
=======================
✅ Estimate created: ID=123, Doc#=1001
Line Items Returned: X

Returned Line Items:
  1. SalesItemLineDetail: "Channel Letters"
     Amount: $100
  2. DescriptionOnly: "Note text"
  3. SubTotalLineDetail
     Amount: $200
  ...
```

## Troubleshooting

### If You Don't See Any Logs:

1. **Check if the backend is running:**
```bash
pm2 status
```

2. **Verify the route is being called:**
Check browser Developer Tools Network tab - look for:
- POST request to `/api/quickbooks/create-estimate`
- Response status and body

3. **Check for errors:**
```bash
pm2 logs signhouse-backend --err
```

4. **Restart backend if needed:**
```bash
pm2 restart signhouse-backend --update-env
```

## OAuth Connection Issue Found

There appears to be an issue with QuickBooks OAuth token storage. Error in logs:
```
Field 'access_token' doesn't have a default value
```

This might prevent QuickBooks estimates from being created. You may need to:
1. Reconnect to QuickBooks from the app
2. Check if QuickBooks connection status shows as connected

## Next Steps

1. Keep PM2 logs open: `pm2 logs signhouse-backend`
2. Try creating an estimate with Empty Rows and Subtotals
3. Send to QuickBooks
4. Copy the console output showing the detailed payload

The logs will show exactly what's being sent to QuickBooks and help identify why special items aren't appearing.