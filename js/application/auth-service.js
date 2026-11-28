// Application Layer: Authentication & session use-case service.
// Depends ONLY on the Domain ring and injected AuthGateway + ProfileRepository ports:
//   authGateway = {
//     isConfigured(): boolean,
//     isFileProtocol?(): boolean,
//     signUp(nick, pin, profileRepo): Promise<{ uid, profile, offline? }>,
//     logIn(nick, pin, profileRepo): Promise<{ uid, profile, offline? }>,
//     logInAdmin(allItemIds, profileRepo): Promise<{ uid, profile, admin: true, offline: true }>,
//     logOut(profile, profileRepo): Promise<void>,
//     onSessionRestored(callback, profileRepo): void,
//   }
//   profileRepo = {
//     createProfile(uid, nickname): Promise<object>,
//     loadProfile(uid, nickname): Promise<object>,
//     saveProfile(uid, profile): Promise<void>,
//   }
// Zero Firebase, zero DOM, zero localStorage imports.
import { CUSTOM } from '../domain/data.js?v=29';

export const ADMIN_TEST_CODE = 'haljordangreenlantern';
export const NICKNAME_RULE = /^[A-Za-z0-9_]{3,12}$/;
export const PIN_RULE = /^\d{4}$/;

/** Pure credential validation. Returns an error message or null when valid. */
export function validateCredentials(nick, pin) {
  if (!NICKNAME_RULE.test(nick)) return 'Nickname must be 3-12 letters, numbers, or underscores.';
  if (!PIN_RULE.test(pin)) return 'PIN must be exactly 4 digits.';
  return null;
}

function isDomainOrKeyError(err) {
  const code = String((err && err.code) || '').toLowerCase();
  const msg = String((err && err.message) || '').toLowerCase();
  return (
    code.includes('referer') ||
    msg.includes('referer') ||
    code === 'auth/unauthorized-domain' ||
    code === 'auth/api-key-not-valid' ||
    code === 'auth/app-not-authorized'
  );
}

/** Pure error formatter for auth errors. */
export function friendlyAuthError(err, { isFileProtocol = false } = {}) {
  if (isFileProtocol) {
    return 'Open the game through a local server (http://127.0.0.1:8000), not by double-clicking the HTML file.';
  }
  if (isDomainOrKeyError(err)) {
    return 'Cloud sign-in is blocked on this URL/port. Use http://127.0.0.1:8000 or http://localhost:8000 (or allow this port in Google Cloud).';
  }
  switch (err && err.code) {
    case 'app/invalid-input':
      return err.message;
    case 'auth/email-already-in-use':
      return 'That nickname is already taken. Try another one.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Wrong nickname or PIN.';
    case 'auth/network-request-failed':
      return 'No internet connection. You can still play offline, but cloud sync is paused.';
    case 'auth/too-many-requests':
      return 'Too many tries. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is disabled in the cloud auth console.';
    default:
      return 'Could not connect to the cloud service. Please check the browser console and try again.';
  }
}

export function createAuthService({ authGateway, profileRepo }) {
  const allItemIds = Object.values(CUSTOM).flat().map((i) => i.id);

  function isConfigured() {
    return !!authGateway?.isConfigured?.();
  }

  function friendlyError(err) {
    return friendlyAuthError(err, { isFileProtocol: !!authGateway?.isFileProtocol?.() });
  }

  async function signUp(nick, pin) {
    const problem = validateCredentials(nick, pin);
    if (problem) throw { code: 'app/invalid-input', message: problem };
    return authGateway.signUp(nick, pin, profileRepo);
  }

  async function logIn(nick, pin) {
    if (String(nick || '').trim().toLowerCase() === ADMIN_TEST_CODE && String(pin || '').trim() === '') {
      return authGateway.logInAdmin(allItemIds, profileRepo);
    }
    const problem = validateCredentials(nick, pin);
    if (problem) throw { code: 'app/invalid-input', message: problem };
    return authGateway.logIn(nick, pin, profileRepo);
  }

  async function logOut(profile) {
    return authGateway.logOut(profile, profileRepo);
  }

  async function saveProfile(uid, profile) {
    return profileRepo.saveProfile(uid, profile);
  }

  function onSessionRestored(callback) {
    if (authGateway?.onSessionRestored) {
      return authGateway.onSessionRestored(callback, profileRepo);
    }
    return () => {};
  }

  return {
    isConfigured,
    validate: validateCredentials,
    friendlyError,
    signUp,
    logIn,
    logOut,
    saveProfile,
    onSessionRestored,
  };
}
