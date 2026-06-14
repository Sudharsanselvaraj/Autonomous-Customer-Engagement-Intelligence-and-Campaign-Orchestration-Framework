#!/bin/bash
# AsterCRM VPS Deploy Script
# Usage: ./deploy.sh YOUR_VPS_IP

set -e

VPS_IP=${1:-}

if [ -z "$VPS_IP" ]; then
    echo "Usage: ./deploy.sh YOUR_VPS_IP"
    echo "Example: ./deploy.sh 123.45.67.89"
    exit 1
fi

echo "🚀 Deploying AsterCRM to VPS: $VPS_IP"

# Create deploy directory on VPS
ssh root@$VPS_IP "mkdir -p /opt/astercrm && cd /opt/astercrm && git clone https://github.com/Sudharsanselvaraj/AI-Native-Customer-Intelligence-Segmentation-and-Campaign-Orchestration-System.git . || git pull"

# Copy local changes if needed (uncomment if you want to rsync local changes)
# rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='.next' ./ root@$VPS_IP:/opt/astercrm/

# Install Docker if not present
ssh root@$VPS_IP "which docker || curl -fsSL https://get.docker.com | sh"

# Create .env file for secrets
ssh root@$VPS_IP "cat > /opt/astercrm/.env << 'EOF'
OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
GEMINI_API_KEY=${GEMINI_API_KEY:-}
SECRET_KEY=${SECRET_KEY:-$(openssl rand -hex 32)}
EOF"

# Build and start
ssh root@$VPS_IP "cd /opt/astercrm && docker compose -f docker-compose.prod.yml down || true"
ssh root@$VPS_IP "cd /opt/astercrm && docker compose -f docker-compose.prod.yml up -d --build"

# Wait for services
sleep 10

# Seed data
ssh root@$VPS_IP "curl -s -X POST http://localhost:8000/api/analytics/seed || echo 'Seed may need retry after DB init'"

echo ""
echo "✅ AsterCRM deployed!"
echo ""
echo "🌐 Frontend: http://$VPS_IP"
echo "📡 API:      http://$VPS_IP:8000"
echo "📚 API Docs: http://$VPS_IP:8000/docs"
echo ""
echo "Useful commands on VPS:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo "  docker compose -f docker-compose.prod.yml ps"
echo ""
