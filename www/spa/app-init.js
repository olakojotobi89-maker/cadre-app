// SPA bootstrap entry that wires router + global helpers.
// This file is loaded by spa/index.html.

import { start, registerRoute, navigate } from '../router.js';

import * as views from './views.js';

const container = document.getElementById('view-container');
start({ container });

// Register routes (no lazy-load for now per your request)
for (const [route, viewModule] of views.routes) {
  registerRoute(route, viewModule);
}

// Normalize default
if (!window.location.hash) {
  // prefer dashboard naming
  navigate('/dashboard');
}

