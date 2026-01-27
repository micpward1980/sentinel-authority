"""Background tasks for monitoring"""
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

async def check_offline_agents_task(get_db_func):
    """Background task to check for offline agents every 5 minutes"""
    from app.models.models import EnveloSession, APIKey, User, Certificate
    from app.services.email_service import notify_agent_offline, notify_admin_agent_offline
    
    while True:
        try:
            await asyncio.sleep(300)  # Wait 5 minutes
            
            async for db in get_db_func():
                try:
                    now = datetime.utcnow()
                    
                    # Get active sessions
                    result = await db.execute(
                        select(EnveloSession).where(EnveloSession.status == "active")
                    )
                    sessions = result.scalars().all()
                    
                    for session in sessions:
                        last_activity = session.last_heartbeat_at or session.last_telemetry_at
                        if not last_activity:
                            continue
                        
                        minutes_offline = int((now - last_activity).total_seconds() / 60)
                        
                        # Only alert if offline >5 min and haven't alerted recently
                        last_offline_alert = getattr(session, 'last_offline_alert_at', None)
                        already_alerted = last_offline_alert and (now - last_offline_alert).total_seconds() < 3600
                        
                        if minutes_offline >= 5 and not already_alerted:
                            # Get user info
                            api_key_result = await db.execute(
                                select(APIKey).where(APIKey.id == session.api_key_id)
                            )
                            api_key = api_key_result.scalar_one_or_none()
                            
                            if api_key:
                                user_result = await db.execute(
                                    select(User).where(User.id == api_key.user_id)
                                )
                                user = user_result.scalar_one_or_none()
                                
                                if user:
                                    cert_result = await db.execute(
                                        select(Certificate).where(Certificate.id == session.certificate_id)
                                    )
                                    cert = cert_result.scalar_one_or_none()
                                    
                                    system_name = cert.system_name if cert else "Unknown System"
                                    org_name = cert.organization_name if cert else user.organization or "Unknown"
                                    
                                    try:
                                        await notify_agent_offline(
                                            user.email, system_name, session.session_id, org_name, minutes_offline
                                        )
                                        await notify_admin_agent_offline(
                                            system_name, org_name, session.session_id, minutes_offline, user.email
                                        )
                                        print(f"[MONITOR] Sent offline alert for {org_name} - {system_name}")
                                    except Exception as e:
                                        print(f"[MONITOR] Failed to send offline alert: {e}")
                    
                    await db.commit()
                except Exception as e:
                    print(f"[MONITOR] Error in offline check: {e}")
                finally:
                    await db.close()
                break  # Only need one db session
                    
        except Exception as e:
            print(f"[MONITOR] Background task error: {e}")
            await asyncio.sleep(60)  # Wait a minute before retrying
