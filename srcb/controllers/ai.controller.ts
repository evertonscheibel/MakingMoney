import { Request, Response } from 'express';
import { body } from 'express-validator';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Cycle, Process } from '../models';
import { asyncHandler, AppError } from '../middleware/errors';
import { config, logger } from '../config';
import { CycleStatus, ProcessStatus, UserRole } from '../types';
import { calculatePercentage, calculateAverage } from '../utils';

// Validation rules
export const chatValidation = [
    body('message').trim().isLength({ min: 1, max: 4000 }).withMessage('Message must be 1-4000 characters'),
    body('context').optional().isObject().withMessage('Context must be an object'),
];

/**
 * Chat with AI assistant (Gemini)
 * POST /api/ai/chat
 */
export const chat = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeCompanyId = req.companyId!;
    const { message, context } = req.body;

    // Check if Gemini API key is configured
    if (!config.geminiApiKey) {
        throw new AppError('AI Assistant is not configured. Please set GEMINI_API_KEY.', 503);
    }

    // Build context from current data if requested
    let systemContext = `You are an AI assistant for CHRONOS - Making Money Method, a process management system.
You help users analyze their processes, understand their performance metrics, and provide recommendations.
Always be helpful, concise, and data-driven in your responses.
Respond in the same language as the user's message.`;

    if (context?.includeKPIs !== false) {
        try {
            // Get current cycle and KPIs (sector-aware)
            const cycleFilter: any = {
                companyId: activeCompanyId,
                status: CycleStatus.OPEN,
            };

            const isOperator = req.user?.roles.includes(UserRole.OPERATOR) && !req.user?.roles.includes(UserRole.MASTER) && !req.user?.roles.includes(UserRole.MANAGER);
            if (isOperator && req.user?.sector) {
                cycleFilter.sector = req.user.sector;
            }

            const cycle = await Cycle.findOne(cycleFilter).sort({ month: -1 });

            if (cycle) {
                const processes = await Process.find({ cycleId: cycle._id });

                const totalProcesses = processes.length;
                const deliveredCount = processes.filter((p) => p.deliveryDate !== null).length;
                const onTimeCount = processes.filter((p) => p.status === ProcessStatus.ON_TIME).length;
                const criticalCount = processes.filter((p) => p.status === ProcessStatus.CRITICAL).length;

                const scores = processes
                    .filter((p) => p.score !== null)
                    .map((p) => p.score!);
                const avgScore = calculateAverage(scores);
                const onTimePct = calculatePercentage(onTimeCount, totalProcesses);

                systemContext += `

Current Context:
- Current Cycle: ${cycle.month}
- Total Processes: ${totalProcesses}
- Delivered: ${deliveredCount}
- On Time: ${onTimeCount} (${onTimePct}%)
- Critical: ${criticalCount}
- Average Score: ${avgScore}`;

                // Add sector breakdown
                const sectorCounts: Record<string, number> = {};
                processes.forEach((p) => {
                    sectorCounts[p.sector] = (sectorCounts[p.sector] || 0) + 1;
                });

                const sectors = Object.entries(sectorCounts)
                    .map(([sector, count]) => `${sector}: ${count}`)
                    .join(', ');

                if (sectors) {
                    systemContext += `
- Processes by Sector: ${sectors}`;
                }
            }
        } catch (error) {
            logger.warn('Failed to gather context for AI:', error);
            // Continue without context
        }
    }

    try {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: 'System context: ' + systemContext }],
                },
                {
                    role: 'model',
                    parts: [{ text: 'Understood. I am ready to assist with CHRONOS - Making Money Method process management questions.' }],
                },
            ],
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();

        res.json({
            success: true,
            data: {
                message: response,
                model: 'gemini-2.0-flash-exp',
            },
        });
    } catch (error) {
        logger.error('Gemini API error:', error);

        if ((error as { status?: number }).status === 429) {
            throw new AppError('AI service rate limit reached. Please try again later.', 429);
        }

        throw new AppError('AI service temporarily unavailable.', 503);
    }
});

