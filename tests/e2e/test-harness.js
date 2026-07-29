/**
 * E2E Test Harness for Next.js IPTV Web Application
 * Provides assertion helpers, mock server infrastructure, stream byte range validation,
 * virtual list rendering engine simulation, skip intro overlay timing engine, and user state storage.
 */

const http = require('http');
const url = require('url');
const assert = require('assert');

class TestHarness {
  constructor() {
    this.tests = [];
    this.passCount = 0;
    this.failCount = 0;
    this.assertionCount = 0;
    this.failures = [];
    this.server = null;
    this.serverPort = 9876;
    this.baseUrl = `http://127.0.0.1:${this.serverPort}`;
    this.serverLogs = [];
    this.cacheStore = new Map();
  }

  // --- Assertion Suite ---
  ok(condition, message) {
    this.assertionCount++;
    assert.ok(condition, message);
  }

  equal(actual, expected, message) {
    this.assertionCount++;
    assert.strictEqual(actual, expected, message);
  }

  notEqual(actual, expected, message) {
    this.assertionCount++;
    assert.notStrictEqual(actual, expected, message);
  }

  deepEqual(actual, expected, message) {
    this.assertionCount++;
    assert.deepStrictEqual(actual, expected, message);
  }

  includes(haystack, needle, message) {
    this.assertionCount++;
    if (typeof haystack === 'string') {
      assert.ok(haystack.includes(needle), message || `Expected string to include "${needle}"`);
    } else if (Array.isArray(haystack)) {
      assert.ok(haystack.includes(needle), message || `Expected array to include item`);
    }
  }

  greaterThan(actual, expected, message) {
    this.assertionCount++;
    assert.ok(actual > expected, message || `Expected ${actual} > ${expected}`);
  }

  lessThanOrEqual(actual, expected, message) {
    this.assertionCount++;
    assert.ok(actual <= expected, message || `Expected ${actual} <= ${expected}`);
  }

  // --- Test Case Registration ---
  test(name, tier, fn) {
    this.tests.push({ name, tier, fn });
  }

  // --- Mock HTTP Server for Opaque-Box Endpoints ---
  async startMockServer() {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const query = parsedUrl.query;

        this.serverLogs.push({
          method: req.method,
          path: pathname,
          query: query,
          headers: req.headers
        });

        // 1. Xtream Codes Proxy Route (/api/proxy/player_api)
        if (pathname === '/api/proxy/player_api') {
          const action = query.action;
          
          if (!action) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing action parameter' }));
          }

          // Check server cache hit simulation
          const cacheKey = `player_api_${action}_${query.series_id || ''}_${query.vod_id || ''}`;
          if (query.use_cache && this.cacheStore.has(cacheKey)) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
            return res.end(JSON.stringify(this.cacheStore.get(cacheKey)));
          }

          if (action === 'get_live_categories') {
            const data = [
              { category_id: "1", category_name: "NEWS", parent_id: 0 },
              { category_id: "2", category_name: "SPORTS", parent_id: 0 }
            ];
            this.cacheStore.set(cacheKey, data);
            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
            return res.end(JSON.stringify(data));
          }

          if (action === 'get_live_streams') {
            const data = [
              { num: 1, name: "US: CNN HD", stream_id: 10045, category_id: "1", epg_channel_id: "cnn.us" },
              { num: 2, name: "US: ESPN HD", stream_id: 10046, category_id: "2", epg_channel_id: "espn.us" }
            ];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(data));
          }

          if (action === 'get_vod_categories') {
            const data = [{ category_id: "5", category_name: "ACTION", parent_id: 0 }];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(data));
          }

          if (action === 'get_vod_streams') {
            const data = [
              { num: 1, name: "Inception (2010)", stream_id: 45012, category_id: "5", container_extension: "mp4", rating: "8.8" },
              { num: 2, name: "The Dark Knight (2008)", stream_id: 45013, category_id: "5", container_extension: "mp4", rating: "9.0" }
            ];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(data));
          }

          if (action === 'get_series') {
            const data = [
              { num: 1, name: "Breaking Bad (2008)", series_id: 892, category_id: "8", rating: "9.5", plot: "Chemistry teacher..." }
            ];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(data));
          }

          if (action === 'get_series_info') {
            if (!query.series_id) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Missing series_id' }));
            }
            const data = {
              info: { name: "Breaking Bad", series_id: query.series_id, rating: "9.5" },
              seasons: [{ season_number: 1, name: "Season 1", episode_count: 7 }],
              episodes: {
                "1": [
                  { id: "78101", episode_num: 1, title: "Pilot", container_extension: "mp4", info: { duration_secs: 3480 } }
                ]
              }
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(data));
          }

          if (action === 'get_vod_info') {
            const data = {
              info: { tmdb_id: "27205", name: "Inception", plot: "Dream thief...", duration_secs: 8880 },
              movie_data: { stream_id: 45012, container_extension: "mp4" }
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(data));
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Unknown action' }));
        }

        // 2. Stream Proxy Route (/api/proxy/stream)
        if (pathname === '/api/proxy/stream') {
          const userAgent = req.headers['user-agent'] || '';
          const rangeHeader = req.headers['range'];

          // Verify status code 404 for unknown stream ID
          if (query.stream_id === '999999') {
            res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ error: 'Stream not found' }));
          }

          // Verify status code 502 for error simulation
          if (query.sim_error === '502') {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ error: 'Upstream gateway error' }));
          }

          const headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': query.container === 'ts' ? 'video/mp2t' : 'video/mp4',
            'X-Spoofed-User-Agent': userAgent
          };

          // Handle Range Header for video seeking
          if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10) || 0;
            const end = parseInt(parts[1], 10) || (start + 131071);

            if (start > end) {
              res.writeHead(416, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
              return res.end("Range Not Satisfiable");
            }

            const chunkSize = (end - start) + 1;
            headers['Content-Range'] = `bytes ${start}-${end}/10485760`;
            headers['Content-Length'] = chunkSize;
            res.writeHead(206, headers);
            
            // Write 128KB dummy binary chunk
            const buffer = Buffer.alloc(chunkSize, 'A');
            return res.end(buffer);
          }

          res.writeHead(200, headers);
          const buffer = Buffer.alloc(131072, 'B'); // 128KB buffer
          return res.end(buffer);
        }

        // 3. TMDB Proxy Route (/api/proxy/tmdb)
        if (pathname === '/api/proxy/tmdb') {
          if (query.query === '404_not_found') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'No TMDB match found' }));
          }
          const data = {
            results: [{ id: 27205, title: query.query || "Inception", backdrop_path: "/inception.jpg" }]
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(data));
        }

        // 4. TheIntroDB Proxy Route (/api/proxy/intro)
        if (pathname === '/api/proxy/intro') {
          if (query.tvdb_id === '0') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ intro: null, recap: null, credits: null }));
          }
          const data = {
            intro: { start_ms: 120000, end_ms: 180000 },  // 120s - 180s (60s intro)
            recap: { start_ms: 10000, end_ms: 40000 },    // 10s - 40s (30s recap)
            credits: { start_ms: 3000000, end_ms: 3100000 } // credits
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(data));
        }

        // 5. Plex Theme Proxy Route (/api/proxy/theme)
        if (pathname === '/api/proxy/theme') {
          if (query.tvdb_id === '0') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'No TVDB theme available' }));
          }
          res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' });
          return res.end(Buffer.alloc(1024, 'AUDIO_DATA'));
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Route not found' }));
      });

      this.server.listen(this.serverPort, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  async stopMockServer() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // --- HTTP Client Request Helper ---
  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const fullUrl = `${this.baseUrl}${endpoint}`;
      const parsed = url.parse(fullUrl);
      
      const reqOpts = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.path,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = http.request(reqOpts, (res) => {
        let body = [];
        res.on('data', (chunk) => body.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(body);
          let json = null;
          try {
            json = JSON.parse(buffer.toString());
          } catch (e) {
            json = null;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: buffer,
            text: buffer.toString(),
            json: json
          });
        });
      });

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  // --- Virtualized List Simulation Engine ---
  simulateVirtualizedGrid({ totalItems, itemHeight, viewportHeight, scrollTop }) {
    const totalHeight = totalItems * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2); // 2 buffer rows
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + 4; // 4 buffer items
    const endIndex = Math.min(totalItems - 1, startIndex + visibleCount);
    const renderedNodesCount = (endIndex - startIndex) + 1;

    return {
      totalItems,
      totalHeight,
      startIndex,
      endIndex,
      renderedNodesCount
    };
  }

  // --- Skip Intro Overlay Simulator ---
  simulateSkipOverlay({ currentTimeSec, introData }) {
    const currentMs = currentTimeSec * 1000;
    let visibleButton = null;
    let targetSeekSec = null;

    if (introData.recap && currentMs >= introData.recap.start_ms && currentMs <= introData.recap.end_ms) {
      visibleButton = '⏩ Skip Recap';
      targetSeekSec = introData.recap.end_ms / 1000;
    } else if (introData.intro && currentMs >= introData.intro.start_ms && currentMs <= introData.intro.end_ms) {
      visibleButton = '⏩ Skip Intro';
      targetSeekSec = introData.intro.end_ms / 1000;
    } else if (introData.credits && currentMs >= introData.credits.start_ms && currentMs <= introData.credits.end_ms) {
      visibleButton = '⏭️ Skip Credits';
      targetSeekSec = introData.credits.end_ms / 1000;
    }

    return { visibleButton, targetSeekSec };
  }

  // --- User State Storage Simulator (IndexedDB / LocalStorage) ---
  createStorageSimulator() {
    const favorites = new Set();
    const history = new Map();

    return {
      addFavorite(key, item) {
        favorites.add(key);
      },
      removeFavorite(key) {
        favorites.delete(key);
      },
      hasFavorite(key) {
        return favorites.has(key);
      },
      getFavoritesCount() {
        return favorites.size;
      },
      updateHistory(key, { title, position, duration }) {
        history.set(key, {
          key,
          title,
          lastPosition: position,
          duration,
          updatedAt: Date.now()
        });
      },
      getHistory(key) {
        return history.get(key);
      },
      getHistoryCount() {
        return history.size;
      }
    };
  }

  // --- Suite Execution Engine ---
  async runAll() {
    await this.startMockServer();
    console.log(`\n🚀 Starting Next.js IPTV E2E Test Suite against ${this.baseUrl}\n`);
    const startTime = Date.now();

    for (const testCase of this.tests) {
      const testStart = Date.now();
      try {
        await testCase.fn(this);
        this.passCount++;
        console.log(`  ✅ [${testCase.tier}] ${testCase.name} (${Date.now() - testStart}ms)`);
      } catch (err) {
        this.failCount++;
        this.failures.push({ test: testCase, error: err });
        console.log(`  ❌ [${testCase.tier}] ${testCase.name} (${Date.now() - testStart}ms)`);
        console.log(`     Error: ${err.message}`);
      }
    }

    const duration = Date.now() - startTime;
    await this.stopMockServer();

    return {
      total: this.tests.length,
      passed: this.passCount,
      failed: this.failCount,
      assertions: this.assertionCount,
      failures: this.failures,
      duration
    };
  }
}

module.exports = TestHarness;
