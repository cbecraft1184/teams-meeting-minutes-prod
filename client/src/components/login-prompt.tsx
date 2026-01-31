import { Button } from '@fluentui/react-components';
import { PersonRegular, ArrowSyncCircleRegular } from '@fluentui/react-icons';
import { useTeams } from '@/contexts/TeamsContext';

export function LoginPrompt() {
  const { login, isLoggingIn, error } = useTeams();

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '2rem',
        textAlign: 'center',
      }}
      data-testid="login-prompt"
    >
      <div style={{ marginBottom: '2rem' }}>
        <PersonRegular style={{ fontSize: '64px', color: '#0078d4' }} />
      </div>
      
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        Teams Meeting Minutes
      </h1>
      
      <p style={{ color: '#666', marginBottom: '2rem', maxWidth: '400px' }}>
        Sign in with your Microsoft account to access meeting minutes, 
        view transcripts, and manage action items.
      </p>

      {error && (
        <div 
          style={{ 
            color: '#d32f2f', 
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#ffebee',
            borderRadius: '4px',
          }}
          data-testid="login-error"
        >
          {error}
        </div>
      )}

      <Button
        appearance="primary"
        size="large"
        icon={isLoggingIn ? <ArrowSyncCircleRegular /> : <PersonRegular />}
        onClick={login}
        disabled={isLoggingIn}
        data-testid="button-login"
      >
        {isLoggingIn ? 'Signing in...' : 'Sign in with Microsoft'}
      </Button>

      <p style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#999' }}>
        For best experience, access this app from Microsoft Teams.
      </p>
    </div>
  );
}
