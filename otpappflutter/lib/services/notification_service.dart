import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';

class NotificationService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    // Request permissions
    NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      if (kDebugMode) {
        print('User granted permission');
      }
      
      // Get the token
      String? token = await _messaging.getToken();
      if (token != null) {
        await saveToken(token);
      }

      // Listen for token refresh
      _messaging.onTokenRefresh.listen(saveToken);

      // Setup local notifications for foreground
      const AndroidInitializationSettings androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const DarwinInitializationSettings iosSettings = DarwinInitializationSettings();
      const InitializationSettings initSettings = InitializationSettings(android: androidSettings, iOS: iosSettings);
      
      await _localNotifications.initialize(settings: initSettings);

      // Listen for foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    }
  }

  static Future<void> saveToken(String token) async {
    if (kDebugMode) {
      print('FCM Token: $token');
    }
    // We save the token to a general "tokens" collection for testing
    // In a real app, you'd link this to a specific userId
    await _firestore.collection('device_tokens').doc(token).set({
      'token': token,
      'createdAt': FieldValue.serverTimestamp(),
      'platform': defaultTargetPlatform.toString(),
    });
  }

  static void _handleForegroundMessage(RemoteMessage message) {
    RemoteNotification? notification = message.notification;

    if (notification != null) {
      _localNotifications.show(
        id: notification.hashCode,
        title: notification.title,
        body: notification.body,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'high_importance_channel',
            'High Importance Notifications',
            importance: Importance.max,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
      );
    }
  }

  static Future<void> triggerLocalNotification() async {
    await _localNotifications.show(
      id: 0,
      title: 'Test Notification',
      body: 'This is a self-triggered local notification!',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'test_channel',
          'Test Notifications',
          importance: Importance.max,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}
