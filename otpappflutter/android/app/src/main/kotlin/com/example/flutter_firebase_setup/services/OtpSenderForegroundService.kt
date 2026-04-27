package com.example.flutter_firebase_setup.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.flutter_firebase_setup.MainActivity
import com.example.flutter_firebase_setup.R
import com.example.flutter_firebase_setup.sms.SmsSendHelper
import com.google.firebase.FirebaseApp
import com.google.firebase.database.*

/**
 * Native foreground service that:
 * 1. Listens to Firebase RTDB for pending OTP requests (survives app kill)
 * 2. Sends SMS via SmsManager when a request arrives
 * 3. Updates RTDB status after sending
 * 4. Writes heartbeat every 60 seconds
 *
 * This runs entirely in native Android — no Dart VM needed.
 */
class OtpSenderForegroundService : Service() {

    private var businessId: String = ""
    private var simId: String = ""
    private var senderPhone: String = "" // the phone number this SIM logged in with
    private var database: FirebaseDatabase? = null
    private var otpRequestsRef: DatabaseReference? = null
    private var childAddedListener: ChildEventListener? = null
    private var childChangedListener: ChildEventListener? = null
    private val handler = Handler(Looper.getMainLooper())
    private var heartbeatRunnable: Runnable? = null
    private var smsSentToday = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return try {
            // Read config from SharedPreferences
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            businessId = intent?.getStringExtra("business_id") ?: prefs.getString("business_id", "") ?: ""
            simId = intent?.getStringExtra("sim_id") ?: prefs.getString("sim_id", "") ?: ""
            senderPhone = intent?.getStringExtra("sender_phone") ?: prefs.getString("sender_phone", "") ?: ""

            // Save config for restart after kill
            if (businessId.isNotEmpty() && simId.isNotEmpty()) {
                prefs.edit()
                    .putString("business_id", businessId)
                    .putString("sim_id", simId)
                    .putString("sender_phone", senderPhone)
                    .putBoolean("service_enabled", true)
                    .apply()
            }

            if (businessId.isEmpty() || simId.isEmpty()) {
                Log.e(TAG, "Missing business_id or sim_id, stopping service")
                stopSelf(startId)
                return START_NOT_STICKY
            }

            startForeground(NOTIFICATION_ID, buildNotification("Starting..."))
            initFirebaseAndListen()

            START_STICKY // Auto-restart if killed
        } catch (t: Throwable) {
            Log.e(TAG, "onStartCommand failed", t)
            stopSelf(startId)
            START_NOT_STICKY
        }
    }

    private fun initFirebaseAndListen() {
        try {
            // Ensure Firebase is initialized
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this)
            }
            database = FirebaseDatabase.getInstance()

            // Stop any existing listeners
            removeListeners()

            // Start RTDB listener
            startOtpListener()

            // Start heartbeat
            startHeartbeat()

            updateNotification("Listening for OTP requests...")
            Log.i(TAG, "Service started: business=$businessId sim=$simId")
        } catch (e: Exception) {
            Log.e(TAG, "Firebase init failed", e)
            updateNotification("Error: Firebase init failed")
        }
    }

    private fun startOtpListener() {
        val ref = database?.getReference("otp_requests/$businessId") ?: return
        otpRequestsRef = ref

        // Listen for NEW requests
        childAddedListener = object : ChildEventListener {
            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {
                handleRequest(snapshot)
            }
            override fun onChildChanged(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onChildRemoved(snapshot: DataSnapshot) {}
            override fun onChildMoved(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onCancelled(error: DatabaseError) {
                Log.e(TAG, "RTDB listener cancelled: ${error.message}")
            }
        }

        // Listen for CHANGED requests (retries from backend set status back to pending)
        childChangedListener = object : ChildEventListener {
            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onChildChanged(snapshot: DataSnapshot, previousChildName: String?) {
                handleRequest(snapshot)
            }
            override fun onChildRemoved(snapshot: DataSnapshot) {}
            override fun onChildMoved(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onCancelled(error: DatabaseError) {
                Log.e(TAG, "RTDB retry listener cancelled: ${error.message}")
            }
        }

        ref.addChildEventListener(childAddedListener!!)
        ref.addChildEventListener(childChangedListener!!)
        Log.i(TAG, "RTDB listeners attached for business=$businessId")
    }

    private fun handleRequest(snapshot: DataSnapshot) {
        try {
            val status = snapshot.child("status").getValue(String::class.java) ?: return
            val targetSimId = snapshot.child("target_sim_id").getValue(String::class.java) ?: return

            // Only process pending requests targeted at this SIM
            if (status != "pending" || targetSimId != simId) return

            val requestKey = snapshot.key ?: return
            val recipient = snapshot.child("recipient").getValue(String::class.java) ?: return
            val message = snapshot.child("message").getValue(String::class.java) ?: return

            Log.i(TAG, "Processing OTP request: $requestKey for $recipient")

            // Claim the request via transaction
            val requestRef = snapshot.ref
            requestRef.runTransaction(object : Transaction.Handler {
                override fun doTransaction(currentData: MutableData): Transaction.Result {
                    val currentStatus = currentData.child("status").getValue(String::class.java)
                    if (currentStatus != "pending") return Transaction.abort()

                    currentData.child("status").value = "picked"
                    currentData.child("picked_by").value = simId
                    currentData.child("picked_at").value = ServerValue.TIMESTAMP
                    return Transaction.success(currentData)
                }

                override fun onComplete(error: DatabaseError?, committed: Boolean, currentData: DataSnapshot?) {
                    if (!committed) {
                        Log.d(TAG, "Request $requestKey already claimed")
                        return
                    }
                    // Send SMS
                    sendSmsForRequest(requestRef, requestKey, recipient, message)
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "handleRequest error", e)
        }
    }

    private fun sendSmsForRequest(requestRef: DatabaseReference, requestKey: String, recipient: String, message: String) {
        try {
            SmsSendHelper.sendSmsWithCallback(applicationContext, recipient, message, requestKey, senderPhone)

            // Poll for SMS result (check SharedPrefs set by SmsSendResultReceiver)
            val resultPrefs = getSharedPreferences("sms_send_results", Context.MODE_PRIVATE)
            val pollRunnable = object : Runnable {
                var attempts = 0
                override fun run() {
                    attempts++
                    val key = "result_${requestKey}_success"
                    if (resultPrefs.contains(key)) {
                        val success = resultPrefs.getBoolean(key, false)
                        // Clean up result
                        resultPrefs.edit()
                            .remove("result_${requestKey}_success")
                            .remove("result_${requestKey}_code")
                            .remove("result_${requestKey}_phone")
                            .remove("result_${requestKey}_time")
                            .apply()

                        if (success) {
                            requestRef.child("status").setValue("sent")
                            requestRef.child("sent_at").setValue(ServerValue.TIMESTAMP)
                            smsSentToday++
                            updateNotification("Active | $smsSentToday SMS sent today")
                            Log.i(TAG, "SMS sent to $recipient")
                        } else {
                            requestRef.child("status").setValue("failed")
                            requestRef.child("failure_reason").setValue("SMS send failed")
                            Log.w(TAG, "SMS failed for $recipient")
                        }
                    } else if (attempts < 20) {
                        // Poll again in 500ms (max 10 seconds)
                        handler.postDelayed(this, 500)
                    } else {
                        // Timeout — mark as sent optimistically (carrier accepted but no callback)
                        requestRef.child("status").setValue("sent")
                        requestRef.child("sent_at").setValue(ServerValue.TIMESTAMP)
                        smsSentToday++
                        updateNotification("Active | $smsSentToday SMS sent today")
                        Log.w(TAG, "SMS result timeout for $recipient, marked as sent")
                    }
                }
            }
            handler.postDelayed(pollRunnable, 500)
        } catch (e: Exception) {
            Log.e(TAG, "sendSms failed for $recipient", e)
            requestRef.child("status").setValue("failed")
            requestRef.child("failure_reason").setValue(e.message ?: "SMS exception")
        }
    }

    private fun startHeartbeat() {
        heartbeatRunnable?.let { handler.removeCallbacks(it) }

        heartbeatRunnable = object : Runnable {
            override fun run() {
                try {
                    val ref = database?.getReference("device_status/$businessId/$simId")
                    ref?.setValue(mapOf(
                        "online" to true,
                        "last_heartbeat" to ServerValue.TIMESTAMP,
                        "sim_status" to "ready"
                    ))
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat error", e)
                }
                handler.postDelayed(this, 60_000) // Every 60 seconds
            }
        }
        handler.post(heartbeatRunnable!!) // Run immediately, then every 60s
    }

    private fun writeOffline() {
        try {
            val ref = database?.getReference("device_status/$businessId/$simId")
            ref?.updateChildren(mapOf(
                "online" to false,
                "last_heartbeat" to ServerValue.TIMESTAMP
            ))
        } catch (e: Exception) {
            Log.e(TAG, "writeOffline error", e)
        }
    }

    private fun removeListeners() {
        childAddedListener?.let { otpRequestsRef?.removeEventListener(it) }
        childChangedListener?.let { otpRequestsRef?.removeEventListener(it) }
        childAddedListener = null
        childChangedListener = null
        heartbeatRunnable?.let { handler.removeCallbacks(it) }
    }

    override fun onDestroy() {
        Log.i(TAG, "Service being destroyed")
        removeListeners()
        writeOffline()
        super.onDestroy()
    }

    // ─── Notification helpers ─────────────────

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        val ch = NotificationChannel(
            CHANNEL_ID, "OTP Sender Service", NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps OTP sender running in background"
            setShowBadge(false)
        }
        mgr.createNotificationChannel(ch)
    }

    private fun buildNotification(text: String): Notification {
        val launch = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("OTP Sender")
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(launch)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        mgr.notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        private const val TAG = "OtpSenderFgs"
        const val NOTIFICATION_ID = 72001
        const val CHANNEL_ID = "otp_sender_fgs"
        const val PREFS_NAME = "otp_sender_config"

        fun start(context: Context, businessId: String? = null, simId: String? = null, senderPhone: String? = null) {
            val app = context.applicationContext
            val i = Intent(app, OtpSenderForegroundService::class.java).apply {
                businessId?.let { putExtra("business_id", it) }
                simId?.let { putExtra("sim_id", it) }
                senderPhone?.let { putExtra("sender_phone", it) }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                app.startForegroundService(i)
            } else {
                @Suppress("DEPRECATION")
                app.startService(i)
            }
        }

        fun stop(context: Context) {
            val app = context.applicationContext
            val prefs = app.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean("service_enabled", false).apply()
            app.stopService(Intent(app, OtpSenderForegroundService::class.java))
        }
    }
}
