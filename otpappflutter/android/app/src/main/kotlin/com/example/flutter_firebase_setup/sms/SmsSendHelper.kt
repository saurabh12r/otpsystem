package com.example.flutter_firebase_setup.sms

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.example.flutter_firebase_setup.receivers.SmsSendResultReceiver

object SmsSendHelper {
    private const val TAG = "SmsSendHelper"

    /**
     * Sends SMS from a specific SIM (matched by phone number) with delivery callback.
     * @param senderPhone the phone number this device logged in with — SMS will be sent from the SIM matching this number.
     */
    fun sendSmsWithCallback(
        context: Context,
        destinationAddress: String,
        message: String,
        requestId: String,
        senderPhone: String? = null
    ) {
        val appCtx = context.applicationContext

        // Check permission first
        if (ContextCompat.checkSelfPermission(appCtx, Manifest.permission.SEND_SMS)
            != PackageManager.PERMISSION_GRANTED) {
            throw SecurityException("SEND_SMS permission not granted")
        }

        val smsManager = resolveSmsManager(appCtx, senderPhone)

        val requestCode = (destinationAddress.hashCode() xor System.nanoTime().toInt()) and 0x7fff
        val sentIntent = PendingIntent.getBroadcast(
            appCtx,
            requestCode,
            Intent(appCtx, SmsSendResultReceiver::class.java).apply {
                putExtra(SmsSendResultReceiver.EXTRA_PHONE, destinationAddress)
                putExtra(SmsSendResultReceiver.EXTRA_REQUEST_ID, requestId)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val parts = smsManager.divideMessage(message)

        if (parts.size == 1) {
            Log.d(TAG, "Sending SMS to $destinationAddress from ${senderPhone ?: "default SIM"}")
            smsManager.sendTextMessage(destinationAddress, null, message, sentIntent, null)
        } else {
            Log.d(TAG, "Sending ${parts.size}-part SMS to $destinationAddress")
            val sentIntents = ArrayList<PendingIntent?>(parts.size)
            val deliveryIntents = ArrayList<PendingIntent?>(parts.size)
            for (i in 0 until parts.size) {
                sentIntents.add(if (i == parts.size - 1) sentIntent else null)
                deliveryIntents.add(null)
            }
            smsManager.sendMultipartTextMessage(destinationAddress, null, parts, sentIntents, deliveryIntents)
        }
        Log.i(TAG, "SMS dispatched to $destinationAddress (requestId=$requestId)")
    }

    /**
     * Finds the SIM subscription matching the sender phone number,
     * then returns the SmsManager for that specific SIM.
     * Falls back to default if no match found.
     */
    private fun resolveSmsManager(context: Context, senderPhone: String?): SmsManager {
        // Try to find the specific SIM subscription for the sender phone number
        if (senderPhone != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            val subscriptionId = findSubscriptionForPhone(context, senderPhone)
            if (subscriptionId != null) {
                Log.d(TAG, "Using SIM subscription $subscriptionId for $senderPhone")
                return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    context.getSystemService(SmsManager::class.java)
                        ?.createForSubscriptionId(subscriptionId)
                        ?: getSmsManagerForSub(subscriptionId)
                } else {
                    getSmsManagerForSub(subscriptionId)
                }
            }
            Log.w(TAG, "No SIM subscription found for $senderPhone, using default")
        }

        // Fallback to default
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java) ?: getDefaultSmsManager()
        } else {
            getDefaultSmsManager()
        }
    }

    /**
     * Finds the subscription ID for a specific phone number by matching
     * against all active SIM cards on the device.
     */
    private fun findSubscriptionForPhone(context: Context, phone: String): Int? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return null

        // Need READ_PHONE_STATE permission to list subscriptions
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
            != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "READ_PHONE_STATE not granted, can't match SIM by number")
            return null
        }

        try {
            val sm = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                ?: return null
            val subs: List<SubscriptionInfo> = sm.activeSubscriptionInfoList ?: return null

            // Normalize the phone to last 10 digits for comparison
            val phoneSuffix = phone.replace(Regex("[^0-9]"), "").takeLast(10)

            for (sub in subs) {
                val subNumber = sub.number?.replace(Regex("[^0-9]"), "")?.takeLast(10) ?: ""
                Log.d(TAG, "SIM slot ${sub.simSlotIndex}: number=$subNumber, subId=${sub.subscriptionId}")
                if (subNumber.isNotEmpty() && subNumber == phoneSuffix) {
                    Log.i(TAG, "Matched SIM slot ${sub.simSlotIndex} for phone $phone (subId=${sub.subscriptionId})")
                    return sub.subscriptionId
                }
            }

            // If no number match (some carriers don't expose number), try slot 0 as first SIM
            Log.w(TAG, "No SIM number match for $phone. Active SIMs: ${subs.size}")
        } catch (e: Exception) {
            Log.e(TAG, "Error finding subscription for $phone", e)
        }
        return null
    }

    @Suppress("DEPRECATION")
    private fun getSmsManagerForSub(subId: Int): SmsManager {
        return SmsManager.getSmsManagerForSubscriptionId(subId)
    }

    @Suppress("DEPRECATION")
    private fun getDefaultSmsManager(): SmsManager {
        return SmsManager.getDefault()
    }
}
