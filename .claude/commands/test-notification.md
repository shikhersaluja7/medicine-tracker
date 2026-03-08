Trigger a test local notification immediately so I can verify push notifications
are working on my phone.

Steps:
1. Check that expo-notifications permission has been granted
   - If not granted, explain how to grant it and stop
2. Schedule a notification to fire in 5 seconds using expo-notifications
3. Show me the exact notification payload that will be sent:
   {
     title: "Test Notification",
     body: "Medicine Tracker notifications are working!",
     data: { type: "test" }
   }
4. Tell me exactly what I should see on my phone within 5 seconds
5. If I'm running in Expo Go, remind me that notifications only work on
   a real device (not in a simulator)
