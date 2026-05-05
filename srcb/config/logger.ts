import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        if (stack) {
            return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        }
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} [${level}]: ${message}`;
    })
);

export const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    transports: [
        new winston.transports.Console({
            format: consoleFormat,
        }),
    ],
});

// Always add file transports for debugging
logger.add(
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: logFormat,
    })
);
logger.add(
    new winston.transports.File({
        filename: 'logs/combined.log',
        format: logFormat,
    })
);


