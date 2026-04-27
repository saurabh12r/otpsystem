import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'firebase_options.dart';
import 'screens/setup_screen.dart';
import 'screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    debugPrint('Firebase init error: $e');
  }

  final prefs = await SharedPreferences.getInstance();
  final isSetupDone = prefs.getBool('is_setup_done') ?? false;

  runApp(OtpSenderApp(isSetupDone: isSetupDone));
}

class OtpSenderApp extends StatefulWidget {
  final bool isSetupDone;

  const OtpSenderApp({super.key, required this.isSetupDone});

  @override
  State<OtpSenderApp> createState() => _OtpSenderAppState();
}

class _OtpSenderAppState extends State<OtpSenderApp> {
  late bool _isSetupDone;

  @override
  void initState() {
    super.initState();
    _isSetupDone = widget.isSetupDone;
  }

  void _onSetupComplete() {
    setState(() => _isSetupDone = true);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OTP Sender',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: Colors.blue,
        useMaterial3: true,
      ),
      home: _isSetupDone
          ? const DashboardScreen()
          : SetupScreen(onSetupComplete: _onSetupComplete),
    );
  }
}
