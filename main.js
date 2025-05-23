const config = require('config');
const utils = require('utils');
const creepService = require('creep.service');
const Hive = require('Hive');
const Drone = require('Drone.class');
const droneService = require('drone.service');

global.Hive = Hive;
global.Drone = Drone;

/**
 * todo:
 * - create offensive creeps / automate defenses. 
 * - Re organize the code, things are cluttered.
 */
const consoleService = {
  init: function() {
  	// console commands
    global.creepService = creepService;

    // global.spawn = function(job, budget) {
    //   spawnQueue.pushJob({ job, budget });
    // }

    // short cuts
    // global.createDrone = spawnController.createDrone;
    global.createDrone = droneService.createDrone;
  },
  run: function() {
  	consoleService.init();
  	if (Game.time % 5 === 0) {
      console.log('*****************************************************************');
      console.log('*****************************************************************');
      _.map(Game.spawns, (spawn) => {
        console.log(`<b>${spawn.name}'s energy:</b> ${spawn.room.energyAvailable} / ${spawn.room.energyCapacityAvailable}`);
        console.log(`<b>Drone Count: ${Hive.getCreeps(spawn).length}`);
        console.log(`<b>Lab Report: ${Hive.labReport(spawn)}`);
        // spawnController.spawnQueue.report();
        console.log('*****************************************************************');
      });
  	}
  }
}

// main logic loop
module.exports.loop = function () {
  consoleService.run();

  // todo: multi room loop will soon be needed
  for (var room_it in Game.rooms) {
    const spawn = Game.rooms[room_it].find(FIND_MY_SPAWNS)[0];
    if (spawn) {
      const hive = new Hive(spawn.name);
      hive.run();
    }
  }

  Drone.getDrones().forEach(drone => drone.run());
  creepService.run();

  const myRoom = 'W7N52';

  const orderId = '682fd8c1f9846cd5111cdca2';
  const order = Game.market.getOrderById(orderId);
  const amount = 1000;

  // console.log('transactioncost', Game.market.calcTransactionCost(1000, myRoom, 'E47N51'));
  const buyingEnergy = false;
  if (Game.time % 10 === 0 && buyingEnergy) {
    // energy sell orders
    Game.market.getAllOrders({ type: ORDER_SELL, resourceType: RESOURCE_ENERGY}).forEach(order => {
      const maxPrice = 2.5; // lookup price
      if (order.roomName.includes('N') && order.price < maxPrice) {
        // check the distance or that it is in the same region somehow.
        if (order.price < 2.5) {
          const maxBudget = 5000;
          const ceil = 2500;
          // (order.remainingAmount * price)
          const amount = Math.floor(maxBudget / order.price);
          // Game.market.deal(order.id, amount, 'W7N52');
          console.log('Order Complete', order.id, amount, order.resourceType, order.price);
        }
      }
    });
    // console.log('northernEnergyOrders', localEnergyOrders.length);
    // 
    // Game.market.getAllOrders({ type: ORDER_BUY, resourceType: 'H'}).forEach(order => {
    //   if (order.price >= 137) {
    //     // console.log('Hydrogen Order');
    //     // Game.market.deal(order.id, amount, 'W7N52');
    //   }
    // });
  }


  if (order) {
    const energyCost = Game.market.calcTransactionCost(amount, myRoom, order.roomName);
    console.log('ID:', orderId, 'room', order.roomName);
    console.log('Energy:', energyCost);
    console.log('Credits:', amount * order.price);

    // I should look at the marker for orders for energy near me. I wouldn't mind auto buying anything for less than like 3.
  }
  /**
    * Market notes
    * 
    * H
    * 682fae3e70d16c0012dd6133 // 183.042 - 14,500
    * O
    * 68139fc270d16c00129ceb51 - 24.269
    * 
    * EXAMPLE - Game.market.deal('682fd8c1f9846cd5111cdca2', 1195, 'W7N52');
    * 
    *  ZH
    *  Game.market.deal('682b145d70d16c00122bf96c', 2000, 'W7N52'); // cost 19.333
    *  Game.market.deal('680d8e6f70d16c00125df622', 1840, 'W7N52'); // cost 19.333
    *  Currently profiting 80.000 - 90.000 credits per unit here.
    *
    * GO 
    * Game.market.deal('681617aa70d16c00128359e8', 2000, 'W7N52'); // cost 109.847
    * Game.market.deal('6813ce6270d16c0012ae2136', 51661, 'W7N52'); // cost 110.000 Next highest 335.531
    * G buy orders for (51,661 * 121.412)
    * I can profit ~11.400 credits each
    * Sell orders start at 515, I could still potentially make good profit margins, or save a ton on getting my own G.
    * 
    * Energy
    * 
    * Game.market.deal('682f9cd970d16c0012d6e5d9', 450, 'W7N52'); // 1.898
    * Game.market.deal('68191db770d16c00129fbf86', 51661, 'W7N52');
    *
    * let bar = Game.market.calcTransactionCost(1500, 'W7N52', 'E56N48');
    */
  
}
