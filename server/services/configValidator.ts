/**
 * Configuration Validator Service
 * 
 * Validates required environment secrets and configuration at startup
 * Logs missing entries without blocking local mock mode
 */

interface SecretCheck {
  key: string;
  required: boolean;
  environment: 'dev' | 'prod' | 'both';
  description: string;
}

const REQUIRED_SECRETS: SecretCheck[] = [
  // Microsoft Graph API - Development
  {
    key: 'GRAPH_TENANT_ID_DEV',
    required: true,
    environment: 'dev',
    description: 'Azure AD Tenant ID for development environment'
  },
  {
    key: 'GRAPH_CLIENT_ID_DEV',
    required: true,
    environment: 'dev',
    description: 'Azure AD Application Client ID for development'
  },
  {
    key: 'GRAPH_CLIENT_SECRET_DEV',
    required: true,
    environment: 'dev',
    description: 'Azure AD Client Secret for development'
  },

  // Azure OpenAI - Development (optional - can use Replit AI fallback)
  {
    key: 'AZURE_OPENAI_ENDPOINT_DEV',
    required: false,
    environment: 'dev',
    description: 'Azure OpenAI endpoint URL for development (optional - Replit AI fallback available)'
  },
  {
    key: 'AZURE_OPENAI_API_KEY_DEV',
    required: false,
    environment: 'dev',
    description: 'Azure OpenAI API key for development (optional - Replit AI fallback available)'
  },
  {
    key: 'AZURE_OPENAI_DEPLOYMENT_DEV',
    required: false,
    environment: 'dev',
    description: 'Azure OpenAI model deployment name for development (optional - Replit AI fallback available)'
  },

  // Microsoft Graph API - Production
  {
    key: 'GRAPH_TENANT_ID_PROD',
    required: false,
    environment: 'prod',
    description: 'Azure AD Tenant ID for production (Gov Cloud)'
  },
  {
    key: 'GRAPH_CLIENT_ID_PROD',
    required: false,
    environment: 'prod',
    description: 'Azure AD Application Client ID for production'
  },
  {
    key: 'GRAPH_CLIENT_SECRET_PROD',
    required: false,
    environment: 'prod',
    description: 'Azure AD Client Secret for production'
  },

  // Azure OpenAI - Production
  {
    key: 'AZURE_OPENAI_ENDPOINT_PROD',
    required: false,
    environment: 'prod',
    description: 'Azure OpenAI endpoint URL for production (Gov Cloud)'
  },
  {
    key: 'AZURE_OPENAI_API_KEY_PROD',
    required: false,
    environment: 'prod',
    description: 'Azure OpenAI API key for production'
  },
  {
    key: 'AZURE_OPENAI_DEPLOYMENT_PROD',
    required: false,
    environment: 'prod',
    description: 'Azure OpenAI model deployment name for production'
  },

  // SharePoint
  {
    key: 'SHAREPOINT_SITE_URL',
    required: false,
    environment: 'both',
    description: 'SharePoint site URL for document archival'
  },
  {
    key: 'SHAREPOINT_LIBRARY',
    required: false,
    environment: 'both',
    description: 'SharePoint document library name'
  },

  // Email Distribution
  {
    key: 'GRAPH_SENDER_EMAIL',
    required: false,
    environment: 'both',
    description: 'Email address to use as sender for automated emails (e.g., noreply@yourdomain.com)'
  },

  // Application
  {
    key: 'SESSION_SECRET',
    required: true,
    environment: 'both',
    description: 'Session secret for user authentication'
  },
  {
    key: 'DATABASE_URL',
    required: true,
    environment: 'both',
    description: 'PostgreSQL database connection URL'
  }
];

interface ValidationResult {
  valid: boolean;
  missingRequired: SecretCheck[];
  missingOptional: SecretCheck[];
  configured: SecretCheck[];
  useMockServices: boolean;
}

/**
 * Validate environment configuration
 */
export function validateConfiguration(): ValidationResult {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const useMockServices = process.env.USE_MOCK_SERVICES === 'true' || 
                          process.env.USE_MOCK_SERVICES === undefined; // default to true in dev

  const missingRequired: SecretCheck[] = [];
  const missingOptional: SecretCheck[] = [];
  const configured: SecretCheck[] = [];

  // Define fallback mappings for *_DEV to AZURE_*
  const fallbackMappings: Record<string, string> = {
    'GRAPH_TENANT_ID_DEV': 'AZURE_TENANT_ID',
    'GRAPH_CLIENT_ID_DEV': 'AZURE_CLIENT_ID',
    'GRAPH_CLIENT_SECRET_DEV': 'AZURE_CLIENT_SECRET',
    'AZURE_OPENAI_ENDPOINT_DEV': 'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_API_KEY_DEV': 'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_DEPLOYMENT_DEV': 'AZURE_OPENAI_DEPLOYMENT',
  };

  for (const secret of REQUIRED_SECRETS) {
    // Skip production secrets in development environment
    if (!isProduction && secret.environment === 'prod') {
      continue;
    }

    // Skip development secrets in production environment
    if (isProduction && secret.environment === 'dev') {
      continue;
    }

    // Check primary key, then fallback key if available
    const value = process.env[secret.key];
    const fallbackKey = fallbackMappings[secret.key];
    const fallbackValue = fallbackKey ? process.env[fallbackKey] : undefined;
    const isConfigured = (value !== undefined && value !== '') || 
                         (fallbackValue !== undefined && fallbackValue !== '');

    if (isConfigured) {
      configured.push(secret);
    } else {
      if (secret.required && !useMockServices) {
        missingRequired.push(secret);
      } else {
        missingOptional.push(secret);
      }
    }
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    configured,
    useMockServices
  };
}

/**
 * Log validation results to console
 */
export function logValidationResults(result: ValidationResult): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  console.log('\n=================================================');
  console.log('📋 Configuration Validation');
  console.log('=================================================\n');

  console.log(`Environment: ${nodeEnv.toUpperCase()}`);
  console.log(`Mock Services: ${result.useMockServices ? 'ENABLED' : 'DISABLED'}\n`);

  // Configured secrets
  if (result.configured.length > 0) {
    console.log('✅ Configured Secrets:');
    for (const secret of result.configured) {
      console.log(`   ✓ ${secret.key}`);
    }
    console.log('');
  }

  // Missing required secrets
  if (result.missingRequired.length > 0) {
    console.log('❌ Missing Required Secrets:');
    for (const secret of result.missingRequired) {
      console.log(`   ✗ ${secret.key}`);
      console.log(`     ${secret.description}`);
    }
    console.log('');
  }

  // Missing optional secrets
  if (result.missingOptional.length > 0) {
    console.log('⚠️  Missing Optional Secrets:');
    for (const secret of result.missingOptional) {
      console.log(`   ⚠ ${secret.key}`);
      console.log(`     ${secret.description}`);
    }
    console.log('');
  }

  // Summary
  if (result.valid) {
    if (result.useMockServices) {
      console.log('✅ Configuration valid for MOCK MODE');
      console.log('   Real Microsoft integrations will use mock services');
      console.log('   Configure secrets and set USE_MOCK_SERVICES=false to enable real integrations');
    } else {
      console.log('✅ Configuration valid for LIVE MODE');
      console.log(`   ${isProduction ? 'Production' : 'Development'} environment ready`);
    }
  } else {
    console.log('❌ Configuration INVALID');
    console.log('   Missing required secrets - application may not function correctly');
    console.log('');
    console.log('📖 See AZURE_SETUP.md for configuration instructions');
    console.log('📄 See config/env.example for all available secrets');
  }

  // Production readiness check
  if (!isProduction) {
    const hasAnyProdSecrets = REQUIRED_SECRETS
      .filter(s => s.environment === 'prod')
      .some(s => process.env[s.key]);

    if (hasAnyProdSecrets) {
      console.log('\n✅ Production secrets partially configured');
    } else {
      console.log('\n⚠️  Production secrets not yet configured (expected for dev environment)');
    }
  }

  console.log('\n=================================================\n');
}

/**
 * Get configuration for current environment
 */
export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const useMockServices = process.env.USE_MOCK_SERVICES === 'true' || 
                          process.env.USE_MOCK_SERVICES === undefined;

  // Determine which environment suffix to use
  const envSuffix = isProduction ? '_PROD' : '_DEV';

  return {
    // Environment
    nodeEnv,
    isProduction,
    useMockServices,

    // Microsoft Graph - Check both GRAPH_* and AZURE_* credentials
    graph: {
      tenantId: process.env[`GRAPH_TENANT_ID${envSuffix}`] || process.env.AZURE_TENANT_ID || '',
      clientId: process.env[`GRAPH_CLIENT_ID${envSuffix}`] || process.env.AZURE_CLIENT_ID || '',
      clientSecret: process.env[`GRAPH_CLIENT_SECRET${envSuffix}`] || process.env.AZURE_CLIENT_SECRET || '',
      appSecret: process.env[`GRAPH_APP_SECRET${envSuffix}`] || '',
    },

    // Azure OpenAI - Check both suffixed and non-suffixed credentials
    azureOpenAI: {
      endpoint: process.env[`AZURE_OPENAI_ENDPOINT${envSuffix}`] || process.env.AZURE_OPENAI_ENDPOINT || '',
      apiKey: process.env[`AZURE_OPENAI_API_KEY${envSuffix}`] || process.env.AZURE_OPENAI_API_KEY || '',
      deployment: process.env[`AZURE_OPENAI_DEPLOYMENT${envSuffix}`] || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
      apiVersion: process.env[`AZURE_OPENAI_API_VERSION${envSuffix}`] || process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    },

    // SharePoint
    sharepoint: {
      tenantId: process.env.SHAREPOINT_TENANT_ID || '',
      siteUrl: process.env.SHAREPOINT_SITE_URL || '',
      library: process.env.SHAREPOINT_LIBRARY || 'Meeting Minutes',
      clientId: process.env.SHAREPOINT_CLIENT_ID || '',
      clientSecret: process.env.SHAREPOINT_CLIENT_SECRET || '',
    },

    // Email Distribution
    email: {
      senderEmail: process.env.GRAPH_SENDER_EMAIL || '',
    },

    // Database
    database: {
      url: process.env.DATABASE_URL || '',
    },

    // Application
    app: {
      port: parseInt(process.env.PORT || '5000', 10),
      sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      baseUrl: process.env.BASE_URL || '',
    },

    // Feature flags
    features: {
      graphWebhooks: process.env.ENABLE_GRAPH_WEBHOOKS === 'true',
      azureOpenAI: process.env.ENABLE_AZURE_OPENAI === 'true',
      sharepointArchival: process.env.ENABLE_SHAREPOINT_ARCHIVAL === 'true',
      emailDistribution: process.env.ENABLE_EMAIL_DISTRIBUTION === 'true',
      azureAdSync: process.env.ENABLE_AZURE_AD_SYNC === 'true',
      auditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false', // default true
      roiTracking: process.env.ENABLE_ROI_TRACKING !== 'false', // default true
    },

    // Webhook
    webhook: {
      validationToken: process.env.WEBHOOK_VALIDATION_TOKEN || '',
      renewalInterval: parseInt(process.env.WEBHOOK_RENEWAL_INTERVAL || '24', 10),
    },

    // Azure AD Group Sync
    groupSync: {
      interval: parseInt(process.env.GROUP_SYNC_INTERVAL || '15', 10),
      useDelta: process.env.GROUP_SYNC_USE_DELTA !== 'false', // default true
      cacheTTL: parseInt(process.env.GROUP_CACHE_TTL || '15', 10),
    },
  };
}

/**
 * Check if a specific integration is configured
 */
export function isIntegrationConfigured(integration: 'graph' | 'azureOpenAI' | 'sharepoint'): boolean {
  const config = getConfig();

  switch (integration) {
    case 'graph':
      return !!(config.graph.tenantId && config.graph.clientId && config.graph.clientSecret);
    case 'azureOpenAI':
      return !!(config.azureOpenAI.endpoint && config.azureOpenAI.apiKey && config.azureOpenAI.deployment);
    case 'sharepoint':
      return !!(config.sharepoint.siteUrl && config.sharepoint.library);
    default:
      return false;
  }
}

/**
 * Validate and log configuration at startup
 * Returns true if configuration is valid, false otherwise
 */
export function validateAndLogConfig(): boolean {
  const result = validateConfiguration();
  logValidationResults(result);
  return result.valid;
}
