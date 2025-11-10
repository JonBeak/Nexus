#!/usr/bin/env node

/**
 * Nexus Folder Opener - Windows Protocol Installer
 *
 * Registers the nexus:// protocol in Windows Registry.
 * Must be run with administrator privileges.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('═══════════════════════════════════════════════════');
console.log('  Nexus Folder Opener - Protocol Installer');
console.log('═══════════════════════════════════════════════════\n');

// Determine installation path
const installDir = process.env.ProgramFiles
  ? path.join(process.env.ProgramFiles, 'Nexus')
  : 'C:\\Program Files\\Nexus';

const exePath = path.join(installDir, 'nexus-folder-opener.exe');

console.log(`📁 Installation directory: ${installDir}`);
console.log(`📄 Executable path: ${exePath}\n`);

// Check if running on Windows
if (process.platform !== 'win32') {
  console.error('❌ Error: This installer only works on Windows.');
  process.exit(1);
}

// Check if the exe file exists in current directory
const currentExe = path.join(__dirname, 'nexus-folder-opener.exe');
if (!fs.existsSync(currentExe)) {
  console.error('❌ Error: nexus-folder-opener.exe not found in current directory.');
  console.error('   Please build the executable first using: npm run build');
  process.exit(1);
}

try {
  // Step 1: Create installation directory
  console.log('📦 Step 1: Creating installation directory...');
  if (!fs.existsSync(installDir)) {
    fs.mkdirSync(installDir, { recursive: true });
    console.log('   ✅ Directory created\n');
  } else {
    console.log('   ✅ Directory already exists\n');
  }

  // Step 2: Copy executable to Program Files
  console.log('📦 Step 2: Copying executable...');
  fs.copyFileSync(currentExe, exePath);
  console.log('   ✅ Executable copied\n');

  // Step 3: Register protocol in Windows Registry
  console.log('📦 Step 3: Registering nexus:// protocol...');

  // Create a temporary .reg file
  const regContent = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\nexus]
@="URL:Nexus Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\nexus\\DefaultIcon]
@="${exePath.replace(/\\/g, '\\\\')},1"

[HKEY_CLASSES_ROOT\\nexus\\shell]

[HKEY_CLASSES_ROOT\\nexus\\shell\\open]

[HKEY_CLASSES_ROOT\\nexus\\shell\\open\\command]
@="\\"${exePath.replace(/\\/g, '\\\\')}\\" \\"%1\\""
`;

  const regFile = path.join(__dirname, 'nexus-protocol.reg');
  fs.writeFileSync(regFile, regContent);

  // Import the registry file
  execSync(`reg import "${regFile}"`, { stdio: 'inherit' });

  // Clean up temp file
  fs.unlinkSync(regFile);

  console.log('   ✅ Protocol registered\n');

  // Success message
  console.log('═══════════════════════════════════════════════════');
  console.log('  ✅ Installation Complete!');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('The nexus:// protocol is now registered.');
  console.log('You can now click "Open Folder" buttons in the Nexus web app!\n');
  console.log('Test it by visiting: nexus://open?path=C:\\\\Windows\n');

} catch (error) {
  console.error('\n❌ Installation failed:', error.message);
  console.error('\n💡 Make sure you run this installer as Administrator:');
  console.error('   Right-click Command Prompt → "Run as administrator"');
  console.error('   Then run: node install.js\n');
  process.exit(1);
}
