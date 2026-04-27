const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const OTP_SERVICE_URL = process.env.OTP_SERVICE_URL;
const OTP_API_KEY = process.env.OTP_API_KEY;

// GET /send-otp?mobile=+919876543210&device_id=browser123
app.get('/send-otp', async (req, res) => {
  const { mobile, device_id } = req.query;

  if (!mobile || !device_id) {
    return res.status(400).json({ success: false, message: 'mobile and device_id are required as query params' });
  }

  try {
    const response = await fetch(`${OTP_SERVICE_URL}/api/otp/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': OTP_API_KEY,
      },
      body: JSON.stringify({ mobile_number: mobile, device_id }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: 'OTP service unreachable', error: err.message });
  }
});

// GET /verify-otp?mobile=+919876543210&otp=123456&device_id=browser123
app.get('/verify-otp', async (req, res) => {
  const { mobile, otp, device_id } = req.query;

  if (!mobile || !otp || !device_id) {
    return res.status(400).json({ success: false, message: 'mobile, otp, and device_id are required as query params' });
  }

  try {
    const response = await fetch(`${OTP_SERVICE_URL}/api/otp/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': OTP_API_KEY,
      },
      body: JSON.stringify({ mobile_number: mobile, otp, device_id }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: 'OTP service unreachable', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Client demo running on http://localhost:${PORT}`);
  console.log(`OTP Service: ${OTP_SERVICE_URL}`);
  console.log('');
  console.log('Test URLs:');
  console.log(`  Send OTP:   http://localhost:${PORT}/send-otp?mobile=+919876543210&device_id=browser123`);
  console.log(`  Verify OTP: http://localhost:${PORT}/verify-otp?mobile=+919876543210&otp=123456&device_id=browser123`);
});
