from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.db.session import get_db
from app.services.analytics_service import analytics_service
from app.services.ai_service import ai_service
from app.schemas.schemas import DashboardStatsResponse
from app.models.models import Campaign, CampaignAnalytics, Communication, CommunicationEvent, EventTypeEnum, CampaignStatusEnum
from sqlalchemy import func, text

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard(db: Session = Depends(get_db)):
    return analytics_service.get_dashboard_stats(db)


@router.post("/seed")
def seed_data(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Seed demo data for deployment. Run once after fresh deploy."""
    from scripts.seed import seed
    from scripts.seed_campaigns import seed_campaigns
    try:
        seed()
        seed_campaigns()
        return {"status": "success", "message": "Demo data seeded"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/insights")
def get_insights(db: Session = Depends(get_db)):
    """AI-generated insights from current analytics state."""
    stats = analytics_service.get_dashboard_stats(db)
    insights = ai_service.generate_insights(stats)
    return {"insights": insights, "generated_from": {
        "total_customers": stats["total_customers"],
        "total_campaigns": stats["total_campaigns"],
        "avg_open_rate": stats["avg_open_rate"],
    }}


@router.get("/campaigns")
def get_analytics_campaigns(db: Session = Depends(get_db)):
    """Get all campaigns with their analytics for the analytics page."""
    rows = db.execute(text("""
        SELECT c.id, c.name, c.channel, c.status, c.started_at, c.completed_at,
               ca.total_sent, ca.total_delivered, ca.total_opened, ca.total_clicked,
               ca.total_converted, ca.total_revenue, ca.delivery_rate, ca.open_rate,
               ca.click_rate, ca.conversion_rate
        FROM campaigns c
        LEFT JOIN campaign_analytics ca ON ca.campaign_id = c.id
        WHERE c.status = 'COMPLETED'
        ORDER BY c.started_at DESC
    """)).fetchall()
    
    result = []
    for r in rows:
        result.append({
            "id": r[0], "name": r[1], "channel": r[2], "status": r[3],
            "started_at": r[4], "completed_at": r[5],
            "sent": r[6] or 0, "delivered": r[7] or 0, "opened": r[8] or 0,
            "clicked": r[9] or 0, "converted": r[10] or 0, "revenue": float(r[11] or 0),
            "delivery_rate": float(r[12] or 0), "open_rate": float(r[13] or 0),
            "click_rate": float(r[14] or 0), "conversion_rate": float(r[15] or 0),
        })
    return result


@router.get("/channels")
def get_channel_analytics(db: Session = Depends(get_db)):
    """Get aggregated channel performance metrics."""
    rows = db.execute(text("""
        SELECT c.channel,
               SUM(ca.total_sent) as sent,
               SUM(ca.total_delivered) as delivered,
               SUM(ca.total_opened) as opened,
               SUM(ca.total_clicked) as clicked,
               SUM(ca.total_converted) as converted,
               SUM(ca.total_revenue) as revenue,
               AVG(ca.delivery_rate) as avg_delivery,
               AVG(ca.open_rate) as avg_open,
               AVG(ca.click_rate) as avg_click
        FROM campaigns c
        JOIN campaign_analytics ca ON ca.campaign_id = c.id
        WHERE c.status = 'COMPLETED' AND ca.total_sent > 0
        GROUP BY c.channel
    """)).fetchall()
    
    result = []
    for r in rows:
        sent = r[1] or 0
        delivered = r[2] or 0
        opened = r[3] or 0
        clicked = r[4] or 0
        result.append({
            "channel": r[0],
            "sent": int(sent),
            "delivered": int(delivered),
            "opened": int(opened),
            "clicked": int(clicked),
            "converted": int(r[5] or 0),
            "revenue": float(r[6] or 0),
            "delivery_rate": round(float(r[7] or 0) * 100, 1),
            "open_rate": round((opened / delivered * 100) if delivered else 0, 1),
            "click_rate": round((clicked / delivered * 100) if delivered else 0, 1),
        })
    return result


@router.get("/activity")
def get_recent_activity(db: Session = Depends(get_db)):
    """Get recent activity feed for the dashboard."""
    # Recent campaigns
    campaigns = db.execute(text("""
        SELECT c.name, c.status, c.started_at, c.completed_at,
               ca.total_sent, ca.total_clicked
        FROM campaigns c
        LEFT JOIN campaign_analytics ca ON ca.campaign_id = c.id
        WHERE c.status IN ('COMPLETED', 'RUNNING')
        ORDER BY GREATEST(c.started_at, c.completed_at) DESC NULLS LAST
        LIMIT 5
    """)).fetchall()
    
    # Recent customers
    recent_customers = db.execute(text("""
        SELECT name, created_at
        FROM customers
        ORDER BY created_at DESC
        LIMIT 3
    """)).fetchall()
    
    # Recent conversions
    conversions = db.execute(text("""
        SELECT ce.event_time, ce.metadata, c.name as campaign_name
        FROM communication_events ce
        JOIN communications comm ON comm.id = ce.communication_id
        JOIN campaigns c ON c.id = comm.campaign_id
        WHERE ce.event_type = 'CONVERTED'
        ORDER BY ce.event_time DESC
        LIMIT 3
    """)).fetchall()
    
    activities = []
    
    for camp in campaigns:
        if camp[3]:  # completed_at
            activities.append({
                "type": "campaign_complete",
                "text": f'{camp[0]} campaign completed — {camp[4] or 0} reached, {camp[5] or 0} clicked',
                "time": camp[3].isoformat() if camp[3] else None,
            })
        elif camp[2]:  # started_at
            activities.append({
                "type": "campaign_start",
                "text": f'{camp[0]} campaign launched',
                "time": camp[2].isoformat() if camp[2] else None,
            })
    
    for cust in recent_customers:
        activities.append({
            "type": "new_customer",
            "text": f'{cust[0]} registered as a new customer',
            "time": cust[1].isoformat() if cust[1] else None,
        })
    
    for conv in conversions:
        order_value = (conv[1] or {}).get("order_value", 0) if conv[1] else 0
        activities.append({
            "type": "conversion",
            "text": f'₹{order_value:,.0f} revenue from {conv[2]} campaign',
            "time": conv[0].isoformat() if conv[0] else None,
        })
    
    # Sort by time descending
    activities.sort(key=lambda x: x["time"] or "", reverse=True)
    return activities[:8]


@router.get("/revenue-trend")
def get_revenue_trend(db: Session = Depends(get_db)):
    """Get monthly revenue trend for the last 12 months."""
    rows = db.execute(text("""
        SELECT DATE_TRUNC('month', purchase_date) as month,
               SUM(amount) as revenue,
               COUNT(*) as orders
        FROM orders
        WHERE purchase_date >= NOW() - INTERVAL '12 months'
        GROUP BY 1
        ORDER BY 1
    """)).fetchall()
    
    result = []
    for r in rows:
        month = r[0]
        month_str = month.strftime("%b %Y") if month else ""
        result.append({
            "month": month_str,
            "revenue": float(r[1] or 0),
            "orders": r[2] or 0,
        })
    return result
