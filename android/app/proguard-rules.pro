# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor (from @capacitor/android/capacitor/proguard-rules.pro)
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}

-keep public class * extends com.getcapacitor.Plugin { *; }

-keep @com.getcapacitor.NativePlugin public class * {
  @com.getcapacitor.PluginMethod public <methods>;
}

-keep public class * extends org.apache.cordova.* {
  public <methods>;
  public <fields>;
}

# Unity Ads + Play Billing (reflection-heavy SDKs)
-keep class com.unity3d.** { *; }
-keep class com.android.billingclient.** { *; }

# WebView JavaScript interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
