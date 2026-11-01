import { useState, useEffect } from 'react';
import type { MqttSensorPayload } from '@/services/mqtt';

const ML_API_BASE = 'http://localhost:8000/api/ml';

function createFallbackModelData(sensorData: MqttSensorPayload | null) {
  const values = sensorData ?? {
    temperature: 26.5,
    ph: 7.2,
    turbidity: 3.2,
    dissolvedOxygen: 6.8,
    waterLevel: 85,
  };
  const rangeScore = (value: number, min: number, max: number, margin: number) => {
    if (value >= min && value <= max) return 1;
    const distance = value < min ? min - value : value - max;
    return Math.max(0, 1 - distance / margin);
  };
  const factors = {
    temperature: rangeScore(values.temperature, 24, 28, 8),
    ph: rangeScore(values.ph, 6.5, 8.5, 2),
    turbidity: rangeScore(values.turbidity, 0, 5, 10),
    dissolvedOxygen: rangeScore(values.dissolvedOxygen, 6, 10, 4),
    waterLevel: rangeScore(values.waterLevel, 70, 95, 30),
  };
  const score = Math.round(Object.values(factors).reduce((sum, value) => sum + value, 0) / Object.values(factors).length * 100);
  const healthy = score >= 80;
  return {
    healthScore: score,
    factors,
    predictions: [
      { id: 'fallback-health', model_type: 'health_score', health_score: score, factors, created_at: new Date().toISOString() },
      { id: 'fallback-temperature', model_type: 'temperature_forecast', predicted_value: Number((values.temperature + 0.2).toFixed(1)), predicted_for: new Date(Date.now() + 86_400_000).toISOString(), factors: { confidence: 0.78, trend: 0.02 }, created_at: new Date().toISOString() },
    ],
    anomalies: [],
    recommendations: [{
      id: 'fallback-recommendation',
      level: healthy ? 'healthy' : 'warning',
      message: healthy ? 'Fallback sensor readings are within healthy operating ranges.' : 'Review the sensor values outside their optimal ranges.',
      created_at: new Date().toISOString(),
    }],
    cameraAnalysis: [],
  };
}

export function useAiData(activeSensorData: MqttSensorPayload | null = null) {
  const [data, setData] = useState({
    healthScore: 0,
    factors: {},
    predictions: [] as any[],
    anomalies: [] as any[],
    recommendations: [] as any[],
    cameraAnalysis: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sensorKey = activeSensorData ? JSON.stringify(activeSensorData) : '';

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        let query = '';
        if (activeSensorData) {
          query = `?temperature=${activeSensorData.temperature}&ph=${activeSensorData.ph}&turbidity=${activeSensorData.turbidity}&dissolvedOxygen=${activeSensorData.dissolvedOxygen}&waterLevel=${activeSensorData.waterLevel}`;
        }

        const [healthRes, predictRes, anomaliesRes, recRes, camRes] = await Promise.all([
          fetch(`${ML_API_BASE}/health${query}`),
          fetch(`${ML_API_BASE}/predict${query}`),
          fetch(`${ML_API_BASE}/anomalies${query}`),
          fetch(`${ML_API_BASE}/recommendations${query}`),
          fetch(`${ML_API_BASE}/camera`)
        ]);

        if (!mounted) return;

        if (!healthRes.ok) throw new Error('Network response was not ok');

        const health = await healthRes.json();
        const predictions = await predictRes.json();
        const anomalies = await anomaliesRes.json();
        const recommendations = await recRes.json();
        const camera = await camRes.json();

        const healthPred = {
          id: 'health-1',
          model_type: 'health_score',
          health_score: health.score,
          factors: health.factors,
          created_at: new Date().toISOString()
        };

        setData({
          healthScore: health.score,
          factors: health.factors,
          predictions: [healthPred, ...predictions],
          anomalies,
          recommendations,
          cameraAnalysis: [camera]
        });
        setError(null);
      } catch (err) {
        if (mounted) {
          // Keep the dashboard useful when the optional Python service is down.
          // This uses the same active MQTT/mock readings and is replaced by the
          // remote model automatically on the next successful poll.
          setData(createFallbackModelData(activeSensorData));
          setError('ML service unavailable; using local fallback model.');
          console.error(err);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [sensorKey]);

  return { ...data, loading, error };
}
