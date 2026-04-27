package com.example.flutter_firebase_setup.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.example.flutter_firebase_setup.services.OtpSenderForegroundService

/**
 * Restarts the OTP sender foreground service after device reboot.
 * Reads saved config from SharedPreferences — no Dart VM needed.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        try {
            if (intent?.action != Intent.ACTION_BOOT_COMPLETED &&
                intent?.action != "android.intent.action.QUICKBOOT_POWERON"
            ) {
                return
            }

            val prefs = context.applicationContext.getSharedPreferences(
                OtpSenderForegroundService.PREFS_NAME, Context.MODE_PRIVATE
            )
            val serviceEnabled = prefs.getBoolean("service_enabled", false)
            val businessId = prefs.getString("business_id", "") ?: ""
            val simId = prefs.getString("sim_id", "") ?: ""
            val senderPhone = prefs.getString("sender_phone", "") ?: ""

            if (serviceEnabled && businessId.isNotEmpty() && simId.isNotEmpty()) {
                Log.d(TAG, "Boot completed, restarting OTP sender service")
                OtpSenderForegroundService.start(context, businessId, simId, senderPhone)
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Boot receiver failed", t)
        }
    }

    companion object {
        private const val TAG = "OtpBootReceiver"
    }
}
