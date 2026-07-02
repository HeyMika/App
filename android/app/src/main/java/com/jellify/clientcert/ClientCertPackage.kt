package com.jellify.clientcert

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers [ClientCertModule] with React Native. Added manually in
 * `MainApplication.kt` since this is a local (non-autolinked) module.
 */
class ClientCertPackage : ReactPackage {
	override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
		listOf(ClientCertModule(reactContext))

	override fun createViewManagers(
		reactContext: ReactApplicationContext,
	): List<ViewManager<*, *>> = emptyList()
}
