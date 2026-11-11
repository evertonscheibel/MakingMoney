export const eventMonth = (timestamp: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(timestamp)).slice(0, 7);

export const formatEventDate = (timestamp: string) => new Date(timestamp).toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' });
