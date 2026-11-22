import { AxiosError } from 'axios'
import { SystemInfoIssue } from '@jellyfin/sdk/lib/models/recommended-server-issue'
import type { RecommendedServerInfo } from '@jellyfin/sdk/lib/models/recommended-server-info'
import { ServerAddressNotAvailableError } from '../../../../types/errors'
import { JellyfinInfo } from '../../../info'
import type { ConnectToServerResult } from '../types'
import i18n from '../../../../i18n'
import HTTPS from '../../../../constants/protocols'
import { captureError, captureInfo } from '../../../../utils/logging'
import LoggingContext from '../../../../utils/logging/enums'
import {
	getClientCertificateAlias,
	useClientCertificateStore,
} from '../../../../stores/settings/client-certificate'

/**
 * Attempts to connect to a Jellyfin server.
 *
 * Address normalization (protocol, default ports) and candidate ranking is handled by the
 * Jellyfin SDK. Candidates are ranked with HTTPS first, so HTTP is only used as a fallback.
 *
 * If the HTTPS candidates fail in a way that suggests the server requires a client
 * certificate (mutual TLS), the Android system certificate chooser is presented and
 * discovery is retried once with the chosen certificate.
 *
 * @param serverAddress The server address to connect to.
 * @returns The public system info response and the normalized URL of the responding server.
 */
export async function connectToServer(serverAddress: string): Promise<ConnectToServerResult> {
	if (!serverAddress) throw new ServerAddressNotAvailableError()

	let candidates = await JellyfinInfo.discovery.getRecommendedServerCandidates(serverAddress)
	let best = JellyfinInfo.discovery.findBestServer(candidates)

	// Prefer retrying over HTTPS with a client certificate before settling for an HTTP
	// fallback (or failing outright).
	if (!best?.systemInfo?.Version || !best.address.startsWith(HTTPS)) {
		if (await maybePromptForClientCertificate(candidates)) {
			candidates = await JellyfinInfo.discovery.getRecommendedServerCandidates(serverAddress)
			const retried = JellyfinInfo.discovery.findBestServer(candidates)

			if (retried?.systemInfo?.Version) best = retried
			else
				captureInfo(
					LoggingContext.ClientCertificate,
					'Unable to connect after selecting a client certificate',
				)
		}
	}

	if (!best?.systemInfo?.Version) throw new Error(i18n.t('login.unableToConnect'))

	return {
		publicSystemInfoResponse: best.systemInfo,
		resolvedUrl: best.address,
	}
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
 * Finds an HTTPS candidate whose request failed with an error that looks like the
 * server is asking for a client certificate.
 */
function findClientCertificateFailure(candidates: RecommendedServerInfo[]): string | undefined {
	return candidates.find(
		(candidate) =>
			candidate.address.startsWith(HTTPS) &&
			candidate.issues.some(
				(issue) =>
					issue instanceof SystemInfoIssue &&
					looksLikeClientCertificateError(issue.error),
			),
	)?.address
}

/**
 * When appropriate, presents the Android system certificate chooser for a server that
 * appears to require a client certificate.
 *
 * @returns `true` if the user selected a certificate (so the connection should be
 * retried), `false` otherwise.
 */
async function maybePromptForClientCertificate(
	candidates: RecommendedServerInfo[],
): Promise<boolean> {
	const store = useClientCertificateStore.getState()

	// Only where the native module exists, and only when the user hasn't already chosen
	// a certificate.
	if (!store.supported) return false
	if (getClientCertificateAlias()) return false

	const url = findClientCertificateFailure(candidates)
	if (!url) return false

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
