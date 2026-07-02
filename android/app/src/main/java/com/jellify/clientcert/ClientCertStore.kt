package com.jellify.clientcert

import android.content.Context

/**
 * Persists the KeyChain alias of the client certificate the user selected as their
 * default. Stored in [android.content.SharedPreferences] so that both the OkHttp
 * factory (which builds the TLS stack) and the React Native bridge module can read
 * and write a single source of truth.
 *
 * The matching JS-side mirror lives in MMKV (see `src/stores/settings/client-certificate.ts`)
 * and is used for synchronous routing decisions in the axios adapter.
 */
internal object ClientCertStore {
	private const val PREFS = "jellify_client_cert"
	private const val KEY_ALIAS = "selected_alias"

	fun getAlias(context: Context): String? =
		context.applicationContext
			.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
			.getString(KEY_ALIAS, null)

	fun setAlias(context: Context, alias: String?) {
		val editor =
			context.applicationContext
				.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
				.edit()

		if (alias.isNullOrEmpty()) editor.remove(KEY_ALIAS) else editor.putString(KEY_ALIAS, alias)

		editor.apply()
	}
}
