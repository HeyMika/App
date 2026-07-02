package com.jellify.clientcert

import android.content.Context
import android.security.KeyChain
import java.net.Socket
import java.security.Principal
import java.security.PrivateKey
import java.security.cert.X509Certificate
import javax.net.ssl.SSLEngine
import javax.net.ssl.X509ExtendedKeyManager

/**
 * An [X509ExtendedKeyManager] that sources the client certificate and private key
 * from the Android system KeyChain for the alias the user selected.
 *
 * The alias is resolved lazily on every handshake via [aliasProvider], so changing
 * (or clearing) the selected certificate takes effect immediately without having to
 * recreate the OkHttp client or restart the app.
 *
 * When no alias is selected [chooseClientAlias] returns `null`, which tells OkHttp
 * not to present a client certificate — i.e. behaviour is identical to a stock
 * client for users who never configure mutual TLS.
 */
class KeyChainKeyManager(
	private val context: Context,
	private val aliasProvider: () -> String?,
) : X509ExtendedKeyManager() {

	override fun chooseClientAlias(
		keyType: Array<out String>?,
		issuers: Array<out Principal>?,
		socket: Socket?,
	): String? = aliasProvider()

	override fun chooseEngineClientAlias(
		keyType: Array<out String>?,
		issuers: Array<out Principal>?,
		engine: SSLEngine?,
	): String? = aliasProvider()

	override fun getCertificateChain(alias: String?): Array<X509Certificate>? {
		if (alias.isNullOrEmpty()) return null

		return try {
			KeyChain.getCertificateChain(context, alias)
		} catch (e: Exception) {
			null
		}
	}

	override fun getPrivateKey(alias: String?): PrivateKey? {
		if (alias.isNullOrEmpty()) return null

		return try {
			KeyChain.getPrivateKey(context, alias)
		} catch (e: Exception) {
			null
		}
	}

	override fun getClientAliases(
		keyType: String?,
		issuers: Array<out Principal>?,
	): Array<String>? {
		val alias = aliasProvider()
		return if (alias.isNullOrEmpty()) null else arrayOf(alias)
	}

	// Server-side selection is never used by a client, so these are intentionally no-ops.
	override fun getServerAliases(
		keyType: String?,
		issuers: Array<out Principal>?,
	): Array<String>? = null

	override fun chooseServerAlias(
		keyType: String?,
		issuers: Array<out Principal>?,
		socket: Socket?,
	): String? = null
}
