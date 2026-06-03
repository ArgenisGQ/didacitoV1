import os
from cryptography.fernet import Fernet
from django.conf import settings

def get_cipher():
    # En producción esto debe venir de una variable de entorno segura y no rotar.
    # Usamos parte del SECRET_KEY de Django (primeros 32 bytes o re-hasheado) si no hay variable dedicada.
    import base64
    from hashlib import sha256
    
    encryption_key = os.environ.get('ENCRYPTION_KEY')
    if not encryption_key:
        # Generar una clave de 32 bytes determinista a partir del SECRET_KEY
        key_bytes = settings.SECRET_KEY.encode('utf-8')
        encryption_key = base64.urlsafe_b64encode(sha256(key_bytes).digest())
        
    return Fernet(encryption_key)

def encrypt_value(value: str) -> str:
    if not value:
        return value
    cipher = get_cipher()
    return cipher.encrypt(value.encode('utf-8')).decode('utf-8')

def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return encrypted_value
    cipher = get_cipher()
    try:
        return cipher.decrypt(encrypted_value.encode('utf-8')).decode('utf-8')
    except Exception:
        return ""
