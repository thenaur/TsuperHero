// Composition Root (Outermost Ring): Bootstraps html/login.html.
// Wires concrete Infrastructure adapters into Application services and Presentation UI.
import { createAuthService } from '../application/auth-service.js?v=1';
import { createFirebaseProfileRepo } from '../infrastructure/firebase-profile-repo.js?v=1';
import { createFirebaseAuthGateway } from '../infrastructure/firebase-auth-gateway.js?v=1';
import { createLocalSettingsStore } from '../infrastructure/settings-store.js?v=1';
import { createWebAudioAdapter } from '../infrastructure/web-audio.js?v=1';
import { startMenuController } from '../presentation/menu-controller.js?v=1';

const profileRepo = createFirebaseProfileRepo();
const authGateway = createFirebaseAuthGateway();
const authService = createAuthService({ authGateway, profileRepo });
const settingsStore = createLocalSettingsStore();
const audio = createWebAudioAdapter();

startMenuController({ authService, settingsStore, audio });
