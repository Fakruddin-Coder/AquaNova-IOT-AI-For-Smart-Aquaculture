import type { SensorType } from '@/types';
import { Thermometer, Gauge, Droplets, Waves, Eye, Fish, type LucideIcon } from 'lucide-react';

export interface SensorMeta {
  label: string;
  shortLabel: string;
  unit: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  optimal: [number, number];
  warning: [number, number];
  format: (v: number) => string;
}

export const sensorMeta: Record<string, SensorMeta> = {
  temperature: {
    label: 'Water Temperature',
    shortLabel: 'Temp',
    unit: '°C',
    icon: Thermometer,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    optimal: [24, 28],
    warning: [20, 32],
    format: (v) => `${v.toFixed(1)}°C`,
  },
  ph: {
    label: 'pH Level',
    shortLabel: 'pH',
    unit: '',
    icon: Gauge,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    optimal: [6.5, 8.5],
    warning: [6, 9],
    format: (v) => v.toFixed(2),
  },
  water_level: {
    label: 'Water Level',
    shortLabel: 'Level',
    unit: '%',
    icon: Waves,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    optimal: [70, 95],
    warning: [50, 100],
    format: (v) => `${v.toFixed(0)}%`,
  },
  water_quality: {
    label: 'Water Quality',
    shortLabel: 'Quality',
    unit: 'ppm',
    icon: Droplets,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    optimal: [0, 0.1],
    warning: [0, 0.5],
    format: (v) => `${v.toFixed(2)} ppm`,
  },
  turbidity: {
    label: 'Turbidity',
    shortLabel: 'Turbidity',
    unit: 'NTU',
    icon: Eye,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    optimal: [0, 5],
    warning: [0, 10],
    format: (v) => `${v.toFixed(1)} NTU`,
  },
  dissolved_oxygen: {
    label: 'Dissolved Oxygen',
    shortLabel: 'DO',
    unit: 'mg/L',
    icon: Fish,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    optimal: [6, 10],
    warning: [4, 12],
    format: (v) => `${v.toFixed(1)} mg/L`,
  },
};

export function getSensorStatus(value: number, type: string): 'normal' | 'warning' | 'critical' {
  const meta = sensorMeta[type];
  if (!meta) return 'normal';
  if (value >= meta.optimal[0] && value <= meta.optimal[1]) return 'normal';
  if (value >= meta.warning[0] && value <= meta.warning[1]) return 'warning';
  return 'critical';
}

export const sensorTypes: SensorType[] = [
  'temperature',
  'ph',
  'water_level',
  'water_quality',
  'turbidity',
  'dissolved_oxygen',
];
