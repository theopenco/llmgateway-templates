"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  Line,
  LineChart as RechartsLineChart,
  Area,
  AreaChart as RechartsAreaChart,
  Pie,
  PieChart as RechartsePieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const DEFAULT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#eab308",
  "#9333ea",
  "#e11d48",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
];

function getColors(custom?: string[]): string[] {
  return custom && custom.length > 0 ? custom : DEFAULT_COLORS;
}

type SeriesConfig = {
  dataKey: string;
  label?: string;
  color?: string;
  stackId?: string;
};

type ChartWrapperProps = {
  title?: string;
  description?: string;
  children: React.ReactElement;
};

function ChartWrapper({ title, description, children }: ChartWrapperProps) {
  return (
    <div className="w-full h-full flex flex-col">
      {(title || description) && (
        <div className="mb-2 shrink-0">
          {title && (
            <h4 className="text-sm font-semibold text-inherit">{title}</h4>
          )}
          {description && (
            <p className="text-xs opacity-70">{description}</p>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type BarChartProps = {
  title?: string;
  description?: string;
  data: Record<string, string | number>[];
  series: SeriesConfig[];
  xAxisKey: string;
  layout?: "vertical" | "horizontal";
  stacked?: boolean;
};

export function BarChartComponent({
  props,
  colors,
}: {
  props: BarChartProps;
  colors?: string[];
}) {
  const { title, description, data, series, xAxisKey, layout, stacked } = props;
  const palette = getColors(colors);
  return (
    <ChartWrapper title={title} description={description}>
      <RechartsBarChart data={data} layout={layout}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis
          dataKey={layout === "horizontal" ? undefined : xAxisKey}
          type={layout === "horizontal" ? "number" : "category"}
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.5}
        />
        <YAxis
          dataKey={layout === "horizontal" ? xAxisKey : undefined}
          type={layout === "horizontal" ? "category" : "number"}
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.5}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.label || s.dataKey}
            fill={s.color || palette[i % palette.length]}
            stackId={stacked ? "stack" : s.stackId}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ChartWrapper>
  );
}

type LineChartProps = {
  title?: string;
  description?: string;
  data: Record<string, string | number>[];
  series: SeriesConfig[];
  xAxisKey: string;
  curved?: boolean;
};

export function LineChartComponent({
  props,
  colors,
}: {
  props: LineChartProps;
  colors?: string[];
}) {
  const { title, description, data, series, xAxisKey, curved } = props;
  const palette = getColors(colors);
  return (
    <ChartWrapper title={title} description={description}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.5}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.5}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.label || s.dataKey}
            stroke={s.color || palette[i % palette.length]}
            type={curved ? "monotone" : "linear"}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </RechartsLineChart>
    </ChartWrapper>
  );
}

type AreaChartProps = {
  title?: string;
  description?: string;
  data: Record<string, string | number>[];
  series: SeriesConfig[];
  xAxisKey: string;
  stacked?: boolean;
};

export function AreaChartComponent({
  props,
  colors,
}: {
  props: AreaChartProps;
  colors?: string[];
}) {
  const { title, description, data, series, xAxisKey, stacked } = props;
  const palette = getColors(colors);
  return (
    <ChartWrapper title={title} description={description}>
      <RechartsAreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.5}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.5}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => {
          const color = s.color || palette[i % palette.length];
          return (
            <Area
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.label || s.dataKey}
              stroke={color}
              fill={color}
              fillOpacity={0.2}
              type="monotone"
              stackId={stacked ? "stack" : s.stackId}
              strokeWidth={2}
            />
          );
        })}
      </RechartsAreaChart>
    </ChartWrapper>
  );
}

type PieChartProps = {
  title?: string;
  description?: string;
  data: { label: string; value: number; fill?: string }[];
  innerRadius?: number;
  showLabel?: boolean;
};

export function PieChartComponent({
  props,
  colors,
}: {
  props: PieChartProps;
  colors?: string[];
}) {
  const { title, description, data, innerRadius, showLabel } = props;
  const palette = getColors(colors);
  return (
    <ChartWrapper title={title} description={description}>
      <RechartsePieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius || 0}
          outerRadius={80}
          label={
            showLabel !== false
              ? ({ label, percent }: { label: string; percent: number }) =>
                  `${label} ${(percent * 100).toFixed(0)}%`
              : undefined
          }
          labelLine={showLabel !== false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.fill || palette[index % palette.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RechartsePieChart>
    </ChartWrapper>
  );
}
