package com.example.flutter_firebase_setup.receivers

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives SMS send result from SmsManager PendingIntent.
 * Stores the result in SharedPreferences so the Dart layer can read it.
 */
class SmsSendResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            val requestId = intent.getStringExtra(EXTRA_REQUEST_ID) ?: return
            val phone = intent.getStringExtra(EXTRA_PHONE) ?: ""
            val success = resultCode == Activity.RESULT_OK

            Log.d(TAG, "SMS result: requestId=$requestId phone=$phone success=$success resultCode=$resultCode")

            // Store result in SharedPreferences for Dart to read
            val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean("result_${requestId}_success", success)
                .putInt("result_${requestId}_code", resultCode)
                .putString("result_${requestId}_phone", phone)
                .putLong("result_${requestId}_time", System.currentTimeMillis())
                .apply()

        } catch (t: Throwable) {
            Log.e(TAG, "onReceive failed", t)
        }
    }

    companion object {
        const val EXTRA_PHONE = "extra_phone"
        const val EXTRA_REQUEST_ID = "extra_request_id"
        const val PREFS_NAME = "sms_send_results"
        private const val TAG = "OtpSmsSendResult"
    }
}
