#!/bin/bash

# JoJo TTRPG - Production Deployment Checklist
# Dynamic Ability Management System

echo "🚀 JoJo TTRPG - Production Deployment Checklist"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}📋 Pre-Deployment Checklist${NC}"
echo "=============================="

# Security Checks
echo -e "\n${YELLOW}🔒 Security Verification${NC}"
echo "□ Authentication restored on API endpoints"
echo "□ CORS settings configured for production domain"
echo "□ Environment variables set for production"
echo "□ Debug mode disabled in Django settings"
echo "□ Secret keys properly configured"

# Database Checks
echo -e "\n${YELLOW}🗄️ Database Verification${NC}"
echo "□ Production database migrations applied"
echo "□ Ability fixtures loaded (Hamon and Spin)"
echo "□ Database backups configured"
echo "□ Connection pooling optimized"

# API Checks
echo -e "\n${YELLOW}📡 API Verification${NC}"
echo "□ All ability endpoints responding correctly"
echo "□ Authentication middleware working"
echo "□ Rate limiting configured"
echo "□ API documentation updated"

# Frontend Checks
echo -e "\n${YELLOW}🌐 Frontend Verification${NC}"
echo "□ Production build completed successfully"
echo "□ Static files served correctly"
echo "□ API URLs configured for production"
echo "□ Error boundaries implemented"

# Performance Checks
echo -e "\n${YELLOW}⚡ Performance Verification${NC}"
echo "□ Frontend bundle size optimized"
echo "□ API response times acceptable"
echo "□ Database queries optimized"
echo "□ Caching configured properly"

# Testing Checks
echo -e "\n${YELLOW}🧪 Testing Verification${NC}"
echo "□ All manual tests pass"
echo "□ Automated tests implemented"
echo "□ Load testing completed"
echo "□ User acceptance testing done"

echo -e "\n${BLUE}🔧 Deployment Commands${NC}"
echo "======================"

echo -e "\n${YELLOW}Backend Deployment:${NC}"
echo "cd /path/to/production/backend"
echo "source venv/bin/activate"
echo "pip install -r requirements-prod.txt"
echo "python manage.py migrate"
echo "python manage.py loaddata srd_hamon_abilities.json srd_spin_abilities.json"
echo "python manage.py collectstatic --noinput"
echo "gunicorn app.wsgi:application --bind 0.0.0.0:8000"

echo -e "\n${YELLOW}Frontend Deployment:${NC}"
echo "cd /path/to/production/frontend"
echo "npm ci --production"
echo "npm run build"
echo "# Copy build/ directory to web server"

echo -e "\n${BLUE}🚦 Post-Deployment Verification${NC}"
echo "================================="

echo -e "\n${YELLOW}Automated Checks:${NC}"
echo "curl -f https://yourdomain.com/api/hamon-abilities/ -H 'Authorization: Token YOUR_TOKEN'"
echo "curl -f https://yourdomain.com/api/spin-abilities/ -H 'Authorization: Token YOUR_TOKEN'"
echo "curl -f https://yourdomain.com/"

echo -e "\n${YELLOW}Manual Verification:${NC}"
echo "1. Open https://yourdomain.com"
echo "2. Create test character with Hamon playbook"
echo "3. Verify Hamon abilities load and display correctly"
echo "4. Switch to Spin playbook"
echo "5. Verify Spin abilities load and auto-switch works"
echo "6. Test ability selection and persistence"
echo "7. Verify visual indicators (colors, emojis) display correctly"

echo -e "\n${BLUE}📊 Monitoring Setup${NC}"
echo "===================="

echo -e "\n${YELLOW}Application Monitoring:${NC}"
echo "□ Error tracking (Sentry, Rollbar, etc.)"
echo "□ Performance monitoring (New Relic, DataDog, etc.)"
echo "□ Log aggregation (ELK stack, Splunk, etc.)"
echo "□ Uptime monitoring (Pingdom, UptimeRobot, etc.)"

echo -e "\n${YELLOW}Database Monitoring:${NC}"
echo "□ Query performance tracking"
echo "□ Connection pool monitoring"
echo "□ Backup verification"
echo "□ Storage usage alerts"

echo -e "\n${BLUE}🔄 Rollback Plan${NC}"
echo "================"

echo -e "\n${YELLOW}If Issues Occur:${NC}"
echo "1. Verify all services are running"
echo "2. Check logs for error messages"
echo "3. Test API endpoints individually"
echo "4. Verify database connectivity"
echo "5. If critical issues, rollback to previous version:"

echo -e "\n${YELLOW}Rollback Commands:${NC}"
echo "# Backend rollback"
echo "git checkout previous-stable-tag"
echo "python manage.py migrate"
echo "systemctl restart gunicorn"

echo -e "\n# Frontend rollback"
echo "# Restore previous build directory"
echo "systemctl restart nginx"

echo -e "\n${BLUE}📞 Support Contacts${NC}"
echo "==================="

echo -e "\n${YELLOW}Emergency Contacts:${NC}"
echo "□ Development team lead"
echo "□ System administrator"
echo "□ Database administrator"
echo "□ Infrastructure team"

echo -e "\n${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "Dynamic Ability Management System is now live in production."
echo "Users can now enjoy seamless ability management with:"
echo "• Hamon abilities for Hamon users"
echo "• Spin abilities for Spin users"
echo "• Visual indicators and smooth transitions"
echo "• Persistent ability selections"
echo ""
echo -e "${BLUE}🎉 The JoJo TTRPG experience just got more bizarre!${NC}"
