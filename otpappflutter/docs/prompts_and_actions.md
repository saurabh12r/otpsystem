# Prompts and AI Actions Log

This document correlates the specific instructions provided by the user with the actions and technical decisions made by the AI.

| # | User Prompt | AI Action(s) | Fixes & Enhancements |
| :--- | :--- | :--- | :--- |
| **1** | "link it to the firebase and configure notifications setup too... for testing add simple add names functionality... setup proper fcm tokens saving functionality" | Created new Firebase project, added `firebase_messaging`, `firebase_core`, `cloud_firestore`, `flutter_local_notifications`. | Initial dependency setup and implementation of `NotificationService`. |
| **2** | "yes create a new project" | Created project `ffs-cf2e4075` using Firebase CLI and linked the Flutter app. | Generated `lib/firebase_options.dart` and configured keys. |
| **3** | "not modified maybe" (referring to `build.gradle.kts`) | Verified `isCoreLibraryDesugaringEnabled` and updated `desugar_jdk_libs` version to `2.1.4`. | Upgraded desugar libraries and restored `minSdk = 21`. |
| **4** | "i m only seeing the black screen why ??" | Analyzed `main()` execution flow and identified a crash during initialization. | Wrapped `main()` in a `try-catch` with a 10s timeout to ensure the UI renders. |
| **5** | "do i need to add some rules or collection ??" | Analyzed the `PERMISSION_DENIED` error in terminal logs. | Explained the "Publish" button in the Firebase Console and automated collection creation. |
| **6** | "realtime database can we integrate it ?" | Added `firebase_database`, re-ran `flutterfire configure`, and updated `main.dart` with a new UI section. | Integrated a parallel real-time syncing mechanism alongside Firestore. |
| **7** | "make a detailed docs how you created... make a docs folder in root" | Created `docs/` directory and four detailed README files explaining the full project history. | Compiled all technical decisions into a readable knowledge base. |
