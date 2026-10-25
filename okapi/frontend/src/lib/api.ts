import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'okapi.token';

/**
 * The token lives in localStorage when "remember me" was ticked and in sessionStorage
 * otherwise, so closing the tab ends the session.
 */
export const tokenStore = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  },
  set(token: string, remember: boolean) {
    tokenStore.clear();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

export const api = axios.create({
  baseURL: '/',
  timeout: 30_000,
});

api.interceptors.request.use(config => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Called when the server rejects our token, so the app can drop back to the login screen. */
let onUnauthenticated: () => void = () => {};
export const setUnauthenticatedHandler = (handler: () => void) => {
  onUnauthenticated = handler;
};

api.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    // 403 is what the resource server returns for an expired/!invalid bearer token.
    if (status === 401 || status === 403) {
      const onLoginRequest = error.config?.url?.includes('/api/authenticate');
      if (!onLoginRequest && tokenStore.get()) {
        tokenStore.clear();
        onUnauthenticated();
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Turns an axios failure into something worth showing a person.
 *
 * The backend speaks RFC 7807 problem+json and puts field errors in `fieldErrors`,
 * so prefer those over the generic title.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  if (error.code === 'ECONNABORTED') {
    return 'The server took too long to respond.';
  }
  if (!error.response) {
    return 'Cannot reach the server. Is the backend running?';
  }

  const data = error.response.data as
    | { detail?: string; title?: string; message?: string; fieldErrors?: { field: string; message: string }[] }
    | undefined;

  const fieldError = data?.fieldErrors?.[0];
  if (fieldError) {
    return `${sentenceCase(fieldError.field)} ${fieldError.message}.`;
  }

  // JHipster uses these keys for the common account conflicts.
  const known: Record<string, string> = {
    'error.userexists': 'That username is already taken.',
    'error.emailexists': 'That email is already registered.',
    'error.validation': 'Please check the highlighted fields.',
  };
  const key = data?.message ?? data?.title ?? '';
  if (known[key]) {
    return known[key];
  }

  if (error.response.status === 400 && data?.detail) {
    return data.detail;
  }

  return data?.detail ?? data?.title ?? fallback;
}

function sentenceCase(value: string): string {
  const spaced = value.replace(/([A-Z])/g, ' $1').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
