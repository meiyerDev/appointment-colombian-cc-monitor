const fs = require('fs');
const path = require('path');

class Logger {
  constructor(config) {
    this.flowId = null;
    this.level = config.level;
    this.logFile = config.file;
    
    // Crear directorio de logs si no existe
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  identifier(id) {
    this.flowId = id;
    return this;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };

    const logString = `[${this.flowId}][${logEntry.timestamp}] ${logEntry.level.toUpperCase()}: ${logEntry.message}${logEntry.data ? ' | ' + JSON.stringify(logEntry.data) : ''}\n`;
    
    // Console output
    console.log(logString.trim());

    const logFile = this.logFile.replace('${date}', new Date().toISOString().split('T')[0].replaceAll('-', '_'));

    // File output
    fs.appendFileSync(logFile, logString);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  debug(message, data) {
    if (this.level === 'debug') {
      this.log('debug', message, data);
    }
  }
}

module.exports = Logger;