# Internet Deployment Guide for Delicato Restaurant

## Option 1: Microsoft Azure Deployment (Recommended)

1. **Prerequisites**
   - Azure account (create at portal.azure.com)
   - Azure CLI installed
   - Your domain name

2. **Deploy to Azure App Service**
   ```powershell
   # Login to Azure
   az login

   # Create a resource group
   az group create --name delicato-rg --location eastus

   # Create an App Service plan
   az appservice plan create --name delicato-plan --resource-group delicato-rg --sku B1

   # Create the web app
   az webapp create --name delicato-restaurant --resource-group delicato-rg --plan delicato-plan --runtime "NODE:18-lts"

   # Configure environment variables
   az webapp config appsettings set --name delicato-restaurant --resource-group delicato-rg --settings MONGODB_URI="mongodb+srv://zemichael:zemichael@restaurant-website.piubxpf.mongodb.net/restaurant" NODE_ENV="production"

   # Deploy your code
   az webapp deployment source config-local-git --name delicato-restaurant --resource-group delicato-rg
   ```

3. **Set up Custom Domain**
   - Go to Azure Portal
   - Select your App Service
   - Go to "Custom domains"
   - Add your domain
   - Configure DNS records at your domain provider:
     ```
     Type: CNAME
     Host: www
     Points to: delicato-restaurant.azurewebsites.net
     ```

4. **Enable SSL**
   - In Azure Portal, go to "TLS/SSL settings"
   - Click "Private Key Certificates"
   - Select "Create App Service Managed Certificate"
   - Bind it to your custom domain

## Option 2: Traditional VPS Deployment

1. **Rent a VPS** (DigitalOcean, Linode, or Vultr)
   - Choose Ubuntu 22.04 LTS
   - Minimum 2GB RAM
   - 1 CPU core
   - 25GB SSD

2. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install Nginx
   sudo apt install nginx -y

   # Install PM2
   sudo npm install -g pm2
   ```

3. **Configure Nginx**
   ```nginx
   # /etc/nginx/sites-available/delicato
   server {
       listen 80;
       server_name your-domain.com www.your-domain.com;

       location / {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **SSL Setup with Let's Encrypt**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx -y

   # Get SSL certificate
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

5. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/Professional_restaurant_website.git /var/www/delicato

   # Install dependencies
   cd /var/www/delicato
   npm install --production

   # Set up environment variables
   cp .env.example .env
   nano .env  # Edit with your MongoDB URI and other settings

   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 startup
   pm2 save
   ```

## Security Considerations

1. **Firewall Setup**
   ```bash
   # Allow only necessary ports
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **MongoDB Security**
   - Update MongoDB Atlas IP whitelist
   - Use strong password
   - Enable network encryption

3. **Application Security**
   - Set secure JWT_SECRET
   - Enable rate limiting
   - Configure CORS properly
   - Set secure HTTP headers

## Monitoring Setup

1. **Setup Application Monitoring**
   ```bash
   # Install PM2 monitoring
   pm2 install pm2-logrotate
   pm2 install pm2-server-monit
   ```

2. **Setup Alerts**
   ```bash
   # Configure PM2 to send email alerts
   pm2 set pm2-alerts:email your-email@domain.com
   ```

## Backup Configuration

1. **Database Backups**
   - Configure MongoDB Atlas automated backups
   - Set up local backup scripts if needed

2. **Application Backups**
   ```bash
   # Create backup script
   #!/bin/bash
   backup_dir="/var/backups/delicato"
   timestamp=$(date +%Y%m%d_%H%M%S)
   tar -czf "$backup_dir/app_backup_$timestamp.tar.gz" /var/www/delicato
   ```

## Post-Deployment Checklist

1. [ ] Verify HTTPS is working
2. [ ] Test all application features
3. [ ] Monitor error logs
4. [ ] Set up automated backups
5. [ ] Configure monitoring alerts
6. [ ] Update DNS records
7. [ ] Test load handling
8. [ ] Verify security headers
9. [ ] Set up logging rotation
10. [ ] Configure automatic updates