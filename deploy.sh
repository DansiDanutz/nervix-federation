#!/bin/bash

# Nervix Deployment Script
# Deploy Nervix API to production

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check environment
check_env() {
    if [ ! -f .env ]; then
        log_error ".env file not found"
        exit 1
    fi

    # Load environment variables
    export $(cat .env | grep -v '^#' | xargs)
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    docker build -t nervix-api:latest .
    log_info "Docker image built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    node api/migrations/run.js
    log_info "Migrations completed"
}

# Stop existing containers
stop_containers() {
    log_info "Stopping existing containers..."
    docker-compose down
    log_info "Containers stopped"
}

# Start new containers
start_containers() {
    log_info "Starting containers..."
    docker-compose up -d
    log_info "Containers started"
}

# Health check
health_check() {
    log_info "Waiting for API to be healthy..."
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log_info "API is healthy!"
            return 0
        fi
        
        RETRY_COUNT=$((RETRY_COUNT+1))
        echo -n "."
        sleep 2
    done
    
    log_error "API health check failed"
    return 1
}

# Main deployment
main() {
    log_info "Starting Nervix deployment..."

    check_env
    build_image
    stop_containers
    start_containers
    health_check

    log_info "Deployment completed successfully!"
    log_info "API is running at: http://localhost:3000"
    log_info "Metrics dashboard: http://localhost:3000/v1/metrics"
}

# Run main
main "$@"
