#!/bin/bash
# LLS Deployment Script
# Usage: ./deploy.sh [api|admin|all]

set -e

# Configuration
PROJECT_DIR="/var/www/lls"
REPO_URL="git@github.com:your-repo/lls.git"  # Update with your repo
BRANCH="main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as correct user
check_permissions() {
    if [ "$EUID" -eq 0 ]; then
        log_error "Do not run as root. Use a deployment user."
        exit 1
    fi
}

# Pull latest code
pull_code() {
    log_info "Pulling latest code from $BRANCH..."
    cd "$PROJECT_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
}

# Install dependencies
install_deps() {
    log_info "Installing dependencies..."
    cd "$PROJECT_DIR"
    pnpm install --frozen-lockfile
}

# Build packages
build_core() {
    log_info "Building @lls/core..."
    pnpm --filter @lls/core build
}

build_api() {
    log_info "Building @lls/api..."
    pnpm --filter @lls/api build
}

build_admin() {
    log_info "Building @lls/admin..."
    pnpm --filter @lls/admin build
}

# Deploy API
deploy_api() {
    log_info "Deploying API..."

    build_core
    build_api

    # Create logs directory
    mkdir -p "$PROJECT_DIR/logs"

    # Restart PM2
    pm2 reload ecosystem.config.cjs --only lls-api || pm2 start ecosystem.config.cjs --only lls-api

    log_info "API deployed successfully"
}

# Deploy Admin
deploy_admin() {
    log_info "Deploying Admin..."

    build_core
    build_admin

    # Copy built files to nginx directory
    rm -rf /var/www/lls/admin/*
    cp -r "$PROJECT_DIR/packages/admin/dist/"* /var/www/lls/admin/

    log_info "Admin deployed successfully"
}

# Deploy all
deploy_all() {
    log_info "Deploying all packages..."

    build_core
    deploy_api
    deploy_admin

    log_info "All packages deployed successfully"
}

# Health check
health_check() {
    log_info "Running health check..."

    # Check API
    if curl -sf http://localhost:4001/health > /dev/null; then
        log_info "API health check passed"
    else
        log_error "API health check failed"
        exit 1
    fi
}

# Main
main() {
    check_permissions

    case "$1" in
        api)
            pull_code
            install_deps
            deploy_api
            health_check
            ;;
        admin)
            pull_code
            install_deps
            deploy_admin
            ;;
        all)
            pull_code
            install_deps
            deploy_all
            health_check
            ;;
        *)
            echo "Usage: $0 [api|admin|all]"
            exit 1
            ;;
    esac

    log_info "Deployment completed!"
}

main "$@"
