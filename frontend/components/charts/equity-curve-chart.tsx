"use client";

import { useRef, useEffect } from "react";
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";

interface EquityCurveChartProps {
  data?: { time: string; value: number }[];
  height?: number;
  multiSeries?: boolean;
  series?: Array<{ name: string; data: { time: string; value: number }[] }>;
}

const sampleEquity = Array.from({ length: 80 }, (_, i) => ({
  time: `2024-01-${String(i + 1).padStart(2, "0")}`,
  value: 100 + i * 0.5 + Math.sin(i * 0.1) * 5 + (Math.random() - 0.5) * 3,
}));

// Charting libs require strictly time-ordered data with unique times.
// Sort ascending and average duplicate timestamps instead of throwing.
function sanitizeSeries(data: { time: string; value: number }[]) {
  const byTime = new Map<string, { sum: number; n: number }>();
  for (const p of data) {
    const t = String(p.time);
    const cur = byTime.get(t);
    if (cur) {
      cur.sum += Number(p.value) || 0;
      cur.n += 1;
    } else {
      byTime.set(t, { sum: Number(p.value) || 0, n: 1 });
    }
  }
  return Array.from(byTime.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([time, { sum, n }]) => ({ time, value: sum / n }));
}

export function EquityCurveChart({
  data = sampleEquity,
  height = 260,
  series,
}: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // lightweight-charts feeds colors straight into the canvas API, which
    // cannot resolve CSS variables like var(--border) — resolve them to
    // concrete color values up-front (same pattern as mini-chart.tsx).
    const style = getComputedStyle(document.documentElement);
    const textTertiary = style.getPropertyValue("--text-tertiary").trim() || "#7a7a86";
    const borderColor = style.getPropertyValue("--border").trim() || "#2a2a32";
    const borderHover = style.getPropertyValue("--border-hover").trim() || "#3a3a44";
    const accentColor = style.getPropertyValue("--accent").trim() || "#007aff";
    const monoFont =
      getComputedStyle(document.body).fontFamily || "SFMono-Regular, Consolas, monospace";

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: "solid" as any, color: "transparent" },
        textColor: textTertiary,
        fontFamily: monoFont,
      },
      grid: {
        vertLines: { color: borderColor },
        horzLines: { color: borderColor },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.2, bottom: 0.2 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        tickMarkFormatter: (time: string | number) => String(time).slice(5),
      },      crosshair: {
        mode: 1,
        vertLine: { color: borderHover },
        horzLine: { color: borderHover },
      },
      handleScroll: true,
      handleScale: true,
    });

    if (series && series.length > 0) {
      series.forEach((s) => {
        const lineSeries = chart.addAreaSeries({
          topColor: "rgba(0, 122, 255, 0.2)",
          bottomColor: "rgba(0, 122, 255, 0.02)",
          lineColor: accentColor,
          lineWidth: 2,
          priceLineVisible: true,
          priceLineColor: borderHover,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        } as any);
        lineSeries.setData(sanitizeSeries(s.data));
      });
    } else {
      const areaSeries = chart.addAreaSeries({
        topColor: "rgba(0, 122, 255, 0.2)",
        bottomColor: "rgba(0, 122, 255, 0.02)",
        lineColor: accentColor,
        lineWidth: 2,
        lineStyle: 1,
        priceLineVisible: true,
        priceLineColor: borderHover,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      areaSeries.setData(sanitizeSeries(data));
    }

    chartRef.current = chart;

    return () => chart.remove();
  }, [data, height]);

  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chartRef.current?.applyOptions({
          width: entry.contentRect.width,
          height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [height]);

  return <div ref={containerRef} className="w-full" />;
}
