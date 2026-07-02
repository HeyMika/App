package com.jellify.clientcert

import android.content.Context
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import java.security.KeyStore
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import okhttp3.OkHttpClient

/**
 * Supplies React Native's networking layer (the `Networking` native module used by
 * `fetch`/`XMLHttpRequest`, and therefore the Jellyfin SDK's default axios adapter)
 * with an [OkHttpClient] that can present the user-selected client certificate from
 * the Android KeyChain during the TLS handshake.
 *
 * This is what makes mutual-TLS (client certificate) authentication possible: the
 * app's primary REST traffic is routed through this OkHttp stack whenever a client
 * certificate is configured (see `src/configs/axios.config.ts`), because the default
 * Cronet stack (`react-native-nitro-fetch`) has no client-certificate API.
 *
 * Server trust is deliberately left untouched — the platform default trust managers
 * are used, so server-certificate verification behaves exactly as before. When no
 * certificate is selected the [KeyChainKeyManager] simply presents nothing, so
 * ordinary (non-mTLS) connections are unaffected.
 */
class ClientCertOkHttpFactory(context: Context) : OkHttpClientFactory {

	private val appContext = context.applicationContext

	override fun createNewNetworkModuleClient(): OkHttpClient {
		// Start from React Native's default builder so we keep RN's cookie jar,
		// interceptors, and timeout configuration.
		val builder = OkHttpClientProvider.createClientBuilder()

		try {
			val trustManager = defaultTrustManager()
			val keyManager =
				KeyChainKeyManager(appContext) { ClientCertStore.getAlias(appContext) }

			val sslContext = SSLContext.getInstance("TLS")
			sslContext.init(arrayOf(keyManager), arrayOf(trustManager), null)

			builder.sslSocketFactory(sslContext.socketFactory, trustManager)
		} catch (e: Exception) {
			// If we cannot install the custom SSL stack we fall back to RN's default
			// client. The only consequence is that no client certificate can be
			// presented, which matches pre-feature behaviour.
		}

		return builder.build()
	}

	private fun defaultTrustManager(): X509TrustManager {
		val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
		factory.init(null as KeyStore?)

		return factory.trustManagers.first { it is X509TrustManager } as X509TrustManager
	}
}
