require('dotenv').config();

module.exports = {
  browser: {
    headless: process.env.HEADLESS === 'true',
    slowMo: process.env.NODE_ENV === 'development' ? 100 : 0,
    timeout: 30000,
  },
  context: {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  monitor: {
    url: process.env.MONITOR_URL || 'https://ejemplo.com',
    targetData: process.env.TARGET_DATA || 'ACTIVO',
    timeout: 15000,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: 'records/logs/monitor_${date}.log',
  },
  mailer: {
    service: process.env.MAILER_SERVICE || 'gmail',
    auth: {
      user: process.env.MAILER_USER,
      pass: process.env.MAILER_PASS,
      fromName: process.env.MAILER_FROM || 'BOT - Citas Cancilleria',
    },
    to: process.env.MAILER_TO,
    cc: process.env.MAILER_CC ? process.env.MAILER_CC.split(',').map(email => email.trim()) : [],
  },
};