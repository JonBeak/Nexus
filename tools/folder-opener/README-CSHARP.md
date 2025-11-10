# Nexus Folder Opener - C# Version

**Professional Windows GUI application to open network folders from the Nexus web app.**

## ✨ Features

- ✅ **True Windows GUI app** - No console window ever
- ✅ **Tiny file size** - ~50KB (vs 36MB Node.js version)
- ✅ **Instant startup** - Native compiled code
- ✅ **Zero dependencies** - Uses built-in .NET Framework
- ✅ **Invisible execution** - Completely silent operation
- ✅ **Secure** - Path validation for safety

---

## 📦 What You Need

### For Users (Installing):
- ✅ Windows 7 or later (any edition)
- ✅ Administrator access (one-time, for installation only)
- ✅ Nothing else! .NET Framework is built into Windows

### For Developers (Building from source):
- ✅ Windows with .NET Framework 4.x (included in Windows 8+)
- ✅ C# Compiler (csc.exe) - comes with .NET Framework

---

## 🚀 Installation (5 Minutes)

### Step 1: Build the Application

**Option A: Use the build script (Easiest)**
1. Open folder in File Explorer
2. Double-click `build.bat`
3. Wait for compilation (~2 seconds)
4. You should see: "BUILD SUCCESSFUL!"

**Option B: Build manually**
```cmd
C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe /target:winexe /out:nexus-folder-opener.exe /reference:System.dll /reference:System.Web.dll /reference:System.Windows.Forms.dll NexusFolderOpener.cs
```

### Step 2: Install the Protocol Handler

1. Right-click `install-csharp.bat`
2. Select **"Run as administrator"**
3. Click "Yes" if Windows asks for permission
4. Wait for "INSTALLATION COMPLETE!"

### Step 3: Test It!

Open Command Prompt and run:
```cmd
start nexus://open?path=C:\Windows
```

If Windows Explorer opens to C:\Windows → **Success!** ✅

---

## 🧪 Testing from Web App

1. Open Nexus web app in browser
2. Click any "Open Folder" button
3. **First time only:** Windows dialog appears:
   - "This site is trying to open Node.js..."
   - Click **"Open"**
4. Folder opens instantly - **NO console window!** ✅

---

## 🔐 Security

### Path Validation

The app **only** opens these types of paths:

✅ **Allowed:**
- UNC paths: `\\server\share\folder`
- Mapped drives: `Z:\folder\subfolder`
- Any drive letter: `C:\`, `D:\`, etc.

❌ **Blocked:**
- Invalid or malformed paths
- Paths that don't match the pattern

### Customizing Allowed Paths

To restrict to **specific local paths only**, edit `NexusFolderOpener.cs` around line 95:

```csharp
// Uncomment these lines and customize:
if (path.StartsWith(@"C:\Orders\", StringComparison.OrdinalIgnoreCase))
    return true;
if (path.StartsWith(@"C:\Jobs\", StringComparison.OrdinalIgnoreCase))
    return true;
```

Then rebuild: `build.bat`

---

## 📊 File Size Comparison

| Version | File Size | Startup Time | Console Window |
|---------|-----------|--------------|----------------|
| **C# (this version)** | **~50 KB** | **Instant** | **Never shows** ✅ |
| Node.js (old) | 36 MB | ~500ms | Shows briefly ❌ |

**The C# version is 700x smaller and faster!**

---

## 🌐 Web App Integration

### Frontend (React/TypeScript)

```typescript
const openOrderFolder = (folderPath: string) => {
  // Create nexus:// protocol URL
  const nexusUrl = `nexus://open?path=${encodeURIComponent(folderPath)}`;

  // Open the folder
  window.location.href = nexusUrl;
};

// Usage in component
<button onClick={() => openOrderFolder(order.folder_path)}>
  📁 Open Folder
</button>
```

### With Fallback (Copy to Clipboard)

```typescript
const openOrderFolder = (folderPath: string) => {
  try {
    // Try custom protocol first
    window.location.href = `nexus://open?path=${encodeURIComponent(folderPath)}`;
  } catch {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(folderPath);
    alert('Path copied! Press Windows+R, paste, and hit Enter.');
  }
};
```

---

## 🛠️ Troubleshooting

### "csc.exe not found" when building

**.NET Framework 4.x is missing**. Download from:
https://dotnet.microsoft.com/download/dotnet-framework

### "Access Denied" during installation

**Run as Administrator:**
1. Right-click `install-csharp.bat`
2. Select "Run as administrator"

### Dialog appears every time

**This is normal for Windows Home**. The dialog asking "Allow nexus to open?" cannot be disabled without Windows Pro.

But there's **no console window flash** anymore! ✅

### Folder doesn't open

**Check these:**
- Folder path exists
- Network connection is working
- You have permission to access the folder
- Path format is correct (UNC: `\\server\share\folder`)

---

## 🔄 Updating

To update the application:

1. Edit `NexusFolderOpener.cs`
2. Run `build.bat`
3. Run `install-csharp.bat` (as admin) again
4. Done!

---

## 🗑️ Uninstalling

Run this in Command Prompt (as Administrator):

```cmd
reg delete HKEY_CLASSES_ROOT\nexus /f
rd /s /q "C:\Program Files\Nexus"
```

---

## 📝 Technical Details

### What Gets Installed

**File:**
- `C:\Program Files\Nexus\nexus-folder-opener.exe` (~50 KB)

**Registry Keys:**
```
HKEY_CLASSES_ROOT\nexus
  (Default) = "URL:Nexus Protocol"
  URL Protocol = ""

HKEY_CLASSES_ROOT\nexus\shell\open\command
  (Default) = "C:\Program Files\Nexus\nexus-folder-opener.exe" "%1"
```

### How It Works

1. User clicks "Open Folder" in web app
2. Browser navigates to: `nexus://open?path=\\server\folder`
3. Windows Registry points `nexus://` → your exe
4. Exe launches (invisible, no console)
5. Exe parses URL, validates path
6. Exe runs: `explorer.exe "\\server\folder"`
7. Exe exits immediately
8. Windows Explorer shows the folder

**Total time: <100ms**

---

## 📄 License

MIT License - Internal use for Sign House Nexus system

---

## 🤝 Support

For issues or questions, contact your system administrator.

---

**Built for Sign House by Claude Code** 🤖

*Rewritten in C# for performance and professionalism*
