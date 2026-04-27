import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class SetupScreen extends StatefulWidget {
  final VoidCallback onSetupComplete;

  const SetupScreen({super.key, required this.onSetupComplete});

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _serverUrlController = TextEditingController(text: 'http://10.0.2.2:5001');
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _showServerField = false;

  @override
  void initState() {
    super.initState();
    _loadServerUrl();
  }

  Future<void> _loadServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUrl = prefs.getString('server_url');
    if (savedUrl != null) {
      _serverUrlController.text = savedUrl;
    }
  }

  @override
  void dispose() {
    _serverUrlController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() { _loading = true; _error = null; });

    final serverUrl = _serverUrlController.text.trim();
    final phone = _phoneController.text.trim();
    final password = _passwordController.text.trim();

    try {
      final response = await http.post(
        Uri.parse('$serverUrl/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phone_number': phone, 'password': password}),
      ).timeout(const Duration(seconds: 10));

      // Check if server returned HTML (ngrok error page, etc.)
      if (response.headers['content-type']?.contains('text/html') == true) {
        setState(() => _error = 'Server returned an error page. Check the server URL.');
        return;
      }

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final result = data['data'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('server_url', serverUrl);
        await prefs.setString('business_id', result['business_id']);
        await prefs.setString('business_name', result['business_name']);
        await prefs.setString('sim_id', result['sim_id']);
        await prefs.setString('phone_number', result['phone_number']);
        await prefs.setString('device_label', result['label'] ?? result['phone_number']);
        await prefs.setBool('is_setup_done', true);

        widget.onSetupComplete();
      } else {
        setState(() => _error = data['message'] ?? 'Login failed');
      }
    } on FormatException {
      setState(() => _error = 'Invalid response from server. Check the server URL.');
    } catch (e) {
      setState(() => _error = 'Connection failed. Check URL and network.');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('OTP Sender'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.sms_outlined, size: 64, color: Colors.blue),
              const SizedBox(height: 16),
              const Text(
                'Login to OTP Sender',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter the mobile number and password given by your admin.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Mobile Number',
                  hintText: '+919876543210',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone),
                ),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'Mobile number is required'
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'Password is required'
                    : null,
              ),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: () => setState(() => _showServerField = !_showServerField),
                child: Text(
                  _showServerField ? 'Hide server settings' : 'Server settings',
                  style: const TextStyle(color: Colors.blue, fontSize: 13),
                ),
              ),
              if (_showServerField) ...[
                const SizedBox(height: 8),
                TextFormField(
                  controller: _serverUrlController,
                  decoration: const InputDecoration(
                    labelText: 'Server URL',
                    hintText: 'http://10.0.2.2:5001',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.dns),
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Server URL is required'
                      : null,
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13), textAlign: TextAlign.center),
              ],
              const SizedBox(height: 24),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _loading ? null : _login,
                  child: _loading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Login', style: TextStyle(fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
