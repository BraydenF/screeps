const config = require('config');
const utils = require('utils');
const Hive = require('Hive');
const Drone = require('Drone.class');
const GameMap = require('GameMap');
const MarketController = require('MarketController');
const PowerCreep = require('PowerCreep');

global.Hive = Hive;
global.Drone = Drone;
global.grc = countResource;

global.viewDroneCpu = function(jobName) {
  let totalCpu = 0;
  let count = 0;
  const data = {};

  for (const name in Memory.creeps) {
    const creep = Memory.creeps[name];
    const ticks = creep.ticksToLive > 0 ? 1500 - creep.ticksToLive : 1500;

    if (creep.totalCpu && (!jobName || creep.job === jobName)) {
      const avgCpu = creep.totalCpu ? creep.totalCpu / ticks : 0;

      if (avgCpu > 0) {
        totalCpu = totalCpu + avgCpu;
        count++;

        // if (creep.job) {
        //   if (!Memory.data[creep.job]) Memory.data[creep.job] = { total: 0, avg: 0, count: 0 };
        //   Memory.data[creep.job].total = Memory.data[creep.job].total + creep.totalCpu;
        //   Memory.data[creep.job].avg = Memory.data[creep.job].avg + creep.avgCpu;
        //   Memory.data[creep.job].count++;
        // }
      }
    }
  }

  console.log(totalCpu, '/', count);
  return totalCpu / count;
  // return totalCpu / Memory.creeps.length;
}

// global.Spawn4.createDrone('drone', [WORK, MOVE, CARRY, WORK, MOVE, CARRY, WORK]);

/**
 * To Do:
 * Hive
 * - Complete the task queue - In Progress
 * - Update the TowerService to use the Taskqueue instead of reserving a hauler
 * 
 * Creeps
 * - Update creeps to correctly move a set amounts of resources
 * 
 * Misc
 * - 
 *
 */

function countResource(resource) {
  let total = 0;
  for (const roomName of Object.keys(Game.rooms)) {
    const room = Game.rooms[roomName];
    if (room && room.controller && room.controller._my && room.storage) {
      total = total + room.storage.store.getUsedCapacity(resource);
      if (room.terminal) {
        total = total + room.terminal.store.getUsedCapacity(resource);
      }
    }
  }
  return total;
}

// main logic loop
module.exports.loop = function () {
  // defines the top of the tick for report viewing
  const reportTime = 10;
  if (Game.time % reportTime === 0) console.log('*****************************************************************');
  // console.log('*****************************************************************');
  const totalData = { energy: 0, battery: 0 };

  let hiveCpu = Game.cpu.getUsed();
  for (const roomName of Object.keys(Game.rooms)) {
    const room = Game.rooms[roomName];
    if (room.controller && room.controller._my) {
      const hive = new Hive(roomName);
      if (hive) {
        const cpu = Game.cpu.getUsed();
        const data = hive.run();

        // if (data) {
        //   totalData.energy = totalData.energy + data.energy;
        //   totalData.battery = totalData.battery + data.battery;
        // }

        if (Game.time % reportTime === 0) hive.report(cpu);
      }
    }
    // else if (Game.time % 15 === OK) {
      // const preScan = Game.cpu.getUsed();
      // GameMap.scan(roomName);
      // Memory.rooms[roomName] = undefined;
      // console.log('scan-cpu', Game.cpu.getUsed() - preScan);
    // }
  }
  Memory.data = totalData;
  hiveCpu = Game.cpu.getUsed() - hiveCpu;

  let droneCpu = Game.cpu.getUsed();
  if (Game.cpu.bucket > 35) {
    Drone.runDrones()
    // Drone.getDrones().forEach(drone => drone.run());
  }

  PowerCreep.run();

  // if (Game.time % 100 === OK) GameMap.scan();

  // MarketController.scan();

  if (Game.time % 10000 === OK) {
    // clears old creeps from memory
    Object.keys(Memory.creeps).forEach(name => {
      const creep = Game.creeps[name];
      if (typeof creep === 'undefined') Memory.creeps[name] = undefined;
    });
  }

  const fincpu = Game.cpu.getUsed();
  // const droneCpuReprt = `drone-cpu ${Game.cpu.getUsed() - droneCpu).toFixed(4)}`;
  console.log('hive-cpu', hiveCpu.toFixed(4), 'drone-cpu', (Game.cpu.getUsed() - droneCpu).toFixed(4), 'cpu', fincpu > 20 ? `<b>${fincpu.toFixed(4)}</b>` : fincpu.toFixed(4), `TL:${Game.cpu.tickLimit}`, `B:${Game.cpu.bucket}`);
}
