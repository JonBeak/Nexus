#!/usr/bin/env node

/**
 * Nexus Folder Opener - Invisible Helper App
 *
 * Opens Windows Explorer to a specific folder path from the web app.
 * Runs completely invisible - no UI, no console window.
 *
 * Protocol: nexus://open?path=<folder_path>
 * Example: nexus://open?path=\\server\orders\12345
 */

const { exec } = require('child_process');
const { URL } = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  // Silent exit if no arguments (shouldn't happen in normal use)
  process.exit(0);
}

const protocolUrl = args[0];

try {
  // Parse the nexus:// URL
  // Windows passes it as: nexus://open?path=\\server\folder
  const url = new URL(protocolUrl);

  // Validate it's the correct protocol
  if (url.protocol !== 'nexus:') {
    process.exit(1);
  }

  // Extract the path parameter
  const folderPath = url.searchParams.get('path');

  if (!folderPath) {
    process.exit(1);
  }

  // Security validation: Only allow specific path patterns
  const isValidPath = (
    // UNC paths: \\server\share\...
    folderPath.startsWith('\\\\') ||
    // Mapped drives: Z:\...
    /^[A-Z]:\\/.test(folderPath) ||
    // Local paths with specific prefixes
    folderPath.startsWith('C:\\Orders\\') ||
    folderPath.startsWith('C:\\Jobs\\')
  );

  if (!isValidPath) {
    // Invalid path pattern - exit silently
    process.exit(1);
  }

  // Open Windows Explorer at the specified path
  // Use 'explorer' command which works for both folders and network paths
  exec(`explorer "${folderPath}"`, (error) => {
    // Exit silently regardless of success/failure
    // Error could mean folder doesn't exist, network unavailable, etc.
    // Let Windows handle showing error to user if needed
    process.exit(error ? 1 : 0);
  });

} catch (error) {
  // Any parsing error - exit silently
  process.exit(1);
}
