import { Types } from 'mongoose';
import type { Request, Response } from 'express';
import { Company, Cycle, Process, User } from '../models';
import { CycleStatus, UserRole, AuthenticatedUser } from '../types';
import { createProcess, updateProcess, setProcessActive } from '../controllers/process.controller';

/**
 * Regression coverage for the "processes silently deactivated" bug: a
 * generic edit (title, dates, sector...) must NEVER be able to flip
 * isActive. Only the dedicated PATCH /processes/:id/active path may do
 * that, and it requires a reason.
 */

function makeRes() {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response & { status: jest.Mock; json: jest.Mock };
}

/**
 * Controllers are wrapped in asyncHandler, which fires the underlying promise
 * but returns void — so callers can't await them directly. This runs the
 * handler and resolves once it has either responded or called next(err).
 */
function runHandler(
    handler: (req: Request, res: Response, next: any) => void,
    req: Request,
    res: Response & { json: jest.Mock },
    next: jest.Mock
): Promise<void> {
    return new Promise((resolve, reject) => {
        // Safety net so a handler that neither responds nor calls next fails
        // loudly instead of hanging until the suite timeout.
        const timer = setTimeout(
            () => reject(new Error('handler did not respond or call next')),
            10000
        );
        const done = () => {
            clearTimeout(timer);
            resolve();
        };
        res.json.mockImplementation(() => {
            done();
            return res;
        });
        next.mockImplementation(() => {
            done();
        });
        try {
            handler(req, res, next);
        } catch (err) {
            clearTimeout(timer);
            reject(err);
        }
    });
}

function makeReq(overrides: Partial<Request> & { user: AuthenticatedUser; companyId: string }): Request {
    return {
        headers: {},
        ip: '127.0.0.1',
        socket: {} as any,
        params: {},
        body: {},
        query: {},
        ...overrides,
    } as unknown as Request;
}

async function seedCompanyWithOpenCycle(sectorName = 'Contabilidade') {
    const company = await Company.create({
        name: 'Empresa Teste Regressao',
        sectors: [{ name: sectorName }],
    });
    const cycle = await Cycle.create({
        companyId: company._id,
        sector: sectorName,
        month: '2026-09',
        status: CycleStatus.OPEN,
        openedAt: new Date(),
        closedAt: null,
        kpis: { avgScore: 0, onTimePct: 0, criticalCount: 0, totalProcesses: 0, avgDeviationDays: 0 },
    });
    const master = await User.create({
        name: 'Master Teste',
        email: `master-${Date.now()}@teste.com`,
        passwordHash: 'senha123456',
        roles: [UserRole.MASTER],
        companyAccess: [{ companyId: company._id, role: UserRole.MASTER, sectors: [] }],
    });
    return { company, cycle, master, sectorName };
}

function authUserFor(master: any, companyId: string): AuthenticatedUser {
    return {
        userId: master._id.toString(),
        email: master.email,
        roles: master.roles,
        activeCompanyId: companyId,
        companyAccess: [{ companyId, role: UserRole.MASTER, sectors: [] }],
        sector: '',
        sectors: [],
    };
}

describe('Process isActive regression', () => {
    it('creates a new process as active, even if the client sends isActive:false', async () => {
        const { company, master, sectorName } = await seedCompanyWithOpenCycle();
        const companyId = company._id.toString();
        const req = makeReq({
            user: authUserFor(master, companyId),
            companyId,
            body: {
                title: 'Processo de teste',
                sector: sectorName,
                plannedDate: '2026-09-05',
                limitDate: '2026-09-10',
                // A malicious/buggy client might still send this — must be ignored.
                isActive: false,
            } as any,
        });
        const res = makeRes();
        const next = jest.fn();

        await runHandler(createProcess, req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        const created = res.json.mock.calls[0][0].data;
        expect(created.isActive).toBe(true);

        const fromDb = await Process.findById(created._id);
        expect(fromDb!.isActive).toBe(true);
    });

    it('editing title/dates never changes isActive, even if isActive is present in the body', async () => {
        const { company, master, sectorName } = await seedCompanyWithOpenCycle();
        const companyId = company._id.toString();

        const process = await Process.create({
            companyId: company._id,
            cycleId: (await Cycle.findOne({ companyId: company._id }))!._id,
            code: '001',
            title: 'Original',
            sector: sectorName,
            plannedDate: new Date('2026-09-05'),
            limitDate: new Date('2026-09-10'),
            status: 'PENDING',
            isActive: true,
        });

        const req = makeReq({
            user: authUserFor(master, companyId),
            companyId,
            params: { id: process._id.toString() },
            body: { title: 'Titulo Editado', isActive: false } as any,
        });
        const res = makeRes();
        const next = jest.fn();

        await runHandler(updateProcess, req, res, next);

        const fromDb = await Process.findById(process._id);
        expect(fromDb!.title).toBe('Titulo Editado');
        expect(fromDb!.isActive).toBe(true); // must remain untouched by a generic edit
    });

    it('setProcessActive requires a reason and records who/why/when', async () => {
        const { company, master, sectorName } = await seedCompanyWithOpenCycle();
        const companyId = company._id.toString();

        const process = await Process.create({
            companyId: company._id,
            cycleId: (await Cycle.findOne({ companyId: company._id }))!._id,
            code: '002',
            title: 'Processo a inativar',
            sector: sectorName,
            plannedDate: new Date('2026-09-05'),
            limitDate: new Date('2026-09-10'),
            status: 'PENDING',
            isActive: true,
        });

        const req = makeReq({
            user: authUserFor(master, companyId),
            companyId,
            params: { id: process._id.toString() },
            body: { isActive: false, reason: 'Duplicado por engano' } as any,
        });
        const res = makeRes();
        const next = jest.fn();

        await runHandler(setProcessActive, req, res, next);

        const fromDb: any = await Process.findById(process._id);
        expect(fromDb.isActive).toBe(false);
        expect(fromDb.deactivationReason).toBe('Duplicado por engano');
        expect(fromDb.deactivatedBy?.toString()).toBe(master._id.toString());
        expect(fromDb.deactivatedAt).toBeTruthy();
    });

    it('non-MASTER users cannot activate/deactivate processes', async () => {
        const { company, sectorName } = await seedCompanyWithOpenCycle();
        const companyId = company._id.toString();

        const operator = await User.create({
            name: 'Operador Teste',
            email: `operador-${Date.now()}@teste.com`,
            passwordHash: 'senha123456',
            roles: [UserRole.OPERATOR],
            companyAccess: [{ companyId: company._id, role: UserRole.OPERATOR, sectors: [sectorName] }],
        });

        const process = await Process.create({
            companyId: company._id,
            cycleId: (await Cycle.findOne({ companyId: company._id }))!._id,
            code: '003',
            title: 'Processo protegido',
            sector: sectorName,
            plannedDate: new Date('2026-09-05'),
            limitDate: new Date('2026-09-10'),
            status: 'PENDING',
            isActive: true,
        });

        const req = makeReq({
            user: {
                userId: operator._id.toString(),
                email: operator.email,
                roles: operator.roles,
                activeCompanyId: companyId,
                companyAccess: [{ companyId, role: UserRole.OPERATOR, sectors: [sectorName] }],
                sector: '',
                sectors: [sectorName],
            },
            companyId,
            params: { id: process._id.toString() },
            body: { isActive: false, reason: 'Tentativa não autorizada' } as any,
        });
        const res = makeRes();
        const next = jest.fn();

        await runHandler(setProcessActive, req, res, next);

        expect(next).toHaveBeenCalled();
        const err = next.mock.calls[0][0];
        expect(err.statusCode ?? err.status).toBe(403);

        const fromDb = await Process.findById(process._id);
        expect(fromDb!.isActive).toBe(true);
    });
});
