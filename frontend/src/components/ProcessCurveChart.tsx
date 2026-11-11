import { useState } from 'react';
import {
    Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
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
    const CartesianChart = mode === 'bar' ? BarChart : LineChart;

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
                {mode === 'pie' ? <PieChart>
                    <Pie data={slices} dataKey="count" nameKey="name" outerRadius="78%" isAnimationActive={false}>
                        {slices.map(slice => <Cell key={slice.name} fill={slice.color} />)}
                    </Pie>
                    <Tooltip formatter={value => `${value} · ${(Number(value) / total).toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 })}`} />
                </PieChart> : <CartesianChart data={data} margin={{ top: 8, right: 12, left: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis dataKey="day" height={42} tick={{ fontSize: 11 }}
                        label={{ value: 'Dia do mês', position: 'insideBottom', offset: 0, fontSize: 11 }} />
                    <YAxis width={52} allowDecimals={false} tick={{ fontSize: 11 }}
                        label={{ value: 'Processos', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip labelFormatter={day => `Dia ${day}`} cursor={mode === 'bar' ? { fill: 'transparent' } : undefined} />
                    {mode === 'bar'
                        ? metrics.map(metric => <Bar key={metric.key} dataKey={metric.key} name={metric.label}
                            fill={metric.color} maxBarSize={24} isAnimationActive={false} />)
                        : metrics.map(metric => <Line key={metric.key} type="stepAfter" dataKey={metric.key}
                            name={metric.label} stroke={metric.color} strokeDasharray={metric.dashed ? '5 4' : undefined}
                            strokeWidth={2} dot={data.length === 1} isAnimationActive={false} />)}
                </CartesianChart>}
            </ResponsiveContainer>
        </div>}
        <ul aria-label={`Legenda: ${title}`} className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
            {mode === 'pie' ? snapshot?.slices.map(slice => <li key={slice.name} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
                {slice.name} · {slice.count}{total > 0 && ` (${(slice.count / total).toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 })})`}
            </li>) : metrics.map(metric => <li key={metric.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: metric.color }} />
                {metric.label}
            </li>)}
        </ul>
    </section>;
}
