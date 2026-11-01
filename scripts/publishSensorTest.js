import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://localhost:1883');

const defaults = [27.4, 7.12, 23.5, 6.8, 82];
const suppliedValues = process.argv.slice(2).map(Number);
const values = defaults.map((defaultValue, index) => suppliedValues[index] ?? defaultValue);

if (values.some((value) => !Number.isFinite(value))) {
  console.error('Usage: npm run publish:test -- <temperature> <ph> <turbidity> <dissolvedOxygen> <waterLevel>');
  process.exit(1);
}

const [temperature, ph, turbidity, dissolvedOxygen, waterLevel] = values;
const payload = { temperature, ph, turbidity, dissolvedOxygen, waterLevel };

client.on('connect', () => {
  console.log('[Test Publisher] Connected to Mosquitto on localhost:1883');
  // Retain the latest test reading so dashboards that reconnect later receive it.
  client.publish('aquanova/sensors', JSON.stringify(payload), { qos: 1, retain: true }, (err) => {
    if (err) {
      console.error('[Test Publisher] Error publishing:', err);
    } else {
      console.log('[Test Publisher] Successfully published telemetry payload:');
      console.log(JSON.stringify(payload, null, 2));
    }
    client.end();
    process.exit(0);
  });
});

client.on('error', (err) => {
  console.error('[Test Publisher] Connection error:', err.message);
  process.exit(1);
});
