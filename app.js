// Cargar variables de entorno antes que cualquier otro módulo (auth.js lee JWT_SECRET al importarse)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { testConnection } from './config/database.js';
import routes from './routes/index.js';

// Para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (necesario para rate limiting detrás de reverse proxy)
app.set('trust proxy', 1);

// Helmet — seguridad HTTP headers + CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Sin CDN (ni jsDelivr ni cdnjs): ninguna página carga un script ni una hoja de afuera, salvo las fuentes de Google, desde que
      // Chart.js salió de Gestión (tests/paginas.test.js y publico.test.js)
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://rpad.mcrmodernizacion.gob.ar',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// No-cache para respuestas de API
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Rutas de la API
app.use('/api', routes);

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'RPAD API'
  });
});

// Cualquier otra ruta sirve el frontend (excepto /api)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de rutas API no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor
const startServer = async () => {
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.error('❌ No se pudo conectar a la base de datos.');
    process.exit(1);
  }

  if (!process.env.CRON_SECRET) {
    console.warn('⚠️  CRON_SECRET no está configurado: /api/cron/* va a rechazar todos los pedidos.');
  }

  // tests/helpers.js (arrancarEn) da por listo un servidor de prueba cuando lee "Servidor corriendo en puerto: N" en esta salida: si
  // cambia el cartel, hay que cambiar también lo que busca ahí
  app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🏛️  RPAD - Registro Permanente de Actualización de Datos ║');
    console.log('║   📊 Municipalidad de Comodoro Rivadavia                   ║');
    console.log('║                                                           ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║   🚀 Servidor corriendo en puerto: ${PORT}                    ║`);
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
  });
};

startServer();

export default app;
