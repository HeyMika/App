package com.jellify.clientcert

import android.app.Activity
import android.security.KeyChain
import android.security.KeyChainAliasCallback
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Bridges the Android system KeyChain to JavaScript so the app can let the user pick
 * (and later reference) a client certificate for mutual-TLS authentication.
 *
 * The heavy lifting — actually presenting the certificate during TLS handshakes —
 * happens in [ClientCertOkHttpFactory]; this module only manages *which* certificate
 * is selected.
 */
class ClientCertModule(private val reactContext: ReactApplicationContext) :
	ReactContextBaseJavaModule(reactContext) {

	override fun getName(): String = NAME

	/** Android always supports this feature; the JS wrapper no-ops on iOS. */
	@ReactMethod
	fun isSupported(promise: Promise) {
		promise.resolve(true)
	}

	/** Returns the KeyChain alias currently selected, or `null` if none. */
	@ReactMethod
	fun getSelectedAlias(promise: Promise) {
		promise.resolve(ClientCertStore.getAlias(reactContext))
	}

	/** Forgets the selected certificate. Does not remove it from the system KeyChain. */
	@ReactMethod
	fun clearSelectedAlias(promise: Promise) {
		ClientCertStore.setAlias(reactContext, null)
		promise.resolve(null)
	}

	/**
	 * Presents the system certificate chooser (the standard Android popup). The
	 * optional [host]/[port] act as hints so Android can highlight a certificate the
	 * user previously granted to that server.
	 *
	 * Resolves with the chosen alias, or `null` if the user dismissed the chooser.
	 * The chosen alias is persisted as the new default.
	 */
	@ReactMethod
	fun selectCertificate(host: String?, port: Double, promise: Promise) {
		val activity: Activity? = currentActivity

		if (activity == null) {
			promise.reject(
				"no_activity",
				"No foreground activity is available to present the certificate chooser",
			)
			return
		}

		val callback = KeyChainAliasCallback { alias ->
			if (!alias.isNullOrEmpty()) {
				ClientCertStore.setAlias(reactContext, alias)
			}
			promise.resolve(alias)
		}

		val portHint = if (port > 0) port.toInt() else -1

		try {
			KeyChain.choosePrivateKeyAlias(
				activity,
				callback,
				null, // keyTypes — accept any
				null, // issuers — accept any
				host, // server host hint (nullable)
				portHint, // server port hint (-1 = none)
				null, // no pre-selected alias
			)
		} catch (e: Exception) {
			promise.reject("chooser_failed", e.message, e)
		}
	}

	companion object {
		const val NAME = "ClientCert"
	}
}
