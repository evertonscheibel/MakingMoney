/** Clone lineage is proven by the source document, never inferred from code/title. */
export function cloneProcessMetadata(process: any) {
    return { lineageId: process.lineageId || process._id, sourceProcessId: process._id,
        // Not-applicable is a decision for one competence, not an indefinite exemption.
        assessmentRequired: true, nonApplicableReason: null,
        evaluatedResponsibleUserId: null, evaluationRuleVersion: null,
        responsibilityChangedAt: null };
}
