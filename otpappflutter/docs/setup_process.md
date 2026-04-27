# Setup & Configuration Process

This document details the step-by-step process of initializing the Flutter project and integrating Firebase services.

## Phase 1: Environment Readiness
- Checked for `firebase-tools` (Firebase CLI) and `flutterfire_cli`.
- Verified the local Flutter project structure.

## Phase 2: Firebase Project Creation
- A new Firebase project was created via the terminal:
  ```bash
  firebase projects:create ffs-cf2e4075 --display-name "Flutter Firebase Setup"
  ```
- This unique ID was derived from the current session's conversation ID to ensure uniqueness in the cloud.

## Phase 3: Dependency Integration
- Added the core and service packages to `pubspec.yaml`:
  - `firebase_core`: Fundamental Firebase initialization.
  - `firebase_messaging`: Push notification handling.
  - `cloud_firestore`: Real-time NoSQL database.
  - `firebase_database`: Lower-latency realtime data syncing.
  - `flutter_local_notifications`: Foreground notification processing.
- Executed `flutter pub get` twice (once manually and once via `flutter run`).

## Phase 4: Platform-Specific Configuration
- **Android**:
  - Run `flutterfire configure` to generate `google-services.json`.
  - Applied `com.google.gms.google-services` plugin in `android/app/build.gradle.kts`.
  - Enabled **Core Library Desugaring** (v2.1.4) to support modern Java APIs on older devices.
  - Set `minSdkVersion` to `21`.
- **iOS**:
  - Run `flutterfire configure` to generate `GoogleService-Info.plist` and add it to the Xcode project.
  - Enabled **Remote Notifications** and **Background Fetch** in `Info.plist`.
  - Configured `FirebaseAppDelegateProxyEnabled: false` to allow manual notification handling.

## Phase 5: Code Implementation
- **Initializer**: Created a resilient `main()` function in `lib/main.dart` with error handling and a 10-second timeout to prevent black screens during slow network initialization.
- **Service Layer**: Created `lib/services/notification_service.dart` to abstract FCM and local notification logic.
- **Dashboard UI**: Developed a multi-section UI to interact with both Firestore and Realtime Database simultaneously.
