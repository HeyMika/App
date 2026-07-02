package com.jellify

import  android.app.Application
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
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative



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
        jsBundleFilePath = getStoredBundlePath(applicationContext)
    )
  }
  


  override fun onCreate() {
    super.onCreate()

    // Route React Native's networking (fetch/XHR, and the Jellyfin SDK's default
    // axios adapter) through an OkHttp client that can present a client certificate
    // from the Android KeyChain, enabling mutual-TLS authentication. Must be set
    // before any networking happens.
    OkHttpClientProvider.setOkHttpClientFactory(ClientCertOkHttpFactory(this))

    loadReactNative(this)
  }
}