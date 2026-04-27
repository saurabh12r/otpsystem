import 'dart:async';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';
import 'sms_channel.dart';

/// Listens to Firebase RTDB for pending OTP requests and sends SMS.
class OtpListenerService {
  final String businessId;
  final String simId;
  final Function(String message)? onLog;
  final Function(int count)? onSmsSent;

  StreamSubscription<DatabaseEvent>? _subscription;
  StreamSubscription<DatabaseEvent>? _retrySubscription;
  int _smsSentToday = 0;
  bool _isListening = false;

  OtpListenerService({
    required this.businessId,
    required this.simId,
    this.onLog,
    this.onSmsSent,
  });

  bool get isListening => _isListening;
  int get smsSentToday => _smsSentToday;

  /// Start listening for OTP requests targeted at this SIM.
  void startListening() {
    if (_isListening) return;

    final ref = FirebaseDatabase.instance
        .ref('otp_requests/$businessId');

    // Listen for all children under this business
    _subscription = ref.onChildAdded.listen((event) {
      _handleNewRequest(event);
    });

    _isListening = true;
    _log('Started listening for OTP requests');
  }

  void _handleNewRequest(DatabaseEvent event) async {
    try {
      final data = event.snapshot.value;
      if (data == null || data is! Map) return;

      final map = Map<String, dynamic>.from(data);
      final status = map['status'] as String?;
      final targetSimId = map['target_sim_id'] as String?;

      // Only process pending requests targeted at this SIM
      if (status != 'pending' || targetSimId != simId) return;

      final requestKey = event.snapshot.key;
      if (requestKey == null) return;
      final recipient = map['recipient'] as String?;
      final message = map['message'] as String?;

      if (recipient == null || message == null) return;

      _log('New OTP request: $requestKey for $recipient');

      // Claim the request via transaction
      final requestRef = FirebaseDatabase.instance
          .ref('otp_requests/$businessId/$requestKey');

      final transactionResult = await requestRef.runTransaction((currentData) {
        if (currentData == null) return Transaction.abort();
        final currentMap = Map<String, dynamic>.from(currentData as Map);
        if (currentMap['status'] != 'pending') return Transaction.abort();

        currentMap['status'] = 'picked';
        currentMap['picked_by'] = simId;
        currentMap['picked_at'] = ServerValue.timestamp;
        return Transaction.success(currentMap);
      });

      if (!transactionResult.committed) {
        _log('Request $requestKey already claimed by another SIM');
        return;
      }

      _log('Claimed request $requestKey, sending SMS to $recipient');

      // Send SMS via native platform channel
      try {
        final sent = await SmsChannel.sendSms(
          phone: recipient,
          message: message,
          requestId: requestKey,
        );

        if (!sent) {
          await _updateStatus(requestKey, 'failed', 'SMS dispatch failed');
          return;
        }

        // Wait for SMS result (poll for up to 10 seconds)
        bool? smsSuccess;
        for (int i = 0; i < 20; i++) {
          await Future.delayed(const Duration(milliseconds: 500));
          final result = await SmsChannel.getSmsResult(requestKey);
          if (result != null) {
            smsSuccess = result['success'] == true;
            break;
          }
        }

        if (smsSuccess == true) {
          await _updateStatus(requestKey, 'sent', null);
          _smsSentToday++;
          onSmsSent?.call(_smsSentToday);
          _log('SMS sent successfully to $recipient');
        } else if (smsSuccess == false) {
          await _updateStatus(requestKey, 'failed', 'SMS send failed');
          _log('SMS send failed for $recipient');
        } else {
          // Timeout waiting for result — mark as sent (optimistic)
          // The PendingIntent callback may arrive later
          await _updateStatus(requestKey, 'sent', null);
          _smsSentToday++;
          onSmsSent?.call(_smsSentToday);
          _log('SMS dispatch timeout, marked as sent (optimistic) for $recipient');
        }
      } catch (e) {
        await _updateStatus(requestKey, 'failed', e.toString());
        _log('SMS error for $recipient: $e');
      }
    } catch (e) {
      _log('Error handling request: $e');
    }
  }

  Future<void> _updateStatus(String requestKey, String status, String? failureReason) async {
    final ref = FirebaseDatabase.instance
        .ref('otp_requests/$businessId/$requestKey');

    final updates = <String, dynamic>{
      'status': status,
    };

    if (status == 'sent') {
      updates['sent_at'] = ServerValue.timestamp;
    } else if (status == 'failed') {
      updates['failure_reason'] = failureReason;
    }

    await ref.update(updates);
  }

  void _log(String message) {
    debugPrint('[OtpListener] $message');
    onLog?.call(message);
  }

  /// Also listen for status changes on existing requests (for retry handling).
  /// When backend retries with this SIM, it resets status to "pending" with our sim_id.
  void startRetryListener() {
    _retrySubscription?.cancel();
    final ref = FirebaseDatabase.instance
        .ref('otp_requests/$businessId');

    _retrySubscription = ref.onChildChanged.listen((event) {
      _handleNewRequest(event);
    });
  }

  void stopListening() {
    _subscription?.cancel();
    _subscription = null;
    _retrySubscription?.cancel();
    _retrySubscription = null;
    _isListening = false;
    _log('Stopped listening');
  }

  void dispose() {
    stopListening();
  }
}
