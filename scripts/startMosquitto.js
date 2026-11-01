import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const confPath = path.resolve(rootDir, 'mosquitto.conf');

const possiblePaths = [
  'C:\\Program Files\\mosquitto\\mosquitto.exe',
  'C:\\PROGRA~1\\mosquitto\\mosquitto.exe',
  'mosquitto',
];

const mosquittoBin = possiblePaths.find((p) => (p !== 'mosquitto' ? fs.existsSync(p) : false)) || 'mosquitto';

console.log('[AquaNova MQTT] Starting Mosquitto Broker...');
console.log(`[AquaNova MQTT] Executable : ${mosquittoBin}`);
console.log(`[AquaNova MQTT] Config     : ${confPath}`);

const proc = spawn(mosquittoBin, ['-c', confPath, '-v'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
});

proc.on('error', (err) => {
  console.error('[AquaNova MQTT] Failed to start Mosquitto:', err.message);
  console.error('Make sure Mosquitto is installed at C:\\Program Files\\mosquitto\\');
});

proc.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.log(`[AquaNova MQTT] Mosquitto exited with code ${code}`);
  }
});
