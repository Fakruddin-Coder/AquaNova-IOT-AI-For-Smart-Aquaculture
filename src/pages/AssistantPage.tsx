import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { useDeviceData } from '@/hooks/useDeviceData';
import { useDevice } from '@/context/DeviceContext';
import { api } from '@/services/api';
import { Card, CardBody, Spinner } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { sensorMeta } from '@/lib/sensorMeta';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const suggestions = [
  'How is my water quality?',
  'What do the latest sensor readings show?',
  'Any anomalies detected?',
  'What should I do about the temperature?',
];

export default function AssistantPage() {
  const { activeDevice } = useDevice();
  const { sensors, latestReadings, alerts, predictions, anomalies, recommendations, loading } = useDeviceData();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm AquaBot, your AI aquaculture assistant. I can answer questions about your water quality, sensor readings, alerts, and system health. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const generateResponse = (question: string): string => {
    const q = question.toLowerCase();

    if (loading || sensors.length === 0) {
      return "I'm still loading your device data. Please try again in a moment.";
    }

    if (q.includes('water quality') || q.includes('quality')) {
      const readings = sensors.map((s) => {
        const r = latestReadings[s.id];
        const meta = sensorMeta[s.type];
        return r ? `${meta?.label ?? s.type}: ${meta?.format(r.value) ?? r.value}` : null;
      }).filter(Boolean);
      return `Here's your current water quality summary:\n\n${readings.join('\n')}\n\nOverall, your water parameters look ${alerts.filter((a) => !a.resolved).length === 0 ? 'good' : 'like they need attention'}.`;
    }

    if (q.includes('reading') || q.includes('sensor') || q.includes('latest')) {
      const readings = sensors.map((s) => {
        const r = latestReadings[s.id];
        const meta = sensorMeta[s.type];
        if (!r) return `${s.name}: No data`;
        return `${meta?.label ?? s.type}: ${meta?.format(r.value) ?? r.value} (${r.status})`;
      });
      return `Latest sensor readings:\n\n${readings.join('\n')}`;
    }

    if (q.includes('anomal') || q.includes('abnormal')) {
      if (anomalies.length === 0) {
        return "Great news! No anomalies have been detected. All your sensors are reading within normal ranges.";
      }
      const recent = anomalies.slice(0, 3);
      return `I've detected ${anomalies.length} anomaly${anomalies.length > 1 ? 'ies' : ''}:\n\n${recent.map((a) => `• ${a.description}`).join('\n')}\n\nPlease review these and take action if needed.`;
    }

    if (q.includes('temperature') || q.includes('temp')) {
      const tempSensor = sensors.find((s) => s.type === 'temperature');
      const reading = tempSensor ? latestReadings[tempSensor.id] : null;
      const meta = sensorMeta.temperature;
      if (reading) {
        const status = reading.value >= 24 && reading.value <= 28 ? 'within the optimal range (24-28°C)' : 'outside the optimal range';
        const tempPred = predictions.find((p) => p.model_type === 'temperature_forecast');
        let response = `Your water temperature is currently ${meta.format(reading.value)}, which is ${status}.`;
        if (tempPred?.predicted_value) {
          response += `\n\nAI predicts it will be ${tempPred.predicted_value.toFixed(1)}°C in 6 hours.`;
        }
        if (reading.value > 28) {
          response += "\n\nRecommendation: Consider increasing water flow or aeration to bring the temperature down.";
        } else if (reading.value < 24) {
          response += "\n\nRecommendation: Consider using a water heater to bring the temperature up.";
        }
        return response;
      }
      return "I couldn't find any temperature sensor data. Please make sure your temperature sensor is connected.";
    }

    if (q.includes('alert') || q.includes('warning')) {
      const active = alerts.filter((a) => !a.resolved);
      if (active.length === 0) {
        return "You have no active alerts. All systems are operating normally!";
      }
      return `You have ${active.length} active alert${active.length > 1 ? 's' : ''}:\n\n${active.slice(0, 5).map((a) => `• ${a.title}: ${a.message ?? ''}`).join('\n')}`;
    }

    if (q.includes('health') || q.includes('score')) {
      const score = predictions.find((p) => p.model_type === 'health_score')?.health_score ?? 0;
      const factors = predictions.find((p) => p.model_type === 'health_score')?.factors;
      let response = `Your AI health score is ${score}/100, which is ${score >= 80 ? 'healthy' : score >= 60 ? 'moderate' : 'concerning'}.`;
      if (factors) {
        const top = Object.entries(factors).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
        const low = Object.entries(factors).sort((a, b) => (a[1] as number) - (b[1] as number))[0];
        response += `\n\nStrongest factor: ${top[0]} (${Math.round((top[1] as number) * 100)}%)`;
        response += `\nWeakest factor: ${low[0]} (${Math.round((low[1] as number) * 100)}%)`;
      }
      return response;
    }

    if (q.includes('recommend') || q.includes('suggest') || q.includes('advice')) {
      if (recommendations.length === 0) return "I don't have any specific recommendations right now. Your system looks healthy!";
      return `Here are my recommendations:\n\n${recommendations.slice(0, 3).map((r) => `• ${r.message}`).join('\n')}`;
    }

    if (q.includes('feeding') || q.includes('feed')) {
      return "You can manage your feeding schedules from the Feeding System page. I can see your feeding history and schedules. Would you like to know about a specific aspect of feeding?";
    }

    if (q.includes('ph')) {
      const phSensor = sensors.find((s) => s.type === 'ph');
      const reading = phSensor ? latestReadings[phSensor.id] : null;
      if (reading) {
        const status = reading.value >= 6.5 && reading.value <= 8.5 ? 'within the optimal range (6.5-8.5)' : 'outside the optimal range';
        return `Your pH level is currently ${reading.value.toFixed(2)}, which is ${status}.`;
      }
      return "I couldn't find pH sensor data.";
    }

    if (q.includes('oxygen') || q.includes('do') || q.includes('o2')) {
      const doSensor = sensors.find((s) => s.type === 'dissolved_oxygen');
      const reading = doSensor ? latestReadings[doSensor.id] : null;
      if (reading) {
        const status = reading.value >= 6 && reading.value <= 10 ? 'within the optimal range (6-10 mg/L)' : 'outside the optimal range';
        return `Your dissolved oxygen level is ${reading.value.toFixed(1)} mg/L, which is ${status}.`;
      }
      return "I couldn't find dissolved oxygen sensor data.";
    }

    return "I can help you with questions about water quality, sensor readings, temperature, pH, dissolved oxygen, alerts, anomalies, AI health scores, and recommendations. Try asking me about any of these topics!";
  };

  const handleSend = async (text?: string) => {
    const message = text ?? input;
    if (!message.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setThinking(true);

    const res = await api.chatWithAssistant({
      deviceId: activeDevice?.device_id || activeDevice?.id,
      message,
    });

    const response = res?.reply || generateResponse(message);
    setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    setThinking(false);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Ask AquaBot about your aquaculture system" />

      <Card className="flex h-[calc(100vh-220px)] flex-col">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">AquaBot</p>
            <p className="text-xs text-emerald-600">● Online — powered by your sensor data</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white'}`}>
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                <p className="whitespace-pre-line">{msg.content}</p>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="border-t border-slate-100 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5" /> Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask AquaBot anything..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || thinking}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}
