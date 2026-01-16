# Time Clock Push Notifications - Implementation Prompt

## 📋 Feature Requirements

Implement a web push notification system for time clock reminders with the following specifications:

### Core Functionality
1. **Conditional Clock-In Reminder**
   - Time: 7:30 AM daily
   - Condition: Only send if user is NOT currently clocked in
   - Action: Notification with link to open main page

2. **Conditional Clock-Out Reminder**
   - Time: 4:00 PM daily
   - Condition: Only send if user IS currently clocked in (hasn't clocked out)
   - Action: Notification with link to open main page

3. **User Assumptions**
   - Users are already logged in
   - JWT token valid for 20 hours (already configured)
   - Notification simply opens the main page (user handles clock in/out there)

### Technical Requirements
- Use Web Push API (no third-party services)
- Works on both iPhone Safari and desktop browsers
- Notifications work even when browser is closed
- Store push subscriptions in MySQL database
- Use node-cron for scheduling

---

## 🗄️ Database Schema

### Create push_subscriptions table
```sql
CREATE TABLE push_subscriptions (
  subscription_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_endpoint (user_id, endpoint(255))
);
```

---

## 📦 Backend Implementation

### 1. Install Required Packages
```bash
cd /home/jon/Nexus/backend/web
npm install web-push node-cron
```

### 2. Generate VAPID Keys
Create `/home/jon/Nexus/backend/web/scripts/generateVapidKeys.js`:
```javascript
const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys Generated:');
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
console.log('\nAdd these to your .env file:');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
```

Run it and add keys to `.env`:
```bash
node scripts/generateVapidKeys.js
```

### 3. Update .env
Add to `/home/jon/Nexus/backend/web/.env`:
```
VAPID_PUBLIC_KEY=<generated_public_key>
VAPID_PRIVATE_KEY=<generated_private_key>
VAPID_EMAIL=mailto:fynine@gmail.com
```

### 4. Create Push Notification Service
Create `/home/jon/Nexus/backend/web/src/services/pushNotificationService.ts`:
```typescript
import webpush from 'web-push';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

// Configure web-push
webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushSubscription {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

export const sendPushNotification = async (
  userId: number,
  title: string,
  body: string,
  url: string = 'https://nexuswebapp.duckdns.org'
) => {
  try {
    // Get all subscriptions for this user
    const [subscriptions] = await pool.execute<RowDataPacket[]>(
      'SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );

    if (subscriptions.length === 0) {
      return { success: false, message: 'No subscriptions found' };
    }

    // Send to all user's subscriptions
    const promises = subscriptions.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth: sub.auth_key,
        },
      };

      const payload = JSON.stringify({
        title,
        body,
        url,
        icon: '/vite.svg',
        badge: '/vite.svg',
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        return { success: true };
      } catch (error: any) {
        // If subscription is invalid/expired, remove it
        if (error.statusCode === 410) {
          await pool.execute(
            'DELETE FROM push_subscriptions WHERE endpoint = ?',
            [sub.endpoint]
          );
        }
        return { success: false, error };
      }
    });

    await Promise.all(promises);
    return { success: true, message: 'Notifications sent' };
  } catch (error) {
    console.error('Push notification error:', error);
    throw error;
  }
};
```

### 5. Create Time Clock Notification Scheduler
Create `/home/jon/Nexus/backend/web/src/services/timeClockScheduler.ts`:
```typescript
import cron from 'node-cron';
import { pool } from '../config/database';
import { sendPushNotification } from './pushNotificationService';
import { RowDataPacket } from 'mysql2';

// Schedule clock-in reminder for 7:30 AM
export const scheduleClockInReminder = () => {
  // Run at 7:30 AM every day
  cron.schedule('30 7 * * *', async () => {
    console.log('🔔 Running clock-in reminder check...');

    try {
      // Find users who are NOT clocked in
      const [users] = await pool.execute<RowDataPacket[]>(`
        SELECT DISTINCT u.user_id, u.first_name
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM time_entries te
          WHERE te.user_id = u.user_id
            AND DATE(te.clock_in) = CURDATE()
            AND te.clock_out IS NULL
        )
        AND u.is_active = 1
      `);

      console.log(`Found ${users.length} users not clocked in`);

      // Send reminder to each user
      for (const user of users) {
        await sendPushNotification(
          user.user_id,
          '⏰ Time to Clock In!',
          `Good morning ${user.first_name}! Don't forget to clock in.`,
          'https://nexuswebapp.duckdns.org'
        );
      }

      console.log('✅ Clock-in reminders sent');
    } catch (error) {
      console.error('Error sending clock-in reminders:', error);
    }
  });
};

// Schedule clock-out reminder for 4:00 PM
export const scheduleClockOutReminder = () => {
  // Run at 4:00 PM every day
  cron.schedule('0 16 * * *', async () => {
    console.log('🔔 Running clock-out reminder check...');

    try {
      // Find users who ARE clocked in (haven't clocked out)
      const [users] = await pool.execute<RowDataPacket[]>(`
        SELECT u.user_id, u.first_name
        FROM users u
        INNER JOIN time_entries te ON u.user_id = te.user_id
        WHERE DATE(te.clock_in) = CURDATE()
          AND te.clock_out IS NULL
          AND u.is_active = 1
      `);

      console.log(`Found ${users.length} users still clocked in`);

      // Send reminder to each user
      for (const user of users) {
        await sendPushNotification(
          user.user_id,
          '⏰ Time to Clock Out!',
          `Hey ${user.first_name}! Don't forget to clock out for the day.`,
          'https://nexuswebapp.duckdns.org'
        );
      }

      console.log('✅ Clock-out reminders sent');
    } catch (error) {
      console.error('Error sending clock-out reminders:', error);
    }
  });
};

// Initialize all schedulers
export const initializeSchedulers = () => {
  console.log('📅 Initializing time clock schedulers...');
  scheduleClockInReminder();
  scheduleClockOutReminder();
  console.log('✅ Schedulers initialized');
  console.log('   - Clock-in reminder: 7:30 AM daily');
  console.log('   - Clock-out reminder: 4:00 PM daily');
};
```

### 6. Create Push Subscription Controller
Create `/home/jon/Nexus/backend/web/src/controllers/pushNotificationController.ts`:
```typescript
import { Request, Response } from 'express';
import { pool } from '../config/database';

export const subscribe = async (req: Request, res: Response) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = (req as any).user.user_id;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription data',
      });
    }

    // Insert or update subscription
    await pool.execute(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         p256dh_key = VALUES(p256dh_key),
         auth_key = VALUES(auth_key),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );

    res.json({
      success: true,
      message: 'Subscription saved',
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save subscription',
    });
  }
};

export const unsubscribe = async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    const userId = (req as any).user.user_id;

    await pool.execute(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      [userId, endpoint]
    );

    res.json({
      success: true,
      message: 'Subscription removed',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove subscription',
    });
  }
};

export const getVapidPublicKey = async (req: Request, res: Response) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY,
  });
};
```

### 7. Create Routes
Create `/home/jon/Nexus/backend/web/src/routes/pushNotificationRoutes.ts`:
```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as pushController from '../controllers/pushNotificationController';

const router = Router();

router.get('/vapid-public-key', pushController.getVapidPublicKey);
router.post('/subscribe', authenticateToken, pushController.subscribe);
router.post('/unsubscribe', authenticateToken, pushController.unsubscribe);

export default router;
```

### 8. Update server.ts
Add to `/home/jon/Nexus/backend/web/src/server.ts`:
```typescript
import pushNotificationRoutes from './routes/pushNotificationRoutes';
import { initializeSchedulers } from './services/timeClockScheduler';

// Add route (with other routes)
app.use('/api/push', pushNotificationRoutes);

// Initialize schedulers after server starts
initializeSchedulers();
```

---

## 🌐 Frontend Implementation

### 1. Create Service Worker
Create `/home/jon/Nexus/frontend/web/public/sw.js`:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    data: {
      url: data.url || '/',
    },
    requireInteraction: true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

### 2. Create Push Notification Hook
Create `/home/jon/Nexus/frontend/web/src/hooks/usePushNotifications.ts`:
```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  const subscribe = async () => {
    if (!isSupported) {
      alert('Push notifications are not supported in your browser');
      return;
    }

    try {
      setIsLoading(true);

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Please enable notifications to receive time clock reminders');
        return;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get VAPID public key
      const { data } = await apiClient.get('/push/vapid-public-key');
      const publicKey = data.publicKey;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to backend
      await apiClient.post('/push/subscribe', subscription.toJSON());

      setIsSubscribed(true);
      alert('✅ Push notifications enabled! You\'ll receive time clock reminders.');
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Failed to enable notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await apiClient.post('/push/unsubscribe', subscription.toJSON());
      }

      setIsSubscribed(false);
      alert('Push notifications disabled');
    } catch (error) {
      console.error('Unsubscribe error:', error);
      alert('Failed to disable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
};

// Helper function
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

### 3. Add Push Notification Toggle to Dashboard
Update `/home/jon/Nexus/frontend/web/src/components/dashboard/SimpleDashboard.tsx`:

Add import:
```typescript
import { usePushNotifications } from '../../hooks/usePushNotifications';
```

Add in component:
```typescript
const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
```

Add UI (in the dashboard, perhaps in the time management section):
```tsx
{isSupported && (
  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h4 className="font-semibold text-blue-900 mb-2">
      🔔 Time Clock Reminders
    </h4>
    <p className="text-sm text-blue-700 mb-3">
      Get reminded to clock in at 7:30 AM and clock out at 4:00 PM
    </p>
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading}
      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
        isSubscribed
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      } disabled:opacity-50`}
    >
      {isLoading ? 'Loading...' : isSubscribed ? 'Disable Reminders' : 'Enable Reminders'}
    </button>
  </div>
)}
```

---

## 🧪 Testing Instructions

### 1. Run Database Migration
```bash
mysql -u root -p sign_manufacturing < migration.sql
```

### 2. Generate and Configure VAPID Keys
```bash
cd /home/jon/Nexus/backend/web
node scripts/generateVapidKeys.js
# Copy output to .env
```

### 3. Install Dependencies and Restart
```bash
cd /home/jon/Nexus/backend/web
npm install web-push node-cron
/home/jon/Nexus/infrastructure/scripts/start-servers.sh
```

### 4. Test on Your Phone
1. Open `https://nexuswebapp.duckdns.org`
2. Login
3. Click "Enable Reminders" button
4. Allow notifications when prompted
5. Test:
   - Clock in before 7:30 AM → Should NOT get reminder at 7:30 AM
   - Don't clock in before 7:30 AM → Should get reminder at 7:30 AM
   - Clock out before 4:00 PM → Should NOT get reminder at 4:00 PM
   - Stay clocked in past 4:00 PM → Should get reminder at 4:00 PM

### 5. Manual Test (Optional)
Add a test endpoint in pushNotificationController.ts:
```typescript
export const testNotification = async (req: Request, res: Response) => {
  const userId = (req as any).user.user_id;
  await sendPushNotification(
    userId,
    'Test Notification',
    'This is a test!',
    'https://nexuswebapp.duckdns.org'
  );
  res.json({ success: true });
};
```

---

## ✅ Success Criteria

- [ ] Users can enable/disable push notifications from dashboard
- [ ] Clock-in reminder sent at 7:30 AM (only if not clocked in)
- [ ] Clock-out reminder sent at 4:00 PM (only if still clocked in)
- [ ] Clicking notification opens main page
- [ ] Works on iPhone Safari
- [ ] Works when browser is closed
- [ ] JWT tokens last 20 hours (already done ✅)

---

## 📝 Notes

- Notifications require HTTPS (already configured ✅)
- Users must grant permission first
- Service worker runs independently of the main app
- Push subscriptions persist in database
- Expired/invalid subscriptions auto-removed
- Scheduler uses server time (adjust cron schedule if needed for timezone)

---

## 🐛 Troubleshooting

**Notifications not appearing:**
- Check browser notification permissions
- Verify service worker registered: DevTools → Application → Service Workers
- Check backend logs for scheduler execution
- Verify VAPID keys in .env

**Wrong timing:**
- Adjust cron schedule for your timezone
- Currently set to server's local time

**Safari-specific:**
- Requires iOS 16.4+ / macOS Ventura+
- User must add site to home screen on older iOS versions
