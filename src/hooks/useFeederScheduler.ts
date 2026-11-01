/**
 * AquaNova — Automated Feeding Scheduler Hook
 *
 * Synchronizes feeding schedules with the backend service.
 * The authoritative automated feeding scheduler runs 24/7 on the Node.js backend
 * (services/feederScheduler.ts) to guarantee feeds even when the browser is closed.
 *
 * This hook maintains UI state, tracks schedules, and prevents duplicate triggers.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useDevice } from '@/context/DeviceContext';
import { api } from '@/services/api';
import type { FeedingSchedule } from '@/types';

export function useFeederScheduler() {
  const { activeDevice } = useDevice();
  const [schedules, setSchedules] = useState<FeedingSchedule[]>([]);
  const activeDeviceId = activeDevice?.device_id || activeDevice?.id || null;

  // Fetch latest schedules for the active device
  const fetchSchedules = useCallback(async () => {
    if (!activeDeviceId) return;
    try {
      const data = await api.getFeeding(activeDeviceId);
      const rawList = Array.isArray(data) ? data : (data as any)?.schedules || [];
      const mapped: FeedingSchedule[] = rawList
        .filter((s: any) => s.status === 'scheduled' && s.enabled !== false)
        .map((s: any) => ({
          id: s._id || s.id,
          device_id: activeDeviceId,
          feed_time: s.scheduledTime || s.feed_time || '12:00',
          amount: s.feedAmount || s.amount || 5,
          enabled: s.enabled !== false,
          frequency: s.frequency || 'daily',
          custom_days: Array.isArray(s.customDays) ? s.customDays : Array.isArray(s.custom_days) ? s.custom_days : [],
          created_at: s.createdAt || new Date().toISOString(),
        }));
      setSchedules(mapped);
    } catch (err) {
      // Ignore background fetch error
    }
  }, [activeDeviceId]);

  // Poll schedules periodically so additions/edits from FeedingPage are picked up
  useEffect(() => {
    fetchSchedules();
    const pollInterval = setInterval(fetchSchedules, 15000); // refresh list every 15s
    return () => clearInterval(pollInterval);
  }, [fetchSchedules]);

  return { schedules, refreshSchedules: fetchSchedules };
}
