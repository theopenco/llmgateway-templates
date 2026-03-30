import { schema } from "@json-render/react";
import { z } from "zod";

const seriesSchema = z.object({
  dataKey: z.string(),
  label: z.string().optional(),
  color: z.string().optional(),
  stackId: z.string().optional(),
});

export const catalog = schema.createCatalog({
  components: {
    BarChart: {
      description: "A bar chart for comparing categorical data",
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(
          z.record(z.string(), z.union([z.string(), z.number()]))
        ),
        series: z.array(seriesSchema),
        xAxisKey: z.string(),
        layout: z.enum(["vertical", "horizontal"]).optional(),
        stacked: z.boolean().optional(),
      }),
    },
    LineChart: {
      description: "A line chart for showing trends over time",
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(
          z.record(z.string(), z.union([z.string(), z.number()]))
        ),
        series: z.array(seriesSchema),
        xAxisKey: z.string(),
        curved: z.boolean().optional(),
      }),
    },
    AreaChart: {
      description: "An area chart for showing volume trends",
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(
          z.record(z.string(), z.union([z.string(), z.number()]))
        ),
        series: z.array(seriesSchema),
        xAxisKey: z.string(),
        stacked: z.boolean().optional(),
      }),
    },
    PieChart: {
      description: "A pie chart for showing proportions",
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        data: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
            fill: z.string().optional(),
          })
        ),
        innerRadius: z.number().optional(),
        showLabel: z.boolean().optional(),
      }),
    },
  },
  actions: {},
});
