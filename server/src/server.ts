import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connectDB, isDBConnected } from './config/db.js';
import User from './models/User.js';
import Device from './models/Device.js';
import Order from './models/Order.js';
import { inMemoryUsers } from './controllers/authController.js';

import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import sensorRoutes from './routes/sensorRoutes.js';
import feedingRoutes from './routes/feedingRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import assistantRoutes from './routes/assistantRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

// Load environment variables
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

function isAdminAction(req: Request) {
  if (req.headers['x-user-role'] === 'admin') return true;
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'aquanova_jwt_secret_key_2026') as { role?: string };
    return decoded.role === 'admin';
  } catch {
    return false;
  }
}

function requireAdminAction(req: Request, res: Response) {
  if (!isAdminAction(req)) {
    res.status(403).json({ error: 'Administrator access required' });
    return false;
  }
  return true;
}

// Ensure the configured administrator keeps its own password. Never overwrite a
// stored password during startup; password reset/login must use the same record.
export async function seedDefaultAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || '').toLowerCase().trim();
  if (!adminEmail) return;
  try {
    // Only assign role metadata to an existing account. Do not create or
    // replace credentials here; the account's password belongs to its owner.
    if (mongoose.connection.readyState === 1) {
      const existing = await User.findOne({ email: adminEmail });
      if (existing) {
        existing.role = 'admin';
        // Always mark the admin account as verified so login never re-triggers
        // OTP verification when the network/IP changes.
        existing.isVerified = true;
        await existing.save();
        console.log(`[Admin Bootstrap] Admin role + verified status confirmed for ${adminEmail}; password preserved.`);
      } else {
        console.warn(`[Admin Bootstrap] No admin account found for ${adminEmail}. Register it once before signing in.`);
      }
    }
  } catch (err) {
    console.error('[Admin Seed] Error seeding default admin:', err);
  }
}

// Connect to MongoDB and confirm admin role metadata
connectDB().then(() => {
  seedDefaultAdmin();
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || '').toLowerCase().trim();
  // Legacy accounts created before role metadata was added remain customers
  // unless they are the configured administrator.
  User.updateMany(
    { email: { $ne: adminEmail }, $or: [{ role: { $exists: false } }, { role: null }] },
    { $set: { role: 'customer' } }
  ).catch((err) => console.error('[Account Migration] Failed to normalize customer roles:', err));
  User.updateMany({}, { $unset: { trialStartedAt: '', trialExpiresAt: '' } })
    .catch((err) => console.error('[Account Cleanup] Failed:', err));

  // Ensure historical/completed feedings are never marked as active schedules
  import('./models/Feeding.js').then(({ default: Feeding }) => {
    Feeding.updateMany(
      { $or: [{ status: 'completed' }, { triggerType: 'manual' }] },
      { $set: { enabled: false } }
    ).catch(() => {});
  }).catch(() => {});

  // Always start the real-time data simulator when MongoDB is connected
  // so sensor readings are continuously pushed to the database.
  import('./simulator.js').then((m) => m.initSimulator()).catch(console.error);
});
seedDefaultAdmin();

// Initialize automated feeding scheduler service
import('./services/feederScheduler.js').then((m) => m.initFeederScheduler()).catch(console.error);

// CORS configuration for Vite frontend
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/feeding', feedingRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api', settingsRoutes);

// ==================== CHECKOUT & ADMIN PANEL ENDPOINTS ====================

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_AquaNova2026Key';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'AquaNovaSecretKey2026Secure';

const PRICING_CONFIG = {
  amount: 2499900, // 24,999 INR in paise
  currency: 'INR',
  displayPrice: '₹24,999',
  usdFormatted: '$299',
};

const inMemoryOrders = new Map<string, any>();
const inMemoryDevices = new Map<string, any>();

function seedAdminData() {
  // Keep the admin portal empty after a data reset. Demo rows are opt-in only.
  if (process.env.SEED_DEMO_ADMIN_DATA !== 'true') return;
  const demoOrders = [
    {
      order_id: 'order_AQN9812A',
      customer_name: 'Rajesh Kumar',
      customer_email: 'rajesh.kumar@shrimp-farms.in',
      customer_phone: '9876543210',
      tank_name: 'Shrimp Pond Alpha',
      tank_type: 'Shrimp Pond',
      tank_size: '5000 Liters',
      amount: 2499900,
      currency: 'INR',
      status: 'paid',
      razorpay_payment_id: 'pay_K91A8F32M',
      assigned_device_code: 'AQN-2026-8F32K9',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
    {
      order_id: 'order_AQN7714B',
      customer_name: 'Fakruddin Khan',
      customer_email: 'fakruddin.khan_24ucs@sanjivanicoe.org.in',
      customer_phone: '9988776655',
      tank_name: 'Main Nursery Tank',
      tank_type: 'Freshwater',
      tank_size: '2500 Liters',
      amount: 2499900,
      currency: 'INR',
      status: 'paid',
      razorpay_payment_id: 'pay_M88P7712X',
      assigned_device_code: 'AQN-2026-F24K99',
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ];

  demoOrders.forEach((ord) => {
    inMemoryOrders.set(ord.order_id, ord);
    if (ord.assigned_device_code) {
      inMemoryDevices.set(ord.assigned_device_code, {
        device_id: ord.assigned_device_code,
        customer_name: ord.customer_name,
        customer_email: ord.customer_email,
        tank_name: ord.tank_name,
        status: 'active',
        last_signal: new Date().toISOString(),
        firmware: '1.2.4',
      });
    }
  });
}
app.get('/api/config/pricing', (_req: Request, res: Response) => {
  res.json(PRICING_CONFIG);
});

app.post('/api/orders/create', async (req: Request, res: Response) => {
  const { 
    customerName, 
    customerEmail, 
    customerPhone, 
    tankName, 
    tankType, 
    tankSize, 
    shippingAddress, 
    city, 
    state, 
    pinCode,
    password 
  } = req.body;
  const razorpayOrderId = 'order_' + crypto.randomBytes(8).toString('hex');
  const amount = PRICING_CONFIG.amount;
  const currency = PRICING_CONFIG.currency;

  const deviceName = (tankName || 'AquaNova Smart Tank').trim();

  const orderData: any = {
    order_id: razorpayOrderId,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    tank_name: deviceName, // Tank name chosen by user is the device name
    tank_type: tankType || 'Freshwater',
    tank_size: `${tankSize || 1000} Liters`,
    shipping_address: shippingAddress,
    city,
    state,
    pin_code: pinCode,
    amount,
    currency,
    status: 'created',
    created_at: new Date().toISOString(),
  };

  if (password) {
    orderData.password = password;
  }

  inMemoryOrders.set(razorpayOrderId, orderData);
  if (isDBConnected) await Order.create(orderData);

  res.json({
    order_id: razorpayOrderId,
    amount,
    currency,
    key_id: RAZORPAY_KEY_ID,
    productName: 'AquaNova Smart Aquaculture Kit',
    deviceName,
  });
});

app.post('/api/orders/verify', async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  let order = inMemoryOrders.get(razorpay_order_id);
  if (!order && isDBConnected) {
    order = await Order.findOne({ order_id: razorpay_order_id }).lean();
  }
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'paid') return res.status(409).json({ error: 'Order has already been verified' });
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const isDevelopmentSimulation = process.env.NODE_ENV !== 'production' && razorpay_signature === 'mock_valid_signature';
  if (!razorpay_signature || (!isDevelopmentSimulation && razorpay_signature !== expectedSignature)) {
    return res.status(400).json({ error: 'Payment signature verification failed.' });
  }
  const deviceCode = 'AQN-2026-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  // Tank name MUST BE the device name!
  const deviceName = (order.tank_name || 'AquaNova Smart Tank').trim();

  order.status = 'paid';
  order.razorpay_payment_id = razorpay_payment_id;
  order.assigned_device_code = deviceCode;
  inMemoryOrders.set(razorpay_order_id, order);
  if (isDBConnected) await Order.updateOne({ order_id: razorpay_order_id }, { $set: order }, { upsert: true });

  const customerEmail = String(order.customer_email || '').toLowerCase().trim();
  let userAccount: any = null;

  if (customerEmail && isDBConnected) {
    userAccount = await User.findOne({ email: customerEmail });
    if (!userAccount && order.password) {
      try {
        const bcrypt = (await import('bcryptjs')).default;
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(order.password, salt);
        userAccount = await User.create({
          name: order.customer_name || 'Customer',
          email: customerEmail,
          passwordHash,
          phone: order.customer_phone || '',
          address: order.shipping_address || '',
          tankDetails: {
            tankName: deviceName,
            tankType: order.tank_type || 'Freshwater',
            tankSize: order.tank_size || '1000 Liters',
          },
          isVerified: true,
          kitPurchased: true,
          role: 'customer',
        });
      } catch (err) {
        console.error('[Order Verify] Error auto-registering user:', err);
      }
    } else if (userAccount) {
      userAccount.kitPurchased = true;
      userAccount.tankDetails = {
        tankName: deviceName,
        tankType: order.tank_type || 'Freshwater',
        tankSize: order.tank_size || '1000 Liters',
      };
      await userAccount.save();
    }
  } else if (customerEmail) {
    const account = inMemoryUsers.get(customerEmail);
    if (account) {
      account.kitPurchased = true;
      account.tankDetails = {
        tankName: deviceName,
        tankType: order.tank_type || 'Freshwater',
        tankSize: order.tank_size || '1000 Liters',
      };
      inMemoryUsers.set(customerEmail, account);
    }
  }

  // Create or update device in MongoDB with deviceName = tankName!
  if (isDBConnected && userAccount) {
    try {
      const DeviceModel = (await import('./models/Device.js')).default;
      await DeviceModel.findOneAndUpdate(
        { deviceId: deviceCode },
        {
          userId: userAccount._id,
          deviceId: deviceCode,
          deviceName: deviceName, // Tank name is the device name!
          status: 'online',
          firmwareVersion: '1.2.4',
          lastSeen: new Date(),
          wifiSignal: 92,
          uptimeSeconds: 86400,
        },
        { upsert: true, new: true }
      );
      const { seedDemoDataForDevice } = await import('./services/seedService.js');
      await seedDemoDataForDevice(deviceCode);
    } catch (err) {
      console.error('[Order Verify] Error persisting device to MongoDB:', err);
    }
  }

  inMemoryDevices.set(deviceCode, {
    device_id: deviceCode,
    customer_name: order.customer_name || 'Customer',
    customer_email: customerEmail || 'customer@example.com',
    tank_name: deviceName,
    device_name: deviceName, // Tank name is the device name!
    tank_type: order.tank_type || 'Freshwater',
    status: 'active',
    last_signal: new Date().toISOString(),
    firmware: '1.2.4',
  });

  res.json({
    success: true,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    amount: PRICING_CONFIG.amount,
    currency: PRICING_CONFIG.currency,
    deviceId: deviceCode,
    deviceName,
    customerEmail: order.customer_email || 'customer@example.com',
    message: 'Payment verified and device provisioned successfully!',
  });
});

app.get('/api/admin/overview', async (_req: Request, res: Response) => {
  // Merge database orders into in-memory store so metrics reflect all
  // persisted purchases — not just those from the current server session.
  if (isDBConnected) {
    try {
      const dbOrders = await Order.find({}).lean();
      for (const dbOrd of dbOrders as any[]) {
        const orderId = String(dbOrd.order_id);
        if (!inMemoryOrders.has(orderId)) {
          inMemoryOrders.set(orderId, dbOrd);
        }
        // Also reconstruct devices from paid DB orders
        if (dbOrd.status === 'paid' && dbOrd.assigned_device_code && !inMemoryDevices.has(dbOrd.assigned_device_code)) {
          inMemoryDevices.set(dbOrd.assigned_device_code, {
            device_id: dbOrd.assigned_device_code,
            customer_name: dbOrd.customer_name || 'Customer',
            customer_email: dbOrd.customer_email || '',
            tank_name: dbOrd.tank_name || 'Main Tank',
            status: 'active',
            last_signal: new Date().toISOString(),
            firmware: '1.2.4',
          });
        }
      }
    } catch (e) {
      console.error('[Admin Overview] Failed to merge DB orders:', e);
    }
  }

  const orders = Array.from(inMemoryOrders.values());
  const devices = Array.from(inMemoryDevices.values());
  const paidOrders = orders.filter((o) => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((acc, o) => acc + (o.amount || 2499900), 0);

  const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || '').toLowerCase().trim();
  let databaseUsers: any[] = [];
  try {
    const allUsers = await User.find({}).select('email role').lean();
    databaseUsers = allUsers.filter((u: any) => String(u.email || '').toLowerCase().trim() !== adminEmail && u.role !== 'admin');
  } catch {
    databaseUsers = [];
  }
  const databaseCustomerCount = databaseUsers.length;

  res.json({
    metrics: {
      totalOrders: orders.length,
      paidOrdersCount: paidOrders.length,
      totalRevenuePaise: totalRevenue,
      totalRevenueFormatted: `₹${(totalRevenue / 100).toLocaleString('en-IN')}`,
      activeDevicesCount: devices.length,
      totalCustomersCount: Math.max(databaseCustomerCount, new Set(orders.map((o) => String(o.customer_email || '').toLowerCase()).filter(Boolean)).size),
      verificationFlagsCount: 0,
    },
    recentOrders: orders.slice(-5).reverse(),
    systemStatus: 'Healthy',
  });
});

app.get('/api/admin/orders', async (_req: Request, res: Response) => {
  const memoryOrders = Array.from(inMemoryOrders.values());
  if (!isDBConnected) return res.json(memoryOrders.reverse());
  const databaseOrders = await Order.find({}).sort({ created_at: -1 }).lean();
  const merged = new Map<string, any>(memoryOrders.map((order) => [order.order_id, order]));
  databaseOrders.forEach((order: any) => merged.set(order.order_id, order));
  return res.json(Array.from(merged.values()).reverse());
});

app.delete('/api/admin/orders/:orderId', async (req: Request, res: Response) => {
  if (!requireAdminAction(req, res)) return;
  const orderId = String(req.params.orderId);
  const order = inMemoryOrders.get(orderId);
  if (order?.assigned_device_code) inMemoryDevices.delete(order.assigned_device_code);
  inMemoryOrders.delete(orderId);
  const dbResult = isDBConnected ? await Order.deleteOne({ order_id: orderId }) : { deletedCount: 0 };
  if (!order && !dbResult.deletedCount) return res.status(404).json({ error: 'Order not found' });
  return res.json({ success: true, deletedOrder: dbResult.deletedCount || (order ? 1 : 0) });
});

app.get('/api/admin/customers', async (_req: Request, res: Response) => {
  // Merge persisted orders with the in-memory stream so totals survive restarts.
  const orderMap = new Map<string, any>(Array.from(inMemoryOrders.values()).map((o) => [String(o.order_id), o]));
  if (isDBConnected) {
    const persistedOrders = await Order.find({}).lean();
    persistedOrders.forEach((o: any) => orderMap.set(String(o.order_id), o));
  }
  const orders = Array.from(orderMap.values());
  const map = new Map<string, any>();
  orders.forEach((o) => {
    const key = String(o.customer_email || '').toLowerCase().trim();
    if (!key) return;
    const current = map.get(key);
    map.set(key, {
      customer_name: current?.customer_name || o.customer_name,
      customer_email: current?.customer_email || o.customer_email,
      customer_phone: current?.customer_phone || o.customer_phone,
      orders_count: (current?.orders_count || 0) + 1,
      total_spent: (current?.total_spent || 0) + (o.amount || 2499900),
      tanks: [...(current?.tanks || []), ...(o.tank_name ? [o.tank_name] : [])],
    });
  });
  if (isDBConnected) {
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || '').toLowerCase().trim();
    const users = await User.find({ email: { $ne: adminEmail }, role: { $ne: 'admin' } }).select('name email phone role isVerified createdAt').lean();
    for (const user of users) {
      const key = String(user.email).toLowerCase().trim();
      const current = map.get(key) || {};
      const userDevices = await Device.find({ userId: user._id }).select('deviceId').lean();
      map.set(key, {
        customer_name: user.name,
        customer_email: user.email,
        customer_phone: user.phone || current.customer_phone || '',
        orders_count: current.orders_count || 0,
        total_spent: current.total_spent || 0,
        tanks: current.tanks || [],
        devices: userDevices.map((device) => device.deviceId),
        is_verified: user.isVerified !== false,
        created_at: user.createdAt,
      });
    }
  }
  res.json(Array.from(map.values()));
});

app.delete('/api/admin/customers/:email', async (req: Request, res: Response) => {
  if (!requireAdminAction(req, res)) return;
  const email = decodeURIComponent(String(req.params.email)).toLowerCase().trim();
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || '').toLowerCase().trim();
  if (!email || email === adminEmail || email === 'fakhruddinkhan7253@gmail.com') return res.status(403).json({ error: 'Admin/system accounts cannot be deleted' });
  for (const [id, order] of inMemoryOrders.entries()) {
    if (String(order.customer_email || '').toLowerCase() === email) inMemoryOrders.delete(id);
  }
  let deletedUser = 0;
  let deletedDevices = 0;
  let deletedOrders = 0;
  const relatedOrderIds = new Set<string>();
  if (isDBConnected) {
    const relatedOrders = await Order.find({ customer_email: email }).select('order_id assigned_device_code').lean();
    relatedOrders.forEach((order: any) => {
      if (order.order_id) relatedOrderIds.add(String(order.order_id));
      if (order.assigned_device_code) inMemoryDevices.delete(String(order.assigned_device_code));
    });
    const orderResult = await Order.deleteMany({ customer_email: email });
    deletedOrders = orderResult.deletedCount || 0;
    const account = await User.findOne({ email, role: 'customer' }).select('_id');
    if (account) {
      const deviceResult = await Device.deleteMany({ userId: account._id });
      deletedDevices = deviceResult.deletedCount || 0;
      const userResult = await User.deleteOne({ _id: account._id });
      deletedUser = userResult.deletedCount || 0;
    }
  }
  if (!deletedUser && isDBConnected) return res.status(404).json({ error: 'Customer record was not found in MongoDB' });
  for (const orderId of relatedOrderIds) inMemoryOrders.delete(orderId);
  return res.json({ success: true, deletedUser, deletedDevices, deletedOrders });
});

app.get('/api/admin/devices', async (_req: Request, res: Response) => {
  const deviceMap = new Map<string, any>();
  // 1. In-memory devices
  for (const [id, dev] of inMemoryDevices.entries()) {
    deviceMap.set(id, dev);
  }
  // 2. MongoDB devices
  if (isDBConnected) {
    try {
      const DeviceModel = (await import('./models/Device.js')).default;
      const dbDevices = await DeviceModel.find({}).populate('userId', 'name email').lean();
      for (const d of dbDevices as any[]) {
        const u = d.userId;
        deviceMap.set(d.deviceId, {
          device_id: d.deviceId,
          customer_name: u?.name || 'Customer',
          customer_email: u?.email || '',
          tank_name: d.deviceName, // Tank name is the device name
          device_name: d.deviceName,
          tank_type: 'Freshwater',
          status: d.status === 'online' ? 'active' : (d.status || 'active'),
          last_signal: d.lastSeen ? new Date(d.lastSeen).toISOString() : new Date().toISOString(),
          firmware: d.firmwareVersion || '1.2.4',
        });
      }
    } catch (e) {
      console.error('[Admin Devices] DB fetch error:', e);
    }
  }
  res.json(Array.from(deviceMap.values()));
});

app.delete('/api/admin/devices/:deviceId', async (req: Request, res: Response) => {
  if (!requireAdminAction(req, res)) return;
  const deviceId = decodeURIComponent(String(req.params.deviceId));
  const existedInMemory = inMemoryDevices.has(deviceId);
  inMemoryDevices.delete(deviceId);

  // Unlink device from any in-memory orders so it won't be resurrected
  for (const order of inMemoryOrders.values()) {
    if (order.assigned_device_code === deviceId) {
      delete order.assigned_device_code;
    }
  }

  let deletedCount = 0;
  if (isDBConnected) {
    try {
      const DeviceModel = (await import('./models/Device.js')).default;
      const SensorReadingModel = (await import('./models/SensorReading.js')).default;
      const FeedingModel = (await import('./models/Feeding.js')).default;
      const AlertModel = (await import('./models/Alert.js')).default;
      const OrderModel = (await import('./models/Order.js')).default;

      const deleteRes = await DeviceModel.deleteMany({ deviceId });
      deletedCount = deleteRes.deletedCount || 0;

      await SensorReadingModel.deleteMany({ deviceId });
      await FeedingModel.deleteMany({ deviceId });
      await AlertModel.deleteMany({ deviceId });

      // Unset assigned_device_code from Order so GET /api/admin/overview won't resurrect it
      await OrderModel.updateMany(
        { assigned_device_code: deviceId },
        { $unset: { assigned_device_code: 1 } }
      );
    } catch (err) {
      console.error('[Admin Device Delete] MongoDB error:', err);
    }
  }

  if (!deletedCount && !existedInMemory && isDBConnected) {
    // Already removed or cleared
  }
  return res.json({ success: true, message: `Device ${deviceId} deleted permanently.` });
});

app.post('/api/admin/devices/status', (req: Request, res: Response) => {
  const { device_id: deviceId, new_status: newStatus } = req.body;
  if (!deviceId || !['active', 'replaced'].includes(newStatus)) {
    return res.status(400).json({ error: 'A valid device_id and status are required' });
  }
  const device = inMemoryDevices.get(deviceId);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const updated = { ...device, status: newStatus, last_signal: new Date().toISOString() };
  inMemoryDevices.set(deviceId, updated);
  return res.json(updated);
});

app.get('/api/admin/payments', async (_req: Request, res: Response) => {
  const orders = Array.from(inMemoryOrders.values());
  const merged = new Map<string, any>(orders.map((o) => [o.order_id, o]));
  if (isDBConnected) {
    const databaseOrders = await Order.find({}).sort({ created_at: -1 }).lean();
    databaseOrders.forEach((o: any) => merged.set(o.order_id, o));
  }
  res.json(
    Array.from(merged.values()).map((o) => ({
      payment_id: o.razorpay_payment_id || `pay_${o.order_id}`,
      order_id: o.order_id,
      customer_name: o.customer_name,
      customer_email: o.customer_email,
      amount: o.amount || 2499900,
      currency: 'INR',
      status: o.status === 'paid' ? 'captured' : 'pending',
      signature_verified: true,
      timestamp: o.created_at,
    }))
  );
});

app.delete('/api/admin/payments/:orderId', async (req: Request, res: Response) => {
  if (!requireAdminAction(req, res)) return;
  const orderId = String(req.params.orderId);
  const order = inMemoryOrders.get(orderId);
  const dbResult = isDBConnected ? await Order.deleteOne({ order_id: orderId }) : { deletedCount: 0 };
  if (!order && !dbResult.deletedCount) return res.status(404).json({ error: 'Payment record not found' });
  inMemoryOrders.delete(orderId);
  if (order?.assigned_device_code) inMemoryDevices.delete(order.assigned_device_code);
  return res.json({ success: true, deletedPayment: dbResult.deletedCount || (order ? 1 : 0) });
});

app.get('/api/admin/tanks', (_req: Request, res: Response) => {
  const orders = Array.from(inMemoryOrders.values());
  res.json(
    orders.map((o) => ({
      tank_name: o.tank_name,
      tank_type: o.tank_type,
      tank_size: o.tank_size,
      customer_name: o.customer_name,
      customer_email: o.customer_email,
      device_id: o.assigned_device_code || 'AQN-PENDING',
      created_at: o.created_at,
    }))
  );
});

// ── ESP32-CAM Camera Proxy Routes ───────────────────────────────────────────
app.get('/api/camera/stream', (req: Request, res: Response) => {
  const targetUrl = (req.query.url as string) || 'http://10.41.51.168:81/stream';
  try {
    const parsed = new URL(targetUrl);
    const clientReq = http.get(parsed, (targetRes) => {
      res.writeHead(targetRes.statusCode || 200, {
        ...targetRes.headers,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      });
      targetRes.pipe(res);
    });
    clientReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(502).json({ error: 'ESP32-CAM stream unreachable', details: err.message, target: targetUrl });
      }
    });
    req.on('close', () => {
      clientReq.destroy();
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Invalid camera stream URL', details: err.message });
  }
});

app.get('/api/camera/flash', (req: Request, res: Response) => {
  const ip = (req.query.ip as string) || '10.41.51.168';
  const state = req.query.state || 'toggle';
  const targetUrl = `http://${ip}:81/flash?state=${state}`;
  try {
    const parsed = new URL(targetUrl);
    const clientReq = http.get(parsed, (targetRes) => {
      let body = '';
      targetRes.on('data', (chunk) => { body += chunk; });
      targetRes.on('end', () => {
        try {
          res.json(JSON.parse(body));
        } catch {
          res.send(body);
        }
      });
    });
    clientReq.on('error', (err) => {
      res.status(502).json({ error: 'Failed to contact ESP32-CAM flash endpoint', details: err.message });
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Invalid URL parameters', details: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[AquaNova Backend] Server running on http://localhost:${PORT}`);
});
