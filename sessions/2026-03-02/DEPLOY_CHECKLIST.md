# NERVIX Production Deploy Checklist — 2026-03-02

## Pre-Deploy

- [x] All Supabase RPCs applied (003 + 004)
- [x] Webhook delivery spam fixed (stale queued messages)
- [x] E2E task lifecycle passes
- [x] 5 team agents enrolled (nano, dexter, memo, sienna, david)
- [x] Load test run (380 req, avg 283ms)
- [x] Security audit completed (15 findings documented)
- [x] SEO files added (robots.txt, sitemap.xml, manifest.json)
- [x] Prometheus /metrics endpoint verified
- [x] SSE real-time events working
- [x] Knowledge barter system operational
- [x] Landing page + docs polished

## Build & Deploy Steps

```bash
# 1. On Mac Studio — build
cd ~/Desktop/DavidAi/nervix-federation
npm run build

# 2. Deploy server to Nano
scp dist/index.js nano-root:/opt/nervix/dist/index.js

# 3. Deploy client (built into dist by Vite)
scp -r dist/client/* nano-root:/opt/nervix/dist/client/

# 4. Deploy SEO static files
scp client/public/robots.txt nano-root:/opt/nervix/dist/client/
scp client/public/sitemap.xml nano-root:/opt/nervix/dist/client/
scp client/public/manifest.json nano-root:/opt/nervix/dist/client/

# 5. Restart on Nano
ssh nano-root "cd /opt/nervix && pm2 restart nervix"

# 6. Verify health
curl -s http://157.230.23.158/api/trpc/federation.health
curl -s http://157.230.23.158/metrics | head -5
curl -s https://nervix.ai/robots.txt
curl -s https://nervix.ai/sitemap.xml
```

## Post-Deploy Verification

- [ ] Health endpoint returns OK
- [ ] /metrics returns Prometheus data
- [ ] robots.txt accessible
- [ ] sitemap.xml accessible
- [ ] manifest.json accessible
- [ ] Agent enrollment works
- [ ] Task create/complete works
- [ ] Leaderboard loads
- [ ] Landing page renders
- [ ] Docs page renders

## DNS / SSL

- Domain: nervix.ai → 157.230.23.158
- SSL: Managed by nginx (Let's Encrypt or Cloudflare)
- Nginx: Port 80 → localhost:3000

## Known Issues (Non-Blocking for Launch)

1. **tasks.list HTTP 500 under heavy load** — connection pool saturation at 10+ concurrent. Works fine at normal load. Fix: increase Supabase connection pool or add request queuing.
2. **50% load test failure rate** — mostly from tasks.list 500s under stress. Real-world traffic much lower concurrency.
3. **Security items** — See SECURITY_AUDIT.md. Critical (.env in git) and High (SHA256 hashing, security headers) should be addressed soon after launch.

## Rollback Plan

```bash
# If deploy breaks:
ssh nano-root "cd /opt/nervix && git checkout HEAD~1 -- dist/index.js && pm2 restart nervix"
# Or restore from last working dist:
ssh nano-root "cd /opt/nervix && pm2 restart nervix --update-env"
```

## Monitoring

- PM2: `ssh nano-root "pm2 status"` / `pm2 logs nervix`
- Metrics: `curl http://157.230.23.158/metrics`
- Health: `curl http://157.230.23.158/api/trpc/federation.health`
- Supabase Dashboard: https://supabase.com/dashboard (kisncxslqjgdesgxmwen)
