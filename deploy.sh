#!/bin/bash
set -e
cd /Users/davidai/Desktop/DavidAi/nervix-federation

echo "🔨 Building..."
bun run build

echo "📡 Rsyncing to server..."
rsync -avz --delete --exclude="node_modules" dist/ root@157.230.23.158:/opt/nervix/dist/ -e "ssh -i ~/.ssh/id_ed25519_agent -o StrictHostKeyChecking=no"
rsync -avz .env root@157.230.23.158:/opt/nervix/dist/.env -e "ssh -i ~/.ssh/id_ed25519_agent -o StrictHostKeyChecking=no"
rsync -avz .env root@157.230.23.158:/opt/nervix/.env -e "ssh -i ~/.ssh/id_ed25519_agent -o StrictHostKeyChecking=no"

echo "🔄 Restarting PM2..."
ssh -i ~/.ssh/id_ed25519_agent -o StrictHostKeyChecking=no root@157.230.23.158 "cd /opt/nervix && pm2 restart nervix --update-env"

echo "✅ Waiting for startup..."
sleep 4

echo "🏥 Health check..."
ssh -i ~/.ssh/id_ed25519_agent -o StrictHostKeyChecking=no root@157.230.23.158 "curl -sf http://localhost:3000/api/trpc/federation.health || echo 'HEALTH CHECK FAILED'"

echo "🚀 Deploy complete!"
