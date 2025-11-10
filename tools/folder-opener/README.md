# Nexus Folder Opener

**Invisible helper app to open network folders from the Nexus web application.**

## 🎯 What It Does

This tiny Windows app allows users to click "Open Folder" buttons in the Nexus web app and have Windows Explorer open the folder instantly - completely invisible, no UI, no windows, just instant folder opening!

## 📦 Files

- `nexus-folder-opener.exe` - The invisible helper app (36MB)
- `install.js` - Protocol registration installer
- `opener.js` - Source code for the helper app
- `package.json` - Build configuration

## 🚀 Installation (One-Time Setup Per PC)

### For End Users:

1. **Copy the exe** to any location (e.g., Desktop)
   - File: `nexus-folder-opener.exe`

2. **Run Command Prompt as Administrator:**
   - Press `Windows + X`
   - Click "Command Prompt (Admin)" or "PowerShell (Admin)"

3. **Navigate to the folder** where you copied the exe:
   ```cmd
   cd C:\Users\YourName\Desktop
   ```

4. **Run the installer:**
   ```cmd
   node install.js
   ```

5. **Done!** The `nexus://` protocol is now registered.

### What the Installer Does:

- Copies `nexus-folder-opener.exe` to `C:\Program Files\Nexus\`
- Registers the `nexus://` protocol in Windows Registry
- No restart required!

## 🧪 Testing

After installation, test it by:

### Method 1: Command Line
```cmd
start nexus://open?path=C:\Windows
```

### Method 2: Browser
Open your browser and navigate to:
```
nexus://open?path=C:\Windows
```

### Method 3: From Web App
Click any "Open Folder" button in the Orders page!

## 🔐 Security

The app validates all paths before opening:

✅ **Allowed paths:**
- UNC paths: `\\server\share\folder`
- Mapped drives: `Z:\folder`
- Specific local paths: `C:\Orders\`, `C:\Jobs\`

❌ **Blocked:**
- System directories (without explicit configuration)
- Invalid or malformed paths
- Non-folder paths

### Customizing Allowed Paths

Edit `opener.js` line 48-55 to allow additional paths:

```javascript
const isValidPath = (
  folderPath.startsWith('\\\\') ||               // UNC paths
  /^[A-Z]:\\/.test(folderPath) ||                // Mapped drives
  folderPath.startsWith('C:\\Orders\\') ||       // Custom path 1
  folderPath.startsWith('C:\\Jobs\\') ||         // Custom path 2
  folderPath.startsWith('D:\\Production\\')      // Custom path 3
);
```

Then rebuild:
```bash
npm run build
```

## 🔨 Building from Source

If you need to rebuild the executable:

```bash
# Install dependencies
npm install

# Build Windows executable
npm run build

# Output: nexus-folder-opener.exe (36MB)
```

## 🌐 Web App Integration

### Frontend (React/TypeScript)

```typescript
// In your Orders component
const openOrderFolder = (folderPath: string) => {
  const nexusUrl = `nexus://open?path=${encodeURIComponent(folderPath)}`;
  window.location.href = nexusUrl;
};

// Usage
<button onClick={() => openOrderFolder(order.folder_path)}>
  📁 Open Folder
</button>
```

### Fallback for Users Without Helper App

```typescript
const openOrderFolder = (folderPath: string) => {
  try {
    // Try custom protocol first
    const nexusUrl = `nexus://open?path=${encodeURIComponent(folderPath)}`;
    window.location.href = nexusUrl;
  } catch {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(folderPath);
    alert('Path copied! Press Windows+R, paste, and hit Enter.');
  }
};
```

## 📊 System Requirements

- **OS:** Windows 7 or later
- **Permissions:** Administrator access (for installation only)
- **Disk Space:** ~36MB
- **Network:** LAN access to shared folders

## 🐛 Troubleshooting

### "Protocol not registered" error
- Run `install.js` again as Administrator
- Check if `C:\Program Files\Nexus\nexus-folder-opener.exe` exists

### Folder doesn't open
- Verify the folder path exists
- Check network connectivity to shared drive
- Ensure you have permission to access the folder

### Security warning when clicking
- This is normal for custom protocols
- Windows may show a dialog: "Allow nexus to open?"
- Click "Allow" or "Open" (you can check "Always allow")

### Need to uninstall?
Run this in Command Prompt (Admin):
```cmd
reg delete HKEY_CLASSES_ROOT\nexus /f
rd /s /q "C:\Program Files\Nexus"
```

## 📝 Version History

- **v1.0.0** (2025-11-04)
  - Initial release
  - Invisible execution (no console/UI)
  - UNC path support
  - Path validation for security

## 📄 License

MIT License - Internal use for Sign House Nexus system

## 🤝 Support

For issues or questions, contact the system administrator.

---

**Built for Sign House by Claude Code** 🤖
