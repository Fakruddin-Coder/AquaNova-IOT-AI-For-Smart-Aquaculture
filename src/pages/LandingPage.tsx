import { Link } from 'react-router-dom';
import {
  Waves,
  Activity,
  Brain,
  Bell,
  Camera,
  BarChart3,
  Bot,
  Cpu,
  Droplets,
  Thermometer,
  Gauge,
  Fish,
  ArrowRight,
  CheckCircle2,
  Shield,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui';

const features = [
  {
    icon: Activity,
    title: 'Real-time Monitoring',
    desc: 'Track temperature, pH, water level, quality, turbidity, and dissolved oxygen 24/7 with live sensor data streaming.',
  },
  {
    icon: Brain,
    title: 'AI Predictions',
    desc: 'Machine learning models forecast water quality trends and predict health issues before they happen.',
  },
  {
    icon: Bot,
    title: 'AI Assistant',
    desc: 'Ask questions about your aquaculture setup and get instant, data-driven recommendations from AquaBot.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    desc: 'Instant notifications when sensor readings go out of range — via dashboard, email, or webhook.',
  },
  {
    icon: Camera,
    title: 'Computer Vision',
    desc: 'AI camera analysis detects fish activity, feeding behavior, and anomalies like dead fish automatically.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    desc: 'Historical trends, anomaly detection, and exportable reports to keep your operation optimized.',
  },
];

const specs = [
  { icon: Cpu, label: 'ESP32-Based', value: 'Low-power IoT kit' },
  { icon: Droplets, label: '6 Sensors', value: 'Full water coverage' },
  { icon: Camera, label: 'AI Camera', value: 'Real-time vision' },
  { icon: Zap, label: 'Auto Feeding', value: 'Smart scheduler' },
];

const steps = [
  {
    num: '01',
    title: 'Install the Kit',
    desc: 'Place the AquaNova IoT kit in your tank. Connect the ESP32 to WiFi — it auto-registers with your account.',
  },
  {
    num: '02',
    title: 'Sensors Go Live',
    desc: 'Six sensors begin streaming data immediately. Set thresholds and feeding schedules from the dashboard.',
  },
  {
    num: '03',
    title: 'AI Takes Over',
    desc: 'Predictive models and computer vision run continuously, alerting you only when action is needed.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-100 glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/30">
              <Waves className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">AquaNova</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-blue-600">
              Features
            </a>
            <a href="#how" className="text-sm font-medium text-slate-600 hover:text-blue-600">
              How it Works
            </a>
            <a href="#specs" className="text-sm font-medium text-slate-600 hover:text-blue-600">
              Hardware
            </a>
            <Link to="/kit" className="text-sm font-medium text-blue-600">
              Buy Kit
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white" />
        <div className="absolute left-1/2 top-20 -z-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-blue-200/30 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>
              IoT + AI for Modern Aquaculture
            </div>
            <h1 className="text-balance text-5xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
              Smart Aquaculture,
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Powered by AI
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-slate-600">
              Monitor water quality in real-time, predict issues before they happen, and let
              computer vision watch your fish — all from one intelligent dashboard.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg">
                  Start Trial
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="secondary" size="lg">
                  Explore Features
                </Button>
              </a>
            </div>
          </div>

          {/* Hero dashboard preview */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-blue-600/10">
              <div className="rounded-xl bg-slate-50 p-6">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {[
                    { icon: Thermometer, label: 'Temperature', value: '26.5°C', status: 'Normal', color: 'text-blue-600 bg-blue-50' },
                    { icon: Gauge, label: 'pH Level', value: '7.2', status: 'Optimal', color: 'text-emerald-600 bg-emerald-50' },
                    { icon: Droplets, label: 'Dissolved O₂', value: '8.3 mg/L', status: 'Good', color: 'text-cyan-600 bg-cyan-50' },
                    { icon: Activity, label: 'Turbidity', value: '1.2 NTU', status: 'Clear', color: 'text-blue-600 bg-blue-50' },
                    { icon: Waves, label: 'Water Level', value: '85%', status: 'Normal', color: 'text-emerald-600 bg-emerald-50' },
                    { icon: Fish, label: 'Fish Health', value: '94/100', status: 'Healthy', color: 'text-emerald-600 bg-emerald-50' },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-slate-100 bg-white p-4 transition-transform hover:scale-105"
                    >
                      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                        <s.icon className="h-5 w-5" />
                      </div>
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="text-xl font-bold text-slate-900">{s.value}</p>
                      <p className="mt-1 text-xs text-emerald-600">{s.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-slate-100 bg-slate-50 py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
          {[
            { value: '24/7', label: 'Real-time Monitoring' },
            { value: '6', label: 'Water Sensors' },
            { value: '94%', label: 'AI Accuracy' },
            { value: '<2s', label: 'Alert Latency' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-blue-600">{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold text-slate-900">Everything you need to run a smarter farm</h2>
            <p className="mt-4 text-lg text-slate-600">
              From sensor monitoring to AI predictions — AquaNova brings cutting-edge technology to your aquaculture operation.
            </p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-600/5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold text-slate-900">Up and running in minutes</h2>
            <p className="mt-4 text-lg text-slate-600">
              No technical expertise required. The kit is plug-and-play.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.num} className="relative">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-bold text-blue-600 shadow-sm ring-1 ring-slate-200">
                  {s.num}
                </div>
                <h3 className="text-xl font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hardware specs */}
      <section id="specs" className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 p-12 text-white shadow-2xl shadow-blue-600/20">
            <div className="grid items-center gap-12 md:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold">The AquaNova IoT Kit</h2>
                <p className="mt-4 text-blue-100">
                  A compact, waterproof enclosure with ESP32 microcontroller, 6 sensors, and an AI-enabled camera module. Built for harsh aquaculture environments.
                </p>
                <div className="mt-6 space-y-3">
                  {['WiFi connected, solar-compatible', 'IP67 waterproof rated', 'OTA firmware updates', 'Works with any tank size'].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-cyan-300" />
                      <span className="text-sm text-blue-50">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-white/10 p-5 backdrop-blur">
                    <s.icon className="h-6 w-6 text-cyan-300" />
                    <p className="mt-3 text-lg font-bold">{s.label}</p>
                    <p className="text-sm text-blue-200">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-4xl font-bold text-slate-900">Ready to upgrade your aquaculture?</h2>
          <p className="mt-4 text-lg text-slate-600">
            Join the future of smart fish farming and start monitoring your farm today.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg">
                Create Account
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Waves className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">AquaNova</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> Secure & Encrypted
            </span>
            <span>© 2026 AquaNova. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
