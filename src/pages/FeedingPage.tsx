import { useState, useEffect } from 'react';
import {
  Droplets,
  Plus,
  Clock,
  Trash2,
  Zap,
  History,
  Fish,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Edit3,
  Info,
  RotateCw,
  Sparkles,
  Check,
  X,
  Calendar,
  Repeat,
  AlertCircle,
} from 'lucide-react';
import { useDeviceData } from '@/hooks/useDeviceData';
import { Card, CardHeader, CardBody, Badge, Button, Spinner, EmptyState } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { api } from '@/services/api';
import { useDevice } from '@/context/DeviceContext';
import { useMqtt } from '@/context/MqttContext';
import { formatTime, formatDate, timeAgo } from '@/lib/utils';
import { normalizeScheduleTime, toTime24h } from '@/lib/timeUtils';
import type { FeedingSchedule } from '@/types';

// Motor rotation logic helper: 5g = 1 cycle, 10g = 2 cycles, etc.
function calculateMotorCycles(grams: number): number {
  return Math.max(1, Math.round(grams / 5));
}

// Cooldown logic helper: 5g = 5s, 10g = 10s, 15g = 15s, +1s per additional gram
function calculateCooldownSeconds(grams: number): number {
  return Math.max(5, Math.round(grams));
}

const WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

function formatCustomDays(days: number[] | undefined): string {
  if (!days || days.length === 0) return 'Custom';
  if (days.length === 7) return 'Daily';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && [0, 6].every((d) => days.includes(d))) return 'Weekends';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => dayNames[d])
    .join(', ');
}

export default function FeedingPage() {
  const { feedingSchedules, feedingHistory, loading, refresh } = useDeviceData();
  const { activeDevice } = useDevice();
  const { feederStatus, publishFeed } = useMqtt();

  // Schedule modal/form state
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FeedingSchedule | null>(null);
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [scheduleAmount, setScheduleAmount] = useState<number>(5);
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Manual feed state
  const [manualAmount, setManualAmount] = useState<number>(5);
  const [feedingNow, setFeedingNow] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Clear history state
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  // Dynamic countdown timer for feeding button cooldown
  // Formula: 5g = 5s, 10g = 10s, 15g = 15s (+1s per additional gram)
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!activeDevice) {
    return (
      <>
        <PageHeader title="Feeding System" subtitle="Automated and manual feeding control" />
        <Card>
          <EmptyState
            icon={<Droplets className="h-12 w-12" />}
            title="No device selected"
            message="Please select or connect an AquaNova device to manage feedings."
          />
        </Card>
      </>
    );
  }

  // Pre-fill form for adding a new schedule
  const handleOpenAdd = () => {
    setEditingSchedule(null);
    setHour('08');
    setMinute('00');
    setPeriod('AM');
    setScheduleAmount(5);
    setFrequency('daily');
    setCustomDays([1, 2, 3, 4, 5]);
    setShowForm(true);
  };

  // Pre-fill form for editing an existing schedule
  const handleOpenEdit = (sched: FeedingSchedule) => {
    setEditingSchedule(sched);
    const norm = normalizeScheduleTime(sched.feed_time);
    setHour(String(norm.hour12).padStart(2, '0'));
    setMinute(String(norm.minutes).padStart(2, '0'));
    setPeriod(norm.period);
    setScheduleAmount(sched.amount || 5);
    setFrequency(sched.frequency || 'daily');
    setCustomDays(
      Array.isArray(sched.custom_days) && sched.custom_days.length > 0
        ? sched.custom_days
        : [1, 2, 3, 4, 5]
    );
    setShowForm(true);
  };

  // Helper to quickly set schedule 1 minute in the future for live testing
  const handleSetQuickTest = () => {
    const testDate = new Date(Date.now() + 65 * 1000);
    const norm = normalizeScheduleTime(`${testDate.getHours()}:${testDate.getMinutes()}`);
    setHour(String(norm.hour12).padStart(2, '0'));
    setMinute(String(norm.minutes).padStart(2, '0'));
    setPeriod(norm.period);
  };

  // Toggle custom day selection
  const handleToggleDay = (dayVal: number) => {
    setCustomDays((prev) => {
      if (prev.includes(dayVal)) {
        if (prev.length === 1) return prev; // Keep at least one day
        return prev.filter((d) => d !== dayVal);
      } else {
        return [...prev, dayVal].sort((a, b) => a - b);
      }
    });
  };

  // Save (Create or Update) schedule
  const handleSaveSchedule = async () => {
    const time24 = toTime24h(Number(hour), Number(minute), period);
    const grams = Math.max(1, scheduleAmount);
    setIsSavingSchedule(true);

    try {
      if (editingSchedule) {
        // Edit existing schedule
        await api.updateFeeding(editingSchedule.id, {
          scheduledTime: time24,
          feedAmount: grams,
          enabled: editingSchedule.enabled,
          frequency,
          customDays: frequency === 'custom' ? customDays : [],
        });
      } else {
        // Create new schedule
        await api.createFeeding({
          deviceId: activeDevice.device_id || activeDevice.id,
          scheduledTime: time24,
          feedAmount: grams,
          status: 'scheduled',
          triggerType: 'scheduled',
          frequency,
          customDays: frequency === 'custom' ? customDays : [],
        });
      }
      setShowForm(false);
      setEditingSchedule(null);
      await refresh();
    } catch (err) {
      console.error('Failed to save schedule:', err);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Toggle schedule ON / OFF
  const handleToggle = async (sched: FeedingSchedule) => {
    try {
      await api.updateFeeding(sched.id, { enabled: !sched.enabled });
      await refresh();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  // Delete schedule
  const handleDelete = async (id: string) => {
    try {
      await api.deleteFeeding(id);
      await refresh();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  // Manual Feed Now with dynamic food quantity countdown
  // 5g = 5s, 10g = 10s, 15g = 15s (+1s per gram)
  const handleFeedNow = async () => {
    if (cooldownRemaining > 0 || feedingNow || feederStatus === 'FEEDING') return;

    setFeedingNow(true);
    const grams = manualAmount;
    const cooldownSeconds = calculateCooldownSeconds(grams);
    setCooldownRemaining(cooldownSeconds); // Dynamic cooldown starting immediately

    const cycles = calculateMotorCycles(grams);

    try {
      // 1. Dispatch MQTT command directly to ESP32 servo with calculated cycles & grams
      publishFeed({ cycles, grams });

      // 2. Log manual feeding event to backend
      await api.createFeeding({
        deviceId: activeDevice.device_id || activeDevice.id,
        scheduledTime: new Date().toTimeString().substring(0, 5),
        feedAmount: grams,
        status: 'completed',
        triggerType: 'manual',
      });
    } catch (err) {
      console.error('Failed to trigger manual feed:', err);
    } finally {
      setFeedingNow(false);
      await refresh();
    }
  };

  // Clear all feeding history records
  const handleClearHistory = async () => {
    setIsClearingHistory(true);
    try {
      const devId = activeDevice.device_id || activeDevice.id;
      await api.clearFeedingHistory(devId);
      setShowClearHistoryConfirm(false);
      await refresh();
    } catch (err) {
      console.error('Failed to clear feeding history:', err);
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Statistics
  const activeSchedulesCount = feedingSchedules.filter((s) => s.enabled).length;
  const totalDailyGrams = feedingSchedules
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.amount || 5), 0);
  const totalDailyCycles = feedingSchedules
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + calculateMotorCycles(s.amount || 5), 0);

  const calculatedFormCycles = calculateMotorCycles(scheduleAmount);
  const calculatedManualCooldown = calculateCooldownSeconds(manualAmount);

  return (
    <>
      <PageHeader
        title="Feeding System"
        subtitle="Automated schedule frequency dispatch & quantity-calibrated manual feed"
        action={
          <div className="flex flex-col items-end gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Manual Feed Amount Selector */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 shadow-xs">
                <span className="text-xs font-semibold text-slate-500">Amount:</span>
                <select
                  value={manualAmount}
                  disabled={cooldownRemaining > 0 || feedingNow || feederStatus === 'FEEDING'}
                  onChange={(e) => setManualAmount(Number(e.target.value))}
                  className="rounded-lg bg-transparent py-0.5 text-xs font-bold text-slate-800 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Manual feed amount in grams"
                >
                  <option value={5}>5g (1 cycle · 5s cooldown)</option>
                  <option value={10}>10g (2 cycles · 10s cooldown)</option>
                  <option value={15}>15g (3 cycles · 15s cooldown)</option>
                  <option value={20}>20g (4 cycles · 20s cooldown)</option>
                  <option value={25}>25g (5 cycles · 25s cooldown)</option>
                </select>
              </div>

              {/* Feed Now Button with Quantity-Based Countdown Cooldown */}
              <Button
                onClick={handleFeedNow}
                disabled={cooldownRemaining > 0 || feedingNow || feederStatus === 'FEEDING'}
                className={`relative transition-all duration-200 ${
                  cooldownRemaining > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50 shadow-none cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {cooldownRemaining > 0 ? (
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Clock className="h-4 w-4 animate-spin text-amber-600" />
                    Please wait {cooldownRemaining} second{cooldownRemaining === 1 ? '' : 's'}
                  </span>
                ) : feedingNow || feederStatus === 'FEEDING' ? (
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Dispensing {manualAmount}g...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
                    Feed Now ({manualAmount}g · {calculatedManualCooldown}s)
                  </span>
                )}
              </Button>

              {/* Add Schedule Button */}
              <Button variant="secondary" onClick={handleOpenAdd}>
                <Plus className="h-4 w-4 text-blue-600" />
                <span>Add Schedule</span>
              </Button>
            </div>

            {/* Feeder Status Badge from ESP32 */}
            <FeederStatusBadge status={feederStatus} />
          </div>
        }
      />

      {/* Prominent Feeding Instructions & Motor Calibration Banner */}
      <div className="mb-6 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-sky-50/90 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/25">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Feeding Instructions & Cooldown Logic</h3>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                  Calibrated Hardware Logic
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-blue-900">
                Each motor cycle dispenses approximately 5 grams. Cooldown is quantity-calibrated: 5g = 5s, 10g = 10s, 15g = 15s (+1s per gram).
              </p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Supports Once, Daily, and Custom Day automated frequencies. The ESP32 motor dispenses by cycle count without requiring gram sensors.
              </p>
            </div>
          </div>

          {/* Visual Rotation & Cooldown Logic Matrix */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-blue-200/70 bg-white/90 px-3 py-2 shadow-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-xs">
                1
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800">5g Food</span>
                <span className="block text-[10px] font-semibold text-slate-500">1 Cycle · 5s Wait</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-blue-200/70 bg-white/90 px-3 py-2 shadow-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">
                2
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800">10g Food</span>
                <span className="block text-[10px] font-semibold text-slate-500">2 Cycles · 10s Wait</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-blue-200/70 bg-white/90 px-3 py-2 shadow-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 text-purple-600 font-bold text-xs">
                3
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800">15g Food</span>
                <span className="block text-[10px] font-semibold text-slate-500">3 Cycles · 15s Wait</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-blue-200/70 bg-white/90 px-3 py-2 shadow-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs">
                +1
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800">+1g More</span>
                <span className="block text-[10px] font-semibold text-slate-500">+1s Countdown</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardBody>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{activeSchedulesCount}</p>
            <p className="text-xs font-medium text-slate-500">Active Schedules</p>
          </CardBody>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardBody>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Droplets className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{totalDailyGrams}g</p>
            <p className="text-xs font-medium text-slate-500">
              Active Daily Feed ({totalDailyCycles} cycle{totalDailyCycles === 1 ? '' : 's'})
            </p>
          </CardBody>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardBody>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <History className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{feedingHistory.length}</p>
            <p className="text-xs font-medium text-slate-500">Recorded Feedings</p>
          </CardBody>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardBody>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Fish className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {feedingHistory.filter((f) => f.trigger_type === 'auto' || f.trigger_type === 'scheduled').length}
            </p>
            <p className="text-xs font-medium text-slate-500">Automated Dispenses</p>
          </CardBody>
        </Card>
      </div>

      {/* Clean Add / Edit Schedule Form with Frequency Options */}
      {showForm && (
        <Card className="mb-6 animate-scale-in border-2 border-blue-200 shadow-md">
          <CardHeader
            title={editingSchedule ? 'Edit Feeding Schedule' : 'Add Automatic Feeding Schedule'}
            subtitle={
              editingSchedule
                ? 'Update feeding time, food quantity, and frequency options'
                : 'Configure automated feeding with custom frequency (Once, Daily, or Custom Days) and quantity in grams'
            }
            icon={
              editingSchedule ? (
                <Edit3 className="h-5 w-5 text-blue-600" />
              ) : (
                <Plus className="h-5 w-5 text-blue-600" />
              )
            }
            action={
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingSchedule(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close form"
              >
                <X className="h-5 w-5" />
              </button>
            }
          />
          <CardBody>
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* 12-Hour Time & AM/PM Picker */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Feeding Time (12-Hour AM / PM)
                    </label>
                    <button
                      type="button"
                      onClick={handleSetQuickTest}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 underline"
                      title="Automatically sets schedule to 1 minute in future for testing live servo!"
                    >
                      <Zap className="h-3 w-3" /> Quick Test: Set to +1 Min
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Hour dropdown */}
                    <div className="flex-1">
                      <select
                        value={hour}
                        onChange={(e) => setHour(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        aria-label="Select Hour"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                          const val = String(h).padStart(2, '0');
                          return (
                            <option key={h} value={val}>
                              {val} Hour
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <span className="text-xl font-black text-slate-400">:</span>

                    {/* Minute dropdown */}
                    <div className="flex-1">
                      <select
                        value={minute}
                        onChange={(e) => setMinute(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        aria-label="Select Minute"
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                          <option key={m} value={m}>
                            {m} Min
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* AM / PM Segmented Control */}
                    <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setPeriod('AM')}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                          period === 'AM'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setPeriod('PM')}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                          period === 'PM'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desired Food Quantity in Grams */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Food Quantity (Grams)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={scheduleAmount}
                      onChange={(e) => setScheduleAmount(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                      grams
                    </span>
                  </div>

                  {/* Quick gram chips */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20, 25].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setScheduleAmount(g)}
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all ${
                          scheduleAmount === g
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {g}g ({calculateMotorCycles(g)}c)
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Schedule Frequency Option: Once, Daily, Custom Days */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
                <label className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Repeat className="h-4 w-4 text-blue-600" />
                  Schedule Frequency
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFrequency('daily')}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      frequency === 'daily'
                        ? 'border-blue-500 bg-white ring-2 ring-blue-100 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-bold text-slate-900">Daily</span>
                      {frequency === 'daily' && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                    <span className="mt-1 text-xs text-slate-500">Every day at scheduled time</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrequency('once')}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      frequency === 'once'
                        ? 'border-amber-500 bg-white ring-2 ring-amber-100 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-bold text-slate-900">Once</span>
                      {frequency === 'once' && <Check className="h-4 w-4 text-amber-600" />}
                    </div>
                    <span className="mt-1 text-xs text-slate-500">Runs once then automatically deactivates</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrequency('custom')}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      frequency === 'custom'
                        ? 'border-purple-500 bg-white ring-2 ring-purple-100 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-bold text-slate-900">Custom Days</span>
                      {frequency === 'custom' && <Check className="h-4 w-4 text-purple-600" />}
                    </div>
                    <span className="mt-1 text-xs text-slate-500">Select specific days of the week</span>
                  </button>
                </div>

                {/* Weekday Selection for Custom Days */}
                {frequency === 'custom' && (
                  <div className="mt-3.5 pt-3 border-t border-slate-200">
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      Select active feeding days:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => {
                        const isSelected = customDays.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => handleToggleDay(d.value)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCustomDays([1, 2, 3, 4, 5])}
                        className="rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-purple-600 hover:underline"
                      >
                        Weekdays
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomDays([0, 6])}
                        className="rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-purple-600 hover:underline"
                      >
                        Weekends
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Motor Rotation Indicator */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCw className="h-4 w-4 text-indigo-600 animate-spin-slow" />
                    <span className="text-xs font-bold text-indigo-950">
                      Required Motor Rotation:{' '}
                      <span className="text-sm font-extrabold text-indigo-600">
                        {calculatedFormCycles} cycle{calculatedFormCycles === 1 ? '' : 's'}
                      </span>
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-indigo-800">
                    ~{calculatedFormCycles * 5}g output · {calculateCooldownSeconds(scheduleAmount)}s cooldown
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-indigo-900/80">
                  At {hour}:{minute} {period} ({frequency === 'daily' ? 'every day' : frequency === 'once' ? 'once only' : formatCustomDays(customDays)}), the ESP32 motor will execute{' '}
                  <strong>{calculatedFormCycles} rotation cycle{calculatedFormCycles === 1 ? '' : 's'}</strong> to dispense{' '}
                  {scheduleAmount} grams.
                </p>
              </div>

              {/* Action buttons & Confirmation Summary */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span>
                    Frequency:{' '}
                    <strong className="text-slate-900 font-bold capitalize">
                      {frequency === 'custom' ? formatCustomDays(customDays) : frequency}
                    </strong>{' '}
                    at{' '}
                    <strong className="text-slate-900 font-bold">
                      {hour}:{minute} {period}
                    </strong>{' '}
                    ·{' '}
                    <strong className="text-slate-900 font-bold">
                      {scheduleAmount}g ({calculatedFormCycles} cycle{calculatedFormCycles === 1 ? '' : 's'})
                    </strong>
                  </span>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowForm(false);
                      setEditingSchedule(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveSchedule} disabled={isSavingSchedule}>
                    {isSavingSchedule ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                      </span>
                    ) : editingSchedule ? (
                      <span className="flex items-center gap-1.5">
                        <Check className="h-4 w-4" /> Update Schedule
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-4 w-4" /> Save Schedule
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Confirmation Modal for Clearing Feeding History */}
      {showClearHistoryConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center gap-3.5 mb-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Clear Feeding History?</h3>
                <p className="text-xs text-slate-500">This action will delete all recorded events</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 mb-5">
              Are you sure you want to delete all {feedingHistory.length} recorded feeding events for this device? This will reset the history counter to zero and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="secondary"
                onClick={() => setShowClearHistoryConfirm(false)}
                disabled={isClearingHistory}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={isClearingHistory}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isClearingHistory ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Clear All History
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Saved Schedules & Feeding History */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Schedules Management */}
        <Card>
          <CardHeader
            title="Feeding Schedules"
            subtitle="Automated schedules with frequency & motor cycle calculation"
            icon={<Clock className="h-5 w-5 text-blue-600" />}
            action={
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                {activeSchedulesCount} Active / {feedingSchedules.length} Total
              </span>
            }
          />
          <CardBody className="space-y-3">
            {feedingSchedules.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-8 w-8 text-slate-400" />}
                title="No schedules configured"
                message="Click 'Add Schedule' to configure automated feedings (Once, Daily, or Custom Days)."
              />
            ) : (
              feedingSchedules.map((sched) => {
                const norm = normalizeScheduleTime(sched.feed_time);
                const cycles = calculateMotorCycles(sched.amount || 5);
                const freq = sched.frequency || 'daily';

                return (
                  <div
                    key={sched.id}
                    className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                      sched.enabled
                        ? 'border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-sm'
                        : 'border-slate-100 bg-slate-50/60 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                          sched.enabled
                            ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-100'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Clock className="h-5 w-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-slate-900">{norm.display12}</p>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                              norm.period === 'AM'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-indigo-100 text-indigo-900'
                            }`}
                          >
                            {norm.period}
                          </span>

                          {/* Frequency Badge */}
                          {freq === 'once' ? (
                            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              Once Only
                            </span>
                          ) : freq === 'custom' ? (
                            <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                              {formatCustomDays(sched.custom_days)}
                            </span>
                          ) : (
                            <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                              Daily
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-bold text-slate-700">{sched.amount || 5}g</span>
                          <span>·</span>
                          <span className="font-semibold text-blue-700">
                            {cycles} motor cycle{cycles === 1 ? '' : 's'}
                          </span>
                          <span>·</span>
                          <span className="text-slate-400">24h: {norm.time24}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* ON/OFF Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggle(sched)}
                        className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                          sched.enabled ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                        title={sched.enabled ? 'Click to pause schedule' : 'Click to enable schedule'}
                        aria-label={sched.enabled ? 'Disable schedule' : 'Enable schedule'}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            sched.enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(sched)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title="Edit schedule"
                        aria-label="Edit schedule"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(sched.id)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete schedule"
                        aria-label="Delete schedule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        {/* Feeding History with Clear History action */}
        <Card>
          <CardHeader
            title="Feeding History"
            subtitle="Complete record of manual and automated feeding events"
            icon={<History className="h-5 w-5 text-amber-600" />}
            action={
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {feedingHistory.length} Total
                </span>
                {feedingHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearHistoryConfirm(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    title="Clear all feeding history records"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear History</span>
                  </button>
                )}
              </div>
            }
          />
          <CardBody className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {feedingHistory.length === 0 ? (
              <EmptyState
                icon={<History className="h-8 w-8 text-slate-400" />}
                title="No feeding events recorded"
                message="Feedings executed manually or automatically via schedule will be tracked here in real time."
              />
            ) : (
              feedingHistory.map((f) => {
                const isAuto = f.trigger_type === 'auto' || f.trigger_type === 'scheduled';
                const cycles = calculateMotorCycles(f.amount || 5);

                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          isAuto ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {isAuto ? <Clock className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">
                            {f.amount || 5}g dispensed
                          </p>
                          <span className="text-xs font-semibold text-slate-500">
                            ({cycles} motor cycle{cycles === 1 ? '' : 's'})
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {formatDate(f.fed_at)} at {formatTime(f.fed_at)} · {timeAgo(f.fed_at)}
                        </p>
                      </div>
                    </div>

                    <Badge variant={isAuto ? 'success' : 'info'}>
                      {isAuto ? 'Automatic' : 'Manual'}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

// ── Helper: FeederStatusBadge ─────────────────────────────────────────────────

type FeederStatus = 'READY' | 'FEEDING' | 'COMPLETED' | 'ERROR' | null;

function FeederStatusBadge({ status }: { status: FeederStatus }) {
  if (!status) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <WifiOff className="h-3.5 w-3.5" />
        <span>Feeder: waiting for ESP32</span>
      </div>
    );
  }

  const config: Record<
    NonNullable<FeederStatus>,
    { icon: React.ReactNode; text: string; cls: string }
  > = {
    READY: {
      icon: <Wifi className="h-3.5 w-3.5" />,
      text: 'Feeder ready',
      cls: 'text-emerald-600',
    },
    FEEDING: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: 'Feeding in progress…',
      cls: 'text-blue-600 font-bold',
    },
    COMPLETED: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      text: 'Feeding completed',
      cls: 'text-emerald-600',
    },
    ERROR: {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      text: 'Feeder error',
      cls: 'text-red-600',
    },
  };

  const { icon, text, cls } = config[status];

  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold ${cls}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
}
