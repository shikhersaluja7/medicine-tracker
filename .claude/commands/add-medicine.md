Interactively add a new medicine to the database for the currently logged-in user.

Ask me for:
1. Medicine name (e.g., "Lisinopril")
2. Dosage (e.g., "10mg")
3. Instructions (e.g., "Take with food in the morning")
4. Prescribing doctor name (e.g., "Dr. Smith")
5. Current quantity on hand (e.g., 30)
6. Unit (e.g., "tablet", "ml", "capsule")
7. Low-stock threshold — warn me when stock drops below this number (e.g., 7)
8. Schedule frequency: daily | twice_daily | weekly | as_needed
9. Time(s) of day in HH:MM format (e.g., ["08:00"] or ["08:00", "20:00"])
10. Days of week if weekly (e.g., ["mon", "wed", "fri"]) — skip if daily

Then:
- Write the SQL INSERT calls using the service functions in src/services/
- Show me the resulting database row in a formatted table
- Confirm the notification will be scheduled for the next due time
