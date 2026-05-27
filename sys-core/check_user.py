import os
import sys
import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "django_project"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core_settings.settings")
django.setup()

from plan_app.models import User, Role

emails = ["superadmin@didactico.edu", "gestion@didactico.edu", "coordinador@didactico.edu", "docente@didactico.edu"]
for email in emails:
    u = User.objects.filter(email=email).first()
    if u:
        if not u.roles.exists():
            role_name = "ADMIN_GESTION" if "gestion" in email else "COORDINADOR" if "coordinador" in email else "DOCENTE" if "docente" in email else "SUPER_ADMIN"
            print(f"Assigning {role_name} role to {email}...")
            u.roles.add(Role.objects.get(name=role_name))
        u.set_password(email.split('@')[0] + "123" if "superadmin" in email or "gestion" in email or "docente" in email else "coord2024")
        u.save()
        print(f"Password reset for {email}")
        print(f"Roles: {[r.name for r in u.roles.all()]}")
    else:
        print(f"User {email} NOT found")
