/**
 * Azure Key Vault Integration Service
 * 
 * Securely loads application secrets from Azure Key Vault using Managed Identity.
 * This eliminates the need to store secrets in environment variables or App Settings.
 * 
 * Features:
 * - Managed Identity authentication (no credentials needed)
 * - In-memory caching to minimize Key Vault API calls
 * - Automatic fallback to environment variables for local development
 * - Graceful degradation if Key Vault is unavailable
 * 
 * Azure Setup Required:
 * 1. Enable Managed Identity on App Service
 * 2. Grant "Key Vault Secrets User" role to Managed Identity
 * 3. Set KEY_VAULT_NAME environment variable
 */

import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

interface SecretCache {
  value: string;
  fetchedAt: Date;
  expiresAt: Date;
}

const secretCache = new Map<string, SecretCache>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

let secretClient: SecretClient | null = null;
let initializationError: Error | null = null;

/**
 * Initialize Azure Key Vault client with Managed Identity
 * 
 * CRITICAL: Only works in Azure with Managed Identity enabled
 * In local development, falls back to environment variables
 */
export function initializeKeyVaultClient(): void {
  const keyVaultName = process.env.KEY_VAULT_NAME;
  
  if (!keyVaultName) {
    console.log('[KeyVault] KEY_VAULT_NAME not set - using environment variables only');
    return;
  }

  // Check if Managed Identity is available (Azure Container Apps, App Service, etc.)
  const msiEndpoint = process.env.MSI_ENDPOINT || process.env.IDENTITY_ENDPOINT;
  if (!msiEndpoint) {
    console.log('[KeyVault] No Managed Identity available - using environment variables only');
    console.log('[KeyVault] To use Key Vault, assign a Managed Identity to this Container App');
    return;
  }

  try {
    // DefaultAzureCredential automatically uses Managed Identity when running in Azure
    // In local dev, it can use Azure CLI credentials or VS Code credentials
    const credential = new DefaultAzureCredential();
    const vaultUrl = `https://${keyVaultName}.vault.azure.net`;
    
    secretClient = new SecretClient(vaultUrl, credential);
    
    console.log(`✅ [KeyVault] Initialized client for vault: ${keyVaultName}`);
  } catch (error: any) {
    initializationError = error;
    console.error('[KeyVault] Failed to initialize:', error.message);
    console.log('[KeyVault] Falling back to environment variables');
  }
}

/**
 * Get secret from Azure Key Vault with caching
 * 
 * Flow:
 * 1. Check in-memory cache (15-min TTL)
 * 2. Fetch from Key Vault if cache miss/expired
 * 3. Fallback to environment variable if Key Vault unavailable
 * 
 * @param secretName - Name of secret in Key Vault (use dashes, not underscores)
 * @param envVarName - Environment variable name for fallback
 * @returns Secret value or null if not found
 */
export async function getSecret(secretName: string, envVarName?: string): Promise<string | null> {
  // Check cache first
  const cached = secretCache.get(secretName);
  if (cached && new Date() < cached.expiresAt) {
    console.log(`[KeyVault] Cache hit: ${secretName}`);
    return cached.value;
  }

  // Try Key Vault if client is initialized
  if (secretClient) {
    try {
      console.log(`[KeyVault] Fetching secret: ${secretName}`);
      const secret = await secretClient.getSecret(secretName);
      
      if (!secret.value) {
        console.warn(`[KeyVault] Secret ${secretName} has no value`);
        return fallbackToEnvVar(envVarName);
      }

      // Cache the secret
      const now = new Date();
      secretCache.set(secretName, {
        value: secret.value,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      });

      console.log(`✅ [KeyVault] Loaded secret: ${secretName}`);
      return secret.value;
    } catch (error: any) {
      console.error(`[KeyVault] Error fetching ${secretName}:`, error.message);
      return fallbackToEnvVar(envVarName);
    }
  }

  // Fallback to environment variable
  return fallbackToEnvVar(envVarName);
}

/**
 * Get multiple secrets in parallel with caching
 * 
 * More efficient than calling getSecret() multiple times sequentially
 */
export async function getSecrets(secretMap: Record<string, string>): Promise<Record<string, string | null>> {
  const promises = Object.entries(secretMap).map(async ([key, secretName]) => {
    const value = await getSecret(secretName, key);
    return [key, value] as [string, string | null];
  });

  const results = await Promise.all(promises);
  return Object.fromEntries(results);
}

/**
 * Fallback to environment variable if Key Vault is unavailable
 */
function fallbackToEnvVar(envVarName?: string): string | null {
  if (!envVarName) {
    return null;
  }

  const value = process.env[envVarName];
  if (value) {
    console.log(`[KeyVault] Fallback to env var: ${envVarName}`);
    return value;
  }

  console.warn(`[KeyVault] Secret not found in Key Vault or env vars: ${envVarName}`);
  return null;
}

/**
 * Clear secret cache (useful for testing or manual refresh)
 */
export function clearSecretCache(): void {
  secretCache.clear();
  console.log('[KeyVault] Secret cache cleared');
}

/**
 * Check if Key Vault client is initialized
 */
export function isKeyVaultAvailable(): boolean {
  return secretClient !== null;
}

/**
 * Get initialization status
 */
export function getKeyVaultStatus(): {
  initialized: boolean;
  vaultName: string | null;
  error: string | null;
  cachedSecrets: number;
} {
  return {
    initialized: secretClient !== null,
    vaultName: process.env.KEY_VAULT_NAME || null,
    error: initializationError?.message || null,
    cachedSecrets: secretCache.size,
  };
}
