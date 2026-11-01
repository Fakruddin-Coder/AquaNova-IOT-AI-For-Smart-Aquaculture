import { Minus, Plus, Fish, Layers } from 'lucide-react';
import { Card, CardBody, Badge } from '@/components/ui';

interface FishPopulationCardProps {
  deviceName: string;
  count: number;
  capacity?: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function FishPopulationCard({
  deviceName,
  count,
  capacity = 50,
  onIncrement,
  onDecrement,
}: FishPopulationCardProps) {
  const occupancyPct = Math.min(100, Math.round((count / capacity) * 100));

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
      <CardBody>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left Title & Info */}
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Fish className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Fish Population</h3>
                <Badge variant="info" className="text-[11px]">
                  Updated manually
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Number of fish in <span className="font-medium text-slate-700">{deviceName}</span>
              </p>
            </div>
          </div>

          {/* Right Counter & Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-6 bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl border border-slate-100 sm:border-0">
            {/* Display Fish Count */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold text-blue-600 tracking-tight">{count}</span>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-700">Fish in Tank</p>
                <p className="text-[11px] text-slate-400">
                  Total: <span className="font-medium text-slate-600">{count}</span> / {capacity} ({occupancyPct}%)
                </p>
              </div>
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDecrement}
                disabled={count <= 0}
                aria-label="Decrease fish count"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 font-bold shadow-sm transition-all hover:bg-slate-100 hover:text-blue-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="flex h-9 min-w-[2.5rem] items-center justify-center rounded-xl bg-blue-50 px-2 text-sm font-bold text-blue-700 border border-blue-100">
                {count}
              </div>

              <button
                type="button"
                onClick={onIncrement}
                aria-label="Increase fish count"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
