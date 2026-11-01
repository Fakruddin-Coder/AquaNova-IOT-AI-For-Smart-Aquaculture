import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Waves,
  ArrowRight,
  Shield,
  Cpu,
  Droplets,
  Camera,
  Wifi,
  Activity,
  Box,
  MonitorSmartphone,
  ChevronRight,
  CheckCircle2,
  Plug
} from 'lucide-react';
import { Button } from '@/components/ui';
import CheckoutModal from '@/components/CheckoutModal';

export default function KitPage() {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-100 glass bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/30">
              <Waves className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">AquaNova</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link to="/#features" className="text-sm font-medium text-slate-600 hover:text-blue-600">
              Features
            </Link>
            <Link to="/#how" className="text-sm font-medium text-slate-600 hover:text-blue-600">
              How it Works
            </Link>
            <Link to="/#specs" className="text-sm font-medium text-slate-600 hover:text-blue-600">
              Hardware
            </Link>
            <Link to="/kit" className="text-sm font-medium text-blue-600 font-semibold">
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

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
                </span>
                Now Available
              </div>
              <h1 className="text-balance text-5xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
                AquaNova Smart
                <br />
                <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  Aquaculture Kit
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                The complete plug-and-play hardware solution for your farm. Includes a powerful ESP32 controller, 6 precision water sensors, an AI-ready camera, an automatic feeder, and everything you need to start monitoring instantly.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
                <Button
                  size="lg"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full sm:w-auto px-8 py-6 text-lg bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20"
                >
                  Buy Now - $299 / ₹24,999
                </Button>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Shield className="h-4 w-4" /> 1-Year Warranty Included
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-cyan-50 rounded-3xl blur-2xl opacity-50"></div>
              <img 
                src="/kit-image.png" 
                alt="AquaNova Kit" 
                className="relative rounded-2xl shadow-2xl ring-1 ring-slate-200/50 object-cover w-full aspect-square md:aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* What's in the box Quick Cards */}
      <section className="py-16 bg-slate-50 border-t border-slate-200/60">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-900">What's in the Box?</h2>
            <p className="mt-3 text-slate-600">Everything you need to modernize your aquaculture setup in one package.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">6 Precision Sensors</h3>
              <p className="text-slate-600 text-xs leading-relaxed">Ultrasonic level, temperature probe, pH electrode, turbidity, dissolved oxygen & DHT22 environmental sensor.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">ESP32 Controller</h3>
              <p className="text-slate-600 text-xs leading-relaxed">Dual-core MCU with built-in Wi-Fi & Bluetooth connectivity, GPIO breakout, and low power mode.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Camera className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">ESP32-CAM Webcam</h3>
              <p className="text-slate-600 text-xs leading-relaxed">2MP OV2640 camera for real-time video streaming, fish activity monitoring, and AI image analysis.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Plug className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Feeder & Accessories</h3>
              <p className="text-slate-600 text-xs leading-relaxed">Auto feeder module, relay board, breadboard, power adapter, cables, waterproof enclosure & mounting hardware.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Component Specification Images Showcase */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/50 px-4 py-1.5 text-xs font-semibold text-cyan-300 mb-4">
              Official Hardware Diagrams
            </div>
            <h2 className="text-3xl font-extrabold text-white md:text-4xl">
              Hardware Component Specifications
            </h2>
            <p className="mt-4 text-slate-300">
              Detailed technical blueprints and component breakdowns included in every AquaNova Kit.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-2">
            {/* Card 1: 6 Sensors */}
            <div className="group overflow-hidden rounded-3xl bg-slate-800 border border-slate-700 shadow-xl transition-all duration-300 hover:border-cyan-500/50">
              <div className="p-6 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                <div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Module 01</span>
                  <h3 className="text-xl font-bold text-white">1. 6 Precision Sensors</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
              <div className="p-4 bg-slate-950/40">
                <img
                  src="/sensors-spec.jpg"
                  alt="6 Precision Sensors Specification Blueprint"
                  className="rounded-2xl w-full object-cover shadow-2xl group-hover:scale-[1.01] transition-transform duration-300"
                />
              </div>
              <div className="p-6 bg-slate-800/80">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Includes Ultrasonic Sensor (water level), Probe Temperature Sensor (-55°C to 125°C), Industrial pH Electrode (0–14 pH), Turbidity Sensor (0–3000 NTU), Dissolved Oxygen Sensor (0–20 mg/L), and DHT22 Environmental Sensor.
                </p>
              </div>
            </div>

            {/* Card 2: ESP32 Controller */}
            <div className="group overflow-hidden rounded-3xl bg-slate-800 border border-slate-700 shadow-xl transition-all duration-300 hover:border-cyan-500/50">
              <div className="p-6 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                <div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Module 02</span>
                  <h3 className="text-xl font-bold text-white">2. ESP32 Controller</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <Cpu className="h-5 w-5" />
                </div>
              </div>
              <div className="p-4 bg-slate-950/40">
                <img
                  src="/esp32-controller-spec.jpg"
                  alt="ESP32 Controller Specification Blueprint"
                  className="rounded-2xl w-full object-cover shadow-2xl group-hover:scale-[1.01] transition-transform duration-300"
                />
              </div>
              <div className="p-6 bg-slate-800/80">
                <p className="text-sm text-slate-300 leading-relaxed">
                  High-performance dual-core 32-bit MCU with built-in Wi-Fi + Bluetooth connectivity, multiple GPIO pinouts for seamless sensor attachment, low power consumption, and USB programming interface.
                </p>
              </div>
            </div>

            {/* Card 3: ESP32-CAM */}
            <div className="group overflow-hidden rounded-3xl bg-slate-800 border border-slate-700 shadow-xl transition-all duration-300 hover:border-cyan-500/50">
              <div className="p-6 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                <div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Module 03</span>
                  <h3 className="text-xl font-bold text-white">3. ESP32-CAM (Web Cam)</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <Camera className="h-5 w-5" />
                </div>
              </div>
              <div className="p-4 bg-slate-950/40">
                <img
                  src="/esp32-cam-spec.jpg"
                  alt="ESP32-CAM Specification Blueprint"
                  className="rounded-2xl w-full object-cover shadow-2xl group-hover:scale-[1.01] transition-transform duration-300"
                />
              </div>
              <div className="p-6 bg-slate-800/80">
                <p className="text-sm text-slate-300 leading-relaxed">
                  2MP OV2640 Camera with Wi-Fi wireless streaming, compact form-factor for tank mounting, real-time live video streaming to monitor your fish, and image capture capabilities optimized for AI vision models.
                </p>
              </div>
            </div>

            {/* Card 4: Auto Feeder + Other Components */}
            <div className="group overflow-hidden rounded-3xl bg-slate-800 border border-slate-700 shadow-xl transition-all duration-300 hover:border-cyan-500/50">
              <div className="p-6 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                <div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Module 04</span>
                  <h3 className="text-xl font-bold text-white">4. Auto Feeder + Other Components</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <Plug className="h-5 w-5" />
                </div>
              </div>
              <div className="p-4 bg-slate-950/40">
                <img
                  src="/feeder-components-spec.jpg"
                  alt="Auto Feeder and Components Specification Blueprint"
                  className="rounded-2xl w-full object-cover shadow-2xl group-hover:scale-[1.01] transition-transform duration-300"
                />
              </div>
              <div className="p-6 bg-slate-800/80">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Automated smart feeder with LCD timer, jumper wires, relay module, breadboard, power adapter, USB cable, Dupont cables, terminal block, screws & standoffs, cable ties, DC plug, and IP67 waterproof box.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
            <p className="mt-4 text-slate-600">A seamless flow of data from your tank directly to your screen.</p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {[
              { icon: Droplets, label: 'Sensors' },
              { icon: Cpu, label: 'ESP32' },
              { icon: Wifi, label: 'Wi-Fi' },
              { icon: Box, label: 'AquaNova' },
              { icon: Activity, label: 'AI' },
              { icon: MonitorSmartphone, label: 'Dashboard' }
            ].map((step, idx, arr) => (
              <div key={step.label} className="flex flex-col md:flex-row items-center gap-4 w-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center shadow-sm border border-blue-100">
                    <step.icon className="h-7 w-7 text-blue-600" />
                  </div>
                  <span className="font-medium text-slate-900 text-sm">{step.label}</span>
                </div>
                {idx < arr.length - 1 && (
                  <ChevronRight className="hidden md:block h-6 w-6 text-slate-300 mx-auto" />
                )}
                {idx < arr.length - 1 && (
                  <div className="md:hidden h-6 w-px bg-slate-200 my-2"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Device ID / Activation */}
      <section className="py-24 bg-slate-950 text-white border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Simple Activation</h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                Every AquaNova Kit comes with a unique <strong>Device ID</strong>. Getting started takes seconds — no complex network configurations needed.
              </p>
              
              <div className="space-y-6">
                {[
                  { title: 'Buy Kit', desc: 'Order your complete hardware package.' },
                  { title: 'Receive Kit + Device ID', desc: 'Your unique code is included in the box.' },
                  { title: 'Sign In & Add Device', desc: 'Log into your AquaNova account.' },
                  { title: 'Enter Device ID', desc: 'Type your code in the dashboard.' }
                ].map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <CheckCircle2 className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{step.title}</h4>
                      <p className="text-slate-400 text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
              <h3 className="text-2xl font-bold mb-6 text-center">Manage Multiple Kits</h3>
              <p className="text-slate-400 text-center mb-8">
                One account scales infinitely. Add as many tanks as you need using the same login. No separate emails required.
              </p>
              
              <div className="bg-slate-950 rounded-2xl p-6 space-y-4 border border-slate-800">
                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Box className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Tank A (Nursery)</p>
                      <p className="text-xs text-slate-400">ID: AQ-8F32-K9M</p>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Box className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Tank B (Grow-out)</p>
                      <p className="text-xs text-slate-400">ID: AQ-2N45-P1L</p>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Box className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Tank C (Quarantine)</p>
                      <p className="text-xs text-slate-400">ID: AQ-7T91-X4C</p>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
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

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </div>
  );
}
