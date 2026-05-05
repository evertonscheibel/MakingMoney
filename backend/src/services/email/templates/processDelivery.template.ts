import { Process } from '../../../models';

interface ProcessDeliveryEmailProps {
    recipientName: string;
    process: any;
    statusText: string;
}

export const getProcessDeliveryEmailTemplate = ({ recipientName, process, statusText }: ProcessDeliveryEmailProps): string => {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #2563eb;">Processo Entregue</h2>
            <p>Olá ${recipientName},</p>
            <p>Um processo do setor <strong>${process.sector}</strong> foi marcado como entregue:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Código:</strong> ${process.code}</p>
                <p><strong>Título:</strong> ${process.title}</p>
                <p><strong>Setor:</strong> ${process.sector}</p>
                <p><strong>Data de Entrega:</strong> ${new Date(process.deliveryDate).toLocaleDateString('pt-BR')}</p>
                <p><strong>Pontuação:</strong> <span style="color: ${process.score! >= 75 ? '#16a34a' : process.score! >= 50 ? '#eab308' : '#dc2626'}; font-weight: bold;">${process.score}</span></p>
                <p><strong>Status:</strong> ${statusText}</p>
                ${process.deliveryEvidence ? `<p><strong>Evidência:</strong> ${process.deliveryEvidence}</p>` : ''}
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
                Esta é uma notificação automática do sistema Metodo Chronos.
            </p>
        </div>
    `;
};

