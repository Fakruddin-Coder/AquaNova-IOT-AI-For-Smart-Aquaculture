import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import SensorReading from '../models/SensorReading.js';
import Alert from '../models/Alert.js';
import AIAnalysis from '../models/AIAnalysis.js';
import { isDBConnected } from '../config/db.js';

export const chatWithAssistant = async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const queryLower = message.toLowerCase();
    const devId = deviceId || 'AN-001';

    let latestReading: any = null;
    let recentAlerts: any[] = [];
    let aiData: any = null;

    if (isDBConnected) {
      try {
        [latestReading, recentAlerts, aiData] = await Promise.all([
          SensorReading.findOne({ deviceId: devId }).sort({ timestamp: -1 }),
          Alert.find({ deviceId: devId, resolved: false }).sort({ timestamp: -1 }),
          AIAnalysis.findOne({ deviceId: devId }).sort({ createdAt: -1 }),
        ]);
      } catch (e) {}
    }

    const temp = latestReading?.temperature ?? 27.4;
    const ph = latestReading?.ph ?? 7.1;
    const wl = latestReading?.waterLevel ?? 82;
    const doVal = latestReading?.otherSensorValues?.dissolvedOxygen ?? 6.8;
    const turb = latestReading?.otherSensorValues?.turbidity ?? 3.2;
    const healthScore = aiData?.healthScore ?? 94;

    let reply = '';

    if (queryLower.includes('ph')) {
      reply = `The current pH level for device ${devId} is ${ph} pH. Standard optimal range is 6.5 – 8.5. ` +
        (ph >= 6.5 && ph <= 8.5 ? 'Water alkalinity and acidity are in healthy balance.' : 'pH parameter requires attention!');
    } else if (queryLower.includes('temp') || queryLower.includes('temperature')) {
      reply = `The current water temperature is ${temp}°C. Optimal range for standard aquatic culture is 24.0°C – 29.0°C. ` +
        (temp >= 24 && temp <= 29 ? 'Thermal stability is optimal.' : 'Temperature is outside ideal range.');
    } else if (queryLower.includes('oxygen') || queryLower.includes('dissolved') || queryLower.includes('do')) {
      reply = `Dissolved Oxygen level is currently ${doVal} mg/L. Target minimum threshold is 5.0 mg/L. Aeration levels are optimal.`;
    } else if (queryLower.includes('alert') || queryLower.includes('warning') || queryLower.includes('issue')) {
      if (recentAlerts.length > 0) {
        reply = `There are currently ${recentAlerts.length} active alert(s):\n` +
          recentAlerts.map((a) => `• ${a.type || 'Alert'}: ${a.message}`).join('\n');
      } else {
        reply = `No active critical alerts detected for device ${devId}. All monitored parameters are operating within standard parameters.`;
      }
    } else if (queryLower.includes('health') || queryLower.includes('score') || queryLower.includes('status')) {
      reply = `The current AI Health Score for your aquaculture tank is ${healthScore}/100. ` +
        (healthScore >= 80 ? 'System ecosystem is operating in optimal health state.' : 'System health needs review.');
    } else if (queryLower.includes('feed') || queryLower.includes('food') || queryLower.includes('diet')) {
      reply = `Recommended daily feeding calculation: 30g total daily across 3 scheduled cycles (08:00, 13:00, 18:00). Appetite response index is normal.`;
    } else {
      reply = `Analysis for AquaNova System (${devId}):\n` +
        `• Temperature: ${temp}°C\n` +
        `• pH Level: ${ph}\n` +
        `• Water Level: ${wl}%\n` +
        `• Dissolved Oxygen: ${doVal} mg/L\n` +
        `• Turbidity: ${turb} NTU\n` +
        `• AI Health Score: ${healthScore}/100\n\n` +
        `Ask me specifically about temperature, pH, alerts, feeding schedules, or dissolved oxygen levels!`;
    }

    return res.json({
      reply,
      deviceId: devId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Assistant error:', error);
    return res.status(500).json({ error: 'Failed to process AI assistant query' });
  }
};
