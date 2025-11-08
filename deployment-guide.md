# Delicato Restaurant Website - Windows Deployment Guide

This guide explains each step of deploying the Delicato Restaurant Website on a Windows production server, including why each step is necessary and what it accomplishes.

## Prerequisites Installation

1. **Install Node.js LTS**
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`
   
   **Why?** Node.js is the runtime environment that powers our server-side application. We use the LTS (Long Term Support) version because it:
   - Provides stable, tested features
   - Receives security updates for an extended period
   - Has better compatibility with most npm packages
   - Is recommended for production deployments

2. **MongoDB Atlas (Already Configured)**
   The project is already configured to use MongoDB Atlas (cloud database), so no local installation is required.
   
   **Why MongoDB Atlas is better for production:**
   - Zero maintenance required
   - Automatic backups and updates
   - Built-in monitoring and scaling
   - High availability and reliability
   - Professional database management
   - Accessible from anywhere
   
   **Current Configuration:**
   - Database is hosted on MongoDB Atlas
   - Connection string is in .env file
   - No local MongoDB installation needed
   - Already seeded with initial data

3. **Install IIS (Internet Information Services)**
   - Open Control Panel > Programs > Turn Windows features on or off
   - Check "Internet Information Services"
   - Under "World Wide Web Services", enable:
     - Application Development Features (Required for Node.js integration)
     - Common HTTP Features (Basic web serving capabilities)
     - Security (SSL/TLS support and security features)
     - Performance Features (Caching and compression)
   
   **Why?** IIS serves as our web server and reverse proxy because it:
   - Provides enterprise-grade features and security
   - Handles SSL/TLS termination
   - Offers better performance through caching
   - Enables serving static files efficiently
   - Provides detailed logging and monitoring
   - Is optimized for Windows servers

## Database Configuration

The database is already set up on MongoDB Atlas, which provides:
- Managed database hosting
- Automatic backups
- Built-in monitoring
- High availability
- Security features

**No local setup required!**

To verify the database connection:
```powershell
# The application will automatically connect to MongoDB Atlas using
# the connection string in your .env file
npm start

# If you see "MongoDB connected: ac-0tcpsck-shard-00-00.piubxpf.mongodb.net"
# in the console, the connection is successful
```

**Why MongoDB Atlas is the right choice:**
- Professional-grade hosting
- No need for local database management
- Automatic updates and patches
- Built-in backup and recovery
- 24/7 monitoring and alerts
- Scalability options
- Geographic distribution

## Application Deployment

1. **Create Application Directory**
   ```powershell
   mkdir C:\delicato
   ```
   
   **Why?** A dedicated application directory:
   - Keeps application files organized and isolated
   - Makes backups and updates easier
   - Provides clear separation from other system files
   - Simplifies permission management

2. **Copy Application Files**
   - Copy all project files to C:\delicato
   - Exclude node_modules and .git folders
   
   **Why?** Proper file deployment:
   - node_modules should be fresh-installed for the target system
   - .git files aren't needed in production
   - Ensures clean deployment without development artifacts
   - Reduces deployment size and security risks

3. **Install Dependencies**
   ```powershell
   cd C:\delicato
   npm install --production
   ```
   
   **Why?** Production dependency installation:
   - Installs only necessary production packages
   - Excludes development dependencies to reduce attack surface
   - Ensures consistent package versions
   - Creates optimized node_modules structure

4. **Configure Environment**
   Create .env file in C:\delicato with:
   ```
   PORT=4000
   MONGODB_URI=mongodb://localhost:27017/delicato
   JWT_SECRET=your-secure-production-secret
   LOYALTY_POINTS_PER_DOLLAR=1
   NODE_ENV=production
   ```
   
   **Why?** Environment configuration:
   - Separates sensitive configuration from code
   - Enables different settings for different environments
   - Secures database connections and secrets
   - Controls application behavior in production

5. **Install PM2 Globally**
   ```powershell
   npm install -g pm2
   ```
   
   **Why?** PM2 Process Manager:
   - Ensures application stays running
   - Provides automatic restart on crashes
   - Enables load balancing across CPU cores
   - Offers monitoring and logging features
   - Handles application updates without downtime

6. **Configure PM2 for Windows Startup**
   ```powershell
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   # Run the command that PM2 provides
   ```
   
   **Why?** PM2 Startup Configuration:
   - Ensures application starts automatically after server reboot
   - Maintains process list across system restarts
   - Provides proper shutdown handling
   - Enables system-level process management
   - Keeps application running even after system updates

## IIS Reverse Proxy Setup

1. **Install URL Rewrite Module and Application Request Routing**
   - Download URL Rewrite from: https://www.iis.net/downloads/microsoft/url-rewrite
   - Install Application Request Routing (ARR) from: https://www.iis.net/downloads/microsoft/application-request-routing
   
   **Why?** These modules are essential because:
   - URL Rewrite enables routing requests to the Node.js application
   - ARR provides reverse proxy capabilities
   - Enables SSL termination at IIS level
   - Provides caching and load balancing features
   - Allows URL manipulation for cleaner endpoints

2. **Configure IIS**
   - Open IIS Manager
   - Create new website:
     - Site name: Delicato
     - Physical path: C:\delicato
     - Port: 80
   - Add reverse proxy rules to web.config
   
   **Why?** IIS Configuration provides:
   - Professional-grade web server capabilities
   - Request filtering and security features
   - Static file serving optimization
   - Proper HTTP header management
   - Integration with Windows authentication
   - Advanced logging and monitoring

## SSL Setup (Optional but Recommended)

1. **Install SSL Certificate**
   - Purchase SSL certificate or use Let's Encrypt
   - Install certificate in IIS
   - Bind HTTPS to port 443
   
   **Why?** SSL/TLS encryption is crucial because it:
   - Protects customer data during transmission
   - Secures payment and personal information
   - Improves search engine rankings
   - Builds customer trust
   - Is required for PCI compliance
   - Prevents man-in-the-middle attacks
   - Enables modern web features that require HTTPS

## Final Steps

1. **Initialize Database**
   ```powershell
   cd C:\delicato
   node server/seed.js
   ```
   
   **Why?** Database initialization:
   - Creates initial admin account
   - Sets up required database collections
   - Adds sample menu items
   - Establishes loyalty program structure
   - Ensures all required data is in place

2. **Start Application**
   ```powershell
   pm2 start ecosystem.config.js
   ```
   
   **Why?** Proper application startup:
   - Launches application in cluster mode
   - Enables load balancing
   - Sets up process monitoring
   - Configures error handling
   - Establishes logging

3. **Set up Monitoring**
   ```powershell
   pm2 install pm2-server-monit
   pm2 install pm2-logrotate
   ```
   
   **Why?** Monitoring setup:
   - Tracks server resource usage
   - Manages log file sizes and rotation
   - Provides real-time performance metrics
   - Enables early problem detection
   - Prevents disk space issues from logs
   - Helps maintain system stability

## Maintenance Commands

The following commands are essential for day-to-day operation and troubleshooting:

- Start application: `pm2 start ecosystem.config.js`
  **Why?** Launches the application with all configured clusters and settings

- Stop application: `pm2 stop ecosystem.config.js`
  **Why?** Gracefully stops the application, allowing requests to complete

- View status: `pm2 status`
  **Why?** Shows current state of all processes, memory usage, and uptime

- View logs: `pm2 logs`
  **Why?** Displays real-time application logs for debugging and monitoring

- Monitor resources: `pm2 monit`
  **Why?** Provides detailed CPU, memory, and request metrics in real-time

These commands help you:
- Monitor application health
- Diagnose problems quickly
- Manage server resources
- Track user activity
- Ensure optimal performance

## Default Credentials

Manager Account:
- Username: mike@mnsu.edu
- Password: Manager1234 (change this immediately)

## Backup Setup

1. **Configure MongoDB Backups**
   ```powershell
   # Create backup directory
   mkdir C:\backup\mongodb

   # Create backup script
   New-Item -Path "C:\backup\backup-mongo.bat"
   ```
   
   **Why?** Regular backups are critical because they:
   - Protect against data loss
   - Enable disaster recovery
   - Allow point-in-time restoration
   - Safeguard customer and order history
   - Maintain business continuity
   - Comply with data protection regulations

2. **Create Windows Task Scheduler job for regular backups**
   
   **Why?** Automated backup scheduling:
   - Ensures consistent backup execution
   - Removes human error from backup process
   - Maintains backup history
   - Enables off-hours backup timing
   - Provides backup verification
   - Automates cleanup of old backups