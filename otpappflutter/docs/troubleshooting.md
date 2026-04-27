# Troubleshooting & Technical Resolutions

This document provides a detailed breakdown of the technical challenges encountered during the Firebase integration and their subsequent fixes.

## 🔴 Challenge 1: Duplicate `com.google.gms.google-services` Plugin
- **Symptom**: `flutterfire configure` failed with "Plugin already added" error.
- **Root Cause**: The FlutterFire CLI attempted to add the plugin to `android/app/build.gradle.kts` while it was already present from a previous run or manual edit.
- **Resolution**: Manually cleaned up the duplicate entry in `android/app/build.gradle.kts`, ensuring only one instance of `id("com.google.gms.google-services")` existed.

## 🔴 Challenge 2: `minSdkVersion` 21 Requirement
- **Symptom**: Build failures when compiling for Android.
- **Root Cause**: The `flutter_local_notifications` package requires `minSdkVersion` 21 (Android 5.0) for certain advanced notification features and for Core Library Desugaring.
- **Resolution**: Updated `android/app/build.gradle.kts` to explicitly set `minSdk = 21` instead of using the default `flutter.minSdkVersion`.

## 🔴 Challenge 3: Core Library Desugaring & `desugar_jdk_libs`
- **Symptom**: Error message stating "Dependency ':flutter_local_notifications' requires core library desugaring to be enabled for :app."
- **Root Cause**: Modern plugins use Java 8+ features that aren't natively supported on older Android versions without desugaring.
- **Resolution**: 
  - Enabled `isCoreLibraryDesugaringEnabled = true` in `compileOptions`.
  - Added `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")` to dependencies.
  - *Correction*: Initially used v2.0.3, but updated to v2.1.4 as specifically required by the latest version of the plugin.

## 🔴 Challenge 4: `flutter_local_notifications` v20+ API Changes
- **Symptom**: `Error: Too many positional arguments: 0 allowed, but 4 found.` and `No named parameter with the name 'initializationSettings'`.
- **Root Cause**: Version 20.0.0 of the plugin introduced breaking changes, shifting from positional arguments to named parameters for `initialize()` and `show()`.
- **Resolution**: 
  - Consulted the source code of the installed plugin version (20.1.0) using `grep`.
  - Identified the correct parameter names: `settings:` (for `initialize`) and `id:`, `title:`, `body:`, `notificationDetails:` (for `show`).

## 🔴 Challenge 5: Black Screen on Startup
- **Symptom**: The app would start but display only a black screen.
- **Root Cause**: Initializing Firebase and the Notification Service asynchronously in `main()` without error handling. When Firestore threw a `PERMISSION_DENIED` exception (due to locked rules), the execution stopped before reaching `runApp()`.
- **Resolution**: Wrapped the initialization in a `try-catch` block and added a 10-second timeout to `NotificationService.initialize()` to ensure `runApp()` is always called.

## 🔴 Challenge 6: Firestore `PERMISSION_DENIED`
- **Symptom**: Warnings in the log stating "Write failed at device_tokens/..."
- **Root Cause**: The newly created Firebase project had Firestore rules set to deny all traffic by default.
- **Resolution**: Guided the user to enable **Test Mode** in the Firebase console and directed them to **Publish** the rules manually.
