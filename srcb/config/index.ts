import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    // Database
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'default-dev-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

    // Gemini AI
    geminiApiKey: process.env.GEMINI_API_KEY || '',

    // Rate limiting
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10000', 10),

    // App
    defaultPageSize: 20,
    maxPageSize: 100,
};

// Validate required config in production
export function validateConfig(): void {
    const requiredInProduction = ['JWT_SECRET'];

    if (config.nodeEnv === 'production') {
        for (const key of requiredInProduction) {
            if (!process.env[key]) {
                throw new Error(`Missing required environment variable: ${key}`);
            }
        }
    }

    // Warn about missing optional keys
    if (!config.geminiApiKey) {
        console.warn('Warning: GEMINI_API_KEY not set. AI Assistant will not work.');
    }
}

export { logger } from './logger';
export { connectDatabase, disconnectDatabase } from './database';

