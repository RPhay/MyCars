import { Router } from 'express';
import { listDealerships, getDealership } from '../services/researchStore.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const dealerships = await listDealerships();
    res.render('pages/dealership-list', { title: 'Dealerships', dealerships });
  } catch (err) {
    next(err);
  }
});

router.get('/:domain', async (req, res, next) => {
  try {
    const dealership = await getDealership(req.params.domain);
    res.render('pages/dealership-detail', {
      title: dealership.title,
      domain: req.params.domain,
      dealership,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).render('pages/404', { title: 'Not Found' });
    }
    next(err);
  }
});

export default router;
