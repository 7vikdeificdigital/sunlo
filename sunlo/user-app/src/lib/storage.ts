import * as SecureStore from 'expo-secure-store';

/** Mobile par login tokens phone ke encrypted Keychain/Keystore mein (SecureStore) */
export const secureStorage = {
  get: (k: string) => SecureStore.getItemAsync(k),
  set: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  remove: (k: string) => SecureStore.deleteItemAsync(k),
};
