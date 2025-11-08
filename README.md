# Delicato Restaurant Website - Self-Hosting Guide

## Overview
This is a full-featured restaurant website with customer, kitchen, and manager interfaces. The application uses:
- Node.js backend server
- MongoDB Atlas for database
- Express.js web framework
- Static HTML/CSS/JS frontend

## Quick Start (Local Development)
1. Start the server:
```powershell
npm start
```
2. Access the website at: http://localhost:4000

## Default Accounts
- Manager: 
  - Email: mike@mnsu.edu
  - Password: Manager1234
- Customer: 
  - Email: alex.rivera@example.com
  - Password: GuestAccess123

## Host From Your Computer (Make Public)

### Prerequisites
1. A computer that can stay on 24/7
2. Home internet connection
3. Access to your router settings
4. (Optional) Domain name

### Step 1: Router Configuration
1. Log into your router (usually http://192.168.1.1 or http://192.168.0.1)
2. Set up port forwarding:
   - Forward port 80 (HTTP) to port 4000 on your computer
   - Forward port 443 (HTTPS) to port 4000 on your computer
3. Note your public IP address (Google "what is my IP")

### Step 2: Dynamic DNS Setup (Optional but Recommended)
1. Sign up for a free dynamic DNS service (like No-IP or DuckDNS)
2. Get a free subdomain (e.g., your-restaurant.ddns.net)
3. Install the dynamic DNS client to keep your IP address updated

### Step 3: Run the Website
1. Open PowerShell as Administrator
2. Navigate to website folder:
```powershell
cd C:\delicato
```
3. Install PM2 for keeping the server running:
```powershell
npm install -g pm2
```
4. Start the server with PM2:
```powershell
pm2 start server/index.js --name delicato
```
5. Make PM2 start on boot:
```powershell
pm2 startup
pm2 save
```

### Step 4: Access Your Website
- Local network: http://localhost:4000
- From the internet: http://your-public-ip
- With dynamic DNS: http://your-subdomain.ddns.net

## Features

### Customer Portal
- View menu
- Place orders
- Track order status
- Manage reservations
- Loyalty program
- Digital wallet

### Kitchen Display
- Real-time order management
- Order status updates
- Cooking time tracking
- Queue management

### Manager Dashboard
- Menu management
- Content updates
- Order oversight
- Staff management
- Settings configuration
- Analytics

## File Structure
```
├── css/            # Stylesheets
├── js/             # Frontend JavaScript
├── server/         # Backend Node.js server
│   ├── models/     # Database models
│   ├── routes/     # API routes
│   └── middleware/ # Express middleware
└── *.html          # Web pages
```

## Security Notes
1. Change default passwords immediately
2. Keep your computer's firewall enabled
3. Keep Windows updated
4. Use HTTPS when possible
5. Regularly backup your MongoDB data

## Troubleshooting

### Server Won't Start
1. Check if port 4000 is in use:
```powershell
netstat -ano | findstr :4000
```
2. Kill the process if needed:
```powershell
taskkill /PID [process_id] /F
```

### Can't Access from Internet
1. Check if server is running:
```powershell
pm2 status
```
2. Verify port forwarding:
   - Visit http://localhost:4000 locally
   - Try using a port checking tool
3. Check Windows firewall settings

### Database Issues
1. Verify MongoDB connection:
```powershell
node server/seed.js
```
2. Check .env file has correct MongoDB URI

## Maintenance

### Regular Tasks
1. Check server status:
```powershell
pm2 status
```

2. View logs:
```powershell
pm2 logs delicato
```

3. Restart server:
```powershell
pm2 restart delicato
```

4. Update application:
```powershell
git pull
npm install
pm2 restart delicato
```

### Backup
1. MongoDB Atlas handles database backups automatically
2. Backup your .env file
3. Keep a copy of any custom configurations

## Environment Variables (.env)
```
PORT=4000
MONGODB_URI=mongodb+srv://zemichael:zemichael@restaurant-website.piubxpf.mongodb.net/restaurant
MONGODB_DB=restaurant-website
NODE_ENV=production
```

## Support
For issues or questions:
1. Check the troubleshooting section
2. Review server logs: `pm2 logs`
3. Check MongoDB Atlas dashboard
4. Review router configuration

## Best Practices
1. Use a UPS for power outages
2. Set up automatic Windows updates
3. Monitor system resources
4. Keep security software updated
5. Regularly check logs for issues
6. Maintain good internet connectivity
