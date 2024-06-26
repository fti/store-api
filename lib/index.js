'use strict';

import express from 'express';
import gplay from "google-play-scraper";
import store from 'app-store-scraper';
import path from 'path';
import qs from 'querystring';

const router = express.Router();

const toList = (apps) => ({ results: apps });
const toData = (apps) => ({ data: apps });

const cleanUrls = (req, os) => (app) => Object.assign({}, app, {
  playstoreUrl: app.url,
  url: buildUrl(req, 'apps/' + app.appId+ '?os='+os),
  permissions: buildUrl(req, 'apps/' + app.appId + '/permissions'+ '?os='+os),
  similar: buildUrl(req, 'apps/' + app.appId + '/similar'+ '?os='+os),
  reviews: buildUrl(req, 'apps/' + app.appId + '/reviews'+ '?os='+os),
  datasafety: buildUrl(req, 'apps/' + app.appId + '/datasafety'+ '?os='+os),
  developerName: app.developer||app.developerId,
  developer: {
    devId: app.developer,
    url: buildUrl(req, 'developers/' + qs.escape(app.developerId||app.developer)+ '?os='+os)
  },
  categories: buildUrl(req, 'categories/')
});

const buildUrl = (req, subpath) =>
  req.protocol + '://' + path.join(req.get('host'), req.baseUrl, subpath);

/* Index */
router.get('/', (req, res) =>
  res.json({
    apps: buildUrl(req, 'apps'),
    developers: buildUrl(req, 'developers'),
    categories: buildUrl(req, 'categories')
  }));

/* App search */
router.get('/apps/', function (req, res, next) {
  if (!req.query.q) {
    return next();
  }

  const opts = Object.assign({ term: req.query.q }, req.query);

  if(opts.os == 'ios'){
    store.search(opts)
    .then((apps) => apps.map(cleanUrls(req, opts.os)))
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
  }else{
    gplay.search(opts)
    .then((apps) => apps.map(cleanUrls(req, opts.os)))
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
  }
});

/* Search suggest */
router.get('/apps/', function (req, res, next) {
  if (!req.query.suggest) {
    return next();
  }

  const toJSON = (term) => ({
    term,
    url: buildUrl(req, '/apps/') + '?' + qs.stringify({ q: term })
  });

  if(req.query.os == 'ios'){
    store.suggest({ term: req.query.suggest })
    .then((terms) => terms.map(toJSON))
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
  }else{
    gplay.suggest({ term: req.query.suggest })
    .then((terms) => terms.map(toJSON))
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
  }

  
});

/* App list */
router.get('/apps/', function (req, res, next) {
  function paginate(apps) {
    const num = parseInt(req.query.num || '60');
    const start = parseInt(req.query.start || '0');

    if (start - num >= 0) {
      req.query.start = start - num;
      apps.prev = buildUrl(req, '/apps/') + '?' + qs.stringify(req.query);
    }

    if (start + num <= 500) {
      req.query.start = start + num;
      apps.next = buildUrl(req, '/apps/') + '?' + qs.stringify(req.query);
    }

    return apps;
  }

  if(req.query.os == 'ios'){
    req.query.category = parseInt(req.query.category)
    store.list(req.query)
    .then((apps) => apps.map(cleanUrls(req, req.query.os)))
    .then(toList).then(paginate)
    .then(res.json.bind(res))
    .catch(next);
  } else {
    gplay.list(req.query)
    .then((apps) => apps.map(cleanUrls(req, req.query.os)))
    .then(toList).then(paginate)
    .then(res.json.bind(res))
    .catch(next);
  }

});

/* App detail*/
router.get('/apps/:appId', function (req, res, next) {
  const opts = Object.assign({ id: req.params.appId, appId: req.params.appId }, req.query);
  if(opts.os == 'ios'){
    opts.ratings = true;
    store.app(opts)
    .then(cleanUrls(req, opts.os))
    .then(res.json.bind(res))
    .catch(next);
  } else {
    gplay.app(opts)
      .then(cleanUrls(req, opts.os))
      .then(res.json.bind(res))
      .catch(next);
  }
});

/* Similar apps */
router.get('/apps/:appId/similar', function (req, res, next) {
  const opts = Object.assign({ id: req.params.appId, appId: req.params.appId }, req.query);
  if(opts.os == 'ios'){
    store.similar(opts)
    .then((apps) => apps.map(cleanUrls(req, opts.os)))
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
  } else {
    gplay.similar(opts)
    .then((apps) => apps.map(cleanUrls(req, opts.os)))
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
  }
});

/* Data Safety */
router.get('/apps/:appId/datasafety', function (req, res, next) {
  const opts = Object.assign({ id: req.params.appId, appId: req.params.appId }, req.query);
  if(opts.os == 'ios'){
    store.privacy(opts)
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
  } else {
    gplay.datasafety(opts)
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
  }
  

});

/* App permissions */
router.get('/apps/:appId/permissions', function (req, res, next) {
  const opts = Object.assign({ appId: req.params.appId }, req.query);
  gplay.permissions(opts)
    .then(toList)
    .then(res.json.bind(res))
    .catch(next);
});

/* App reviews */
router.get('/apps/:appId/reviews', function (req, res, next) {
  function paginate(apps) {
    const page = parseInt(req.query.page || '0');

    const subpath = '/apps/' + req.params.appId + '/reviews/';
    if (page > 0) {
      req.query.page = page - 1;
      apps.prev = buildUrl(req, subpath) + '?' + qs.stringify(req.query);
    }

    if (apps.results.length) {
      req.query.page = page + 1;
      apps.next = buildUrl(req, subpath) + '?' + qs.stringify(req.query);
    }

    return apps;
  }

  const opts = Object.assign({ id: req.params.appId, appId: req.params.appId }, req.query);
  if(opts.os == 'ios'){
    store.reviews(opts)
    .then(toData)
    .then(toList)
    .then(paginate)
    .then(res.json.bind(res))
    .catch(next);
  } else {
    gplay.reviews(opts)
    .then(toList)
    .then(paginate)
    .then(res.json.bind(res))
    .catch(next);
  }
});

/* Apps by developer */
router.get('/developers/:devId/', function (req, res, next) {
  const opts = Object.assign({ devId: req.params.devId }, req.query);

  if(opts.os == 'ios'){
    store.developer(opts)
    .then((apps) => apps.map(cleanUrls(req, opts.os)))
    .then((apps) => ({
      devId: req.params.devId,
      apps
    }))
    .then(res.json.bind(res))
    .catch(next);
  } else {
    gplay.developer(opts)
    .then((apps) => apps.map(cleanUrls(req, opts.os)))
    .then((apps) => ({
      devId: req.params.devId,
      apps
    }))
    .then(res.json.bind(res))
    .catch(next);

  }
  
});

/* Developer list (not supported) */
router.get('/developers/', (req, res) =>
  res.status(400).json({
    message: 'Please specify a developer id.',
    example: buildUrl(req, '/developers/' + qs.escape('Wikimedia Foundation'))
  }));

/* Category list */
router.get('/categories/', function (req, res, next) {
  gplay.categories()
    .then(res.json.bind(res))
    .catch(next);
});


function errorHandler(err, req, res, next) {
  res.status(400).json({ message: err.message });
  next();
}

router.use(errorHandler);

export default router;
