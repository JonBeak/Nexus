/**
 * Gmail Credentials Setup CLI Tool
 *
 * Interactive command-line tool to configure Gmail API service account credentials.
 * Stores the service account JSON file path in encrypted_credentials table.
 *
 * Usage:
 *   npm run setup:gmail-credentials
 *
 * Pattern: Similar to update-qb-credentials.js but for Gmail service account
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { CredentialService } from '../services/credentialService';

// Initialize credential service
const credentialService = CredentialService.getInstance();

/**
 * Create readline interface for user input
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Promisify readline question
 */
function question(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

/**
 * Validate service account JSON file
 */
function validateServiceAccountJSON(filePath: string): { valid: boolean; error?: string } {
  try {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }

    // Read and parse JSON
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileContent);

    // Validate required fields
    const requiredFields = [
      'type',
      'project_id',
      'private_key_id',
      'private_key',
      'client_email',
      'client_id'
    ];

    for (const field of requiredFields) {
      if (!json[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate type
    if (json.type !== 'service_account') {
      return { valid: false, error: `Invalid type: ${json.type} (expected: service_account)` };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing JSON'
    };
  }
}

/**
 * Copy service account JSON to config directory
 */
function copyServiceAccountFile(sourcePath: string, configDir: string): string {
  const targetPath = path.join(configDir, 'gmail-service-account.json');

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  // Copy file
  fs.copyFileSync(sourcePath, targetPath);

  // Set restrictive permissions (owner read/write only)
  fs.chmodSync(targetPath, 0o600);

  return targetPath;
}

/**
 * Main setup function
 */
async function main() {
  console.log('\n=======================================================');
  console.log('  Gmail API Service Account Setup');
  console.log('=======================================================\n');

  console.log('This tool will configure Gmail API credentials for sending');
  console.log('customer notification emails.\n');

  console.log('Prerequisites:');
  console.log('1. ✅ Gmail API enabled in Google Cloud Console');
  console.log('2. ✅ Service account created with domain-wide delegation');
  console.log('3. ✅ Service account JSON key downloaded\n');

  const proceed = await question('Do you have the service account JSON file ready? (y/n): ');

  if (proceed.toLowerCase() !== 'y') {
    console.log('\n⚠️  Setup cancelled.');
    console.log('   Please complete Google Cloud Console setup first.\n');
    rl.close();
    process.exit(0);
  }

  // Get service account JSON file path
  console.log('\n--- Step 1: Service Account JSON File ---\n');

  let serviceAccountPath = '';
  let validPath = false;

  while (!validPath) {
    const inputPath = await question('Enter path to service account JSON file: ');

    if (!inputPath || inputPath.trim() === '') {
      console.log('❌ Path cannot be empty. Please try again.\n');
      continue;
    }

    // Resolve absolute path
    const absolutePath = path.isAbsolute(inputPath)
      ? inputPath
      : path.join(process.cwd(), inputPath);

    console.log(`\nValidating: ${absolutePath}...`);

    const validation = validateServiceAccountJSON(absolutePath);

    if (!validation.valid) {
      console.log(`❌ Invalid service account file: ${validation.error}`);
      console.log('   Please check the file and try again.\n');
      continue;
    }

    // Read JSON to show service account email
    const json = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    console.log(`✅ Valid service account file`);
    console.log(`   Service Account: ${json.client_email}`);
    console.log(`   Project ID: ${json.project_id}\n`);

    const confirm = await question('Is this correct? (y/n): ');

    if (confirm.toLowerCase() === 'y') {
      serviceAccountPath = absolutePath;
      validPath = true;
    } else {
      console.log('\n');
    }
  }

  // Copy file to config directory
  console.log('\n--- Step 2: Copy to Config Directory ---\n');

  const configDir = path.join(process.cwd(), 'config');
  console.log(`Copying service account JSON to: ${configDir}/`);

  try {
    const targetPath = copyServiceAccountFile(serviceAccountPath, configDir);
    console.log(`✅ File copied successfully`);
    console.log(`   Location: ${targetPath}`);
    console.log(`   Permissions: 0600 (owner read/write only)\n`);

    // Store path in encrypted_credentials table
    console.log('\n--- Step 3: Store in Database ---\n');
    console.log('Saving service account path to encrypted_credentials table...');

    // Store as relative path for portability
    const relativePath = path.relative(process.cwd(), targetPath);

    await credentialService.setCredential({
      service_name: 'gmail',
      credential_key: 'service_account_path',
      value: relativePath,
      metadata: {
        configured_at: new Date().toISOString(),
        sender_email: process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca',
        note: 'Gmail service account for customer notification emails'
      }
    });

    console.log('✅ Service account path stored successfully\n');

  } catch (error) {
    console.error('❌ Failed to copy file or store credentials:', error);
    console.error('   Setup incomplete. Please try again.\n');
    rl.close();
    process.exit(1);
  }

  // Summary
  console.log('\n=======================================================');
  console.log('  ✅ Gmail API Setup Complete!');
  console.log('=======================================================\n');

  console.log('Configuration Summary:');
  console.log(`  Sender Email: ${process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca'}`);
  console.log(`  Sender Name: ${process.env.GMAIL_SENDER_NAME || 'Sign House'}`);
  console.log(`  Gmail Enabled: ${process.env.GMAIL_ENABLED || 'false'}\n`);

  console.log('Next Steps:');
  console.log('1. Test Gmail API connection:');
  console.log('   npm run test:gmail-auth\n');

  console.log('2. When ready to send real emails, update .env:');
  console.log('   GMAIL_ENABLED=true\n');

  console.log('3. Test with internal email first before enabling for customers\n');

  rl.close();
  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error('\n❌ Setup failed:', error);
  rl.close();
  process.exit(1);
});
