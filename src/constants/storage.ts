import { createMMKV } from 'react-native-mmkv'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { AsyncStorage as TanstackAsyncStorage } from '@tanstack/react-query-persist-client'
import { StateStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const storage = createMMKV()

/**
 * Dedicated MMKV instance for the selected client-certificate alias.
 *
 * Kept separate from {@link storage} so it is NOT wiped by `storage.clearAll()` on
 * sign-out — a client certificate is a device/server-level setting, so re-logging in
 * to the same mutual-TLS server keeps working. The alias itself is not sensitive; the
 * private key stays in the Android system KeyChain.
 */
export const clientCertificateStorage = createMMKV({ id: 'client-certificate' })

const storageFunctions = {
	setItem: async (key: string, value: string) => {
		await AsyncStorage.setItem(key, value)
	},
	getItem: async (key: string) => {
		const value = await AsyncStorage.getItem(key)
		return value === undefined ? null : value
	},
	removeItem: async (key: string) => {
		await AsyncStorage.removeItem(key)
	},
}

const mmkvStorageFunctions = {
	setItem: (key: string, value: string) => {
		storage.set(key, value)
	},
	getItem: (key: string) => {
		const value = storage.getString(key)
		return value === undefined ? null : value
	},
	removeItem: (key: string) => {
		storage.remove(key)
	},
}

const clientStorage: TanstackAsyncStorage<string> = storageFunctions

export const queryClientPersister = createAsyncStoragePersister({
	storage: clientStorage,
})

export const stateStorage: StateStorage = storageFunctions

export const mmkvStateStorage: StateStorage = mmkvStorageFunctions
