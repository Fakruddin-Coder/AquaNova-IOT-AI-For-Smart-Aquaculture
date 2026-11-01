import { sensorMeta } from '@/lib/sensorMeta';
import type { Device, Sensor, SensorReading, Alert, FeedingHistory, AiPrediction, Recommendation } from '@/types';

interface PdfReportOptions {
  reportTitle?: string;
  user?: { full_name?: string | null; email?: string } | null;
  activeDevice?: Device | null;
  sensors?: Sensor[];
  latestReadings?: Record<string, SensorReading | null>;
  alerts?: Alert[];
  feedingHistory?: FeedingHistory[];
  predictions?: AiPrediction[];
  recommendations?: Recommendation[];
  fishCount?: number;
}

export function generatePdfReport(options: PdfReportOptions = {}) {
  const {
    reportTitle = 'System Health & Aquaculture Report',
    user,
    activeDevice,
    sensors = [],
    latestReadings = {},
    alerts = [],
    feedingHistory = [],
    predictions = [],
    recommendations = [],
  } = options;

  const deviceId = activeDevice?.id || activeDevice?.device_id || 'AN-001';
  
  // Get active fish population count for current device
  let fishCount = options.fishCount;
  if (fishCount === undefined) {
    try {
      const saved = localStorage.getItem('aquanova_fish_counts');
      const map = saved ? JSON.parse(saved) : {};
      fishCount = map[deviceId] ?? 25;
    } catch {
      fishCount = 25;
    }
  }

  const generatedDate = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const userName = user?.full_name || 'System Operator';
  const deviceName = activeDevice?.name || 'AquaNova Main Tank';
  const firmware = activeDevice?.firmware_version || '1.2.4';
  const wifiSignal = activeDevice?.wifi_signal ?? 88;
  const activeAlertsCount = alerts.filter((a) => !a.resolved).length;
  const healthScore = predictions.find((p) => p.model_type === 'health_score')?.health_score ?? 94;

  const reportHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>AquaNova Report - ${reportTitle}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background-color: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 13px;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-b: 2px solid #2563eb;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-logo {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: bold;
          font-size: 18px;
        }
        .brand-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .brand-subtitle {
          font-size: 11px;
          color: #64748b;
          margin: 0;
        }
        .report-meta {
          text-align: right;
        }
        .report-title {
          font-size: 14px;
          font-weight: 700;
          color: #2563eb;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .report-date {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .section {
          margin-bottom: 20px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          margin-bottom: 12px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .card-label {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 600;
          color: #64748b;
        }
        .card-value {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 2px;
        }
        .card-sub {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 12px;
        }
        th, td {
          padding: 8px 10px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        th {
          background-color: #f1f5f9;
          font-weight: 600;
          color: #475569;
          font-size: 11px;
          text-transform: uppercase;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
        }
        .badge-success { background-color: #dcfce7; color: #166534; }
        .badge-warning { background-color: #fef3c7; color: #92400e; }
        .badge-danger { background-color: #fee2e2; color: #991b1b; }

        .footer {
          margin-top: 30px;
          padding-top: 12px;
          border-t: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          <div class="brand-logo">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
            </svg>
          </div>
          <div>
            <h1 class="brand-title">AquaNova</h1>
            <p class="brand-subtitle">IoT & AI for Smart Aquaculture</p>
          </div>
        </div>
        <div class="report-meta">
          <p class="report-title">${reportTitle}</p>
          <p class="report-date">Generated: ${generatedDate}</p>
        </div>
      </div>

      <!-- System & Device Overview -->
      <div class="section">
        <h2 class="section-title">System & Active Tank Overview</h2>
        <div class="grid-3">
          <div class="card">
            <div class="card-label">Active Tank / Device</div>
            <div class="card-value">${deviceName}</div>
            <div class="card-sub">Device ID: ${deviceId}</div>
          </div>
          <div class="card">
            <div class="card-label">Fish Population</div>
            <div class="card-value">${fishCount} Fish</div>
            <div class="card-sub">Capacity: 50 (${Math.round(((fishCount ?? 25) / 50) * 100)}% occupancy)</div>
          </div>
          <div class="card">
            <div class="card-label">AI Health Score</div>
            <div class="card-value">${healthScore} / 100</div>
            <div class="card-sub">${healthScore >= 80 ? 'Optimal Status' : 'Requires Attention'}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="grid-3">
          <div class="card">
            <div class="card-label">Operator</div>
            <div class="card-value">${userName}</div>
          </div>
          <div class="card">
            <div class="card-label">Firmware & Network</div>
            <div class="card-value">v${firmware}</div>
            <div class="card-sub">WiFi Signal: ${wifiSignal}%</div>
          </div>
          <div class="card">
            <div class="card-label">Active Alerts</div>
            <div class="card-value">${activeAlertsCount}</div>
            <div class="card-sub">${activeAlertsCount === 0 ? 'All systems clear' : 'Alerts requiring review'}</div>
          </div>
        </div>
      </div>

      <!-- Water Quality Telemetry Table -->
      <div class="section">
        <h2 class="section-title">Water Quality Sensor Telemetry</h2>
        <table>
          <thead>
            <tr>
              <th>Sensor Parameter</th>
              <th>Current Reading</th>
              <th>Optimal Range</th>
              <th>Status</th>
              <th>Last Recorded</th>
            </tr>
          </thead>
          <tbody>
            ${sensors
              .map((sensor) => {
                const reading = latestReadings[sensor.id];
                const meta = sensorMeta[sensor.type];
                const val = reading ? (meta ? meta.format(reading.value) : `${reading.value} ${sensor.unit}`) : '—';
                const status = reading?.status || 'normal';
                const statusClass = status === 'normal' ? 'badge-success' : status === 'warning' ? 'badge-warning' : 'badge-danger';
                const optRange = meta ? `${meta.optimal[0]} - ${meta.optimal[1]} ${sensor.unit}` : 'N/A';
                return `
                  <tr>
                    <td><strong>${sensor.name}</strong> (${meta?.shortLabel || sensor.type})</td>
                    <td><strong>${val}</strong></td>
                    <td>${optRange}</td>
                    <td><span class="badge ${statusClass}">${status.toUpperCase()}</span></td>
                    <td>${reading ? new Date(reading.recorded_at).toLocaleTimeString() : 'Never'}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- Feeding & Recent Alerts -->
      <div class="section">
        <div class="grid-2">
          <div>
            <h2 class="section-title">Feeding Activity Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Time / Date</th>
                  <th>Amount</th>
                  <th>Trigger</th>
                </tr>
              </thead>
              <tbody>
                ${feedingHistory.length > 0 ? feedingHistory.slice(0, 5).map((f) => `
                  <tr>
                    <td>${new Date(f.fed_at).toLocaleDateString()} ${new Date(f.fed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>${f.amount}g</strong></td>
                    <td>${f.trigger_type.toUpperCase()}</td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="3" style="text-align:center; color:#94a3b8;">No feeding logs recorded yet</td></tr>
                `}
              </tbody>
            </table>
          </div>

          <div>
            <h2 class="section-title">Recent Alerts & Recommendations</h2>
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Title / Message</th>
                </tr>
              </thead>
              <tbody>
                ${recommendations.length > 0 ? recommendations.slice(0, 3).map((r) => `
                  <tr>
                    <td><span class="badge badge-success">INSIGHT</span></td>
                    <td>${r.message}</td>
                  </tr>
                `).join('') : ''}
                ${alerts.slice(0, 3).map((a) => `
                  <tr>
                    <td><span class="badge ${a.severity === 'critical' ? 'badge-danger' : 'badge-warning'}">${a.severity.toUpperCase()}</span></td>
                    <td><strong>${a.title}</strong>: ${a.message || 'Parameter check required'}</td>
                  </tr>
                `).join('')}
                ${alerts.length === 0 && recommendations.length === 0 ? `
                  <tr><td colspan="2" style="text-align:center; color:#94a3b8;">No recent alerts or warnings</td></tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="footer">
        <div>AquaNova Smart Aquaculture Platform — Official Telemetry Document</div>
        <div>Confidential & System Internal Report</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  try {
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const printWin = window.open(blobUrl, '_blank');

    if (!printWin) {
      // If popup blocker blocked opening a new tab, fallback to direct download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `AquaNova_${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('PDF Generation Error:', err);
  }
}
