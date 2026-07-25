/**
 * Advanced Chart Component v3.0 — TradingView Lightweight Charts
 * 
 * Professional stock chart matching TradingView's look and feel:
 * - TradingView Lightweight Charts library for rendering
 * - Proper candlestick/area/bar chart types
 * - Professional crosshair with price/time labels
 * - Volume histogram below main chart
 * - Technical indicators (SMA, EMA, Bollinger Bands)
 * - Time range selector toolbar
 * - Dark theme matching TradingView
 * - Abboud AI overlay (price lines for fib/targets/stop-loss)
 * - Responsive design
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { createChart, ColorType, CrosshairMode, LineStyle, PriceScaleMode } from "lightweight-charts";
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time } from "lightweight-charts";
import { CandlestickSeries, LineSeries, HistogramSeries, AreaSeries } from "lightweight-charts";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CandlestickChart, LineChart as LineChartIcon, BarChart2, AreaChart as AreaChartIcon,
  TrendingUp, Activity, Layers, Sparkles, Maximize2, Minimize2,
  RotateCcw, Settings2, ChevronDown,
} from "lucide-react";
import { AbboudSignalCard, useAbboudIndicator } from "./AbboudIndicatorOverlay";

interface AdvancedChartProps {
  symbol: string;
  exchange: "ADX" | "DFM";
  chartData: Array<{ date: string; isoDate?: string; close: number; volume: number; open?: number; high?: number; low?: number }>;
  chartRange: string;
  onRangeChange: (range: string) => void;
  chartLoading: boolean;
}

const chartRanges = [
  { label: "1D", value: "1d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
];

type ChartType = "candlestick" | "line" | "area" | "bar";

// TradingView-style dark theme colors
const TV_COLORS = {
  background: "#131722",
  text: "#d1d4dc",
  textDim: "#787b86",
  grid: "#1e222d",
  border: "#2a2e39",
  crosshair: "#758696",
  upColor: "#26a69a",
  downColor: "#ef5350",
  upWick: "#26a69a",
  downWick: "#ef5350",
  volumeUp: "rgba(38, 166, 154, 0.3)",
  volumeDown: "rgba(239, 83, 80, 0.3)",
  sma20: "#2962ff",
  sma50: "#ff6d00",
  sma200: "#ab47bc",
  ema9: "#26c6da",
  bb: "rgba(33, 150, 243, 0.3)",
  bbLine: "#2196f3",
};

// Calculate SMA
function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// Calculate EMA
function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(ema);
    } else {
      ema = (data[i] - ema!) * multiplier + ema!;
      result.push(ema);
    }
  }
  return result;
}

// Calculate Bollinger Bands
function calcBB(data: number[], period: number = 20, stdDev: number = 2) {
  const sma = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i]!;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const sd = Math.sqrt(variance) * stdDev;
      upper.push(mean + sd);
      lower.push(mean - sd);
    }
  }
  return { upper, lower, middle: sma };
}

// Calculate RSI
function calcRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (data.length < period + 1) return data.map(() => null);
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = 0; i < period; i++) result.push(null);
  result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }
  return result;
}

// Calculate MACD
function calcMACD(data: number[], fast: number = 12, slow: number = 26, signal: number = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const macdLine: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    } else {
      macdLine.push(null);
    }
  }
  
  const validMacd = macdLine.filter(v => v !== null) as number[];
  const signalLine = calcEMA(validMacd, signal);
  
  // Align signal line with MACD line
  const result: { macd: number | null; signal: number | null; histogram: number | null }[] = [];
  let validIdx = 0;
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null) {
      result.push({ macd: null, signal: null, histogram: null });
    } else {
      const sig = signalLine[validIdx] ?? null;
      const hist = sig !== null ? macdLine[i]! - sig : null;
      result.push({ macd: macdLine[i], signal: sig, histogram: hist });
      validIdx++;
    }
  }
  return result;
}

export function AdvancedChart({ symbol, exchange, chartData, chartRange, onRangeChange, chartLoading }: AdvancedChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showEMA9, setShowEMA9] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showAbboud, setShowAbboud] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  // Abboud AI data
  const { data: abboudData } = useAbboudIndicator(symbol, exchange, showAbboud);

  // Convert chart data to Lightweight Charts format
  const formattedData = useMemo(() => {
    if (!chartData || chartData.length === 0) return { candles: [], volumes: [], closes: [] };
    
    const candles: CandlestickData[] = [];
    const volumes: HistogramData[] = [];
    const closes: number[] = [];
    
    for (const point of chartData) {
      if (!point.isoDate || !point.close) continue;
      const time = point.isoDate as Time;
      candles.push({
        time,
        open: point.open ?? point.close,
        high: point.high ?? point.close,
        low: point.low ?? point.close,
        close: point.close,
      });
      const isUp = (point.close >= (point.open ?? point.close));
      volumes.push({
        time,
        value: point.volume || 0,
        color: isUp ? TV_COLORS.volumeUp : TV_COLORS.volumeDown,
      });
      closes.push(point.close);
    }
    
    return { candles, volumes, closes };
  }, [chartData]);

  // Create and manage the main chart
  useEffect(() => {
    if (!chartContainerRef.current || formattedData.candles.length === 0) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: isFullscreen ? window.innerHeight - 200 : 420,
      layout: {
        background: { type: ColorType.Solid, color: TV_COLORS.background },
        textColor: TV_COLORS.text,
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: TV_COLORS.grid, style: LineStyle.Dotted },
        horzLines: { color: TV_COLORS.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: TV_COLORS.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2a2e39",
        },
        horzLine: {
          color: TV_COLORS.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2a2e39",
        },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: TV_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // Add main series based on chart type
    let mainSeries: ISeriesApi<any>;
    if (chartType === "candlestick") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: TV_COLORS.upColor,
        downColor: TV_COLORS.downColor,
        borderDownColor: TV_COLORS.downColor,
        borderUpColor: TV_COLORS.upColor,
        wickDownColor: TV_COLORS.downWick,
        wickUpColor: TV_COLORS.upWick,
      });
      mainSeries.setData(formattedData.candles);
    } else if (chartType === "line") {
      mainSeries = chart.addSeries(LineSeries, {
        color: "#2962ff",
        lineWidth: 2,
      });
      mainSeries.setData(formattedData.candles.map(c => ({ time: c.time, value: c.close })));
    } else if (chartType === "area") {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: "#2962ff",
        topColor: "rgba(41, 98, 255, 0.3)",
        bottomColor: "rgba(41, 98, 255, 0.02)",
        lineWidth: 2,
      });
      mainSeries.setData(formattedData.candles.map(c => ({ time: c.time, value: c.close })));
    } else {
      // Bar chart - use candlestick with thin bodies
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: TV_COLORS.upColor,
        downColor: TV_COLORS.downColor,
        borderDownColor: TV_COLORS.downColor,
        borderUpColor: TV_COLORS.upColor,
        wickDownColor: TV_COLORS.downWick,
        wickUpColor: TV_COLORS.upWick,
      });
      mainSeries.setData(formattedData.candles);
    }

    // Add SMA 20
    if (showSMA20 && formattedData.closes.length > 20) {
      const sma20 = calcSMA(formattedData.closes, 20);
      const sma20Series = chart.addSeries(LineSeries, {
        color: TV_COLORS.sma20,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const sma20Data: LineData[] = [];
      for (let i = 0; i < sma20.length; i++) {
        if (sma20[i] !== null) {
          sma20Data.push({ time: formattedData.candles[i].time, value: sma20[i]! });
        }
      }
      sma20Series.setData(sma20Data);
    }

    // Add SMA 50
    if (showSMA50 && formattedData.closes.length > 50) {
      const sma50 = calcSMA(formattedData.closes, 50);
      const sma50Series = chart.addSeries(LineSeries, {
        color: TV_COLORS.sma50,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const sma50Data: LineData[] = [];
      for (let i = 0; i < sma50.length; i++) {
        if (sma50[i] !== null) {
          sma50Data.push({ time: formattedData.candles[i].time, value: sma50[i]! });
        }
      }
      sma50Series.setData(sma50Data);
    }

    // Add EMA 9
    if (showEMA9 && formattedData.closes.length > 9) {
      const ema9 = calcEMA(formattedData.closes, 9);
      const ema9Series = chart.addSeries(LineSeries, {
        color: TV_COLORS.ema9,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const ema9Data: LineData[] = [];
      for (let i = 0; i < ema9.length; i++) {
        if (ema9[i] !== null) {
          ema9Data.push({ time: formattedData.candles[i].time, value: ema9[i]! });
        }
      }
      ema9Series.setData(ema9Data);
    }

    // Add Bollinger Bands
    if (showBB && formattedData.closes.length > 20) {
      const bb = calcBB(formattedData.closes, 20, 2);
      const bbUpperSeries = chart.addSeries(LineSeries, {
        color: TV_COLORS.bbLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const bbLowerSeries = chart.addSeries(LineSeries, {
        color: TV_COLORS.bbLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const upperData: LineData[] = [];
      const lowerData: LineData[] = [];
      for (let i = 0; i < bb.upper.length; i++) {
        if (bb.upper[i] !== null) {
          upperData.push({ time: formattedData.candles[i].time, value: bb.upper[i]! });
        }
        if (bb.lower[i] !== null) {
          lowerData.push({ time: formattedData.candles[i].time, value: bb.lower[i]! });
        }
      }
      bbUpperSeries.setData(upperData);
      bbLowerSeries.setData(lowerData);
    }

    // Add Abboud AI overlay (price lines)
    if (showAbboud && abboudData) {
      // Stop Loss line
      if (abboudData.signal?.stopLoss) {
        mainSeries.createPriceLine({
          price: abboudData.signal.stopLoss,
          color: "#ef5350",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "Stop Loss",
        });
      }
      // Entry zone lines
      if (abboudData.signal?.entryZone) {
        mainSeries.createPriceLine({
          price: abboudData.signal.entryZone.low,
          color: "#e040fb",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "Entry Low",
        });
        mainSeries.createPriceLine({
          price: abboudData.signal.entryZone.high,
          color: "#e040fb",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "Entry High",
        });
      }
      // Target lines
      if (abboudData.signal?.targets) {
        (abboudData.signal.targets as Array<any>).forEach((target: any, idx: number) => {
          const price = typeof target === 'number' ? target : target?.price ?? target;
          if (typeof price === 'number' && !isNaN(price)) {
            mainSeries.createPriceLine({
              price,
              color: "#26a69a",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `TP${idx + 1}`,
            });
          }
        });
      }
      // Fibonacci levels
      if (abboudData.fibLevels) {
        const fibColors: Record<string, string> = {
          "0.236": "#26c6da",
          "0.382": "#66bb6a",
          "0.5": "#ffd54f",
          "0.618": "#ff7043",
          "0.786": "#ab47bc",
        };
        (abboudData.fibLevels as Array<{ level: number; price: number }>).forEach((fib) => {
          const color = fibColors[fib.level.toString()] || "#787b86";
          mainSeries.createPriceLine({
            price: fib.price,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: false,
            title: `Fib ${fib.level}`,
          });
        });
      }
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [formattedData, chartType, showSMA20, showSMA50, showEMA9, showBB, showAbboud, abboudData, isFullscreen]);

  // Volume chart
  useEffect(() => {
    if (!volumeContainerRef.current || !showVolume || formattedData.volumes.length === 0) return;

    if (volumeChartRef.current) {
      volumeChartRef.current.remove();
      volumeChartRef.current = null;
    }

    const container = volumeContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 80,
      layout: {
        background: { type: ColorType.Solid, color: TV_COLORS.background },
        textColor: TV_COLORS.textDim,
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: TV_COLORS.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelVisible: false },
        horzLine: { color: TV_COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2a2e39" },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      timeScale: { visible: false },
      handleScroll: { vertTouchDrag: false },
    });

    volumeChartRef.current = chart;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.setData(formattedData.volumes);

    // Sync time scale with main chart
    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && volumeChartRef.current) {
          volumeChartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && chartRef.current) {
          chartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (volumeContainerRef.current && volumeChartRef.current) {
        volumeChartRef.current.applyOptions({ width: volumeContainerRef.current.clientWidth });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      volumeChartRef.current = null;
    };
  }, [formattedData, showVolume]);

  // RSI chart
  useEffect(() => {
    if (!rsiContainerRef.current || !showRSI || formattedData.closes.length < 15) return;

    if (rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
    }

    const container = rsiContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 100,
      layout: {
        background: { type: ColorType.Solid, color: TV_COLORS.background },
        textColor: TV_COLORS.textDim,
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: TV_COLORS.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: { visible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelVisible: false },
        horzLine: { color: TV_COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2a2e39" },
      },
    });

    rsiChartRef.current = chart;

    const rsiValues = calcRSI(formattedData.closes, 14);
    const rsiSeries = chart.addSeries(LineSeries, {
      color: "#ab47bc",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const rsiData: LineData[] = [];
    for (let i = 0; i < rsiValues.length; i++) {
      if (rsiValues[i] !== null) {
        rsiData.push({ time: formattedData.candles[i].time, value: rsiValues[i]! });
      }
    }
    rsiSeries.setData(rsiData);

    // Overbought/Oversold lines
    const obSeries = chart.addSeries(LineSeries, {
      color: "rgba(239, 83, 80, 0.5)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const osSeries = chart.addSeries(LineSeries, {
      color: "rgba(38, 166, 154, 0.5)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const obData = rsiData.map(d => ({ time: d.time, value: 70 }));
    const osData = rsiData.map(d => ({ time: d.time, value: 30 }));
    obSeries.setData(obData);
    osSeries.setData(osData);

    chart.timeScale().fitContent();

    // Sync with main chart
    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && rsiChartRef.current) {
          rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      rsiChartRef.current = null;
    };
  }, [formattedData, showRSI]);

  // MACD chart
  useEffect(() => {
    if (!macdContainerRef.current || !showMACD || formattedData.closes.length < 27) return;

    if (macdChartRef.current) {
      macdChartRef.current.remove();
      macdChartRef.current = null;
    }

    const container = macdContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 100,
      layout: {
        background: { type: ColorType.Solid, color: TV_COLORS.background },
        textColor: TV_COLORS.textDim,
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: TV_COLORS.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: { visible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelVisible: false },
        horzLine: { color: TV_COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2a2e39" },
      },
    });

    macdChartRef.current = chart;

    const macdValues = calcMACD(formattedData.closes);
    
    // MACD line
    const macdSeries = chart.addSeries(LineSeries, {
      color: "#2962ff",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    // Signal line
    const signalSeries = chart.addSeries(LineSeries, {
      color: "#ff6d00",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    // Histogram
    const histSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const macdData: LineData[] = [];
    const signalData: LineData[] = [];
    const histData: HistogramData[] = [];

    for (let i = 0; i < macdValues.length; i++) {
      const time = formattedData.candles[i]?.time;
      if (!time) continue;
      if (macdValues[i].macd !== null) {
        macdData.push({ time, value: macdValues[i].macd! });
      }
      if (macdValues[i].signal !== null) {
        signalData.push({ time, value: macdValues[i].signal! });
      }
      if (macdValues[i].histogram !== null) {
        histData.push({
          time,
          value: macdValues[i].histogram!,
          color: macdValues[i].histogram! >= 0 ? "rgba(38, 166, 154, 0.6)" : "rgba(239, 83, 80, 0.6)",
        });
      }
    }

    histSeries.setData(histData);
    macdSeries.setData(macdData);
    signalSeries.setData(signalData);

    chart.timeScale().fitContent();

    // Sync with main chart
    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && macdChartRef.current) {
          macdChartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (macdContainerRef.current && macdChartRef.current) {
        macdChartRef.current.applyOptions({ width: macdContainerRef.current.clientWidth });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      macdChartRef.current = null;
    };
  }, [formattedData, showMACD]);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
    volumeChartRef.current?.timeScale().fitContent();
    rsiChartRef.current?.timeScale().fitContent();
    macdChartRef.current?.timeScale().fitContent();
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const indicators = [
    { key: "sma20", label: "SMA 20", active: showSMA20, toggle: () => setShowSMA20(!showSMA20), color: TV_COLORS.sma20 },
    { key: "sma50", label: "SMA 50", active: showSMA50, toggle: () => setShowSMA50(!showSMA50), color: TV_COLORS.sma50 },
    { key: "ema9", label: "EMA 9", active: showEMA9, toggle: () => setShowEMA9(!showEMA9), color: TV_COLORS.ema9 },
    { key: "bb", label: "Bollinger", active: showBB, toggle: () => setShowBB(!showBB), color: TV_COLORS.bbLine },
    { key: "rsi", label: "RSI", active: showRSI, toggle: () => setShowRSI(!showRSI), color: "#ab47bc" },
    { key: "macd", label: "MACD", active: showMACD, toggle: () => setShowMACD(!showMACD), color: "#2962ff" },
    { key: "abboud", label: "Aboood.AI", active: showAbboud, toggle: () => setShowAbboud(!showAbboud), color: "#ffd54f" },
  ];

  const chartTypes: { type: ChartType; icon: typeof CandlestickChart; label: string }[] = [
    { type: "candlestick", icon: CandlestickChart, label: "Candles" },
    { type: "line", icon: LineChartIcon, label: "Line" },
    { type: "area", icon: AreaChartIcon, label: "Area" },
    { type: "bar", icon: BarChart2, label: "Bars" },
  ];

  if (chartLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg overflow-hidden" style={{ background: TV_COLORS.background }}>
        <div className="p-4 space-y-3">
          <Skeleton className="h-8 w-full bg-[#1e222d]" />
          <Skeleton className="h-[420px] w-full bg-[#1e222d]" />
          <Skeleton className="h-[80px] w-full bg-[#1e222d]" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-lg overflow-hidden border ${isFullscreen ? "fixed inset-0 z-50" : ""}`}
      style={{ background: TV_COLORS.background, borderColor: TV_COLORS.border }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b flex-wrap" style={{ borderColor: TV_COLORS.border }}>
        {/* Chart type buttons */}
        <div className="flex items-center gap-0.5 mr-2">
          {chartTypes.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`p-1.5 rounded transition-colors ${chartType === type ? "bg-[#2962ff]/20 text-[#2962ff]" : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]"}`}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-[#2a2e39] mx-1" />

        {/* Time range buttons */}
        <div className="flex items-center gap-0.5 mr-2">
          {chartRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => onRangeChange(range.value)}
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${chartRange === range.value ? "bg-[#2962ff]/20 text-[#2962ff]" : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]"}`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-[#2a2e39] mx-1" />

        {/* Indicators dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Indicators</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showIndicatorMenu && (
            <div
              className="absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-xl py-1 min-w-[160px]"
              style={{ background: "#1e222d", borderColor: TV_COLORS.border }}
            >
              {indicators.map((ind) => (
                <button
                  key={ind.key}
                  onClick={() => { ind.toggle(); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[#2a2e39] transition-colors text-left"
                >
                  <div className="w-3 h-3 rounded-sm border" style={{ borderColor: ind.color, background: ind.active ? ind.color : "transparent" }} />
                  <span className={ind.active ? "text-[#d1d4dc]" : "text-[#787b86]"}>{ind.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Volume toggle */}
        <button
          onClick={() => setShowVolume(!showVolume)}
          className={`p-1.5 rounded transition-colors ${showVolume ? "text-[#d1d4dc]" : "text-[#787b86]"} hover:bg-[#1e222d]`}
          title="Volume"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Reset zoom */}
        <button onClick={handleResetZoom} className="p-1.5 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors" title="Reset zoom">
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} className="p-1.5 rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d] transition-colors" title="Fullscreen">
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Active indicators legend */}
      {(showSMA20 || showSMA50 || showEMA9 || showBB || showAbboud) && (
        <div className="flex items-center gap-3 px-3 py-1 text-[10px]" style={{ borderBottom: `1px solid ${TV_COLORS.border}` }}>
          {showSMA20 && <span style={{ color: TV_COLORS.sma20 }}>SMA 20</span>}
          {showSMA50 && <span style={{ color: TV_COLORS.sma50 }}>SMA 50</span>}
          {showEMA9 && <span style={{ color: TV_COLORS.ema9 }}>EMA 9</span>}
          {showBB && <span style={{ color: TV_COLORS.bbLine }}>BB(20,2)</span>}
          {showAbboud && <span style={{ color: "#ffd54f" }}>Aboood.AI</span>}
        </div>
      )}

      {/* Main chart container */}
      <div ref={chartContainerRef} className="w-full" />

      {/* Volume chart */}
      {showVolume && (
        <div ref={volumeContainerRef} className="w-full" style={{ borderTop: `1px solid ${TV_COLORS.border}` }} />
      )}

      {/* RSI chart */}
      {showRSI && (
        <div className="relative">
          <div className="absolute left-2 top-1 text-[10px] font-medium z-10" style={{ color: "#ab47bc" }}>RSI(14)</div>
          <div ref={rsiContainerRef} className="w-full" style={{ borderTop: `1px solid ${TV_COLORS.border}` }} />
        </div>
      )}

      {/* MACD chart */}
      {showMACD && (
        <div className="relative">
          <div className="absolute left-2 top-1 text-[10px] font-medium z-10" style={{ color: "#2962ff" }}>MACD(12,26,9)</div>
          <div ref={macdContainerRef} className="w-full" style={{ borderTop: `1px solid ${TV_COLORS.border}` }} />
        </div>
      )}

      {/* Abboud AI Signal Card */}
      {showAbboud && (
        <div className="p-3" style={{ borderTop: `1px solid ${TV_COLORS.border}` }}>
          <AbboudSignalCard symbol={symbol} exchange={exchange} enabled={showAbboud} />
        </div>
      )}

      {/* TradingView attribution */}
      <div className="flex items-center justify-end px-3 py-1 text-[9px]" style={{ color: TV_COLORS.textDim, borderTop: `1px solid ${TV_COLORS.border}` }}>
        Powered by TradingView Lightweight Charts
      </div>
    </motion.div>
  );
}

export default AdvancedChart;
