import { EmailQueue, EmailStatus, Process } from '../../models';
import { DeliveryStatus } from '../../types';

// The SMTP worker alone can mark a delivery email as sent. A batch token
// prevents old queued messages from changing a reverted/reconfirmed delivery.
export async function syncDeliveryEmailStatus(item: any): Promise<void> {
    if (item.category !== 'process_delivery' || !item.deliveryBatchId || !item.entityId) return;
    const messages = await EmailQueue.find({ companyId: item.companyId, entityId: item.entityId, deliveryBatchId: item.deliveryBatchId });
    if (!messages.length) return;
    const allSent = messages.every(q => q.status === EmailStatus.SENT);
    const allSettled = messages.every(q => [EmailStatus.SENT, EmailStatus.FAILED].includes(q.status));
    if (!allSent && !allSettled) return;
    await Process.updateOne({ _id: item.entityId, companyId: item.companyId, deliveryEmailBatchId: item.deliveryBatchId, deliveryStatus: DeliveryStatus.EMAIL_QUEUED }, {
        $set: { deliveryStatus: allSent ? DeliveryStatus.EMAIL_SENT : DeliveryStatus.EMAIL_FAILED, emailSentAt: allSent ? new Date() : null },
    });
}
