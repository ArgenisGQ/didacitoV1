from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from api.models import SystemSetting
import logging

logger = logging.getLogger(__name__)

class SettingsManager:
    _instance = None
    _settings = {}
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(SettingsManager, cls).__new__(cls, *args, **kwargs)
        return cls._instance

    @classmethod
    async def initialize(cls, db: AsyncSession = None):
        """Load all system settings from the database into memory."""
        if cls._initialized and not db:
            return
        
        logger.info("Initializing SettingsManager...")
        if db is not None:
            await cls._load_from_db(db)
        else:
            from api.database import get_task_db
            async with get_task_db() as session:
                await cls._load_from_db(session)
        cls._initialized = True

    @classmethod
    async def _load_from_db(cls, db: AsyncSession):
        try:
            result = await db.execute(select(SystemSetting))
            settings_list = result.scalars().all()
            cls._settings = {setting.key: setting.value for setting in settings_list}
            logger.info(f"Loaded {len(cls._settings)} settings into cache.")
        except Exception as e:
            logger.error(f"Error loading system settings: {e}")

    @classmethod
    def get_cached_setting(cls, key: str, default: str = None) -> str:
        """Retrieve a setting value from memory. Fallbacks to default."""
        return cls._settings.get(key, default)

    @classmethod
    def get_setting_as_bool(cls, key: str, default: bool = False) -> bool:
        val = cls.get_cached_setting(key)
        if val is None:
            return default
        return str(val).lower() in ("true", "1", "yes", "on")

    @classmethod
    def get_setting_as_int(cls, key: str, default: int = 0) -> int:
        val = cls.get_cached_setting(key)
        if val is None:
            return default
        try:
            return int(val)
        except ValueError:
            return default

    @classmethod
    def get_setting_as_list(cls, key: str, default: list = None) -> list:
        val = cls.get_cached_setting(key)
        if val is None:
            return default or []
        return [item.strip() for item in str(val).split(",") if item.strip()]

    @classmethod
    async def reload(cls, db: AsyncSession):
        """Invalidate cache and reload from database."""
        logger.info("Reloading system settings cache...")
        await cls._load_from_db(db)
