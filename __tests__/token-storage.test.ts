// Plano de Testes, seção 5.2 — armazenamento do token de sessão.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { clearSessionToken, getSessionToken, setSessionToken } from '@/auth/token-storage';

const TOKEN_KEY = 'poupeazy.session-token';
const secureStore = jest.mocked(SecureStore);
const globalWithWindow = globalThis as { window?: unknown };

function createLocalStorage() {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => void values.set(key, value)),
    removeItem: jest.fn((key: string) => void values.delete(key)),
  };
}

describe('Armazenamento do token de sessão', () => {
  const originalWindow = globalWithWindow.window;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalWithWindow.window = originalWindow;
  });

  describe.each(['ios', 'android'] as const)('no %s (SecureStore)', (os) => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', os);
    });

    test('setSessionToken grava na chave da sessão, acessível só neste aparelho desbloqueado', async () => {
      secureStore.setItemAsync.mockResolvedValue(undefined);

      await setSessionToken('token-nativo');

      expect(secureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'token-nativo', {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    });

    test('getSessionToken devolve o valor guardado no SecureStore', async () => {
      secureStore.getItemAsync.mockResolvedValue('token-salvo');

      await expect(getSessionToken()).resolves.toBe('token-salvo');

      expect(secureStore.getItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
    });

    test('getSessionToken devolve null quando não há sessão salva', async () => {
      secureStore.getItemAsync.mockResolvedValue(null);

      await expect(getSessionToken()).resolves.toBeNull();
    });

    test('clearSessionToken remove a chave do SecureStore', async () => {
      secureStore.deleteItemAsync.mockResolvedValue(undefined);

      await clearSessionToken();

      expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
    });
  });

  describe('na web (localStorage)', () => {
    let localStorage: ReturnType<typeof createLocalStorage>;

    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
      localStorage = createLocalStorage();
      globalWithWindow.window = { localStorage };
    });

    test('grava, lê e remove o token no localStorage sem usar o SecureStore', async () => {
      await setSessionToken('token-web');
      await expect(getSessionToken()).resolves.toBe('token-web');
      await clearSessionToken();
      await expect(getSessionToken()).resolves.toBeNull();

      expect(localStorage.setItem).toHaveBeenCalledWith(TOKEN_KEY, 'token-web');
      expect(localStorage.removeItem).toHaveBeenCalledWith(TOKEN_KEY);
      expect(secureStore.setItemAsync).not.toHaveBeenCalled();
      expect(secureStore.getItemAsync).not.toHaveBeenCalled();
      expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    test('sem window (renderização no servidor) não quebra e devolve null', async () => {
      globalWithWindow.window = undefined;

      await expect(getSessionToken()).resolves.toBeNull();
      await expect(setSessionToken('token-ssr')).resolves.toBeUndefined();
      await expect(clearSessionToken()).resolves.toBeUndefined();

      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });
});
