import asyncio
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update
from api.core.settings_manager import SettingsManager
from api.models import User, UserRole, RefreshToken
from api.database import get_task_db
from api.routers.admin import log_audit_background

logger = logging.getLogger(__name__)

async def run_daily_inactivity_cleanup():
    """Background task that runs periodically to automatically deactivate inactive accounts"""
    logger.info("Starting daily inactivity scheduler loop...")
    while True:
        try:
            # Sleep first or run immediately?
            # Running immediately on startup ensures any pending cleanups are handled right away.
            async with get_task_db() as db:
                # Reload settings inside loop to get fresh DB updates
                await SettingsManager.initialize(db)
                
                auto_deactivate = SettingsManager.get_setting_as_bool("AUTO_DEACTIVATE_INACTIVE_ACCOUNTS", False)
                threshold_days = SettingsManager.get_setting_as_int("INACTIVE_ACCOUNT_THRESHOLD_DAYS", 90)
                
                if auto_deactivate:
                    logger.info(f"Checking for users inactive for more than {threshold_days} days...")
                    limit_date = datetime.now(timezone.utc) - timedelta(days=threshold_days)
                    
                    query = select(User).where(
                        User.is_active == True,
                        User.role != UserRole.SUPER_ADMIN,
                        (User.last_login < limit_date) | ((User.last_login == None) & (User.date_joined < limit_date))
                    )
                    res = await db.execute(query)
                    inactive_users = res.scalars().all()
                    
                    for user in inactive_users:
                        logger.info(f"Deactivating user {user.email} due to prolonged inactivity...")
                        user.is_active = False
                        user.deactivated_at = datetime.now(timezone.utc)
                        user.deactivation_reason = f"Inactividad prolongada ({threshold_days} días)"
                        db.add(user)
                        
                        # Revoke tokens
                        await db.execute(
                            update(RefreshToken)
                            .where(RefreshToken.user_id == user.id)
                            .values(is_revoked=True)
                        )
                        
                        # Email simulation
                        print("\n" + "="*80)
                        print(" [EMAIL SIMULATION] CUENTA SUSPENDIDA POR INACTIVIDAD (AUTOMÁTICO)")
                        print(f" Para el usuario: {user.email}")
                        print(f" Motivo: Inactividad prolongada de {threshold_days} días.")
                        print("="*80 + "\n")
                        
                        # Log audit
                        await log_audit_background(
                            user_id=None,  # Performed by system
                            action="USER_DEACTIVATED",
                            ip_address="127.0.0.1",
                            user_agent="system-scheduler",
                            details={"deactivated_user_id": user.id, "deactivated_user_email": user.email, "type": "auto_inactivity"}
                        )
                        
                    if inactive_users:
                        await db.commit()
                        logger.info(f"Successfully deactivated {len(inactive_users)} inactive users.")
                    else:
                        logger.info("No inactive users found for automatic deactivation.")
                else:
                    logger.info("Automatic deactivation of inactive accounts is disabled.")
        except Exception as e:
            logger.error(f"Error in inactivity cleanup task: {e}")
            
        # Sleep for 24 hours
        await asyncio.sleep(24 * 3600)
