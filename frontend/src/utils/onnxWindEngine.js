/**
 * OnnxWindEngine — Browser-side wind GAN inference using ONNX Runtime Web.
 * 
 * Replaces the Python FastAPI backend (/predict endpoint) when running on
 * GitHub Pages or when the local backend is unavailable.
 * 
 * Pipeline: Float32Array(3×512×512) → ONNX GAN → denorm → inverse turbo →
 *           wind speeds → comfort metric coloring → HTMLCanvasElement
 * 
 * Model source: HuggingFace (SustainableUrbanSystemsLab/UrbanWind-GAN)
 * Model is cached in IndexedDB after first download.
 */

import * as ort from 'onnxruntime-web';
import { TURBO_COLORMAP } from './turboColormap';

import { getBackendURL } from './backend';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MODEL_URL =
    'https://huggingface.co/SustainableUrbanSystemsLab/Yel-1.0/resolve/main/Yel.onnx';
const DB_NAME = 'urban-wind-model-cache';
const DB_STORE = 'models';
const DB_KEY = 'gan-model-v1';
const N = 512; // GAN resolution

// ---------------------------------------------------------------------------
// IndexedDB helpers — cache the 208 MB model for instant repeat visits
// ---------------------------------------------------------------------------
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getCachedModel() {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const store = tx.objectStore(DB_STORE);
            const getReq = store.get(DB_KEY);
            getReq.onsuccess = () => resolve(getReq.result || null);
            getReq.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function cacheModel(buffer) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            const store = tx.objectStore(DB_STORE);
            store.put(buffer, DB_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    } catch {
        // Caching is best-effort; don't break inference if it fails
    }
}

// ---------------------------------------------------------------------------
// Model download with progress reporting
// ---------------------------------------------------------------------------
async function downloadModel(onProgress) {
    const response = await fetch(MODEL_URL);
    if (!response.ok) {
        throw new Error(`Failed to download model: HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total && onProgress) {
            onProgress(Math.round((received / total) * 100));
        }
    }

    // Combine chunks into single ArrayBuffer
    const buffer = new ArrayBuffer(received);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const chunk of chunks) {
        view.set(chunk, offset);
        offset += chunk.length;
    }

    return buffer;
}

// ---------------------------------------------------------------------------
// Inverse Turbo Colormap LUT (64³ = 262,144 entries, ~256 KB)
// Maps quantized RGB → nearest turbo colormap index (0–255)
// ---------------------------------------------------------------------------
const LUT_SIZE = 64;
let inverseLUT = null;

function buildInverseTurboLUT() {
    if (inverseLUT) return inverseLUT;

    const lut = new Uint8Array(LUT_SIZE * LUT_SIZE * LUT_SIZE);

    // Pre-scale turbo entries to 0-255
    const turbo255 = TURBO_COLORMAP.map(([r, g, b]) => [r * 255, g * 255, b * 255]);

    for (let ri = 0; ri < LUT_SIZE; ri++) {
        const r = (ri * 255) / (LUT_SIZE - 1);
        for (let gi = 0; gi < LUT_SIZE; gi++) {
            const g = (gi * 255) / (LUT_SIZE - 1);
            for (let bi = 0; bi < LUT_SIZE; bi++) {
                const b = (bi * 255) / (LUT_SIZE - 1);

                let bestIdx = 0;
                let bestDist = Infinity;
                for (let k = 0; k < 256; k++) {
                    const dr = r - turbo255[k][0];
                    const dg = g - turbo255[k][1];
                    const db = b - turbo255[k][2];
                    const dist = dr * dr + dg * dg + db * db;
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIdx = k;
                    }
                }
                lut[ri * LUT_SIZE * LUT_SIZE + gi * LUT_SIZE + bi] = bestIdx;
            }
        }
    }

    inverseLUT = lut;
    return lut;
}

// ---------------------------------------------------------------------------
// Core inference pipeline
// ---------------------------------------------------------------------------

/**
 * Denormalize raw GAN output from [-1, 1] to [0, 255] uint8.
 * Mirrors Python: (raw * 127.5) + 127.5, clipped to [0, 255].
 * 
 * @param {Float32Array} raw - Shape (3, 512, 512), values in [-1, 1]
 * @returns {Uint8Array} Shape (512*512, 3) in HWC order, values [0, 255]
 */
function denormalize(raw) {
    const size = N * N;
    const out = new Uint8Array(size * 3);

    for (let i = 0; i < size; i++) {
        // raw is CHW: channels at raw[0*size+i], raw[1*size+i], raw[2*size+i]
        for (let c = 0; c < 3; c++) {
            let val = raw[c * size + i] * 127.5 + 127.5;
            if (val < 0) val = 0;
            if (val > 255) val = 255;
            out[i * 3 + c] = val;
        }
    }
    return out;
}

/**
 * Convert denormalized RGB image to wind speed values using the inverse turbo LUT.
 * 
 * @param {Uint8Array} denorm - Shape (512*512, 3), HWC, values [0, 255]
 * @returns {Float32Array} Wind speeds in [0, 15] m/s, length 512*512
 */
function colorToWindSpeed(denorm) {
    const lut = buildInverseTurboLUT();
    const numPixels = N * N;
    const windSpeeds = new Float32Array(numPixels);
    const scale = (LUT_SIZE - 1) / 255;

    for (let i = 0; i < numPixels; i++) {
        const r = denorm[i * 3];
        const g = denorm[i * 3 + 1];
        const b = denorm[i * 3 + 2];

        // Quantize to LUT indices
        const ri = (r * scale + 0.5) | 0;
        const gi = (g * scale + 0.5) | 0;
        const bi = (b * scale + 0.5) | 0;

        const turboIdx = lut[ri * LUT_SIZE * LUT_SIZE + gi * LUT_SIZE + bi];
        windSpeeds[i] = turboIdx * (15.0 / 256);
    }
    return windSpeeds;
}

/**
 * Morphological dilation: 9×9 max-pool to fill wind values into building voids.
 * Exact port of the Python backend's dilation logic (api.py L442-452).
 * 
 * @param {Float32Array} windSpeeds - Length 512*512, modified in place
 */
function dilateWindSpeeds(windSpeeds) {
    const W = N, H = N;

    // Record which pixels are buildings (zero wind speed)
    const isBuildingMask = new Uint8Array(W * H);
    for (let i = 0; i < windSpeeds.length; i++) {
        if (windSpeeds[i] === 0.0) isBuildingMask[i] = 1;
    }

    // 9×9 sparse maximum pool (matching Python's range(-4, 5))
    const dilated = new Float32Array(windSpeeds);

    for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
            if (dx === 0 && dy === 0) continue;
            for (let y = 0; y < H; y++) {
                // np.roll wraps around — replicate this behavior
                const sy = ((y + dy) % H + H) % H;
                for (let x = 0; x < W; x++) {
                    const sx = ((x + dx) % W + W) % W;
                    const idx = y * W + x;
                    const sidx = sy * W + sx;
                    if (windSpeeds[sidx] > dilated[idx]) {
                        dilated[idx] = windSpeeds[sidx];
                    }
                }
            }
        }
    }

    // Apply dilation only to building pixels
    for (let i = 0; i < windSpeeds.length; i++) {
        if (isBuildingMask[i]) {
            windSpeeds[i] = dilated[i];
        }
    }
}

/**
 * Apply comfort metric coloring to wind speed values.
 * Exact port of all 5 comfort metrics from the Python backend (api.py L461-515).
 * 
 * @param {Float32Array} windSpeeds - Raw wind speeds (0-15 scale)
 * @param {number} windSpeed - User's wind speed slider value (m/s)
 * @param {string} comfortMetric - One of: 'speed', 'lawson', 'davenport', 'nen8100', 'beaufort'
 * @returns {Uint8Array} RGBA pixel data, length 512*512*4
 */
function applyComfortMetricColoring(windSpeeds, windSpeed, comfortMetric) {
    const numPixels = N * N;
    const rgba = new Uint8Array(numPixels * 4);
    const metric = comfortMetric.toLowerCase();

    // Compute actual wind speeds (scale from GAN's 0-15 range to user's windSpeed)
    const actualSpeeds = new Float32Array(numPixels);
    for (let i = 0; i < numPixels; i++) {
        actualSpeeds[i] = windSpeeds[i] * (windSpeed / 15.0);
    }

    if (metric === 'lawson') {
        const bins = [4.0, 6.0, 8.0, 10.0];
        const colors = [
            [0.0, 0.2, 1.0],   // Blue
            [0.0, 0.8, 1.0],   // Cyan
            [0.0, 0.8, 0.0],   // Green
            [1.0, 0.8, 0.0],   // Yellow
            [1.0, 0.0, 0.0],   // Red
        ];
        for (let i = 0; i < numPixels; i++) {
            const idx = digitize(actualSpeeds[i], bins);
            rgba[i * 4]     = (colors[idx][0] * 255) | 0;
            rgba[i * 4 + 1] = (colors[idx][1] * 255) | 0;
            rgba[i * 4 + 2] = (colors[idx][2] * 255) | 0;
            rgba[i * 4 + 3] = 255;
        }
    } else if (metric === 'davenport') {
        const bins = [3.6, 5.3, 7.6, 9.8];
        const colors = [
            [0.0, 0.2, 1.0],
            [0.0, 0.8, 1.0],
            [0.0, 0.8, 0.0],
            [1.0, 0.8, 0.0],
            [1.0, 0.0, 0.0],
        ];
        for (let i = 0; i < numPixels; i++) {
            const idx = digitize(actualSpeeds[i], bins);
            rgba[i * 4]     = (colors[idx][0] * 255) | 0;
            rgba[i * 4 + 1] = (colors[idx][1] * 255) | 0;
            rgba[i * 4 + 2] = (colors[idx][2] * 255) | 0;
            rgba[i * 4 + 3] = 255;
        }
    } else if (metric === 'nen8100') {
        const bins = [5.0, 15.0];
        const colors = [
            [0.0, 0.8, 0.0],   // Green
            [1.0, 0.5, 0.0],   // Orange
            [1.0, 0.0, 0.0],   // Red
        ];
        for (let i = 0; i < numPixels; i++) {
            const idx = digitize(actualSpeeds[i], bins);
            rgba[i * 4]     = (colors[idx][0] * 255) | 0;
            rgba[i * 4 + 1] = (colors[idx][1] * 255) | 0;
            rgba[i * 4 + 2] = (colors[idx][2] * 255) | 0;
            rgba[i * 4 + 3] = 255;
        }
    } else if (metric === 'beaufort') {
        const bins = [0.5, 1.5, 3.3, 5.5, 7.9, 10.7, 13.8];
        const colors = [
            [0.5, 0.5, 0.5],   // Calm (Gray)
            [0.4, 0.6, 0.8],   // Light air
            [0.2, 0.6, 1.0],   // Light breeze
            [0.0, 0.8, 0.8],   // Gentle Breeze
            [0.0, 0.8, 0.0],   // Moderate
            [1.0, 1.0, 0.0],   // Fresh
            [1.0, 0.5, 0.0],   // Strong
            [1.0, 0.0, 0.0],   // Gale
        ];
        for (let i = 0; i < numPixels; i++) {
            const idx = digitize(actualSpeeds[i], bins);
            rgba[i * 4]     = (colors[idx][0] * 255) | 0;
            rgba[i * 4 + 1] = (colors[idx][1] * 255) | 0;
            rgba[i * 4 + 2] = (colors[idx][2] * 255) | 0;
            rgba[i * 4 + 3] = 255;
        }
    } else {
        // Default "speed" — Turbo colormap with power curve
        for (let i = 0; i < numPixels; i++) {
            let norm = ((windSpeeds[i] / 15.0) * windSpeed / 30.0);
            if (norm < 0) norm = 0;
            if (norm > 1) norm = 1;
            norm = Math.pow(norm, 0.8);
            norm = 0.1 + norm * 0.9;
            let idx = (norm * 255.0) | 0;
            if (idx < 0) idx = 0;
            if (idx > 255) idx = 255;

            const tc = TURBO_COLORMAP[idx];
            rgba[i * 4]     = (tc[0] * 255) | 0;
            rgba[i * 4 + 1] = (tc[1] * 255) | 0;
            rgba[i * 4 + 2] = (tc[2] * 255) | 0;
            rgba[i * 4 + 3] = 255;
        }
    }

    return rgba;
}

/**
 * np.digitize equivalent: returns bin index for a value given sorted bin edges.
 * For bins [a, b, c], returns 0 if val < a, 1 if a <= val < b, etc.
 */
function digitize(val, bins) {
    for (let i = 0; i < bins.length; i++) {
        if (val < bins[i]) return i;
    }
    return bins.length;
}

// ---------------------------------------------------------------------------
// OnnxWindEngine — public API
// ---------------------------------------------------------------------------
export class OnnxWindEngine {
    constructor() {
        this.session = null;
        this.inputName = null;
        this.ready = false;
        this._initPromise = null;
    }

    /**
     * Initialize the engine: download/cache model, create ONNX session.
     * Safe to call multiple times; subsequent calls return the same promise.
     * 
     * @param {function} onProgress - Callback: onProgress(percent, statusText)
     */
    async init(onProgress) {
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._doInit(onProgress);
        return this._initPromise;
    }

    async _doInit(onProgress) {
        // Configure ONNX Runtime WASM paths relative to the app's base URL
        ort.env.wasm.wasmPaths = import.meta.env.BASE_URL;

        // GitHub Pages (and most static hosts) don't serve COOP/COEP headers,
        // so SharedArrayBuffer is unavailable → force single-threaded WASM
        if (typeof SharedArrayBuffer === 'undefined') {
            ort.env.wasm.numThreads = 1;
        }

        // Build the inverse turbo LUT in background while model loads
        const lutPromise = new Promise((resolve) => {
            setTimeout(() => { buildInverseTurboLUT(); resolve(); }, 0);
        });

        // Try loading from IndexedDB cache first
        let modelBuffer = null;

        if (onProgress) onProgress(0, 'Checking cache...');
        modelBuffer = await getCachedModel();

        if (modelBuffer) {
            if (onProgress) onProgress(100, 'Loading from cache...');
        } else {
            // Download from HuggingFace with progress
            if (onProgress) onProgress(0, 'Downloading Wind AI Model...');
            try {
                modelBuffer = await downloadModel((pct) => {
                    if (onProgress) onProgress(pct, `Downloading Model: ${pct}%`);
                });
            } catch (err) {
                throw new Error(
                    `Failed to download wind model from HuggingFace. ` +
                    `This may be due to CORS restrictions or network issues. ` +
                    `Error: ${err.message}`
                );
            }

            // Cache for next time (async, don't block)
            cacheModel(modelBuffer).catch(() => {});
        }

        // Create ONNX inference session — WASM backend only (most reliable for static hosting)
        if (onProgress) onProgress(100, 'Initializing ONNX Runtime...');

        this.session = await ort.InferenceSession.create(modelBuffer, {
            executionProviders: ['wasm'],
        });

        this.inputName = this.session.inputNames[0];
        await lutPromise;
        this.ready = true;
    }

    /**
     * Run wind GAN inference and return a colored canvas.
     * 
     * @param {Float32Array} floatData - Shape (3 × 512 × 512), values in [-1, 1].
     *   Channel 0: Geometry mask (1.0=air, -1.0=building)
     *   Channel 1: X-wind vector
     *   Channel 2: Z-wind vector
     * @param {number} windSpeed - User wind speed in m/s (for comfort metric scaling)
     * @param {string} comfortMetric - 'speed' | 'lawson' | 'davenport' | 'nen8100' | 'beaufort'
     * @returns {HTMLCanvasElement} 512×512 canvas with colored wind visualization
     */
    async predict(floatData, windSpeed, comfortMetric) {
        if (!this.ready) {
            throw new Error('OnnxWindEngine not initialized. Call init() first.');
        }

        // Create ONNX tensor — shape [1, 3, 512, 512]
        const inputTensor = new ort.Tensor('float32', floatData, [1, 3, N, N]);
        const feeds = { [this.inputName]: inputTensor };

        // Run inference
        const results = await this.session.run(feeds);
        const outputName = this.session.outputNames[0];
        const rawOutput = results[outputName].data; // Float32Array, shape [1, 3, 512, 512]

        // Extract the single batch item: rawOutput is [1, 3, 512, 512], we want [3, 512, 512]
        const singleOutput = rawOutput.subarray(0, 3 * N * N);

        // Denormalize: [-1, 1] → [0, 255]
        const denorm = denormalize(singleOutput);

        // Convert to wind speeds via inverse turbo colormap
        const windSpeeds = colorToWindSpeed(denorm);

        // Morphological dilation: fill building voids
        dilateWindSpeeds(windSpeeds);

        // Apply comfort metric coloring → RGBA pixel data
        const rgba = applyComfortMetricColoring(windSpeeds, windSpeed, comfortMetric);

        // Create output canvas
        const canvas = document.createElement('canvas');
        canvas.width = N;
        canvas.height = N;
        const ctx = canvas.getContext('2d');
        const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer), N, N);
        ctx.putImageData(imageData, 0, 0);

        return canvas;
    }
}

// ---------------------------------------------------------------------------
// Backend health check utility
// ---------------------------------------------------------------------------
let _backendStatus = null; // null = unchecked, true/false = result

/**
 * Check if the local Python backend is reachable.
 * Result is cached for the session.
 */
export async function checkBackendAvailable() {
    if (_backendStatus !== null) return _backendStatus;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${getBackendURL()}/health`, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        _backendStatus = res.ok;
    } catch {
        _backendStatus = false;
    }
    return _backendStatus;
}

// Singleton engine instance
let _engineInstance = null;

/**
 * Get or create the singleton ONNX wind engine.
 * @param {function} onProgress - Progress callback
 * @returns {Promise<OnnxWindEngine>}
 */
export async function getWindEngine(onProgress) {
    if (!_engineInstance) {
        _engineInstance = new OnnxWindEngine();
    }
    if (!_engineInstance.ready) {
        await _engineInstance.init(onProgress);
    }
    return _engineInstance;
}
