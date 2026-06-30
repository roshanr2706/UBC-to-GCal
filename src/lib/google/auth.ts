import { env } from '$env/dynamic/public';

const SCOPES =
  'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar';

// Minimal shape of the Google Identity Services token client we rely on.
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
  callback: (resp: { access_token?: string; error?: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

export function hasClientId(): boolean {
  return !!env.PUBLIC_GOOGLE_CLIENT_ID && !env.PUBLIC_GOOGLE_CLIENT_ID.startsWith('your-client-id');
}

/** Open the GIS consent popup and resolve with a short-lived access token. */
export function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = env.PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject(new Error('Missing PUBLIC_GOOGLE_CLIENT_ID — set it in .env to enable Google sync.'));
      return;
    }
    if (!window.google) {
      reject(new Error('Google Identity Services failed to load. Check your network and retry.'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Authorization was cancelled.'));
        } else {
          resolve(resp.access_token);
        }
      }
    });
    client.requestAccessToken({ prompt: '' });
  });
}
