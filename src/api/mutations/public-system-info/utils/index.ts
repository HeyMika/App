import { getSystemApi } from '@jellyfin/sdk/lib/utils/api'

import { Jellyfin } from '@jellyfin/sdk/lib/jellyfin'
import { JellyfinInfo } from '../../../info'
import { PublicSystemInfo } from '@jellyfin/sdk/lib/generated-client/models'
import { Api } from '@jellyfin/sdk'
import { AxiosError } from 'axios'
import HTTPS, { HTTP } from '../../../../constants/protocols'
import { captureError, captureInfo } from '../../../../utils/logging'
import LoggingContext from '../../../../utils/logging/enums'
import {
	getClientCertificateAlias,
	useClientCertificateStore,
} from '../../../../stores/settings/client-certificate'

type ConnectionType = 'hostname' | 'ipAddress'

/**
 * Attempts to connect to a Jellyfin server.
 *
 * @param serverAddress The server address to connect to.
 * @param useHttps Whether to use HTTPS.
 * @returns The public system info response.
 */
export async function connectToServer(serverAddress: string): Promise<{
	publicSystemInfoResponse: PublicSystemInfo
	connectionType: ConnectionType
}> {
	if (!serverAddress) throw new Error('Server address was empty')

	const serverAddressContainsProtocol =
		serverAddress.includes(HTTP) || serverAddress.includes(HTTPS)

	const jellyfin = new Jellyfin(JellyfinInfo)

	// Use the protocol provided in the server address if it exists, otherwise default to HTTPS
	const hostnameUrl = `${serverAddressContainsProtocol ? '' : HTTPS}${serverAddress}`
	const hostnameApi = jellyfin.createApi(hostnameUrl)

	const httpApi = !serverAddressContainsProtocol
		? jellyfin.createApi(`${HTTP}${serverAddress}`)
		: undefined

	// First attempt to connect using the hostname (with the protocol provided or defaulting to HTTPS)
	try {
		return await connect(hostnameApi, 'hostname')
	} catch (error) {
		// The server may require a client certificate (mutual TLS). If it looks that
		// way and the user hasn't configured one yet, present the Android system
		// certificate chooser and retry once with the chosen certificate.
		if (await maybePromptForClientCertificate(error, hostnameUrl)) {
			try {
				return await connect(hostnameApi, 'hostname')
			} catch {
				captureInfo(
					LoggingContext.ClientCertificate,
					'Unable to connect after selecting a client certificate',
				)
			}
		} else {
			console.info('Unable to connect, attempting to connect via HTTP if available')
		}
	}

	// If the first attempt fails and we haven't already tried HTTP, attempt to connect using HTTP
	if (httpApi) {
		try {
			return await connect(httpApi, 'ipAddress')
		} catch (error) {
			console.info('Unable to connect via HTTP')
		}
	}

	throw new Error('Unable to connect to Jellyfin')
}

/**
 * Heuristically decides whether a failed HTTPS connection is due to a missing/invalid
 * client certificate. TLS-level detection is inherently fuzzy, so we combine two
 * signals:
 *
 * - The server answered with a status reverse proxies use for client-cert problems
 *   (nginx `495`/`496`, or `400` with a certificate-related body).
 * - The TLS handshake was aborted (no HTTP response) with an SSL/certificate-shaped
 *   error message.
 */
function looksLikeClientCertificateError(error: unknown): boolean {
	const axiosError = error as AxiosError | undefined

	const status = axiosError?.response?.status
	if (status === 495 || status === 496) return true
	if (status === 400) {
		const body = JSON.stringify(axiosError?.response?.data ?? '').toLowerCase()
		if (body.includes('certificate') || body.includes('ssl')) return true
	}

	// A handshake the server aborts surfaces as a network error with no HTTP response.
	if (axiosError?.response) return false

	const message = `${axiosError?.message ?? ''} ${String(
		(axiosError as { cause?: unknown } | undefined)?.cause ?? '',
	)}`.toLowerCase()

	return (
		message.includes('ssl') ||
		message.includes('tls') ||
		message.includes('handshake') ||
		message.includes('certificate')
	)
}

function parseHostAndPort(url: string): { host: string | null; port: number } {
	try {
		const parsed = new URL(url)
		return { host: parsed.hostname || null, port: parsed.port ? Number(parsed.port) : 0 }
	} catch {
		return { host: null, port: 0 }
	}
}

/**
 * When appropriate, presents the Android system certificate chooser for a server that
 * appears to require a client certificate.
 *
 * @returns `true` if the user selected a certificate (so the connection should be
 * retried), `false` otherwise.
 */
async function maybePromptForClientCertificate(error: unknown, url: string): Promise<boolean> {
	const store = useClientCertificateStore.getState()

	// Only for secure connections, only where the native module exists, and only when
	// the user hasn't already chosen a certificate.
	if (!url.startsWith(HTTPS)) return false
	if (!store.supported) return false
	if (getClientCertificateAlias()) return false
	if (!looksLikeClientCertificateError(error)) return false

	try {
		const { host, port } = parseHostAndPort(url)
		const alias = await store.selectCertificate(host, port)
		return !!alias
	} catch (promptError) {
		captureError(
			promptError,
			LoggingContext.ClientCertificate,
			'Failed while prompting for a client certificate',
		)
		return false
	}
}

function connect(api: Api, connectionType: ConnectionType) {
	return getSystemApi(api)
		.getPublicSystemInfo()
		.then((response) => {
			if (!response.data.Version)
				throw new Error(
					`Jellyfin instance did not respond to our ${connectionType} request`,
				)

			return {
				publicSystemInfoResponse: response.data,
				connectionType,
			}
		})
		.catch((error) => {
			captureError(
				error,
				LoggingContext.PublicSystemInfo,
				`Failed to connect to Jellyfin via ${connectionType}`,
			)
			// Rethrow the original error (rather than a generic one) so callers can
			// inspect it — e.g. to detect a missing client certificate.
			throw error
		})
}
