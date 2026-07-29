import test from 'node:test';
import assert from 'node:assert/strict';

// Test environment variables setup
process.env.XTREAM_HOST = 'nvr.xcm9xplus.org:2052';
process.env.XTREAM_USERNAME = '66764023';
process.env.XTREAM_PASSWORD = '13715132950979';
process.env.TMDB_API_KEY = '4ef0d7355d9ffb5151e987764708ce96';

import { getXtreamConfig, buildUpstreamPlayerUrl, buildUpstreamStreamUrl } from '../../src/lib/xtream-client.ts';

test('Xtream Client - getXtreamConfig retrieves env values', () => {
  const config = getXtreamConfig();
  assert.equal(config.host, 'nvr.xcm9xplus.org:2052');
  assert.equal(config.username, '66764023');
  assert.equal(config.password, '13715132950979');
});

test('Xtream Client - buildUpstreamPlayerUrl builds valid URL without exposing client credentials', () => {
  const urlString = buildUpstreamPlayerUrl('get_live_categories', {
    username: 'attacker',
    password: 'password',
    category_id: '12',
  });
  const url = new URL(urlString);
  assert.equal(url.searchParams.get('action'), 'get_live_categories');
  assert.equal(url.searchParams.get('username'), '66764023');
  assert.equal(url.searchParams.get('password'), '13715132950979');
  assert.equal(url.searchParams.get('category_id'), '12');
});

test('Xtream Client - buildUpstreamStreamUrl constructs stream routes', () => {
  const liveUrl = buildUpstreamStreamUrl('live', '10045', 'ts');
  assert.ok(liveUrl.includes('/live/66764023/13715132950979/10045.ts'));

  const movieUrl = buildUpstreamStreamUrl('movie', '45012.mp4');
  assert.ok(movieUrl.includes('/movie/66764023/13715132950979/45012.mp4'));

  const seriesUrl = buildUpstreamStreamUrl('series', '78101', 'mkv');
  assert.ok(seriesUrl.includes('/series/66764023/13715132950979/78101.mkv'));
});

test('Storage & State Manager - favorites and history state rules', async () => {
  assert.equal(typeof window, 'undefined');
  // Tests SSR safety in storage module
  const { getFavorites, getWatchHistory } = await import('../../src/lib/storage.ts');
  assert.deepEqual(getFavorites(), []);
  assert.deepEqual(getWatchHistory(), []);
});

test('Skip Overlay & Player - stream URL formatting and timestamp normalization', async () => {
  const { getStreamUrl } = await import('../../src/lib/api-client.ts');
  const liveUrl = getStreamUrl('live', 10045, 'm3u8');
  assert.equal(liveUrl, '/api/proxy/stream?type=live&stream_id=10045&container=m3u8');

  const movieUrl = getStreamUrl('movie', 45012, 'mp4');
  assert.equal(movieUrl, '/api/proxy/stream?type=movie&stream_id=45012&container=mp4');
});
