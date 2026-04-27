package com.example.flutter_firebase_setup

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.example.flutter_firebase_setup.sms.SmsSendHelper
import com.example.flutter_firebase_setup.services.OtpSenderForegroundService
import com.example.flutter_firebase_setup.receivers.SmsSendResultReceiver
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val smsChannel = "otp_sender/sms"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            smsChannel
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "sendSms" -> {
                    val phone = call.argument<String>("phone")
                    val message = call.argument<String>("message")
                    val requestId = call.argument<String>("requestId")
                    if (phone.isNullOrBlank() || message.isNullOrBlank() || requestId.isNullOrBlank()) {
                        result.error("invalid_args", "phone, message, and requestId are required", null)
                        return@setMethodCallHandler
                    }
                    try {
                        SmsSendHelper.sendSmsWithCallback(
                            applicationContext,
                            phone,
                            message,
                            requestId
                        )
                        result.success(true)
                    } catch (e: Exception) {
                        Log.e(TAG, "sendSms failed", e)
                        result.error("sms_failed", e.message, null)
                    }
                }

                "getSmsResult" -> {
                    val requestId = call.argument<String>("requestId")
                    if (requestId.isNullOrBlank()) {
                        result.error("invalid_args", "requestId is required", null)
                        return@setMethodCallHandler
                    }
                    val prefs = applicationContext.getSharedPreferences(
                        SmsSendResultReceiver.PREFS_NAME, Context.MODE_PRIVATE
                    )
                    val key = "result_${requestId}_success"
                    if (prefs.contains(key)) {
                        val success = prefs.getBoolean(key, false)
                        val code = prefs.getInt("result_${requestId}_code", -1)
                        // Clean up
                        prefs.edit()
                            .remove("result_${requestId}_success")
                            .remove("result_${requestId}_code")
                            .remove("result_${requestId}_phone")
                            .remove("result_${requestId}_time")
                            .apply()
                        result.success(mapOf("success" to success, "resultCode" to code))
                    } else {
                        result.success(null) // No result yet
                    }
                }

                "startForegroundService" -> {
                    try {
                        val businessId = call.argument<String>("business_id") ?: ""
                        val simId = call.argument<String>("sim_id") ?: ""
                        val senderPhone = call.argument<String>("sender_phone") ?: ""
                        OtpSenderForegroundService.start(applicationContext, businessId, simId, senderPhone)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("service_failed", e.message, null)
                    }
                }

                "stopForegroundService" -> {
                    try {
                        OtpSenderForegroundService.stop(applicationContext)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("service_failed", e.message, null)
                    }
                }

                "isServiceRunning" -> {
                    val prefs = applicationContext.getSharedPreferences(
                        OtpSenderForegroundService.PREFS_NAME, Context.MODE_PRIVATE
                    )
                    result.success(prefs.getBoolean("service_enabled", false))
                }

                "requestIgnoreBatteryOptimizations" -> {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                                val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                    data = Uri.parse("package:$packageName")
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                startActivity(i)
                            }
                        }
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("intent_failed", e.message, null)
                    }
                }

                "isBatteryOptimizationDisabled" -> {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                            result.success(pm.isIgnoringBatteryOptimizations(packageName))
                        } else {
                            result.success(true)
                        }
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }

                "requestSmsPermission" -> {
                    try {
                        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS)
                            != PackageManager.PERMISSION_GRANTED) {
                            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.SEND_SMS), SMS_PERMISSION_CODE)
                        }
                        // Also request POST_NOTIFICATIONS for Android 13+
                        if (Build.VERSION.SDK_INT >= 33) {
                            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                                != PackageManager.PERMISSION_GRANTED) {
                                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_CODE)
                            }
                        }
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("permission_failed", e.message, null)
                    }
                }

                "hasSmsPermission" -> {
                    val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
                    result.success(granted)
                }

                else -> result.notImplemented()
            }
        }

        Log.d(TAG, "Flutter engine configured with OTP sender channels")
    }

    companion object {
        private const val TAG = "OtpSenderMainActivity"
        private const val SMS_PERMISSION_CODE = 1001
        private const val NOTIFICATION_PERMISSION_CODE = 1002
    }
}
