import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import indexRouter from './routes/index.js';
import dealershipsRouter from './routes/dealerships.js';
import vehiclesRouter from './routes/vehicles.js';
import apiRouter from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Security headers. No CDN scripts needed beyond Bootstrap (same CSP shape as
// MyWork), and SSE (EventSource) is same-origin so default connect-src is fine.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        'font-src': ["'self'", 'https://cdn.jsdelivr.net'],
      },
    },
  }),
);

app.use(morgan('dev'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(expressLayouts);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/dealerships', dealershipsRouter);
app.use('/vehicles', vehiclesRouter);
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Not Found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('pages/error', {
    title: 'Error',
    message: err.message || 'An unexpected error occurred',
  });
});

export default app;
