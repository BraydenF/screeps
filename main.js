const config = require('config');
const utils = require('utils');
const Hive = require('Hive');
const Drone = require('Drone.class');
const GameMap = require('GameMap');
const MarketController = require('MarketController');
const PowerCreep = require('PowerCreep');
const profiler = require('cpuProfiler');
const productionNotifier = require('productionNotifier');

global.Hive = Hive;
global.Drone = Drone;
global.grc = countResource;
global.profiler = profiler;

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
  if (Game.time % reportTime === OK) console.log('*****************************************************************');

  PowerCreep.run();
  let droneCpu = Game.cpu.getUsed();
  Drone.globalizeDrones();
  if (global.drones && Game.cpu.bucket > 35) {
    Drone.runDrones(global.drones);
  }
  droneCpu = Game.cpu.getUsed() - droneCpu;

  const totalData = { energy: 0, battery: 0 };
  let totalHiveCpu = Game.cpu.getUsed();

  if (global.hives) {
    for (const roomName of Object.keys(global.hives)) {
      const hive = global.hives[roomName];

      if (hive instanceof Hive) {
        const data = hive.run();
        // profiler.profile(roomName, () => hive.run());

        // if (data) {
        //   totalData.energy = totalData.energy + data.energy;
        //   totalData.battery = totalData.battery + data.battery;
        // }

        if (Game.time % reportTime === OK) hive.report();
      }
    }

    Memory.data = totalData;
  } else {
    global.hives = {};
  }
  totalHiveCpu = Game.cpu.getUsed() - totalHiveCpu;

  // some init and cleanup code has been placed behind a CPU wall!
  if (Game.cpu.getUsed() < 20 && Game.cpu.bucket > 100) {
    for (const roomName of Object.keys(Game.rooms)) {
      const room = Game.rooms[roomName];
      if (!(global.hives[roomName] instanceof Hive) && room.controller && room.controller._my) {
        global.hives[roomName] = new Hive(roomName);
      }
    }

    if (Game.time % 10000 === OK) {
      // clears old creeps from memory
      Object.keys(Memory.creeps).forEach(name => {
        const creep = Game.creeps[name];
        if (typeof creep === 'undefined') Memory.creeps[name] = undefined;
      });
    }

    // const orderIds = Object.keys(Game.market.orders);
    // orderIds.forEach(id => {
    //   const order = Game.market.getOrderById(id);
    //   if (order && !order.active) {
    //     Game.market.cancelOrder(order.id);
    //   }
    // });

    /**
     * pathing test work
     */
    try {
      if (false && Game.time % 2 === OK) {
        const posA = Game.getObjectById('68769493123fb864f956eb85');
        const posB = Game.getObjectById('5bbcb7a91e7d3f3cbe250913');
        const flag = Game.flags['deposit-plan'];

        // console.log(posA, flag, flag);      
        if (posA && flag) {
          Game.map.visual.line(posA.pos, flag.pos, { color: '#ff0000', lineStyle: 'dashed' });
          if (Game.map.visual.getSize() >= 1024000) console.log('clearing', Game.map.visual.clear());
          // console.log('Game.map.visual.getSize()', Game.map.visual.getSize());

          let path = Memory._beta['path-test'];
          if (!path) {
            const res = PathFinder.search(posA.pos, { pos: flag.pos }, { plainCost: 1, swampCost: 2 });
            if (res.path) Memory._beta['path-test'] = res.path;
          } else {
            let count = 0;
            path.forEach(pos => {
              pos = new RoomPosition(pos.x, pos.y, pos.roomName);
              if (pos) {
                if (count <= 5) {
                  Game.map.visual.text("Target💥", pos, { color: '#FF0000', fontSize: 10 });
                  // let visual = Game.map.visual.circle(pos, { radius: 10, stroke: '#ff0000' });
                  // console.log('vis', pos, visual);
                  count++;
                }
              }
            });

            // console.log(Game.map.visual.export());
          }

          // PathFinder.search(posA.pos, { pos: flag.pos }, { plainCost: 1, swampCost: 2 }).path.forEach(pos => {
          //   // console.log(pos);
          //   if (Game.map.visual.getSize() >= 1024000) {
          //     // console.log(Game.map.visual.text("💥", pos, { color: '#FF0000', fontSize: 10 }));
          //   } else console.log('FULL');
          //   // console.log(Game.map.visual.circle(pos, { fill: 'transparent', radius: 50, stroke: '#ff0000' }));

          // // //   // room.createConstructionSite(pos, STRUCTURE_ROAD);
          // });
          // const path = GameMap.findRoute(posA.pos.roomName, flag.pos.roomName);
          // console.log('path', path);
        }
      }
    } catch (e) {
      console.log('path-test-oops', e.toString());
    }
  }

  productionNotifier.run()

  const fincpu = Game.cpu.getUsed();
  // const droneCpuReprt = `drone-cpu ${Game.cpu.getUsed() - droneCpu).toFixed(4)}`;
  // console.log('hive-cpu', totalHiveCpu.toFixed(4), 'drone-cpu', (droneCpu).toFixed(4), 'cpu', fincpu > 20 ? `<b>${fincpu.toFixed(4)}</b>` : fincpu.toFixed(4), Game.cpu.bucket <= 9900 ? `B:${Game.cpu.bucket}` : '');
}
