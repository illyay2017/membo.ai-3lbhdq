# membo.ai ProGuard Rules
# Version: 1.0.0

#-------------------------------------------
# React Native Core Rules
#-------------------------------------------
# Keep React Native annotations
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters

# Keep classes with DoNotStrip annotation
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# Keep all native methods
-keepclassmembers class * {
    native <methods>;
}

#-------------------------------------------
# membo.ai Native Modules
#-------------------------------------------
# Voice Recognition Module
-keep class ai.membo.modules.RNVoiceModule { *; }
-keep class ai.membo.managers.VoiceManager { *; }

# Study Module
-keep class ai.membo.modules.RNStudyModule { *; }
-keep class ai.membo.managers.StudyManager { *; }

# Content Capture Module
-keep class ai.membo.modules.RNContentCaptureModule { *; }
-keep class ai.membo.managers.ContentCaptureManager { *; }

# Notification Module
-keep class ai.membo.modules.RNNotificationModule { *; }
-keep class ai.membo.managers.NotificationManager { *; }

#-------------------------------------------
# Firebase & Google Play Services
#-------------------------------------------
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**

#-------------------------------------------
# Application Components
#-------------------------------------------
-keep class ai.membo.MainApplication { *; }
-keep class ai.membo.MainActivity { *; }

#-------------------------------------------
# Optimization & Debug Settings
#-------------------------------------------
# Disable arithmetic optimizations that might affect React Native
-optimizations !code/simplification/arithmetic

# Keep type information for JSON parsing
-keepattributes Signature

# Keep all annotations
-keepattributes *Annotation*

# Keep source file names and line numbers for stack traces
-keepattributes SourceFile,LineNumberTable

#-------------------------------------------
# Third-Party Libraries
#-------------------------------------------
# React Native Paper
-keep class com.facebook.react.views.text.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# React Native Voice
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.modules.** { *; }

# React Native Navigation
-keep class com.facebook.react.modules.core.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

#-------------------------------------------
# General Rules
#-------------------------------------------
# Keep JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Enum values
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable implementations
-keepnames class * implements java.io.Serializable

#-------------------------------------------
# Debugging and Stack Traces
#-------------------------------------------
# Remove debug logs in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Keep crash reporting data
-keepattributes LineNumberTable,SourceFile
-renamesourcefileattribute SourceFile

#-------------------------------------------
# Performance Optimizations
#-------------------------------------------
# Allow aggressive optimizations
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontskipnonpubliclibraryclassmembers
-dontpreverify
-verbose

# Allow class merging for better optimization
-allowaccessmodification
-repackageclasses 'ai.membo'

# Remove unused code
-dontnote
-dontwarn
-ignorewarnings