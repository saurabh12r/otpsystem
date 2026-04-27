import 'dart:async';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';

/// Writes periodic heartbeat to RTDB so the backend knows this device is online.
class HeartbeatService {
  final String businessId;
  final String simId;

  Timer? _timer;
  bool _isRunning = false;

  HeartbeatService({required this.businessId, required this.simId});

  bool get isRunning => _isRunning;

  void start() {
    if (_isRunning) return;
    _isRunning = true;

    // Write immediately, then every 60 seconds
    _writeHeartbeat();
    _timer = Timer.periodic(const Duration(seconds: 60), (_) {
      _writeHeartbeat();
    });

    debugPrint('[Heartbeat] Started for $businessId/$simId');
  }

  Future<void> _writeHeartbeat() async {
    try {
      final ref = FirebaseDatabase.instance
          .ref('device_status/$businessId/$simId');

      await ref.set({
        'online': true,
        'last_heartbeat': ServerValue.timestamp,
        'sim_status': 'ready',
      });
    } catch (e) {
      debugPrint('[Heartbeat] Error: $e');
    }
  }

  Future<void> _writeOffline() async {
    try {
      final ref = FirebaseDatabase.instance
          .ref('device_status/$businessId/$simId');

      await ref.update({
        'online': false,
        'last_heartbeat': ServerValue.timestamp,
      });
    } catch (e) {
      debugPrint('[Heartbeat] Error writing offline: $e');
    }
  }

  Future<void> stop() async {
    _timer?.cancel();
    _timer = null;
    _isRunning = false;
    await _writeOffline();
    debugPrint('[Heartbeat] Stopped');
  }

  void dispose() {
    stop();
  }
}
