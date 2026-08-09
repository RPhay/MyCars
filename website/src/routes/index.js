import { Router } from 'express';
import { getCounts } from '../services/researchStore.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const counts = await getCounts();
    res.render('pages/dashboard', { title: 'MyCars', counts });
  } catch (err) {
    next(err);
  }
});

export default router;
