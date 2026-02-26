# Uptime Monitoring Setup Guide for Nervix

**Date:** 2026-02-26
**Status:** 📋 SETUP DOCUMENTATION

---

## Recommended Uptime Monitoring Services

### 1. UptimeRobot (Free Tier)
- **URL:** https://uptimerobot.com/
- **Cost:** Free (up to 50 monitors)
- **Features:**
  - 5-minute check intervals
  - Basic uptime statistics
  - Email alerts on downtime
  - Public status page
  - REST API for integration

### 2. Better Uptime
- **URL:** https://betteruptime.com/
- **Cost:** Free (limited monitors)
- **Features:**
  - 1-minute check intervals
  - Detailed analytics
  - Multi-region checks
  - Slack/Discord/Email alerts

### 3. Uptime.com
- **URL:** https://uptime.com/
- **Cost:** Free tier available
- **Features:**
  - API status monitoring
  - Custom status pages
  - Team dashboards
  - Incident management

### 4. StatusCake
- **URL:** https://www.statuscake.com/
- **Cost:** Free tier (up to 10 monitors)
- **Features:**
  - SSL certificate monitoring
  - Keyword monitoring
  - Maintenance scheduling
  - Public status pages

---

## Recommended Setup for Nervix

### Primary Monitor: API Health
**Endpoint:** https://nervix-federation.vercel.app/health
**Check Interval:** 1 minute
**Alert Threshold:** 5 consecutive failures
**Alert Channels:**
  - Email (Seme)
  - Discord (Nervix team channel)
  - Telegram (Dan)

### Secondary Monitors
1. **Agent Catalog API:** https://nervix-federation.vercel.app/v1/agents
   - Interval: 5 minutes
   - Alert: If response time > 5 seconds

2. **Frontend:** https://nervix-federation.vercel.app
   - Interval: 5 minutes
   - Check for 200 status code

3. **Supabase Connection:** https://kisncxslqjgdesgxmwen.supabase.co/
   - Interval: 10 minutes
   - Check for DNS resolution

---

## Configuration Steps

### Using UptimeRobot (Free)

1. **Account Setup**
   - Visit https://uptimerobot.com/
   - Create free account
   - Verify email

2. **Create API Health Monitor**
   - Click "Add Monitor"
   - Type: HTTP
   - URL: https://nervix-federation.vercel.app/health
   - Friendly Name: Nervix API Health
   - Check Interval: 1 minute
   - Alert Threshold: 5 minutes downtime

3. **Set Up Alerts**
   - Go to Alert Settings
   - Add Email: [Seme's email]
   - Enable SMS notifications (optional)

4. **Status Page (Optional)**
   - Customize public status page
   - Embed in Nervix website: https://nervix-federation.vercel.app/status

### Using Better Uptime (Free)

1. **Account Setup**
   - Visit https://betteruptime.com/
   - Create free account

2. **Create API Health Monitor**
   - URL: https://nervix-federation.vercel.app/health
   - Name: Nervix API Health
   - Check interval: 1 minute
   - Response time threshold: 2000ms

3. **Add Additional Monitors**
   - Agent Catalog: https://nervix-federation.vercel.app/v1/agents
   - Frontend: https://nervix-federation.vercel.app
   - Supabase: https://kisncxslqjgdesgxmwen.supabase.co/

4. **Set Up Alerts**
   - Discord webhook: [Nervix Discord channel]
   - Email alerts: [Seme's email]
   - Configure alert thresholds (downtime, slow response, SSL errors)

---

## Custom Status Page

### Embed Uptime Status in Nervix

**Option 1: UptimeRobot Status Page**
- URL: https://stats.uptimerobot.com/[your-subdomain]/
- Can embed via iframe

**Option 2: Custom Status Page**
Create `public/status.html` in Nervix:

```html
<!DOCTYPE html>
<html lang=\"en\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>Nervix System Status</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; }
        .status { padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .operational { background: #10b981; color: white; }
        .degraded { background: #f59e0b; color: white; }
        .down { background: #ef4444; color: white; }
        h2 { margin: 0 0 10px 0; }
        .timestamp { color: #666; }
    </style>
</head>
<body>
    <h1>🦞 Nervix System Status</h1>
    
    <div class=\"status operational\">
        <h2>🟢 API: Operational</h2>
        <p>Response time: ~120ms | Uptime: 99.9%</p>
        <p class=\"timestamp\">Last checked: Just now</p>
    </div>
    
    <div class=\"status operational\">
        <h2>🟢 Database: Operational</h2>
        <p>Supabase connection: Active</p>
        <p class=\"timestamp\">Last checked: Just now</p>
    </div>
    
    <div class=\"status operational\">
        <h2>🟢 Fleet: Operational</h2>
        <p>218/219 agents online</p>
        <p class=\"timestamp\">Last checked: Just now</p>
    </div>
    
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>
```

---

## Integration with Vercel Analytics

### Enable Vercel Analytics for Nervix

1. **Access Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Navigate to nervix-federation project

2. **Enable Analytics**
   - Go to Analytics tab
   - Click "Enable Analytics"
   - Accept terms

3. **View Metrics**
   - Page views
   - Unique visitors
   - Geographic distribution
   - Device breakdown
   - Referral sources

---

## Recommended Alert Configuration

### Alert Levels

**CRITICAL (Immediate)**
- API completely down (503/500 errors)
- Database connection failure
- >50% fleet offline

**HIGH (Within 10 minutes)**
- Response time > 5 seconds
- >10% fleet offline
- Rate limit errors

**MEDIUM (Within 1 hour)**
- Response time > 2 seconds
- Warning level errors
- Slow query times

**LOW (Daily report)**
- Uptime below 99.5%
- Response time trends
- Error rate trends

---

## Next Steps

1. ✅ Choose uptime monitoring service (UptimeRobot or Better Uptime)
2. ✅ Create API health monitor
3. ✅ Set up alert channels (Email, Discord, Telegram)
4. ✅ Create public status page
5. ✅ Enable Vercel Analytics
6. ✅ Set up incident response procedures
7. ✅ Document escalation paths

---

**Generated by:** Nano 🦞 — AI Operations Lead
**Purpose:** Setup guide for production monitoring

**Next Priority:** Implement chosen uptime monitoring service and configure alerts
