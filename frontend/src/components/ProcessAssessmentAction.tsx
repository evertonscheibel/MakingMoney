import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Process } from '../types';
import { api } from '../api/client';

export default function ProcessAssessmentAction({ process }: { process: Process }) {
    const [open, setOpen] = useState(false), [reason, setReason] = useState('');
    const client = useQueryClient();
    const mutation = useMutation({ mutationFn: () => api.patch(`/processes/${process._id}/assessment`, {
        required: process.assessmentRequired === false, reason,
    }), onSuccess: () => { setOpen(false); setReason('');
        ['processes', 'summary', 'extract', 'myMetrics', 'teamMetrics', 'performance-evolution'].forEach(key => client.invalidateQueries({ queryKey: [key] }));
    } });
    return <>
        <button type="button" className="rounded px-2 py-1 text-xs border text-gray-600" title="Alterar aplicabilidade nesta competência" onClick={() => setOpen(true)}>Aplicabilidade</button>
        {open && <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label="Aplicabilidade da avaliação">
            <form className="card w-full max-w-md space-y-4 text-left" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
                <h2 className="font-semibold">{process.assessmentRequired === false ? 'Exigir avaliação' : 'Marcar como não aplicável'}</h2>
                <p className="text-sm">{process.title}. Esta alteração vale somente para o ciclo deste processo e terá motivo registrado.</p>
                <label className="block text-sm">Motivo<textarea className="input mt-1" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
                {mutation.isError && <p role="alert" className="text-red-700 text-sm">{mutation.error.message}</p>}
                <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" disabled={!reason.trim() || mutation.isPending}>Salvar</button></div>
            </form>
        </div>}
    </>;
}
