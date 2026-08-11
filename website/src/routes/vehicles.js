import { Router } from 'express';
import {
  listVehicles,
  getVehicleOverview,
  getVehicle,
  listTypePhotos,
  listVinPhotos,
  resolvePhotoPath,
  deleteMake,
  deleteModel,
  deleteYear,
  deleteVehicle,
  setVehicleMeta,
} from '../services/researchStore.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const makes = await listVehicles();
    res.render('pages/vehicle-list', { title: 'Vehicles', makes });
  } catch (err) {
    next(err);
  }
});

router.get('/:make', async (req, res, next) => {
  try {
    const { make } = req.params;
    const makes = await listVehicles();
    const makeEntry = makes.find((m) => m.make === make);
    if (!makeEntry) {
      return res.status(404).render('pages/404', { title: 'Not Found' });
    }
    const vins = makeEntry.models.flatMap((md) =>
      md.years.flatMap((y) => y.vins.map((v) => ({ ...v, model: md.model, year: y.year }))),
    );
    res.render('pages/vehicle-make', {
      title: make,
      make,
      meta: makeEntry.meta,
      models: makeEntry.models,
      vins,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:make/:model', async (req, res, next) => {
  try {
    const { make, model } = req.params;
    const makes = await listVehicles();
    const modelEntry = makes.find((m) => m.make === make)?.models.find((md) => md.model === model);
    if (!modelEntry) {
      return res.status(404).render('pages/404', { title: 'Not Found' });
    }
    const vins = modelEntry.years.flatMap((y) => y.vins.map((v) => ({ ...v, year: y.year })));
    res.render('pages/vehicle-model', {
      title: `${make} ${model}`,
      make,
      model,
      meta: modelEntry.meta,
      years: modelEntry.years,
      vins,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:make/:model/:year', async (req, res, next) => {
  try {
    const { make, model, year } = req.params;
    let overview = null;
    try {
      overview = await getVehicleOverview(make, model, year);
    } catch {
      // no overview.md yet — fine, page still shows any VIN files
    }
    const makes = await listVehicles();
    const modelEntry = makes
      .find((m) => m.make === make)
      ?.models.find((m) => m.model === model);
    const yearEntry = modelEntry?.years.find((y) => y.year === year);

    if (!overview && !yearEntry) {
      return res.status(404).render('pages/404', { title: 'Not Found' });
    }

    const photos = await listTypePhotos(make, model, year);

    res.render('pages/vehicle-year', {
      title: `${year} ${make} ${model}`,
      make,
      model,
      year,
      meta: yearEntry?.meta || { rating: 0, status: 'none' },
      overview,
      photos,
      vins: yearEntry?.vins || [],
    });
  } catch (err) {
    next(err);
  }
});

// Type-level photo (5 segments after /vehicles/ — distinct from the 4-segment
// VIN detail route below, so no route-matching ambiguity).
router.get('/:make/:model/:year/photos/:file', async (req, res) => {
  const { make, model, year, file } = req.params;
  const resolved = resolvePhotoPath(make, model, year, 'photos', file);
  if (!resolved) return res.status(404).end();
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

router.get('/:make/:model/:year/:vin', async (req, res, next) => {
  try {
    const { make, model, year, vin } = req.params;
    const vehicle = await getVehicle(make, model, year, vin);
    const photos = await listVinPhotos(make, model, year, vin);
    res.render('pages/vehicle-detail', {
      title: vehicle.title,
      make,
      model,
      year,
      vin,
      vehicle,
      photos,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).render('pages/404', { title: 'Not Found' });
    }
    next(err);
  }
});

// VIN-level photo (6 segments — distinct from both routes above).
router.get('/:make/:model/:year/:vin/photos/:file', async (req, res) => {
  const { make, model, year, vin, file } = req.params;
  const resolved = resolvePhotoPath(make, model, year, vin, 'photos', file);
  if (!resolved) return res.status(404).end();
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

function handleMetaError(err, res, next) {
  if (err.message === 'Invalid rating' || err.message === 'Invalid status' || err.message === 'Invalid notes') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

router.put('/:make/meta', async (req, res, next) => {
  try {
    res.json(await setVehicleMeta([req.params.make], req.body));
  } catch (err) {
    handleMetaError(err, res, next);
  }
});

router.put('/:make/:model/meta', async (req, res, next) => {
  try {
    res.json(await setVehicleMeta([req.params.make, req.params.model], req.body));
  } catch (err) {
    handleMetaError(err, res, next);
  }
});

router.put('/:make/:model/:year/meta', async (req, res, next) => {
  try {
    res.json(await setVehicleMeta([req.params.make, req.params.model, req.params.year], req.body));
  } catch (err) {
    handleMetaError(err, res, next);
  }
});

router.put('/:make/:model/:year/:vin/meta', async (req, res, next) => {
  try {
    res.json(await setVehicleMeta([req.params.make, req.params.model, req.params.year, req.params.vin], req.body));
  } catch (err) {
    handleMetaError(err, res, next);
  }
});

router.delete('/:make', async (req, res, next) => {
  try {
    await deleteMake(req.params.make);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:make/:model', async (req, res, next) => {
  try {
    await deleteModel(req.params.make, req.params.model);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:make/:model/:year', async (req, res, next) => {
  try {
    await deleteYear(req.params.make, req.params.model, req.params.year);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:make/:model/:year/:vin', async (req, res, next) => {
  try {
    await deleteVehicle(req.params.make, req.params.model, req.params.year, req.params.vin);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
