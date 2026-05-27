import os
import sys

# Bootstrap Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core_settings.settings")
import django
django.setup()

from django.contrib.auth.hashers import check_password
from plan_app.models import User

u = User.objects.filter(email="superadmin@didactico.edu").first()
if u:
    print(f"Hash in DB: {u.password}")
    print(f"Check password result: {check_password('superadmin123', u.password)}")
else:
    print("User not found")
