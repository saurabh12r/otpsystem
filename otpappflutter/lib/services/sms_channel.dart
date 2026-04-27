import 'package:flutter/services.dart';

/// Platform channel to native Android SMS sending via SmsManager.
class SmsChannel {
  static const _channel = MethodChannel('otp_sender/sms');

  /// Send SMS via native SmsManager.
  /// Returns true if the SMS was dispatched (not necessarily delivered).
  static Future<bool> sendSms({
    required String phone,
    required String message,
    required String requestId,
  }) async {
    final result = await _channel.invokeMethod('sendSms', {
      'phone': phone,
      'message': message,
      'requestId': requestId,
    });
    return result == true;
  }

  /// Check if SMS send result is available for a request.
  /// Returns {success: bool, resultCode: int} or null if no result yet.
  static Future<Map<String, dynamic>?> getSmsResult(String requestId) async {
    final result = await _channel.invokeMethod('getSmsResult', {
      'requestId': requestId,
    });
    if (result == null) return null;
    return Map<String, dynamic>.from(result);
  }

  /// Start the native foreground service with RTDB listener + SMS sending.
  /// This runs entirely in native Android and survives app kills.
  /// [senderPhone] ensures SMS is sent from the correct SIM on dual-SIM devices.
  static Future<void> startForegroundService({
    required String businessId,
    required String simId,
    required String senderPhone,
  }) async {
    await _channel.invokeMethod('startForegroundService', {
      'business_id': businessId,
      'sim_id': simId,
      'sender_phone': senderPhone,
    });
  }

  /// Stop the foreground service.
  static Future<void> stopForegroundService() async {
    await _channel.invokeMethod('stopForegroundService');
  }

  /// Check if the native service is running (persisted in SharedPreferences).
  static Future<bool> isServiceRunning() async {
    final result = await _channel.invokeMethod('isServiceRunning');
    return result == true;
  }

  /// Request the user to disable battery optimization for this app.
  static Future<void> requestIgnoreBatteryOptimizations() async {
    await _channel.invokeMethod('requestIgnoreBatteryOptimizations');
  }

  /// Check if battery optimization is already disabled.
  static Future<bool> isBatteryOptimizationDisabled() async {
    final result = await _channel.invokeMethod('isBatteryOptimizationDisabled');
    return result == true;
  }

  /// Request SMS and notification permissions at runtime.
  static Future<void> requestSmsPermission() async {
    await _channel.invokeMethod('requestSmsPermission');
  }

  /// Check if SMS permission is granted.
  static Future<bool> hasSmsPermission() async {
    final result = await _channel.invokeMethod('hasSmsPermission');
    return result == true;
  }
}
