/* =====================================================================
   CSTP - TACTICAL OPERATIONS MAP
   Cadre Special Tactical Platform
   Production JavaScript - Modular ES6 Architecture
   ===================================================================== */

'use strict';

/* =====================================================================
   MOCK DATA
   Realistic data that can be replaced with Supabase Realtime later.
   ===================================================================== */
const MOCK_DATA = {
    officers: [
        { id: 'O-001', name: 'SGT. Marcus Reed', badge: '4521', unit: 'ALPHA-1', type: 'officer', status: 'online', role: 'patrol', lat: 38.8977, lng: -77.0365, speed: 0, direction: 45, battery: 87, gps: 3, mission: 'Patrol Sector 7', emergency: false, lastUpdate: Date.now() - 12000 },
        { id: 'O-002', name: 'LT. Sarah Chen', badge: '2847', unit: 'BRAVO-2', type: 'commander', status: 'online', role: 'command', lat: 38.9002, lng: -77.0338, speed: 0, direction: 120, battery: 92, gps: 2, mission: 'Operation Iron Sentinel', emergency: false, lastUpdate: Date.now() - 5000 },
        { id: 'O-003', name: 'CPL. James Okafor', badge: '6193', unit: 'CHARLIE-3', type: 'officer', status: 'online', role: 'patrol', lat: 38.8950, lng: -77.0400, speed: 12, direction: 270, battery: 64, gps: 4, mission: 'Patrol Sector 4', emergency: false, lastUpdate: Date.now() - 30000 },
        { id: 'O-004', name: 'DET. Nina Volkov', badge: '3752', unit: 'DELTA-1', type: 'officer', status: 'online', role: 'detective', lat: 38.9025, lng: -77.0380, speed: 0, direction: 0, battery: 78, gps: 2, mission: 'Surveillance Op-9', emergency: false, lastUpdate: Date.now() - 8000 },
        { id: 'O-005', name: 'SGT. David Park', badge: '5814', unit: 'ECHO-2', type: 'officer', status: 'emergency', role: 'patrol', lat: 38.8920, lng: -77.0320, speed: 0, direction: 180, battery: 45, gps: 5, mission: 'SOS - Backup Required', emergency: true, lastUpdate: Date.now() - 2000 },
        { id: 'O-006', name: 'OFF. Maria Santos', badge: '7241', unit: 'FOXTROT-1', type: 'police', status: 'online', role: 'patrol', lat: 38.8990, lng: -77.0420, speed: 8, direction: 90, battery: 91, gps: 2, mission: 'Traffic Control', emergency: false, lastUpdate: Date.now() - 15000 },
        { id: 'O-007', name: 'CPT. Alex Morgan', badge: '1024', unit: 'GOLF-CMD', type: 'commander', status: 'online', role: 'command', lat: 38.9015, lng: -77.0355, speed: 0, direction: 0, battery: 98, gps: 1, mission: 'Overall Command', emergency: false, lastUpdate: Date.now() - 1000 },
        { id: 'O-008', name: 'SGT. Ryan Cooper', badge: '8832', unit: 'HOTEL-1', type: 'military', status: 'online', role: 'tactical', lat: 38.8940, lng: -77.0390, speed: 5, direction: 315, battery: 82, gps: 3, mission: 'Perimeter Security', emergency: false, lastUpdate: Date.now() - 20000 },
        { id: 'O-009', name: 'OFF. Lisa Tanaka', badge: '9156', unit: 'INDIA-2', type: 'police', status: 'offline', role: 'patrol', lat: 38.9035, lng: -77.0310, speed: 0, direction: 0, battery: 12, gps: 0, mission: 'Off Duty', emergency: false, lastUpdate: Date.now() - 3600000 },
        { id: 'O-010', name: 'CPL. Ahmed Hassan', badge: '4478', unit: 'JULIET-3', type: 'military', status: 'online', role: 'sniper', lat: 38.8965, lng: -77.0435, speed: 0, direction: 225, battery: 76, gps: 2, mission: 'Overwatch Position', emergency: false, lastUpdate: Date.now() - 45000 }
    ],

    vehicles: [
        { id: 'V-101', name: 'Unit Alpha-7', callsign: 'ALPHA-7', type: 'vehicle', category: 'cruiser', status: 'online', lat: 38.8977, lng: -77.0365, speed: 0, direction: 45, fuel: 78, driver: 'SGT. Marcus Reed', mission: 'Patrol Sector 7', emergency: false, lastUpdate: Date.now() - 12000 },
        { id: 'V-102', name: 'Tactical Response 2', callsign: 'TR-2', type: 'vehicle', category: 'armored', status: 'online', lat: 38.9002, lng: -77.0338, speed: 35, direction: 120, fuel: 65, driver: 'LT. Sarah Chen', mission: 'Rapid Response', emergency: false, lastUpdate: Date.now() - 5000 },
        { id: 'V-103', name: 'K-9 Unit 3', callsign: 'K9-3', type: 'vehicle', category: 'van', status: 'online', lat: 38.8950, lng: -77.0400, speed: 12, direction: 270, fuel: 82, driver: 'CPL. James Okafor', mission: 'K-9 Patrol', emergency: false, lastUpdate: Date.now() - 30000 },
        { id: 'V-104', name: 'SWAT Carrier', callsign: 'SWAT-1', type: 'vehicle', category: 'armored', status: 'online', lat: 38.8920, lng: -77.0320, speed: 0, direction: 180, fuel: 91, driver: 'SGT. David Park', mission: 'SOS Response', emergency: true, lastUpdate: Date.now() - 2000 },
        { id: 'V-105', name: 'Ambulance M-1', callsign: 'MED-1', type: 'medical', category: 'ambulance', status: 'online', lat: 38.8990, lng: -77.0420, speed: 45, direction: 90, fuel: 70, driver: 'Paramedic J. Lee', mission: 'Emergency Transport', emergency: false, lastUpdate: Date.now() - 15000 },
        { id: 'V-106', name: 'Fire Engine 12', callsign: 'FE-12', type: 'fire', category: 'engine', status: 'online', lat: 38.9025, lng: -77.0380, speed: 28, direction: 45, fuel: 88, driver: 'Cpt. R. Williams', mission: 'Structure Fire Response', emergency: false, lastUpdate: Date.now() - 8000 }
    ],

    drones: [
        { id: 'D-201', name: 'Hawk-1', callsign: 'HAWK-1', type: 'drone', category: 'recon', status: 'online', lat: 38.8985, lng: -77.0375, altitude: 120, speed: 15, direction: 0, battery: 72, operator: 'CPL. Ahmed Hassan', mission: 'Aerial Surveillance', emergency: false, lastUpdate: Date.now() - 3000 },
        { id: 'D-202', name: 'Falcon-2', callsign: 'FALCON-2', type: 'drone', category: 'thermal', status: 'online', lat: 38.8960, lng: -77.0410, altitude: 80, speed: 8, direction: 180, battery: 58, operator: 'SGT. Ryan Cooper', mission: 'Thermal Scan Sector 4', emergency: false, lastUpdate: Date.now() - 5000 },
        { id: 'D-203', name: 'Eagle-3', callsign: 'EAGLE-3', type: 'helicopter', category: 'aircraft', status: 'online', lat: 38.9030, lng: -77.0350, altitude: 450, speed: 85, direction: 90, battery: 94, operator: 'Pilot M. Johnson', mission: 'Air Support', emergency: false, lastUpdate: Date.now() - 1000 }
    ],

    emergencies: [
        { id: 'E-301', type: 'sos', severity: 'critical', title: 'Officer Down - Backup Required', location: '14th St & Constitution Ave', lat: 38.8920, lng: -77.0320, assigned: 'SGT. David Park', units: ['TR-2', 'SWAT-1', 'MED-1'], started: Date.now() - 300000, status: 'active' },
        { id: 'E-302', type: 'fire', severity: 'high', title: 'Structure Fire - Commercial', location: '800 Pennsylvania Ave', lat: 38.8975, lng: -77.0390, assigned: 'Cpt. R. Williams', units: ['FE-12'], started: Date.now() - 600000, status: 'active' },
        { id: 'E-303', type: 'medical', severity: 'medium', title: 'Medical Emergency', location: 'National Mall - West', lat: 38.8900, lng: -77.0450, assigned: 'Paramedic J. Lee', units: ['MED-1'], started: Date.now() - 180000, status: 'responding' }
    ],

    missions: [
        { id: 'M-401', name: 'Operation Iron Sentinel', code: 'OP-IS-2026', status: 'active', priority: 'high', officers: 8, vehicles: 4, drones: 2, started: Date.now() - 86400000, eta: null },
        { id: 'M-402', name: 'Patrol Sector 7', code: 'PAT-S7', status: 'active', priority: 'medium', officers: 3, vehicles: 2, drones: 1, started: Date.now() - 14400000, eta: null },
        { id: 'M-403', name: 'VIP Protection Detail', code: 'VIP-001', status: 'active', priority: 'critical', officers: 6, vehicles: 3, drones: 1, started: Date.now() - 7200000, eta: Date.now() + 18000000 }
    ],

    incidents: [
        { id: 'I-501', type: 'checkpoint', title: 'Checkpoint Alpha', lat: 38.8985, lng: -77.0355, status: 'active', assigned: 'ALPHA-1' },
        { id: 'I-502', type: 'roadblock', title: 'Roadblock - 14th St', lat: 38.8930, lng: -77.0325, status: 'active', assigned: 'BRAVO-2' },
        { id: 'I-503', type: 'landing', title: 'Landing Zone Medevac', lat: 38.9010, lng: -77.0370, status: 'standby', assigned: 'EAGLE-3' }
    ],

    events: [
        { id: 1, type: 'info', icon: 'user', title: 'Officer Alpha-7 online', meta: 'SGT. Marcus Reed // ALPHA-1', time: Date.now() - 30000 },
        { id: 2, type: 'success', icon: 'truck', title: 'Vehicle TR-2 deployed', meta: 'Tactical Response // BRAVO-2', time: Date.now() - 60000 },
        { id: 3, type: 'warning', icon: 'alert', title: 'Bravo patrol started', meta: 'Sector 4 perimeter sweep', time: Date.now() - 120000 },
        { id: 4, type: 'emergency', icon: 'sos', title: 'SOS activated - Officer down', meta: 'SGT. David Park // 14th & Constitution', time: Date.now() - 180000 },
        { id: 5, type: 'info', icon: 'medical', title: 'Medical unit assigned', meta: 'MED-1 responding to incident', time: Date.now() - 240000 },
        { id: 6, type: 'warning', icon: 'fire', title: 'Fire team responding', meta: 'FE-12 dispatched to Pennsylvania Ave', time: Date.now() - 300000 },
        { id: 7, type: 'info', icon: 'flag', title: 'Road blocked', meta: 'Checkpoint established at 14th St', time: Date.now() - 360000 },
        { id: 8, type: 'success', icon: 'check', title: 'Mission completed', meta: 'Sector 3 patrol - all clear', time: Date.now() - 420000 },
        { id: 9, type: 'info', icon: 'drone', title: 'Drone HAWK-1 airborne', meta: 'Aerial surveillance initiated', time: Date.now() - 480000 },
        { id: 10, type: 'warning', icon: 'radio', title: 'Backup dispatched', meta: 'SWAT-1 en route to SOS location', time: Date.now() - 540000 }
    ],

    notifications: [
        { id: 1, type: 'emergency', title: 'SOS RECEIVED', message: 'Officer David Park activated emergency beacon at 14th & Constitution', time: Date.now() - 30000 },
        { id: 2, type: 'warning', title: 'LOW BATTERY', message: 'OFF. Lisa Tanaka unit at 12% battery', time: Date.now() - 120000 },
        { id: 3, type: 'info', title: 'MISSION UPDATE', message: 'Operation Iron Sentinel status updated', time: Date.now() - 300000 }
    ]
};

/* =====================================================================
   UTILITY FUNCTIONS
   ===================================================================== */
const Utils = {
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour12: false });
    },
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    },
    formatRelative(timestamp) {
        const diff = Date.now() - timestamp;
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    },
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    generateId() {
        return 'id-' + Math.random().toString(36).substr(2, 9);
    },
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
};

/* =====================================================================
   SVG ICON LIBRARY
   ===================================================================== */
const Icons = {
    officer: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>',
    commander: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/><circle cx="12" cy="11" r="2"/></svg>',
    vehicle: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M7 10l2-5h6l2 5M5 17v-7h14v7M7 17a2 2 0 1 0 4 0M13 17a2 2 0 1 0 4 0"/></svg>',
    drone: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="6" height="6"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>',
    helicopter: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6M12 3v6M12 15v6"/></svg>',
    boat: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20l2-4h16l2 4M4 16l2-8h12l2 8M12 4v4"/></svg>',
    medical: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>',
    police: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/></svg>',
    military: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg>',
    fire: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-3 2-3 6a6 6 0 0 0 12 0c0-6-6-11-6-11z"/></svg>',
    emergency: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    checkpoint: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    incident: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    user: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>',
    truck: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="7" width="13" height="10" rx="1"/><path d="M14 10h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    alert: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
    sos: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
    flag: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    radio: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2a6 6 0 0 1 0-8.4M12 12h.01"/></svg>'
};

/* =====================================================================
   CLASS: MapManager
   Manages the Leaflet map instance, layers, and controls.
   ===================================================================== */
class MapManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.layers = {};
        this.currentLayer = 'dark';
        this.minimap = null;
        this.gridLayer = null;
        this.gridVisible = false;
    }

    init() {
        // Initialize map centered on Washington DC area
        this.map = L.map(this.containerId, {
            center: [38.8977, -77.0365],
            zoom: 15,
            zoomControl: false,
            attributionControl: true
        });

        // Add zoom control to top-right
        L.control.zoom({ position: 'topright' }).addTo(this.map);
        L.control.scale({ position: 'bottomright', imperial: true, metric: true }).addTo(this.map);

        // Define tile layers
        this.layers = {
            dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }),
            street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }),
            satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 19
            }),
            terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenTopoMap',
                maxZoom: 17
            }),
            hybrid: L.layerGroup([
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    maxZoom: 19
                }),
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
                    subdomains: 'abcd',
                    maxZoom: 19
                })
            ])
        };

        // Add default layer
        this.layers.dark.addTo(this.map);

        // Initialize minimap
        this._initMinimap();

        // Initialize grid overlay
        this._initGrid();

        // Map events
        this.map.on('mousemove', (e) => this._updateCoords(e.latlng));
        this.map.on('zoomend', () => this._updateZoom());

        // Force initial update
        setTimeout(() => {
            this._updateCoords(this.map.getCenter());
            this._updateZoom();
        }, 100);

        return this.map;
    }

    _initMinimap() {
        const miniLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd'
        });
        this.minimap = new L.Control.MiniMap(miniLayer, {
            position: 'bottomleft',
            width: 140,
            height: 140,
            toggleDisplay: true,
            minimized: false,
            zoomLevelOffset: -5
        }).addTo(this.map);
    }

    _initGrid() {
        this.gridLayer = L.layerGroup();
        // Generate grid lines
        const bounds = this.map.getBounds();
        this._drawGrid();
        this.map.on('moveend zoomend', () => this._drawGrid());
    }

    _drawGrid() {
        if (!this.gridVisible) return;
        this.gridLayer.clearLayers();
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();
        const step = Math.pow(2, Math.max(0, 13 - zoom)) * 0.001;

        for (let lat = Math.floor(bounds.getSouth() / step) * step; lat <= bounds.getNorth(); lat += step) {
            this.gridLayer.addLayer(L.polyline([[lat, bounds.getWest()], [lat, bounds.getEast()]], {
                color: '#00D4FF', weight: 0.5, opacity: 0.15, dashArray: '2,4'
            }));
        }
        for (let lng = Math.floor(bounds.getWest() / step) * step; lng <= bounds.getEast(); lng += step) {
            this.gridLayer.addLayer(L.polyline([[bounds.getSouth(), lng], [bounds.getNorth(), lng]], {
                color: '#00D4FF', weight: 0.5, opacity: 0.15, dashArray: '2,4'
            }));
        }
    }

    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        if (this.gridVisible) {
            this._drawGrid();
            this.gridLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.gridLayer);
        }
        return this.gridVisible;
    }

    switchLayer(layerName) {
        if (!this.layers[layerName] || layerName === this.currentLayer) return;
        Object.values(this.layers).forEach(layer => this.map.removeLayer(layer));
        if (this.layers[layerName].addTo) {
            this.layers[layerName].addTo(this.map);
        } else if (this.layers[layerName].eachLayer) {
            this.layers[layerName].addTo(this.map);
        }
        this.currentLayer = layerName;
    }

    _updateCoords(latlng) {
        const latEl = document.getElementById('coord-lat');
        const lonEl = document.getElementById('coord-lon');
        const mgrsEl = document.getElementById('coord-mgrs');
        if (latEl) latEl.textContent = latlng.lat.toFixed(5);
        if (lonEl) lonEl.textContent = latlng.lng.toFixed(5);
        if (mgrsEl) mgrsEl.textContent = this._toApproxMGRS(latlng.lat, latlng.lng);
    }

    _updateZoom() {
        const zoomEl = document.getElementById('coord-zoom');
        if (zoomEl) zoomEl.textContent = this.map.getZoom();
    }

    _toApproxMGRS(lat, lng) {
        // Simplified MGRS approximation for display
        const zone = Math.floor((lng + 180) / 6) + 1;
        const latBand = 'CDEFGHJKLMNPQRSTUVWX'[Math.floor((lat + 80) / 8)] || 'Z';
        return `${zone}${latBand}`;
    }

    flyTo(lat, lng, zoom = 16) {
        this.map.flyTo([lat, lng], zoom, { duration: 1.2 });
    }

    fitBounds(bounds) {
        this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }

    getMap() {
        return this.map;
    }
}

/* =====================================================================
   CLASS: MarkerManager
   Creates and manages tactical markers on the map.
   ===================================================================== */
class MarkerManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.map = mapManager.getMap();
        this.markers = new Map();
        this.markerLayer = L.layerGroup().addTo(this.map);
    }

    createIcon(type, isEmergency = false) {
        const pulseHtml = isEmergency ? '<div class="marker-pulse"></div>' : '';
        const html = `
            <div class="tactical-marker type-${type}">
                ${pulseHtml}
                ${Icons[type] || Icons.officer}
            </div>
        `;
        return L.divIcon({
            html: html,
            className: 'tactical-marker-wrapper',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18]
        });
    }

    addMarker(data) {
        if (this.markers.has(data.id)) {
            this.updateMarker(data);
            return this.markers.get(data.id);
        }

        const marker = L.marker([data.lat, data.lng], {
            icon: this.createIcon(data.type, data.emergency)
        });

        marker.bindPopup(this._createPopup(data), {
            className: 'tactical-popup',
            maxWidth: 300,
            minWidth: 260
        });

        marker.cstpId = data.id;
        marker.cstpData = data;
        marker.addTo(this.markerLayer);
        this.markers.set(data.id, marker);
        return marker;
    }

    updateMarker(data) {
        const marker = this.markers.get(data.id);
        if (!marker) return this.addMarker(data);

        // Animate movement
        const current = marker.getLatLng();
        const target = L.latLng(data.lat, data.lng);

        if (current.distanceTo(target) > 1) {
            this._animateMarker(marker, current, target, data);
        }

        marker.setIcon(this.createIcon(data.type, data.emergency));
        marker.setPopupContent(this._createPopup(data));
        marker.cstpData = data;
    }

    _animateMarker(marker, from, to, data) {
        const duration = 1000;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const lat = from.lat + (to.lat - from.lat) * eased;
            const lng = from.lng + (to.lng - from.lng) * eased;
            marker.setLatLng([lat, lng]);
            if (progress < 1) requestAnimationFrame(animate);
        };
        animate();
    }

    removeMarker(id) {
        const marker = this.markers.get(id);
        if (marker) {
            this.markerLayer.removeLayer(marker);
            this.markers.delete(id);
        }
    }

    clearAll() {
        this.markerLayer.clearLayers();
        this.markers.clear();
    }

    _createPopup(data) {
        const statusClass = data.emergency ? 'emergency' : (data.status === 'online' ? '' : 'warning');
        const statusText = data.emergency ? 'EMERGENCY' : data.status.toUpperCase();

        let fieldsHtml = '';
        if (data.type === 'drone' || data.type === 'helicopter') {
            fieldsHtml = `
                <div class="popup-field"><span class="popup-label">ALTITUDE</span><span class="popup-value">${data.altitude || 0}m</span></div>
                <div class="popup-field"><span class="popup-label">SPEED</span><span class="popup-value">${data.speed || 0} km/h</span></div>
                <div class="popup-field"><span class="popup-label">BATTERY</span><span class="popup-value">${data.battery || 0}%</span></div>
                <div class="popup-field"><span class="popup-label">OPERATOR</span><span class="popup-value">${data.operator || '-'}</span></div>
            `;
        } else if (data.type === 'vehicle' || data.type === 'medical' || data.type === 'fire') {
            fieldsHtml = `
                <div class="popup-field"><span class="popup-label">CALLSIGN</span><span class="popup-value">${data.callsign || '-'}</span></div>
                <div class="popup-field"><span class="popup-label">CATEGORY</span><span class="popup-value">${(data.category || '-').toUpperCase()}</span></div>
                <div class="popup-field"><span class="popup-label">SPEED</span><span class="popup-value">${data.speed || 0} km/h</span></div>
                <div class="popup-field"><span class="popup-label">FUEL</span><span class="popup-value">${data.fuel || 0}%</span></div>
                <div class="popup-field"><span class="popup-label">DRIVER</span><span class="popup-value">${data.driver || '-'}</span></div>
                <div class="popup-field"><span class="popup-label">STATUS</span><span class="popup-status ${statusClass}">${statusText}</span></div>
            `;
        } else {
            fieldsHtml = `
                <div class="popup-field"><span class="popup-label">BADGE</span><span class="popup-value">${data.badge || '-'}</span></div>
                <div class="popup-field"><span class="popup-label">UNIT</span><span class="popup-value">${data.unit || '-'}</span></div>
                <div class="popup-field"><span class="popup-label">ROLE</span><span class="popup-value">${(data.role || '-').toUpperCase()}</span></div>
                <div class="popup-field"><span class="popup-label">SPEED</span><span class="popup-value">${data.speed || 0} km/h</span></div>
                <div class="popup-field"><span class="popup-label">DIRECTION</span><span class="popup-value">${data.direction || 0}°</span></div>
                <div class="popup-field"><span class="popup-label">BATTERY</span><span class="popup-value">${data.battery || 0}%</span></div>
                <div class="popup-field"><span class="popup-label">GPS ACC</span><span class="popup-value">±${data.gps || 0}m</span></div>
                <div class="popup-field"><span class="popup-label">LAST UPDATE</span><span class="popup-value">${Utils.formatRelative(data.lastUpdate || Date.now())}</span></div>
                <div class="popup-field"><span class="popup-label">MISSION</span><span class="popup-value">${data.mission || '-'}</span></div>
                <div class="popup-field"><span class="popup-label">STATUS</span><span class="popup-status ${statusClass}">${statusText}</span></div>
            `;
        }

        return `
            <div class="popup-content">
                <div class="popup-header">
                    <div class="popup-icon">${Icons[data.type] || Icons.officer}</div>
                    <div>
                        <div class="popup-title">${Utils.escapeHtml(data.name)}</div>
                        <div class="popup-subtitle">ID: ${Utils.escapeHtml(data.id)} // ${Utils.escapeHtml(data.type.toUpperCase())}</div>
                    </div>
                </div>
                <div class="popup-grid">${fieldsHtml}</div>
                <div class="popup-actions">
                    <button class="popup-action-btn" onclick="CSTP.ui.radioCall('${data.id}')">RADIO</button>
                    <button class="popup-action-btn" onclick="CSTP.ui.track('${data.id}')">TRACK</button>
                    <button class="popup-action-btn danger" onclick="CSTP.ui.dispatch('${data.id}')">DISPATCH</button>
                </div>
            </div>
        `;
    }

    filterMarkers(filterType) {
        this.markers.forEach((marker, id) => {
            const data = marker.cstpData;
            let visible = true;

            switch (filterType) {
                case 'all': visible = true; break;
                case 'online': visible = data.status === 'online'; break;
                case 'offline': visible = data.status === 'offline'; break;
                case 'emergency': visible = data.emergency === true; break;
                case 'police': visible = data.type === 'police' || data.type === 'officer'; break;
                case 'military': visible = data.type === 'military'; break;
                case 'medical': visible = data.type === 'medical'; break;
                case 'fire': visible = data.type === 'fire'; break;
                case 'vehicles': visible = data.type === 'vehicle'; break;
                case 'drones': visible = data.type === 'drone' || data.type === 'helicopter'; break;
                case 'command': visible = data.type === 'commander'; break;
            }

            if (visible) {
                if (!this.markerLayer.hasLayer(marker)) this.markerLayer.addLayer(marker);
            } else {
                if (this.markerLayer.hasLayer(marker)) this.markerLayer.removeLayer(marker);
            }
        });
    }
}

/* =====================================================================
   CLASS: OfficerManager
   ===================================================================== */
class OfficerManager {
    constructor(markerManager) {
        this.markerManager = markerManager;
        this.officers = new Map();
    }

    loadFromMock(data) {
        data.forEach(officer => {
            this.officers.set(officer.id, officer);
            this.markerManager.addMarker(officer);
        });
    }

    getAll() {
        return Array.from(this.officers.values());
    }

    getById(id) {
        return this.officers.get(id);
    }

    update(id, updates) {
        const officer = this.officers.get(id);
        if (!officer) return;
        Object.assign(officer, updates, { lastUpdate: Date.now() });
        this.markerManager.updateMarker(officer);
    }

    getStats() {
        const all = this.getAll();
        return {
            total: all.length,
            online: all.filter(o => o.status === 'online').length,
            emergency: all.filter(o => o.emergency).length
        };
    }

    // Supabase-ready: call this from realtime subscription
    handleRealtimeUpdate(payload) {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            this.officers.set(payload.new.id, payload.new);
            this.markerManager.addMarker(payload.new);
        } else if (payload.eventType === 'DELETE') {
            this.officers.delete(payload.old.id);
            this.markerManager.removeMarker(payload.old.id);
        }
    }
}

/* =====================================================================
   CLASS: VehicleManager
   ===================================================================== */
class VehicleManager {
    constructor(markerManager) {
        this.markerManager = markerManager;
        this.vehicles = new Map();
    }

    loadFromMock(data) {
        data.forEach(vehicle => {
            this.vehicles.set(vehicle.id, vehicle);
            this.markerManager.addMarker(vehicle);
        });
    }

    getAll() { return Array.from(this.vehicles.values()); }
    getById(id) { return this.vehicles.get(id); }

    getStats() {
        const all = this.getAll();
        return {
            total: all.length,
            online: all.filter(v => v.status === 'online').length,
            emergency: all.filter(v => v.emergency).length
        };
    }

    handleRealtimeUpdate(payload) {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            this.vehicles.set(payload.new.id, payload.new);
            this.markerManager.addMarker(payload.new);
        } else if (payload.eventType === 'DELETE') {
            this.vehicles.delete(payload.old.id);
            this.markerManager.removeMarker(payload.old.id);
        }
    }
}

/* =====================================================================
   CLASS: EmergencyManager
   ===================================================================== */
class EmergencyManager {
    constructor(markerManager) {
        this.markerManager = markerManager;
        this.emergencies = new Map();
    }

    loadFromMock(data) {
        data.forEach(em => {
            this.emergencies.set(em.id, em);
            this.markerManager.addMarker({
                id: em.id,
                name: em.title,
                type: 'emergency',
                lat: em.lat,
                lng: em.lng,
                emergency: true,
                status: em.status,
                mission: em.location,
                lastUpdate: em.started
            });
        });
    }

    getAll() { return Array.from(this.emergencies.values()); }

    getStats() {
        const all = this.getAll();
        return {
            total: all.length,
            critical: all.filter(e => e.severity === 'critical').length,
            active: all.filter(e => e.status === 'active').length
        };
    }
}

/* =====================================================================
   CLASS: MissionManager
   ===================================================================== */
class MissionManager {
    constructor() {
        this.missions = new Map();
    }

    loadFromMock(data) {
        data.forEach(m => this.missions.set(m.id, m));
    }

    getAll() { return Array.from(this.missions.values()); }

    getStats() {
        const all = this.getAll();
        return {
            total: all.length,
            active: all.filter(m => m.status === 'active').length,
            critical: all.filter(m => m.priority === 'critical').length
        };
    }
}

/* =====================================================================
   CLASS: SidebarManager
   ===================================================================== */
class SidebarManager {
    constructor() {
        this.container = document.getElementById('sidebar-menu');
        this.collapsed = false;
        this.sections = [
            {
                title: 'OPERATIONS',
                items: [
                    { id: 'dashboard', label: 'Dashboard', icon: 'grid', badge: null },
                    { id: 'map', label: 'Tactical Map', icon: 'map', badge: null, active: true },
                    { id: 'officers', label: 'Officers', icon: 'user', badge: '10' },
                    { id: 'emergency', label: 'Emergency Response', icon: 'alert', badge: '3', badgeType: 'danger' }
                ]
            },
            {
                title: 'DEPLOYMENT',
                items: [
                    { id: 'dispatch', label: 'Dispatch', icon: 'radio' },
                    { id: 'vehicles', label: 'Vehicles', icon: 'truck', badge: '6' },
                    { id: 'drones', label: 'Drone Operations', icon: 'drone', badge: '3' },
                    { id: 'medical', label: 'Medical Teams', icon: 'medical' },
                    { id: 'fire', label: 'Fire Service', icon: 'fire' },
                    { id: 'police', label: 'Police Units', icon: 'police' },
                    { id: 'military', label: 'Military Units', icon: 'military' }
                ]
            },
            {
                title: 'INTELLIGENCE',
                items: [
                    { id: 'intel', label: 'Intelligence', icon: 'eye' },
                    { id: 'reports', label: 'Reports', icon: 'file' },
                    { id: 'comms', label: 'Communications', icon: 'message' },
                    { id: 'logs', label: 'Mission Logs', icon: 'list' }
                ]
            },
            {
                title: 'CONFIGURATION',
                items: [
                    { id: 'layers', label: 'Map Layers', icon: 'layers' },
                    { id: 'settings', label: 'Settings', icon: 'settings' }
                ]
            }
        ];
    }

    render() {
        this.container.innerHTML = this.sections.map(section => `
            <div class="sidebar-section">
                <div class="sidebar-section-title">${section.title}</div>
                ${section.items.map(item => `
                    <div class="sidebar-item ${item.active ? 'active' : ''}" data-item="${item.id}">
                        ${this._getIcon(item.icon)}
                        <span class="sidebar-item-label">${item.label}</span>
                        ${item.badge ? `<span class="sidebar-item-badge ${item.badgeType || ''}">${item.badge}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('');

        // Bind click events
        this.container.querySelectorAll('.sidebar-item').forEach(el => {
            el.addEventListener('click', () => {
                this.container.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
                CSTP.ui.notify('info', 'NAVIGATION', `Switched to ${el.querySelector('.sidebar-item-label').textContent}`);
            });
        });
    }

    _getIcon(name) {
        const icons = {
            grid: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
            map: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
            user: Icons.user.replace(/width="20"/g, 'width="16"').replace(/height="20"/g, 'height="16"'),
            alert: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
            radio: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M19.1 4.9c3.9 3.9 3.9 10.3 0 14.2M12 12h.01"/></svg>',
            truck: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="7" width="13" height="10" rx="1"/><path d="M14 10h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
            drone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="6" height="6"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>',
            medical: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>',
            fire: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-3 2-3 6a6 6 0 0 0 12 0c0-6-6-11-6-11z"/></svg>',
            police: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/></svg>',
            military: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg>',
            eye: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            file: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            message: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
            list: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
            layers: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
            settings: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
        };
        return icons[name] || '';
    }

    toggle() {
        this.collapsed = !this.collapsed;
        document.getElementById('app').classList.toggle('sidebar-collapsed', this.collapsed);
        setTimeout(() => CSTP.mapManager.map.invalidateSize(), 300);
    }
}

/* =====================================================================
   CLASS: SearchManager
   ===================================================================== */
class SearchManager {
    constructor() {
        this.modal = document.getElementById('search-modal');
        this.input = document.getElementById('search-input');
        this.results = document.getElementById('search-results');
        this.closeBtn = document.getElementById('search-close');
        this.filterChips = document.querySelectorAll('#search-filters .filter-chip');
        this.currentFilter = 'all';
        this.isOpen = false;
    }

    init() {
        this.closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        this.input.addEventListener('input', (e) => this._search(e.target.value));
        this.filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                this.filterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentFilter = chip.dataset.filter;
                this._search(this.input.value);
            });
        });
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.modal.classList.add('active');
        this.isOpen = true;
        setTimeout(() => this.input.focus(), 100);
    }

    close() {
        this.modal.classList.remove('active');
        this.isOpen = false;
        this.input.value = '';
        this.results.innerHTML = '<div class="search-empty">Start typing to search tactical assets...</div>';
    }

    _search(query) {
        if (!query || query.length < 2) {
            this.results.innerHTML = '<div class="search-empty">Start typing to search tactical assets...</div>';
            return;
        }

        const q = query.toLowerCase();
        const results = [];

        // Search officers
        if (this.currentFilter === 'all' || this.currentFilter === 'officer') {
            CSTP.officerManager.getAll().forEach(o => {
                if (o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) ||
                    (o.badge && o.badge.includes(q)) || (o.unit && o.unit.toLowerCase().includes(q)) ||
                    (o.mission && o.mission.toLowerCase().includes(q))) {
                    results.push({ type: 'officer', data: o });
                }
            });
        }

        // Search vehicles
        if (this.currentFilter === 'all' || this.currentFilter === 'vehicle') {
            CSTP.vehicleManager.getAll().forEach(v => {
                if (v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) ||
                    (v.callsign && v.callsign.toLowerCase().includes(q)) ||
                    (v.driver && v.driver.toLowerCase().includes(q))) {
                    results.push({ type: 'vehicle', data: v });
                }
            });
        }

        // Search missions
        if (this.currentFilter === 'all' || this.currentFilter === 'mission') {
            CSTP.missionManager.getAll().forEach(m => {
                if (m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)) {
                    results.push({ type: 'mission', data: m });
                }
            });
        }

        // Search emergencies/incidents
        if (this.currentFilter === 'all' || this.currentFilter === 'incident') {
            MOCK_DATA.emergencies.forEach(e => {
                if (e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q)) {
                    results.push({ type: 'incident', data: e });
                }
            });
            MOCK_DATA.incidents.forEach(i => {
                if (i.title.toLowerCase().includes(q)) {
                    results.push({ type: 'incident', data: i });
                }
            });
        }

        this._renderResults(results);
    }

    _renderResults(results) {
        if (results.length === 0) {
            this.results.innerHTML = '<div class="search-empty">No results found</div>';
            return;
        }

        this.results.innerHTML = results.slice(0, 20).map(r => {
            const d = r.data;
            const icon = Icons[r.type] || Icons.officer;
            const title = d.name || d.title;
            const meta = r.type === 'mission' ? d.code :
                         r.type === 'vehicle' ? `${d.callsign} // ${d.category}` :
                         r.type === 'incident' ? d.location || d.type :
                         `${d.id} // ${d.unit || d.type}`;
            const status = d.emergency ? 'EMERGENCY' : (d.status || '').toUpperCase();
            const statusClass = d.emergency ? 'emergency' : '';

            return `
                <div class="search-result-item" data-lat="${d.lat}" data-lng="${d.lng}" data-type="${r.type}">
                    <div class="search-result-icon">${icon}</div>
                    <div class="search-result-content">
                        <div class="search-result-title">${Utils.escapeHtml(title)}</div>
                        <div class="search-result-meta">${Utils.escapeHtml(meta)}</div>
                    </div>
                    ${status ? `<div class="search-result-status ${statusClass}">${status}</div>` : ''}
                </div>
            `;
        }).join('');

        this.results.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    CSTP.mapManager.flyTo(lat, lng, 17);
                    this.close();
                }
            });
        });
    }
}

/* =====================================================================
   CLASS: DrawingManager
   ===================================================================== */
class DrawingManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.map = mapManager.getMap();
        this.drawnItems = new L.FeatureGroup().addTo(this.map);
        this.activeDrawHandler = null;
        this.modal = document.getElementById('drawing-modal');
        this.closeBtn = document.getElementById('drawing-modal-close');
    }

    init() {
        this.closeBtn.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        this.modal.querySelectorAll('.drawing-tool').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.draw;
                if (type === 'clear') {
                    this.clearAll();
                } else {
                    this.startDrawing(type);
                    this.closeModal();
                }
            });
        });

        this.map.on(L.Draw.Event.CREATED, (e) => {
            this.drawnItems.addLayer(e.layer);
            CSTP.ui.notify('success', 'DRAWING CREATED', `${e.layerType.toUpperCase()} added to map`);
        });
    }

    openModal() {
        this.modal.classList.add('active');
    }

    closeModal() {
        this.modal.classList.remove('active');
        if (this.activeDrawHandler) {
            this.activeDrawHandler.disable();
            this.activeDrawHandler = null;
        }
    }

    startDrawing(type) {
        if (this.activeDrawHandler) this.activeDrawHandler.disable();

        const options = this._getDrawOptions(type);
        let handler;

        switch (type) {
            case 'polygon':
                handler = new L.Draw.Polygon(this.map, options.polygon);
                break;
            case 'circle':
                handler = new L.Draw.Circle(this.map, options.circle);
                break;
            case 'rectangle':
                handler = new L.Draw.Rectangle(this.map, options.rectangle);
                break;
            case 'patrol':
            case 'search':
                handler = new L.Draw.Polyline(this.map, options.polyline);
                break;
            case 'restricted':
            case 'danger':
            case 'safe':
                handler = new L.Draw.Polygon(this.map, options.polygon);
                break;
            case 'landing':
            case 'checkpoint':
            case 'roadblock':
                handler = new L.Draw.Marker(this.map, options.marker);
                break;
        }

        if (handler) {
            handler.enable();
            this.activeDrawHandler = handler;
        }
    }

    _getDrawOptions(type) {
        const base = {
            shapeOptions: {
                color: '#00D4FF',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.15
            }
        };

        switch (type) {
            case 'restricted':
                base.shapeOptions.color = '#FF3344';
                base.shapeOptions.dashArray = '5,10';
                break;
            case 'danger':
                base.shapeOptions.color = '#FF3344';
                base.shapeOptions.fillColor = '#FF3344';
                base.shapeOptions.fillOpacity = 0.2;
                break;
            case 'safe':
                base.shapeOptions.color = '#00FF9D';
                base.shapeOptions.fillColor = '#00FF9D';
                base.shapeOptions.fillOpacity = 0.15;
                break;
            case 'patrol':
                base.shapeOptions.color = '#FFB800';
                base.shapeOptions.weight = 3;
                base.shapeOptions.dashArray = '8,8';
                break;
            case 'search':
                base.shapeOptions.color = '#00D4FF';
                base.shapeOptions.dashArray = '4,6';
                break;
        }

        return {
            polygon: base,
            circle: base,
            rectangle: base,
            polyline: base,
            marker: { icon: this._createDrawnMarkerIcon(type) }
        };
    }

    _createDrawnMarkerIcon(type) {
        const colors = {
            landing: '#00FF9D',
            checkpoint: '#FFB800',
            roadblock: '#FF3344'
        };
        const color = colors[type] || '#00D4FF';
        const labels = { landing: 'H', checkpoint: 'CP', roadblock: 'X' };
        const label = labels[type] || 'M';

        return L.divIcon({
            html: `<div style="width:32px;height:32px;border-radius:50%;background:rgba(15,20,25,0.9);border:2px solid ${color};display:flex;align-items:center;justify-content:center;color:${color};font-family:var(--font-display);font-weight:700;font-size:12px;box-shadow:0 0 12px ${color};">${label}</div>`,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    }

    clearAll() {
        this.drawnItems.clearLayers();
        CSTP.ui.notify('info', 'DRAWINGS CLEARED', 'All tactical drawings removed from map');
    }
}

/* =====================================================================
   CLASS: NotificationManager
   ===================================================================== */
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notifications-container');
        this.queue = [];
        this.maxVisible = 4;
    }

    show(type, title, message, duration = 5000) {
        const id = Utils.generateId();
        const icon = this._getIcon(type);

        const el = document.createElement('div');
        el.className = `notification type-${type}`;
        el.dataset.id = id;
        el.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${Utils.escapeHtml(title)}</div>
                <div class="notification-message">${Utils.escapeHtml(message)}</div>
            </div>
            <button class="notification-close" aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        el.querySelector('.notification-close').addEventListener('click', () => this._remove(el));

        this.container.appendChild(el);
        this.queue.push(el);

        // Limit visible
        while (this.queue.length > this.maxVisible) {
            this._remove(this.queue[0]);
        }

        if (duration > 0) {
            setTimeout(() => this._remove(el), duration);
        }
    }

    _remove(el) {
        if (!el || !el.parentNode) return;
        el.classList.add('removing');
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
            const idx = this.queue.indexOf(el);
            if (idx > -1) this.queue.splice(idx, 1);
        }, 300);
    }

    _getIcon(type) {
        switch (type) {
            case 'emergency': return Icons.emergency;
            case 'warning': return Icons.alert;
            case 'success': return Icons.check;
            case 'info': default: return Icons.radio;
        }
    }
}

/* =====================================================================
   CLASS: TimelineManager (Event Feed)
   ===================================================================== */
class TimelineManager {
    constructor() {
        this.feedBody = document.getElementById('feed-body');
        this.pauseBtn = document.getElementById('feed-pause');
        this.clearBtn = document.getElementById('feed-clear');
        this.expandBtn = document.getElementById('feed-expand');
        this.feed = document.getElementById('event-feed');
        this.isPaused = false;
        this.isExpanded = false;
        this.events = [];
        this.maxEvents = 50;
    }

    init() {
        this.pauseBtn.addEventListener('click', () => this._togglePause());
        this.clearBtn.addEventListener('click', () => this.clear());
        this.expandBtn.addEventListener('click', () => this._toggleExpand());

        // Load initial events
        MOCK_DATA.events.forEach(e => this.addEvent(e, false));
    }

    addEvent(event, animate = true) {
        if (this.isPaused && animate) return;

        const el = document.createElement('div');
        el.className = `feed-event type-${event.type}`;
        if (!animate) el.style.animation = 'none';

        el.innerHTML = `
            <div class="feed-event-icon">${Icons[event.icon] || Icons.radio}</div>
            <div class="feed-event-content">
                <div class="feed-event-text">${Utils.escapeHtml(event.title)}</div>
                <div class="feed-event-meta">${Utils.escapeHtml(event.meta || '')}</div>
            </div>
            <div class="feed-event-time">${Utils.formatTime(event.time)}</div>
        `;

        this.feedBody.insertBefore(el, this.feedBody.firstChild);
        this.events.unshift(event);

        // Trim old events
        while (this.feedBody.children.length > this.maxEvents) {
            this.feedBody.removeChild(this.feedBody.lastChild);
        }
    }

    clear() {
        this.feedBody.innerHTML = '';
        this.events = [];
    }

    _togglePause() {
        this.isPaused = !this.isPaused;
        this.pauseBtn.innerHTML = this.isPaused
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }

    _toggleExpand() {
        this.isExpanded = !this.isExpanded;
        this.feed.classList.toggle('expanded', this.isExpanded);
        setTimeout(() => CSTP.mapManager.map.invalidateSize(), 300);
    }
}

/* =====================================================================
   CLASS: UIController
   Orchestrates all UI interactions.
   ===================================================================== */
class UIController {
    constructor() {
        this.notificationManager = null;
    }

    setNotificationManager(nm) {
        this.notificationManager = nm;
    }

    init() {
        this._initClock();
        this._initTopNav();
        this._initToolbar();
        this._initLayerSwitcher();
        this._initPanelTabs();
        this._initTacticalFilters();
        this._initMobileMenus();
    }

    _initClock() {
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        const update = () => {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
            dateEl.textContent = Utils.formatDate(now);
        };
        update();
        setInterval(update, 1000);
    }

    _initTopNav() {
        document.getElementById('btn-notifications').addEventListener('click', () => {
            this.notify('info', 'NOTIFICATIONS', '3 unread notifications');
        });
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.notify('info', 'SETTINGS', 'Settings panel coming soon');
        });
        document.getElementById('btn-fullscreen').addEventListener('click', () => this._toggleFullscreen());
        document.getElementById('btn-theme').addEventListener('click', () => this._toggleTheme());
    }

    _initToolbar() {
        const toolbar = document.getElementById('tactical-toolbar');
        toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', () => this._handleToolbarAction(btn.dataset.action, btn));
        });
    }

    _handleToolbarAction(action, btn) {
        switch (action) {
            case 'locate-officer':
                this.notify('info', 'LOCATE OFFICER', 'Select an officer from the map to focus');
                break;
            case 'locate-me':
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            CSTP.mapManager.flyTo(pos.coords.latitude, pos.coords.longitude, 16);
                            this.notify('success', 'LOCATION FOUND', 'Centered on your current position');
                        },
                        () => this.notify('warning', 'LOCATION ERROR', 'Unable to retrieve your location')
                    );
                }
                break;
            case 'zoom-emergency':
                const emergencies = CSTP.emergencyManager.getAll();
                if (emergencies.length > 0) {
                    const e = emergencies[0];
                    CSTP.mapManager.flyTo(e.lat, e.lng, 17);
                    this.notify('emergency', 'EMERGENCY LOCATED', e.title);
                }
                break;
            case 'layers':
                CSTP.drawingManager.openModal();
                break;
            case 'grid':
                const gridOn = CSTP.mapManager.toggleGrid();
                this.notify('info', 'GRID OVERLAY', gridOn ? 'Grid enabled' : 'Grid disabled');
                btn.classList.toggle('active', gridOn);
                break;
            case 'measure':
                this.notify('info', 'MEASURE TOOL', 'Click two points on the map to measure distance');
                btn.classList.toggle('active');
                break;
            case 'compass':
                document.getElementById('compass-rose').style.display =
                    document.getElementById('compass-rose').style.display === 'none' ? 'block' : 'none';
                break;
            case 'export':
                this.notify('success', 'EXPORT', 'Mission data exported to clipboard');
                break;
            case 'print':
                window.print();
                break;
            case 'mission-settings':
                this.notify('info', 'MISSION SETTINGS', 'Operation Iron Sentinel - Active');
                break;
            case 'fullscreen':
                this._toggleFullscreen();
                break;
            case 'draw-patrol':
            case 'restricted-zone':
            case 'safe-zone':
            case 'danger-zone':
            case 'checkpoint':
            case 'roadblock':
            case 'landing-zone':
                CSTP.drawingManager.openModal();
                break;
        }
    }

    _initLayerSwitcher() {
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                CSTP.mapManager.switchLayer(btn.dataset.layer);
            });
        });
    }

    _initPanelTabs() {
        const tabs = document.querySelectorAll('.panel-tab');
        const contents = document.querySelectorAll('.panel-tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.querySelector(`[data-tab-content="${tab.dataset.tab}"]`).classList.add('active');
            });
        });

        document.getElementById('panel-collapse-btn').addEventListener('click', () => {
            document.getElementById('app').classList.toggle('panel-collapsed');
            setTimeout(() => CSTP.mapManager.map.invalidateSize(), 300);
        });
    }

    _initTacticalFilters() {
        document.querySelectorAll('#tactical-filters .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#tactical-filters .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                CSTP.markerManager.filterMarkers(btn.dataset.filter);
            });
        });
    }

    _initMobileMenus() {
        document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
            document.getElementById('left-sidebar').classList.toggle('mobile-open');
        });

        document.getElementById('sidebar-collapse-btn').addEventListener('click', () => {
            CSTP.sidebarManager.toggle();
        });
    }

    _toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    _toggleTheme() {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    }

    notify(type, title, message, duration = 5000) {
        if (this.notificationManager) {
            this.notificationManager.show(type, title, message, duration);
        }
    }

    radioCall(id) {
        const officer = CSTP.officerManager.getById(id);
        this.notify('info', 'RADIO CALL', `Initiating radio contact with ${officer ? officer.name : id}`);
    }

    track(id) {
        const officer = CSTP.officerManager.getById(id);
        if (officer) {
            CSTP.mapManager.flyTo(officer.lat, officer.lng, 17);
            this.notify('info', 'TRACKING', `Now tracking ${officer.name}`);
        }
    }

    dispatch(id) {
        const officer = CSTP.officerManager.getById(id);
        this.notify('warning', 'DISPATCH', `Dispatch order sent to ${officer ? officer.name : id}`);
    }

    updateStats() {
        const officers = CSTP.officerManager.getStats();
        const vehicles = CSTP.vehicleManager.getStats();
        const emergencies = CSTP.emergencyManager.getStats();
        const missions = CSTP.missionManager.getStats();

        // Officers
        this._setStat('stat-officers', officers.online, officers.total);
        this._setBar('bar-officers', (officers.online / Math.max(officers.total, 1)) * 100);

        // Units online
        const unitsOnline = officers.online + vehicles.online + 3; // drones etc
        this._setStat('stat-units', unitsOnline, 20);
        this._setBar('bar-units', (unitsOnline / 20) * 100);

        // Vehicles
        this._setStat('stat-vehicles', vehicles.online, vehicles.total);
        this._setBar('bar-vehicles', (vehicles.online / Math.max(vehicles.total, 1)) * 100);

        // Medical
        this._setStat('stat-medical', 2, 3);
        this._setBar('bar-medical', 66);

        // Fire
        this._setStat('stat-fire', 1, 2);
        this._setBar('bar-fire', 50);

        // Police
        this._setStat('stat-police', 4, 5);
        this._setBar('bar-police', 80);

        // Military
        this._setStat('stat-military', 2, 3);
        this._setBar('bar-military', 66);

        // Drones
        this._setStat('stat-drones', 3, 3);
        this._setBar('bar-drones', 100);

        // Missions
        this._setStat('stat-missions', missions.active, missions.total);
        this._setBar('bar-missions', (missions.active / Math.max(missions.total, 1)) * 100);

        // Emergencies
        this._setStat('stat-emergencies', emergencies.active, emergencies.total);
        this._setBar('bar-emergencies', (emergencies.active / Math.max(emergencies.total, 1)) * 100);

        // Systems
        this._setBar('bar-radio', 100);
        this._setBar('bar-gps', 95);
        this._setBar('bar-server', 100);
        this._setBar('bar-battery', 87);
        this._setBar('bar-network', 92);
    }

    _setStat(id, value, max) {
        const el = document.getElementById(id);
        if (el) el.textContent = `${value}${max ? '/' + max : ''}`;
    }

    _setBar(id, percent) {
        const el = document.getElementById(id);
        if (el) el.style.width = `${Utils.clamp(percent, 0, 100)}%`;
    }
}

/* =====================================================================
   MAIN APPLICATION CONTROLLER
   ===================================================================== */
const CSTP = {
    mapManager: null,
    markerManager: null,
    officerManager: null,
    vehicleManager: null,
    emergencyManager: null,
    missionManager: null,
    sidebarManager: null,
    searchManager: null,
    drawingManager: null,
    notificationManager: null,
    timelineManager: null,
    ui: null,

    async init() {
        try {
            // Show loading screen
            this._showLoading();

            // Initialize map
            this.mapManager = new MapManager('tactical-map');
            this.mapManager.init();

            // Initialize managers
            this.markerManager = new MarkerManager(this.mapManager);
            this.officerManager = new OfficerManager(this.markerManager);
            this.vehicleManager = new VehicleManager(this.markerManager);
            this.emergencyManager = new EmergencyManager(this.markerManager);
            this.missionManager = new MissionManager();
            this.notificationManager = new NotificationManager();
            this.timelineManager = new TimelineManager();
            this.drawingManager = new DrawingManager(this.mapManager);
            this.sidebarManager = new SidebarManager();
            this.searchManager = new SearchManager();
            this.ui = new UIController();
            this.ui.setNotificationManager(this.notificationManager);

            // Load mock data
            this.officerManager.loadFromMock(MOCK_DATA.officers);
            this.vehicleManager.loadFromMock(MOCK_DATA.vehicles);
            this.emergencyManager.loadFromMock(MOCK_DATA.emergencies);
            this.missionManager.loadFromMock(MOCK_DATA.missions);

            // Load drone markers
            MOCK_DATA.drones.forEach(d => this.markerManager.addMarker(d));
            // Load incident markers
            MOCK_DATA.incidents.forEach(i => {
                this.markerManager.addMarker({
                    id: i.id,
                    name: i.title,
                    type: i.type === 'checkpoint' ? 'checkpoint' : (i.type === 'roadblock' ? 'checkpoint' : 'checkpoint'),
                    lat: i.lat,
                    lng: i.lng,
                    status: i.status,
                    mission: i.assigned,
                    lastUpdate: Date.now()
                });
            });

            // Initialize UI
            this.sidebarManager.render();
            this.searchManager.init();
            this.drawingManager.init();
            this.timelineManager.init();
            this.ui.init();
            this.ui.updateStats();

            // Start simulations
            this._startSimulations();

            // Hide loading screen
            setTimeout(() => this._hideLoading(), 2200);

            // Show welcome notifications
            setTimeout(() => {
                MOCK_DATA.notifications.forEach((n, i) => {
                    setTimeout(() => this.notificationManager.show(n.type, n.title, n.message), i * 800);
                });
            }, 2500);

            console.log('%c CSTP Tactical Operations Map Initialized ', 'background: #00D4FF; color: #0B0F14; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
            console.log('%c Press Ctrl+K to open search ', 'color: #00FF9D;');

        } catch (error) {
            console.error('CSTP initialization failed:', error);
        }
    },

    _showLoading() {
        document.getElementById('loading-screen').classList.remove('hidden');
    },

    _hideLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
    },

    _startSimulations() {
        // Simulate officer movement
        setInterval(() => {
            CSTP.officerManager.getAll().forEach(officer => {
                if (officer.status === 'online' && officer.speed > 0) {
                    const rad = (officer.direction * Math.PI) / 180;
                    const delta = (officer.speed / 3600) * 0.0001;
                    officer.lat += Math.cos(rad) * delta;
                    officer.lng += Math.sin(rad) * delta;
                    officer.lastUpdate = Date.now();
                    // Slight direction drift
                    officer.direction = (officer.direction + (Math.random() - 0.5) * 20 + 360) % 360;
                    CSTP.markerManager.updateMarker(officer);
                }
            });
        }, 3000);

        // Simulate new events
        const eventTemplates = [
            { type: 'info', icon: 'user', title: 'GPS update received', meta: 'Unit position synchronized' },
            { type: 'info', icon: 'radio', title: 'Radio check complete', meta: 'All units responding' },
            { type: 'success', icon: 'check', title: 'Patrol sector cleared', meta: 'No incidents reported' },
            { type: 'warning', icon: 'alert', title: 'Traffic congestion detected', meta: 'Route recalculation advised' },
            { type: 'info', icon: 'truck', title: 'Vehicle refueled', meta: 'Unit back in service' },
            { type: 'info', icon: 'drone', title: 'Drone telemetry updated', meta: 'Battery and signal nominal' }
        ];

        setInterval(() => {
            const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
            CSTP.timelineManager.addEvent({
                ...template,
                time: Date.now()
            });
        }, 15000);

        // Update stats periodically
        setInterval(() => CSTP.ui.updateStats(), 5000);
    },

    // Supabase Realtime integration hooks
    // Call these from your Supabase .on('postgres_changes') handlers
    realtime: {
        onOfficerUpdate(payload) { CSTP.officerManager.handleRealtimeUpdate(payload); },
        onVehicleUpdate(payload) { CSTP.vehicleManager.handleRealtimeUpdate(payload); },
        onEmergencyUpdate(payload) {
            // Handle emergency realtime updates
            CSTP.notificationManager.show('emergency', 'EMERGENCY UPDATE', payload.new.title || 'Emergency status changed');
        }
    }
};

/* =====================================================================
   BOOTSTRAP
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    CSTP.init();
});

// Expose for popup button onclick handlers
window.CSTP = CSTP;