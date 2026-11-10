import { useState } from 'react';
import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatBusinessDate } from '../utils/businessDate';

const modes = [
    { value: 'line', label: 'Linha' },
    { value: 'bar', label: 'Barras' },
    { value: 'pie', label: 'Pizza' },
] as const;

interface Props {
    title: string;
    description: string;
    data: { day: number }[];
    metrics: { key: string; label: string; color: string; dashed?: boolean }[];
    snapshot?: { date: string; description: string; slices: { name: string; count: number; color: string }[] };
}

export default function ProcessCurveChart({ title, description, data, metrics, snapshot }: Props) {
    const [mode, setMode] = useState<typeof modes[number]['value']>('line');
    const slices = snapshot?.slices.filter(slice => slice.count > 0) ?? [];
    const total = slices.reduce((sum, slice) => sum + slice.count, 0);
    const chartProps = { data, margin: { right: 12 } };
    const axes = <>
        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
        <XAxis dataKey="day" /><YAxis width={38} allowDecimals={false} />
        <Tooltip labelFormatter={day => `Dia ${day}`} /><Legend />
    </>;

    return <section className="card min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div role="group" aria-label={`Tipo de gráfico: ${title}`} className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
                {modes.map(option => <button key={option.value} type="button" aria-pressed={mode === option.value}
                    onClick={() => setMode(option.value)}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${mode === option.value ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                    {option.label}
                </button>)}
            </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
            {mode === 'pie' && snapshot ? `${formatBusinessDate(snapshot.date)} · ${snapshot.description}` : description}
        </p>
        {mode === 'pie' && !total ? (
            <p className="mt-4 text-sm text-gray-500">{snapshot ? 'Nenhum processo nesta composição.' : 'O mês selecionado ainda não começou.'}</p>
        ) : !data.length ? (
            <p className="mt-4 text-sm text-gray-500">O mês selecionado ainda não começou.</p>
        ) : <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
                {mode === 'line' ? <LineChart {...chartProps}>
                    {axes}
                    {metrics.map(metric => <Line key={metric.key} type="stepAfter" dataKey={metric.key}
                        name={metric.label} stroke={metric.color} strokeDasharray={metric.dashed ? '5 4' : undefined}
                        strokeWidth={2} dot={data.length === 1} isAnimationActive={false} />)}
                </LineChart> : mode === 'bar' ? <BarChart {...chartProps}>
                    {axes}
                    {metrics.map(metric => <Bar key={metric.key} dataKey={metric.key} name={metric.label}
                        fill={metric.color} maxBarSize={24} isAnimationActive={false} />)}
                </BarChart> : <PieChart>
                    <Pie data={slices} dataKey="count" nameKey="name" outerRadius="78%" isAnimationActive={false}>
                        {slices.map(slice => <Cell key={slice.name} fill={slice.color} />)}
                    </Pie>
                    <Tooltip formatter={value => `${value} · ${(Number(value) / total).toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 })}`} />
                    <Legend formatter={name => {
                        const count = slices.find(slice => slice.name === name)?.count ?? 0;
                        return `${name} (${count})`;
                    }} />
                </PieChart>}
            </ResponsiveContainer>
        </div>}
    </section>;
}
