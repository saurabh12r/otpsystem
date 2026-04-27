import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/sms_channel.dart';
import 'setup_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with WidgetsBindingObserver {
  String _businessId = '';
  String _simId = '';
  String _senderPhone = '';
  String _deviceLabel = '';
  bool _isServiceRunning = false;
  bool _batteryOptDisabled = false;
  final List<String> _logs = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadConfig();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkServiceStatus();
    }
  }

  Future<void> _loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _businessId = prefs.getString('business_id') ?? '';
      _simId = prefs.getString('sim_id') ?? '';
      _senderPhone = prefs.getString('phone_number') ?? '';
      _deviceLabel = prefs.getString('device_label') ?? 'Unknown';
    });
    _checkServiceStatus();
    _checkPermissions();
  }

  Future<void> _checkServiceStatus() async {
    try {
      final running = await SmsChannel.isServiceRunning();
      final batteryOpt = await SmsChannel.isBatteryOptimizationDisabled();
      setState(() {
        _isServiceRunning = running;
        _batteryOptDisabled = batteryOpt;
      });
    } catch (e) {
      _addLog('Status check error: $e');
    }
  }

  Future<void> _checkPermissions() async {
    try {
      final batteryOpt = await SmsChannel.isBatteryOptimizationDisabled();
      setState(() => _batteryOptDisabled = batteryOpt);
    } catch (e) {
      _addLog('Permission check error: $e');
    }
  }

  void _addLog(String message) {
    final time = DateTime.now().toString().substring(11, 19);
    setState(() {
      _logs.insert(0, '[$time] $message');
      if (_logs.length > 50) _logs.removeLast();
    });
  }

  Future<void> _startService() async {
    if (_businessId.isEmpty || _simId.isEmpty) {
      _addLog('Error: Business ID or SIM ID not configured');
      return;
    }

    try {
      // Request SMS permission first
      final hasPerm = await SmsChannel.hasSmsPermission();
      if (!hasPerm) {
        await SmsChannel.requestSmsPermission();
        await Future.delayed(const Duration(seconds: 2));
      }

      // Start native foreground service — handles RTDB listening + SMS + heartbeat
      // This runs entirely in native Android, survives app kills
      // senderPhone ensures correct SIM is used on dual-SIM devices
      await SmsChannel.startForegroundService(
        businessId: _businessId,
        simId: _simId,
        senderPhone: _senderPhone,
      );

      setState(() => _isServiceRunning = true);
      _addLog('Native service started — works even if app is closed');
    } catch (e) {
      _addLog('Failed to start service: $e');
    }
  }

  Future<void> _stopService() async {
    try {
      await SmsChannel.stopForegroundService();
      setState(() => _isServiceRunning = false);
      _addLog('Service stopped');
    } catch (e) {
      _addLog('Failed to stop service: $e');
    }
  }

  Future<void> _resetSetup() async {
    await _stopService();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => _ResetWrapper()),
        (route) => false,
      );
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('OTP Sender'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _checkServiceStatus,
            tooltip: 'Refresh status',
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: _showSettingsDialog,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status Card
            Card(
              color: _isServiceRunning ? Colors.green.shade50 : Colors.red.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(
                      _isServiceRunning ? Icons.check_circle : Icons.cancel,
                      size: 48,
                      color: _isServiceRunning ? Colors.green : Colors.red,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isServiceRunning ? 'Service Active' : 'Service Stopped',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: _isServiceRunning ? Colors.green.shade800 : Colors.red.shade800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(_deviceLabel, style: const TextStyle(color: Colors.grey)),
                    if (_isServiceRunning)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text(
                          'Runs in background even if app is closed',
                          style: TextStyle(color: Colors.green, fontSize: 12),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Start/Stop Button
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                onPressed: _isServiceRunning ? _stopService : _startService,
                icon: Icon(_isServiceRunning ? Icons.stop : Icons.play_arrow),
                label: Text(_isServiceRunning ? 'Stop Service' : 'Start Service'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isServiceRunning ? Colors.red : Colors.green,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Stats Row
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    title: 'Status',
                    value: _isServiceRunning ? 'Online' : 'Offline',
                    icon: Icons.wifi,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _StatCard(
                    title: 'Battery Opt',
                    value: _batteryOptDisabled ? 'Off' : 'On',
                    icon: _batteryOptDisabled ? Icons.battery_full : Icons.battery_alert,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Config Info
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Configuration', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 8),
                    _ConfigRow(label: 'Business ID', value: _businessId),
                    _ConfigRow(label: 'SIM ID', value: _simId),
                    _ConfigRow(
                      label: 'Battery Opt',
                      value: _batteryOptDisabled ? 'Disabled (Good)' : 'Enabled (Bad)',
                      isWarning: !_batteryOptDisabled,
                    ),
                  ],
                ),
              ),
            ),

            if (!_batteryOptDisabled) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () async {
                  await SmsChannel.requestIgnoreBatteryOptimizations();
                  await Future.delayed(const Duration(seconds: 2));
                  _checkPermissions();
                },
                icon: const Icon(Icons.battery_alert),
                label: const Text('Disable Battery Optimization'),
              ),
            ],

            const SizedBox(height: 16),

            // Logs
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Activity Log', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        TextButton(
                          onPressed: () => setState(() => _logs.clear()),
                          child: const Text('Clear'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (_logs.isEmpty)
                      const Text('No activity yet', style: TextStyle(color: Colors.grey))
                    else
                      ..._logs.take(20).map((log) => Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(log, style: const TextStyle(fontSize: 12, fontFamily: 'monospace')),
                          )),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSettingsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Settings'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.refresh),
              title: const Text('Reset Setup'),
              subtitle: const Text('Clear config and start over'),
              onTap: () {
                Navigator.pop(ctx);
                _resetSetup();
              },
            ),
            ListTile(
              leading: const Icon(Icons.battery_saver),
              title: const Text('Battery Settings'),
              onTap: () {
                Navigator.pop(ctx);
                SmsChannel.requestIgnoreBatteryOptimizations();
              },
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;

  const _StatCard({required this.title, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, color: Colors.blue),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            Text(title, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _ResetWrapper extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SetupScreen(
      onSetupComplete: () {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
          (route) => false,
        );
      },
    );
  }
}

class _ConfigRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isWarning;

  const _ConfigRow({required this.label, required this.value, this.isWarning = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                color: isWarning ? Colors.orange : null,
                fontWeight: isWarning ? FontWeight.bold : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
