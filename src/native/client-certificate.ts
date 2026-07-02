import { NativeModules, Platform } from 'react-native'

/**
 * Thin, typed wrapper over the native `ClientCert` module (Android only).
 *
 * The native side (see `android/app/src/main/java/com/jellify/clientcert/`) manages a
 * client certificate selected from the Android system KeyChain and presents it during
 * TLS handshakes for mutual-TLS authentication. On iOS the module does not exist, so
 * every function degrades gracefully to a no-op.
 */
interface ClientCertNativeModule {
	isSupported(): Promise<boolean>
	getSelectedAlias(): Promise<string | null>
	clearSelectedAlias(): Promise<void>
	selectCertificate(host: string | null, port: number): Promise<string | null>
}

const nativeModule: ClientCertNativeModule | undefined =
	Platform.OS === 'android'
		? (NativeModules.ClientCert as ClientCertNativeModule | undefined)
		: undefined

/**
 * Whether native client-certificate support is available on this platform/build.
 */
export const isClientCertificateSupported = (): boolean => nativeModule != null

/**
 * Presents the Android system certificate chooser (the standard OS popup). The
 * optional {@link host}/{@link port} are hints so Android can highlight a certificate
 * previously granted to that server.
 *
 * @returns the chosen KeyChain alias, or `null` if the user dismissed the chooser or
 * the platform is unsupported. A non-null result is persisted natively as the default.
 */
export const selectClientCertificate = async (
	host?: string | null,
	port?: number,
): Promise<string | null> => {
	if (!nativeModule) return null

	return nativeModule.selectCertificate(host ?? null, port ?? 0)
}

/**
 * @returns the natively-selected KeyChain alias, or `null` if none / unsupported.
 */
export const getSelectedClientCertificateAlias = async (): Promise<string | null> => {
	if (!nativeModule) return null

	return nativeModule.getSelectedAlias()
}

/**
 * Forgets the selected certificate. Does not remove it from the system KeyChain.
 */
export const clearClientCertificate = async (): Promise<void> => {
	if (!nativeModule) return

	await nativeModule.clearSelectedAlias()
}
