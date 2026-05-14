# Ultrasonic Sensor Dashboard

Full-stack monitoring system for your Arduino HC-SR04 ultrasonic sensor.

## Project Structure

  dashboard.html       Single-file frontend (open in browser)
  backend/             TypeScript Express API
    src/
      server.ts        Main Express server + all API routes
      auth.ts          JWT auth + bcrypt password hashing
      mailer.ts        Nodemailer email alert engine
      types.ts         Shared TypeScript interfaces
    .env.example       Environment variable template
    tsconfig.json      TypeScript config

## Quick Start

### 1. Backend

  cd backend
  cp .env.example .env        # Edit with your SMTP credentials
  npm install
  npm run dev                 # Runs on http://localhost:3001

### 2. Frontend

  Open dashboard.html in your browser
  Default login: admin / admin123

## API Endpoints

  POST /auth/register         Register new user
  POST /auth/login            Login, returns JWT
  GET  /readings              Last 100 readings (auth required)
  GET  /readings/latest       Most recent reading (auth required)
  POST /readings              Push a new reading (auth required)
  GET  /alerts/config         Get alert settings (auth required)
  PUT  /alerts/config         Update alert settings (auth required)
  GET  /health                Health check

## Arduino Integration

Replace Serial.println with HTTP POST to /readings:
  Use WiFi shield or ESP8266 module
  POST body: { "distance": <value> }
  Header: Authorization: Bearer <token>

## Email Alerts

Set SMTP_USER and SMTP_PASS in .env (Gmail app password recommended).
Configure thresholds and recipient in the dashboard UI.
Alerts have a 60-second cooldown to prevent spam.

## Security Notes

Change JWT_SECRET in .env before deploying.
Replace in-memory user store with a real database for production.