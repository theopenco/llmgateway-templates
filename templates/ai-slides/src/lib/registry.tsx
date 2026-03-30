"use client";

import { defineRegistry } from "@json-render/react";
import { catalog } from "./catalog";
import {
  BarChartComponent,
  LineChartComponent,
  AreaChartComponent,
  PieChartComponent,
} from "@/components/chart-components";

export const registry = defineRegistry(catalog, {
  components: {
    BarChart: (renderProps) => (
      <BarChartComponent props={renderProps.props as Parameters<typeof BarChartComponent>[0]["props"]} />
    ),
    LineChart: (renderProps) => (
      <LineChartComponent props={renderProps.props as Parameters<typeof LineChartComponent>[0]["props"]} />
    ),
    AreaChart: (renderProps) => (
      <AreaChartComponent props={renderProps.props as Parameters<typeof AreaChartComponent>[0]["props"]} />
    ),
    PieChart: (renderProps) => (
      <PieChartComponent props={renderProps.props as Parameters<typeof PieChartComponent>[0]["props"]} />
    ),
  },
  actions: {},
});
