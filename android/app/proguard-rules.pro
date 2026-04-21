# React Native core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keepclassmembers class * { native <methods>; }
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers,allowobfuscation class * {
  @com.facebook.react.bridge.ReactMethod <methods>;
}

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.reanimated.NativeProxy { *; }

# React Native Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.** { *; }

# React Native Keychain
-keep class com.oblador.keychain.** { *; }

# React Native Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# React Native Fast Image
-keep class com.dylanvann.fastimage.** { *; }

# React Native Image Picker
-keep class com.imagepicker.** { *; }

# React Native Document Picker
-keep class io.github.elc1798.** { *; }
-keep class com.reactnativedocumentpicker.** { *; }

# React Native Safe Area Context
-keep class com.th3rdwave.safeareacontext.** { *; }

# React Native AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# OkHttp / Networking
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Keep annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Prevent stripping R8/D8 optimisations from crashing on reflection
-keepclassmembers class **.R$* { public static <fields>; }
