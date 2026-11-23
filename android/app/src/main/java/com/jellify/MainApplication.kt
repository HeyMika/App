package com.jellify

import  android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.jellify.clientcert.ClientCertOkHttpFactory
import com.jellify.clientcert.ClientCertPackage
import com.margelo.nitro.nitroota.core.getStoredBundlePath
import com.margelo.nitro.superconfig.NativeSuperConfig
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.tencent.mmkv.MMKV
import io.sentry.react.RNSentrySDK
import org.json.JSONObject

// Zustand persist key for src/stores/settings/app.ts
private const val APP_SETTINGS_STORAGE_KEY = "app-settings-storage"

class MainApplication : Application(), ReactApplication {


  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(ClientCertPackage())
        },
        // Only load a downloaded OTA bundle when OTA updates are enabled. This fork
        // disables them, so any bundle fetched earlier from upstream's App-Bundles
        // repo (which would replace this fork's JS) is ignored in favour of the
        // bundle shipped in the APK.
        jsBundleFilePath =
          if (isOtaUpdateEnabled()) getStoredBundlePath(applicationContext) else null
    )
  }



  override fun onCreate() {
    super.onCreate()

    // Route React Native's networking (fetch/XHR, and the Jellyfin SDK's default
    // axios adapter) through an OkHttp client that can present a client certificate
    // from the Android KeyChain, enabling mutual-TLS authentication. Must be set
    // before any networking happens.
    OkHttpClientProvider.setOkHttpClientFactory(ClientCertOkHttpFactory(this))

    startCrashReporting()
    loadReactNative(this)
  }

  private fun isOtaUpdateEnabled(): Boolean =
    NativeSuperConfig.config["OTA_UPDATE_ENABLED"] == "true"

  /**
   * Starts Sentry before React Native loads so startup crashes get reported.
   * JS re-initializes it with the full options once the bundle is running.
   */
  private fun startCrashReporting() {
    if (BuildConfig.DEBUG) return

    try {
      if (!hasSendMetricsConsent()) return

      val dsn = NativeSuperConfig.config["GLITCHTIP_DSN"]
      if (dsn.isNullOrEmpty()) return

      RNSentrySDK.init(this) { options -> options.dsn = dsn }
    } catch (e: Throwable) {
      // Crash reporting must never be the reason the app fails to start
      Log.w("Jellify", "Unable to start crash reporting", e)
    }
  }

  /**
   * Reads the "Send Analytics" setting straight from the MMKV store react-native-mmkv
   * writes to, since JS hasn't loaded yet
   */
  private fun hasSendMetricsConsent(): Boolean {
    MMKV.initialize(this, filesDir.absolutePath + "/mmkv")
    val persisted = MMKV.defaultMMKV().decodeString(APP_SETTINGS_STORAGE_KEY) ?: return false
    return JSONObject(persisted).optJSONObject("state")?.optBoolean("sendMetrics", false) ?: false
  }
}
