import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { clientCertificateStorage } from '../../constants/storage'
import { MMKVStorageKeys } from '../../enums/mmkv-storage-keys'
import {
	clearClientCertificate,
	getSelectedClientCertificateAlias,
	isClientCertificateSupported,
	selectClientCertificate,
} from '../../native/client-certificate'
import { captureError, LoggingContext } from '../../utils/logging'

/**
 * Reads the selected client-certificate alias straight from MMKV. Synchronous, so the
 * axios adapter (`src/configs/axios.config.ts`) can decide per request whether to route
 * through the client-cert (OkHttp) path. Returns `null` when none is configured.
 *
 * MMKV mirrors the native SharedPreferences value (the source of truth used by the
 * OkHttp TLS stack); both are written together whenever the selection changes.
 */
export const getClientCertificateAlias = (): string | null =>
	clientCertificateStorage.getString(MMKVStorageKeys.ClientCertificateAlias) ?? null

const mirrorAlias = (alias: string | null) => {
	if (alias) clientCertificateStorage.set(MMKVStorageKeys.ClientCertificateAlias, alias)
	else clientCertificateStorage.remove(MMKVStorageKeys.ClientCertificateAlias)
}

type ClientCertificateStore = {
	/** The selected KeyChain alias, or `null` if none is configured. */
	alias: string | null

	/** True on platforms/builds where the native module is present (Android). */
	supported: boolean

	/**
	 * Opens the Android system certificate chooser and stores the chosen certificate as
	 * the default. Resolves with the chosen alias, or `null` if the user cancelled.
	 */
	selectCertificate: (host?: string | null, port?: number) => Promise<string | null>

	/** Forgets the selected certificate (does not remove it from the system KeyChain). */
	clearCertificate: () => Promise<void>
}

export const useClientCertificateStore = create<ClientCertificateStore>()(
	devtools(
		(set) => ({
			alias: getClientCertificateAlias(),
			supported: isClientCertificateSupported(),

			selectCertificate: async (host, port) => {
				try {
					const alias = await selectClientCertificate(host, port)

					// The user may have cancelled the chooser (null); only overwrite the
					// stored default when a certificate was actually chosen.
					if (alias) {
						mirrorAlias(alias)
						set({ alias })
					}

					return alias
				} catch (error) {
					captureError(
						error,
						LoggingContext.ClientCertificate,
						'Failed to select a client certificate',
					)
					throw error
				}
			},

			clearCertificate: async () => {
				try {
					await clearClientCertificate()
				} catch (error) {
					captureError(
						error,
						LoggingContext.ClientCertificate,
						'Failed to clear the client certificate',
					)
				}

				mirrorAlias(null)
				set({ alias: null })
			},
		}),
		{ name: 'client-certificate-store' },
	),
)

/**
 * Convenience hook returning `[alias, selectCertificate, clearCertificate, supported]`.
 */
export const useClientCertificate = (): [
	string | null,
	(host?: string | null, port?: number) => Promise<string | null>,
	() => Promise<void>,
	boolean,
] => {
	const alias = useClientCertificateStore((state) => state.alias)
	const selectCertificate = useClientCertificateStore((state) => state.selectCertificate)
	const clearCertificate = useClientCertificateStore((state) => state.clearCertificate)
	const supported = useClientCertificateStore((state) => state.supported)

	return [alias, selectCertificate, clearCertificate, supported]
}
