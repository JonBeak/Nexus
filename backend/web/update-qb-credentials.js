#!/usr/bin/env node
/**
 * Update QuickBooks credentials in encrypted storage
 * Usage: node update-qb-credentials.js
 */

const { credentialService } = require('./dist/services/credentialService.js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function updateCredentials() {
  console.log('\n🔐 QuickBooks Credential Update Tool');
  console.log('════════════════════════════════════\n');

  try {
    // Get current credentials to show defaults
    const current = await credentialService.getQuickBooksCredentials();

    if (current) {
      console.log('Current configuration:');
      console.log('  Environment: ' + current.environment);
      console.log('  Redirect URI: ' + current.redirect_uri);
      console.log('  Credentials: [ENCRYPTED]\n');
    }

    // Prompt for new credentials
    const clientId = await question('Enter new Client ID (or press Enter to skip): ');
    const clientSecret = await question('Enter new Client Secret (or press Enter to skip): ');
    const environment = await question('Environment (sandbox/production, Enter to keep current): ');
    const redirectUri = await question('Redirect URI (Enter to keep current): ');

    // Build update object
    const updates = {};
    if (clientId) updates.client_id = clientId;
    if (clientSecret) updates.client_secret = clientSecret;
    if (environment) updates.environment = environment;
    if (redirectUri) updates.redirect_uri = redirectUri;

    if (Object.keys(updates).length === 0) {
      console.log('\n⚠️  No changes provided');
      process.exit(0);
    }

    // Apply updates
    const newCreds = {
      client_id: updates.client_id || current?.client_id,
      client_secret: updates.client_secret || current?.client_secret,
      environment: updates.environment || current?.environment || 'production',
      redirect_uri: updates.redirect_uri || current?.redirect_uri || process.env.QB_REDIRECT_URI
    };

    await credentialService.setQuickBooksCredentials(newCreds);

    console.log('\n✅ Credentials updated successfully!');
    console.log('   Restart your backend server to use new credentials.');

  } catch (error) {
    console.error('\n❌ Error updating credentials:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }

  process.exit(0);
}

updateCredentials().catch(console.error);