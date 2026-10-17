"use client";

import { useRef, useEffect, useState } from "react";
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";

interface MiniChartProps {
  data?: { time: string; value: number }[];
  height?: number;
}

const defaultData = Array.from({ length: 50 }, (_, i) => {
  const d = new Date(2024, 0, i + 1);
  const time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    time,
    value: 100 + Math.sin(i * 0.2) * 15 + (Math.random() - 0.5) * 8,
  };
});

export function MiniChart({ data = defaultData, height = 80 }: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Bumped by the ResizeObserver when the container gains a real width after
  // mounting at zero width, so chart creation is retried.
  const [mountTick, setMountTick] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any existing chart (guard against double-dispose in Strict Mode)
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {
        // chart already disposed
      }
      chartRef.current = null;
    }

    // lightweight-charts can't parse CSS variable references, so resolve
    // them to actual color values via getComputedStyle
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue("--text-tertiary").trim() || "#888888";
    const accentColor = style.getPropertyValue("--accent").trim() || "#3b82f6";
    const monoFont = style.getPropertyValue("--font-mono").trim() || "monospace";

    // Guard: containers briefly report zero width during first paint right
    // after a server restart (hydration), which crashes lightweight-charts
    // internals with "Value is null". Defer init until there is real width.
    const width = containerRef.current.clientWidth;
    if (width <= 0) return;

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { type: "solid" as any, color: "transparent" },
        textColor,
        fontFamily: monoFont,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        scaleMargins: { top: 0.2, bottom: 0.2 },
        borderVisible: false,
      },
      timeScale: {
        visible: false,
      },
      crosshair: {
        showHorizontalLine: false,
        showVerticalLine: false,
      } as any,
      handleScroll: false,
      handleScale: false,
    });

    const lineSeries = chart.addLineSeries({
      color: accentColor,
      lineWidth: 2,
      lineStyle: 1,
      priceLineColor: accentColor,
      priceLine: { visible: false },
      lastValueVisible: false,
      overlayPriceScales: {
        scalesVisible: false,
      },
    } as any);

    lineSeries.setData(data);
    chartRef.current = chart;
    lineSeriesRef.current = lineSeries;

    return () => {
      chart.remove();
    };
  }, [data, height, mountTick]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (!chartRef.current) {
          // Chart not created yet (zero-width mount): retry creation now
          // that the container has a real width.
          if (entry.contentRect.width > 0) setMountTick((t) => t + 1);
          continue;
        }
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
