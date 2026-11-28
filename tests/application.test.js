// Application Layer tests using in-memory fake ports (proves Onion dependency inversion).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile } from '../js/domain/profile.js';
import { createProgressService } from '../js/application/progress-service.js';
import { createAuthService, ADMIN_TEST_CODE, validateCredentials, friendlyAuthError } from '../js/application/auth-service.js';

function createFakeRepo() {
  const store = new Map();
  return {
    store,
    async createProfile(uid, nickname) {
      const p = defaultProfile(nickname);
      store.set(uid, p);
      return p;
    },
    async loadProfile(uid, nickname) {
      if (!store.has(uid)) store.set(uid, defaultProfile(nickname));
      return store.get(uid);
    },
    async saveProfile(uid, profile) {
      store.set(uid, JSON.parse(JSON.stringify(profile)));
    },
  };
}

test('ProgressService runs use cases and persists via injected SessionGateway port', async () => {
  const saved = [];
  const gateway = {
    async loadSession() {
      return { uid: 'u-1', profile: defaultProfile('ana') };
    },
    async saveProfile(uid, profile) {
      saved.push({ uid, profile: JSON.parse(JSON.stringify(profile)) });
    },
  };

  const svc = createProgressService(gateway);
  await svc.init();
  assert.equal(svc.getState().uid, 'u-1');
  assert.equal(svc.getProfile().nickname, 'ana');

  await svc.completeTutorial();
  assert.equal(svc.getProfile().tutorialDone, true);

  await svc.completeLevel(2);
  assert.equal(svc.getProfile().endlessUnlocked, true);

  const endless = await svc.recordEndlessRun('easy', 1000);
  assert.equal(endless.starsAfter, 1);
  assert.deepEqual(endless.newlyUnlocked.map((i) => i.id), ['decor-dice']);

  const locked = await svc.equipItem('decor', 'decor-freshener');
  assert.equal(locked.locked, true);

  const equipped = await svc.equipItem('decor', 'decor-dice');
  assert.equal(equipped.locked, false);
  assert.equal(equipped.profile.equipped.decor, 'decor-dice');
  assert.equal(saved.length, 4);
});

test('ProgressService operates cleanly in guest mode when uid is null', async () => {
  const svc = createProgressService({
    async loadSession() { return { uid: null, profile: defaultProfile('guest') }; },
    async saveProfile() { throw new Error('Should not save in guest mode'); },
  });
  await svc.init();
  const res = await svc.completeTutorial();
  assert.equal(res.profile.tutorialDone, true);
  assert.deepEqual(res.persist, { saved: false, reason: 'guest' });
});

test('AuthService validates credentials and delegates I/O to injected AuthGateway + ProfileRepo', async () => {
  assert.equal(validateCredentials('ab', '1234') !== null, true);
  assert.equal(validateCredentials('ana_1', '123') !== null, true);
  assert.equal(validateCredentials('ana_1', '1234'), null);
  assert.ok(friendlyAuthError({ code: 'auth/wrong-password' }).includes('Wrong nickname or PIN'));
  assert.ok(friendlyAuthError(null, { isFileProtocol: true }).includes('127.0.0.1:8000'));

  const repo = createFakeRepo();
  let adminCalled = false;
  let loggedOut = false;
  const gateway = {
    isConfigured: () => true,
    isFileProtocol: () => false,
    async signUp(nick, _pin, profileRepo) {
      const profile = await profileRepo.createProfile(`uid-${nick}`, nick);
      return { uid: `uid-${nick}`, profile };
    },
    async logIn(nick, _pin, profileRepo) {
      const profile = await profileRepo.loadProfile(`uid-${nick}`, nick);
      return { uid: `uid-${nick}`, profile };
    },
    async logInAdmin(allItemIds, profileRepo) {
      adminCalled = true;
      const profile = { ...defaultProfile('Admin'), isAdmin: true, unlocked: allItemIds };
      await profileRepo.saveProfile('admin', profile);
      return { uid: 'admin', profile, admin: true };
    },
    async logOut() { loggedOut = true; },
    onSessionRestored() {},
  };

  const authService = createAuthService({ authGateway: gateway, profileRepo: repo });
  await assert.rejects(() => authService.signUp('x', '1234'), (err) => err.code === 'app/invalid-input');

  const signed = await authService.signUp('juan', '1234');
  assert.equal(signed.uid, 'uid-juan');
  assert.equal(repo.store.has('uid-juan'), true);

  const admin = await authService.logIn(ADMIN_TEST_CODE, '');
  assert.equal(adminCalled, true);
  assert.equal(admin.profile.unlocked.length, 9);

  await authService.logOut(signed.profile);
  assert.equal(loggedOut, true);
});
