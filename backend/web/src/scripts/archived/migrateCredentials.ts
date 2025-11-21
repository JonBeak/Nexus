// File Clean up Finished: 2025-11-21 - Archived (migration completed 2025-11-03)
#!/usr/bin/env node
/**
 * Migration Script: Migrate QuickBooks credentials to encrypted storage
 *
 * This script:
 * 1. Reads existing credentials from .env file
 * 2. Stores them in encrypted format in the database
 * 3. Migrates existing OAuth tokens to encrypted format
 *
 * Usage: npm run migrate:credentials
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { pool } from '../config/database';
import { credentialService } from '../services/credentialService';
import { encryptionService, EncryptionService } from '../services/encryptionService';
import { QuickBooksCredentials } from '../types/credentials';
import { RowDataPacket } from 'mysql2';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Generate and display encryption salt if not exists
 */
async function ensureEncryptionSalt(): Promise<boolean> {
  if (!process.env.ENCRYPTION_SALT) {
    const newSalt = EncryptionService.generateSalt();

    console.log('⚠️  ENCRYPTION_SALT not found in .env file');
    console.log('📝 Generated new ENCRYPTION_SALT:');
    console.log('');
    console.log('Add this line to your .env file:');
    console.log('═'.repeat(50));
    console.log(`ENCRYPTION_SALT=${newSalt}`);
    console.log('═'.repeat(50));
    console.log('');
    console.log('After adding the salt, run this script again.');

    return false;
  }

  console.log('✅ ENCRYPTION_SALT found');
  return true;
}

/**
 * Test encryption service
 */
async function testEncryption(): Promise<boolean> {
  console.log('🔐 Testing encryption service...');

  const testResult = encryptionService.selfTest();

  if (testResult) {
    console.log('✅ Encryption service test passed');
    return true;
  } else {
    console.error('❌ Encryption service test failed');
    return false;
  }
}

/**
 * Run database migration
 */
async function runDatabaseMigration(): Promise<void> {
  console.log('📊 Running database migration...');

  try {
    // Check if encrypted_credentials table exists
    const [tables] = await pool.execute<RowDataPacket[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'encrypted_credentials'`
    );

    if (tables.length === 0) {
      console.log('❌ Table encrypted_credentials does not exist');
      console.log('Please run the database migration first:');
      console.log('mysql -u root -p sign_manufacturing < /home/jon/Nexus/database/migrations/2025-11-03-encrypted-credentials.sql');
      process.exit(1);
    }

    console.log('✅ Database tables are ready');
  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  }
}

/**
 * Migrate QuickBooks credentials from .env to encrypted storage
 */
async function migrateQuickBooksCredentials(): Promise<boolean> {
  console.log('🔄 Migrating QuickBooks credentials...');

  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const redirectUri = process.env.QB_REDIRECT_URI;
  const environment = process.env.QB_ENVIRONMENT;

  if (!clientId || !clientSecret) {
    console.log('⚠️  No QuickBooks credentials found in .env file');
    return false;
  }

  try {
    // Check if credentials already exist in encrypted storage
    const existing = await credentialService.getQuickBooksCredentials();

    if (existing) {
      console.log('⚠️  QuickBooks credentials already exist in encrypted storage');
      console.log('    Skipping credential migration');
      return true;
    }

    // Store credentials in encrypted format
    const credentials: QuickBooksCredentials = {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      environment: environment as 'sandbox' | 'production' | undefined,
    };

    await credentialService.setQuickBooksCredentials(credentials);

    console.log('✅ QuickBooks credentials migrated successfully');
    console.log('');
    console.log('🔒 IMPORTANT: You can now remove these from your .env file:');
    console.log('   - QB_CLIENT_ID');
    console.log('   - QB_CLIENT_SECRET');
    console.log('   (Keep QB_REDIRECT_URI and QB_ENVIRONMENT as they are not sensitive)');

    return true;
  } catch (error) {
    console.error('❌ Failed to migrate QuickBooks credentials:', error);
    return false;
  }
}

/**
 * Migrate existing OAuth tokens to encrypted format
 */
async function migrateOAuthTokens(): Promise<void> {
  console.log('🔄 Checking OAuth tokens...');

  try {
    // Get tokens that are not encrypted (encryption_version = 0 or NULL)
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, realm_id, access_token, refresh_token
       FROM qb_oauth_tokens
       WHERE (encryption_version = 0 OR encryption_version IS NULL)
       AND access_token IS NOT NULL`
    );

    if (rows.length === 0) {
      console.log('✅ No unencrypted tokens found (or no tokens exist)');
      return;
    }

    console.log(`📝 Found ${rows.length} token(s) to encrypt...`);

    for (const row of rows) {
      console.log(`   Encrypting tokens for Realm ID: ${row.realm_id}`);

      // Encrypt the tokens
      const encryptedAccess = encryptionService.encrypt(row.access_token);
      const encryptedRefresh = encryptionService.encrypt(row.refresh_token);

      // Update the database
      await pool.execute(
        `UPDATE qb_oauth_tokens
         SET access_token_encrypted = ?,
             access_token_iv = ?,
             access_token_tag = ?,
             refresh_token_encrypted = ?,
             refresh_token_iv = ?,
             refresh_token_tag = ?,
             encryption_version = 1
         WHERE id = ?`,
        [
          encryptedAccess.encrypted,
          encryptedAccess.iv,
          encryptedAccess.authTag,
          encryptedRefresh.encrypted,
          encryptedRefresh.iv,
          encryptedRefresh.authTag,
          row.id
        ]
      );
    }

    console.log('✅ OAuth tokens encrypted successfully');

    // Optional: Clear plaintext tokens after successful encryption
    const clearPlaintext = process.argv.includes('--clear-plaintext');
    if (clearPlaintext) {
      console.log('🧹 Clearing plaintext tokens...');
      await pool.execute(
        `UPDATE qb_oauth_tokens
         SET access_token = NULL, refresh_token = NULL
         WHERE encryption_version = 1`
      );
      console.log('✅ Plaintext tokens cleared');
    } else {
      console.log('');
      console.log('💡 TIP: Run with --clear-plaintext to remove plaintext tokens after verification');
    }

  } catch (error) {
    console.error('❌ Failed to migrate OAuth tokens:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('🔐 QuickBooks Credential Encryption Migration');
  console.log('═'.repeat(60));
  console.log('');

  try {
    // Step 1: Check encryption salt
    const hasSalt = await ensureEncryptionSalt();
    if (!hasSalt) {
      process.exit(0);
    }

    // Step 2: Test encryption
    const encryptionWorks = await testEncryption();
    if (!encryptionWorks) {
      process.exit(1);
    }

    // Step 3: Check database
    await runDatabaseMigration();

    // Step 4: Migrate credentials
    await migrateQuickBooksCredentials();

    // Step 5: Migrate OAuth tokens
    await migrateOAuthTokens();

    console.log('');
    console.log('═'.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('1. Test QuickBooks integration to ensure it works');
    console.log('2. Remove QB_CLIENT_ID and QB_CLIENT_SECRET from .env');
    console.log('3. Run with --clear-plaintext to remove old plaintext tokens');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('═'.repeat(60));
    console.error('❌ Migration failed:', error);
    console.error('═'.repeat(60));
    process.exit(1);
  }
}

// Run migration
main().catch(console.error);