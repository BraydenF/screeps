const config = require('config');
const utils = require('utils');
const Hive = require('Hive');
const Drone = require('Drone.class');
const GameMap = require('GameMap');
const PowerCreep = require('PowerCreep');
// const profiler = require('cpuProfiler');
const roomSupport = require('roomSupport.service');
const powerBankService = require('powerBank.service');
const productionNotifier = require('productionNotifier');

const BUCKET_LIMIT = 10000;

global.Hive = Hive;
global.Drone = Drone;
// global.profiler = profiler;

/**
 * { targetRoom:'E7N53', source:'59bbc4ae2052a716c3ce85cb' OR '59bbc4ae2052a716c3ce85ca'});
 * hives['E7N52'].spawnController.createDrone('miner', [...w5,...m5], {targetRoom:'E7N53',source:'59bbc4ae2052a716c3ce85ca'});
 * 
 * sources:[59bbc4ac2052a716c3ce857f, 59bbc4ac2052a716c3ce8580] - 59bbc4ae2052a716c3ce85cf E&N52
 * hives['E7N52'].spawnController.createDrone.createDrone('flagbearer', [MOVE, MOVE, CLAIM], {targetShard:'shard1',targetRoom:'E7N53'})
* hives['E7N52'].spawnController.createDrone('miner', [...m5,...w5], {targetShard:'shard1', targetRoom:'E7N53',source:'59bbc4ae2052a716c3ce85cb'})
 * Spawn5.createDrone('drone', [...m10,...w10, ...m10, ...c10], {targetShard:'shard1', targetRoom:'E7N53'})
 * Spawn5b.createDrone('drone', [...m10,...w10, ...m10, ...c10], {source:'59bbc4ac2052a716c3ce8580',targetShard:'shard1', targetRoom:'E6N51'})
 * 
 * 
 * SpawnH.createDrone('battleRam', [...w5, ...m5], {targetRoom:'E7N53',targets:['5afb9d100a7ef61358a0a4e3']});
 * 
 */

/**
 * Notes
 * - Create a schedule for Hephaestus to move between level 1 factory rooms
 * - Determine a better way to schedule power banks, strongholds, and excavations
 * - Update market prices to change over time
 * - Create better terminal resource management logic tied to room mineral
 * - 
 *
 * - Investigate and determine if more drastic CPU saving is needed...
 * -- Do I have any room searches still happening reguarly?
 * -- 
 */

global.viewDroneCpu = function(jobName) {
  let totalCpu = 0;
  let count = 0;
  const data = {};
  let min = Infinity;
  let max = 0;

  for (const name in Memory.creeps) {
    const creep = Memory.creeps[name];
    const ticks = creep.ticksToLive > 0 ? 1500 - creep.ticksToLive : 1500;

    if (creep.totalCpu && (!jobName || creep.job === jobName)) {
      const avgCpu = creep.totalCpu ? creep.totalCpu / ticks : 0;

      if (avgCpu > 0) {
        totalCpu = totalCpu + avgCpu;
        if (avgCpu < min) min = avgCpu;
        if (avgCpu > max) max = avgCpu;
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

  console.log(`min:${min.toFixed(2)}, max:${max.toFixed(2)}, total:${totalCpu.toFixed(2)}, count:${count}`);
  return totalCpu / count;
}

function globalizeHives() {
  if (!global.hives) global.hives = {};
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    if (!(global.hives[roomName] instanceof Hive) && room.controller && room.controller._my) {
      global.hives[roomName] = new Hive(roomName);
    }
  };
}

// 
function operateCreeps() {

}

// main logic loop
module.exports.loop = function () {
  if (Game.time % 1000 === OK) {
    // clears old creeps from memory
    for (const name in Memory.creeps) {
      const creep = Game.creeps[name];
      if (typeof creep === 'undefined') {
        Memory.creeps[name] = undefined;
      }
    }

    // if (Game.shard.name === 'shard0' || Game.shard.name === 'shard2' && Game.cpu.bucket >= 10000) {
    //   Game.cpu.generatePixel()
    // }
  }

  let totalHiveCpu = Game.cpu.getUsed();
  const lowBucket = Game.cpu.bucket < 4500;
  const shouldReport = !lowBucket && Game.time % 10 === OK;

  if (shouldReport) console.log('*****************************************************************');
  if (global.hives || global.rooms) {
    for (const roomName in global.hives) {
      const hive = global.hives[roomName];

      if (hive instanceof Hive) {
        hive.run();
        if (shouldReport) hive.report();
      }
    }
  } else {
    if (!global.rooms) global.rooms = {};
    globalizeHives();
  }

  if (shouldReport) console.log('----------------------------------------');
  totalHiveCpu = Game.cpu.getUsed() - totalHiveCpu;

  // note: temporarilly disabling power banks while CPU issues and power surplus exist.
  // powerBankService.run();
  // roomSupport.excavationService.run();

  // roomSupport.claimLoot();

  let powerCreepCpu = Game.cpu.getUsed();
  PowerCreep.run();
  // powerCreepCpu = `power-cpu ${(Game.cpu.getUsed() - powerCreepCpu).toFixed(4)}`;
  // console.log(powerCreepCpu);

  let droneCpu = Game.cpu.getUsed();
  Drone.runDrones();
  droneCpu = Game.cpu.getUsed() - droneCpu;

  productionNotifier.run()

  // for (const room in Memory.rooms) {
  //   if (!hasKeys(Memory.rooms[room])) {
  //     Memory.rooms[room] = undefined;
  //     // console.log(room, 'empty Memory', Memory.rooms[room].primarySpawn);
  //   }
  // }

  // let cpu=Game.cpu.getUsed();JSON.stringify(Memory);console.log(Game.cpu.getUsed()-cpu);
  // let cpu=Game.cpu.getUsed();let creepCount=Object.keys(Memory.creeps || {}).length;let roomCount=Object.keys(Memory.rooms || {}).length;console.log('Creeps:',creepCount,'Rooms:',roomCount);console.log('CPU delta:',(Game.cpu.getUsed()-cpu).toFixed(3));

  // const droneCpuReprt = `drone-cpu ${Game.cpu.getUsed() - droneCpu).toFixed(4)}`;
  
  // if (bucket >= BUCKET_LIMIT) {
  //   Game.cpu.generatePixel();
  // }
  // 

  // if (Game.time % 50) {
  //   if (Spawn7 && Spawn7.)
  //   Spawn7.createDrone('sweeper', [...m10c10, ...m10c10], {targetRoom:'W3N53',homeRoom:'W2N53'});
  // }

  // test code
  // if (Game.time % 5 && bucket >= 7000) {
  //   const _routes = Memory._routes;
  //   for (const key in _routes) {
  //     if (_routes[key] && Array.isArray(_routes[key])) {
  //       // console.log('_routes[key]', _routes[key], typeof _routes[key], Array.isArray(_routes[key]));
  //       for (const path of _routes[key]) {
  //         if (path.room === 'E10N54') console.log('huh', key, path.room);
  //       } 
  //     }
  //   }
  // }

  if (Game.cpu.bucket > 2500 || (Game.shard.name === 'shard3' && Game.cpu.bucket < 10000)) {
    const fincpu = Game.cpu.getUsed();
    const bucket = Game.cpu.bucket <= 9900 ? ` B:${Game.cpu.bucket}` : '';
    let cpuReport = 'cpu ' + (fincpu > 20 ? `_${fincpu.toFixed(4)}_` : fincpu.toFixed(4)) + bucket;
    console.log('hive-cpu', totalHiveCpu.toFixed(4), 'drone-cpu', (droneCpu).toFixed(4), cpuReport);
  }
}
