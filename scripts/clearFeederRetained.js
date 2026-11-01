import mqtt from 'mqtt';

const brokerUrl = 'mqtt://127.0.0.1:1884';
console.log(`Connecting to Mosquitto broker at ${brokerUrl} to clear retained commands...`);

const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log('Connected! Publishing empty retained message to aquanova/commands/feeder...');
  client.publish('aquanova/commands/feeder', '', { retain: true, qos: 1 }, (err) => {
    if (err) {
      console.error('Failed to clear retained message:', err);
    } else {
      console.log('✅ Successfully cleared retained messages on aquanova/commands/feeder!');
    }
    client.end();
    process.exit(0);
  });
});

client.on('error', (err) => {
  console.error('MQTT error:', err.message);
  process.exit(1);
});
