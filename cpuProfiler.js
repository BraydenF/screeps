// cpuProfiler.js
// Usage:
// const profiler = require('cpuProfiler');
// profiler.profile('Hive.run', () => hive.run());
// // optionally call profiler.flush() periodically (profiler will auto-flush every flushIntervalTicks)

const MAX_ENTRIES_PER_KEY = 200;        // cap stored history per key
const FLUSH_INTERVAL = 2;             // how often (ticks) to flush runtime buffer to Memory

if (!global.__cpuProfiler) global.__cpuProfiler = { buffer: {}, lastFlush: -1 };

module.exports = {
  profile: function(key, fn) {
    const cpu = Game.cpu.getUsed();
    const res = fn();
    const delta = Game.cpu.getUsed() - cpu;

    // runtime accumulation (avoid Memory writes per call)
    global.__cpuProfiler.buffer[key] = (global.__cpuProfiler.buffer[key] || 0) + delta;

    // mark last used tick for this key
    global.__cpuProfiler.lastTick = Game.time;

    // auto-flush if needed
    try {
      if (global.__cpuProfiler.lastFlush === undefined) global.__cpuProfiler.lastFlush = Game.time;
      if (Game.time - global.__cpuProfiler.lastFlush >= FLUSH_INTERVAL) {
        this.flush();
        global.__cpuProfiler.lastFlush = Game.time;
      }
    } catch (e) {
      // swallow to avoid profiler causing errors
      console.log('cpuProfiler flush error', e);
    }

    return res;
  },

  flush: function() {
    if (!global.__cpuProfiler || !global.__cpuProfiler.buffer) return;
    Memory.cpuProfile = Memory.cpuProfile || {};
    // For each key, push a new sample (tick and cpu) and keep last N entries
    for (const key in global.__cpuProfiler.buffer) {
      const cpu = global.__cpuProfiler.buffer[key];
      Memory.cpuProfile[key] = Memory.cpuProfile[key] || [];
      Memory.cpuProfile[key].push({ t: Game.time, cpu });
      if (Memory.cpuProfile[key].length > MAX_ENTRIES_PER_KEY) {
        Memory.cpuProfile[key].splice(0, Memory.cpuProfile[key].length - MAX_ENTRIES_PER_KEY);
      }
      // reset runtime accumulator for that key
      global.__cpuProfiler.buffer[key] = 0;
    }
  },

  // helper to compute basic aggregates for a key
  stats: function(key) {
    const arr = (Memory.cpuProfile && Memory.cpuProfile[key]) || [];
    if (!arr.length) return { avg: 0, max: 0, count: 0 };
    let sum = 0, max = 0;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i].cpu;
      sum += v;
      if (v > max) max = v;
    }
    return { avg: sum / arr.length, max, count: arr.length };
  }
};