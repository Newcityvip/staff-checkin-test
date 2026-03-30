SRI LANKA TIMEZONE SETUP

IMPORTANT:
This Code.gs does NOT hardcode timezone.
It reads timezone from the SETTINGS sheet.

TO USE SRI LANKA TIME:
Open SETTINGS tab in your Google Sheet.
Find the row where:
setting_key = TIMEZONE

Change setting_value to:
Asia/Colombo

Example:
TIMEZONE | Asia/Colombo

Then:
1) Save Code.gs
2) Deploy > Manage deployments > Edit current web app > New version > Deploy
3) Open:
https://staff-portal-proxy.mdrobiulislam.workers.dev?action=health

You should then see:
"timezone": "Asia/Colombo"
