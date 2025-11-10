# 🚀 Quick Installation Guide

## For Users (5 Minutes)

### Step 1: Download Files
Copy these 2 files to your computer:
1. `nexus-folder-opener.exe`
2. `install.js`

### Step 2: Open Command Prompt as Administrator
- Press `Windows + X`
- Click **"Command Prompt (Admin)"** or **"PowerShell (Admin)"**
- Click "Yes" if Windows asks for permission

### Step 3: Navigate to Download Location
```cmd
cd C:\Users\YourName\Downloads
```
*(Replace with your actual download folder)*

### Step 4: Run Installer
```cmd
node install.js
```

### Step 5: Test It!
In the same command prompt, test it:
```cmd
start nexus://open?path=C:\Windows
```

If Windows Explorer opens to the C:\Windows folder, **you're done!** ✅

---

## Troubleshooting

### "node is not recognized"
You need Node.js installed:
1. Download from: https://nodejs.org
2. Install (just keep clicking Next)
3. Restart Command Prompt
4. Try again

### "Access Denied"
Make sure Command Prompt says **"Administrator"** in the title bar.
- Close Command Prompt
- Right-click "Command Prompt" → "Run as administrator"

### Still not working?
Contact your system administrator.

---

## Uninstalling

If you need to remove it:
```cmd
reg delete HKEY_CLASSES_ROOT\nexus /f
rd /s /q "C:\Program Files\Nexus"
```

---

**Questions?** Ask Jon! 😊
