/*
 * OutputIQ — chrome.storage.local wrapper.
 * Keys:
 *   "attempts"  -> Attempt[] (newest last, capped at MAX_ATTEMPTS)
 *   "settings"  -> Judge0 + comparison settings (see judge0.DEFAULT_SETTINGS)
 */
(function (root) {
  'use strict';

  var MAX_ATTEMPTS = 500;
  var MAX_TEXT = 20000; // chars kept per code/output field

  function area() { return chrome.storage.local; }
  function clip(s) { s = String(s == null ? '' : s); return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + '\n…(truncated)' : s; }

  async function getAttempts() {
    var data = await area().get('attempts');
    return Array.isArray(data.attempts) ? data.attempts : [];
  }

  async function addAttempt(attempt) {
    var list = await getAttempts();
    var a = Object.assign({}, attempt, {
      id: attempt.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      ts: attempt.ts || Date.now(),
      code: clip(attempt.code),
      prediction: clip(attempt.prediction),
      actualOutput: clip(attempt.actualOutput),
      stdin: clip(attempt.stdin)
    });
    list.push(a);
    if (list.length > MAX_ATTEMPTS) list = list.slice(list.length - MAX_ATTEMPTS);
    await area().set({ attempts: list });
    return a;
  }

  async function clearAttempts() { await area().set({ attempts: [] }); }

  async function getSettings() {
    var defaults = (root.OutputIQ && root.OutputIQ.judge0 && root.OutputIQ.judge0.DEFAULT_SETTINGS) || {};
    var data = await area().get('settings');
    return Object.assign({}, defaults, data.settings || {});
  }

  async function saveSettings(settings) { await area().set({ settings: settings }); }

  var api = { getAttempts: getAttempts, addAttempt: addAttempt, clearAttempts: clearAttempts, getSettings: getSettings, saveSettings: saveSettings, MAX_ATTEMPTS: MAX_ATTEMPTS };
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.storage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
