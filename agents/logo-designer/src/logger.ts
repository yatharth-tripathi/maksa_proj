import winston from 'winston';
import { agentConfig } from './config';
import { mkdirSync } from 'fs';

// Ensure logs directory exists
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

const logger = winston.createLogger({
  level: agentConfig.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

export default logger;

