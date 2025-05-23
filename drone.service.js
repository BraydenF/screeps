const Drone = require('Drone.class');
const config = require('config');

const OUTFITS = {
  BASE_PARTS: [WORK, CARRY, CARRY, MOVE, MOVE], // 300
  SCOUT: [MOVE], // 50
  MINER: [MOVE, WORK, WORK], // 250
  UPGRADER: [WORK, WORK, CARRY, MOVE], // 300
  HAULER: [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY], // 300
  SOLDIER: [ATTACK, ATTACK, MOVE, MOVE], // 260
  FLAGBEARER: [CLAIM, MOVE], // 650
}

/**
 * 
 * { work: 5, move: 2, carry: 0, cost: 600 }
 * { work: 5, move: 3, carry: 3, cost: 800 }
 * { work: 10, move: 6, carry: 6, cost: 1600 }
 */

const PART_PRIORITY = [TOUGH, WORK, ATTACK, CARRY, MOVE, RANGED_ATTACK, HEAL, CLAIM]

function orderParts(reciept) {
  const parts = [];
  PART_PRIORITY.forEach((part) => {
    for (let x = 0; x <= reciept[part]; x++) {
      parts.push(part);
    }
  });
  return parts;
}

function getPartsArray(cart) {
  const parts = [];
  const keys = Object.keys(cart).forEach(part => {
    console.log(part, cart[part]);

  });

  return parts;
}

/**
 * todo: update the logic to use the reciept to track the parts until the array is built based on part priority order.
 */
function buyParts(budget, job) {
  const isStandardJob = job === 'drone';
  let remainingBudget = budget;
  const reciept = { work: 0, carry: 0, move: 0, parts: [], cost: 0 };

  if (job === 'scout' && remainingBudget > 500) {
    reciept.parts = OUTFITS.SCOUT;
    remainingBudget = remainingBudget - 50;
  }
  else if (job === 'flagbearer') {
    reciept.parts = OUTFITS.FLAGBEARER;
    remainingBudget = remainingBudget - 650;
  }
  else if (job === 'miner' && remainingBudget >= 250) {
    reciept.parts = OUTFITS.MINER;
    remainingBudget = remainingBudget - 250;

    while (remainingBudget >= 100 && reciept.work <= 7) {
      reciept.work++;
      reciept.parts.push(WORK);
      remainingBudget = remainingBudget - 100;
    }

    if (remainingBudget >= 50) {
      reciept.move++;
      reciept.parts.push(MOVE);
      remainingBudget = remainingBudget - 50;
    }

    while(remainingBudget >= 100) {
      reciept.carry++;
      reciept.move++;

      reciept.parts.push(CARRY);
      reciept.parts.push(MOVE);

      remainingBudget = remainingBudget - 100;
    }
  }
  else if (job === 'upgrader' && remainingBudget >= 300) {
    reciept.parts = OUTFITS.UPGRADER;
    remainingBudget = remainingBudget - 300;

    while (remainingBudget >= 100 && reciept.parts.length <= 7) {
      reciept.work++;
      reciept.parts.push(WORK);
      remainingBudget = remainingBudget - 100;
    }

    if (remainingBudget >= 50) {
      reciept.move++;
      reciept.parts.push(MOVE);
      remainingBudget = remainingBudget - 50;
    }

    if (remainingBudget >= 50) {
      reciept.carry++;
      reciept.parts.push(CARRY);
      remainingBudget = remainingBudget - 50;
    }
  }
  else if (job === 'hauler' && remainingBudget >= 300) {
    reciept.parts = OUTFITS.HAULER;
    remainingBudget = remainingBudget - 300;

    console.log('remainingBudget', remainingBudget);
    while(remainingBudget >= 100) {
      reciept.carry++;
      reciept.move++;

      reciept.parts.push(CARRY);
      reciept.parts.push(MOVE);

    console.log('remainingBudget', remainingBudget);
      remainingBudget = remainingBudget - 100;
    }

    if (remainingBudget >= 50) {
      reciept.move++;
      reciept.parts.push(MOVE);
      remainingBudget = remainingBudget - 50;
    }
  } else if (job === 'soldier') {
    reciept.parts = OUTFITS.SOLDIER;
    remainingBudget = remainingBudget - 260;
  }
  else if (isStandardJob && remainingBudget >= 300) {
    const baseSetCost = 300;
    const baseSet = { workMultiplier: 1, carryMultiplier: 2, moveMultiplier: 2 } // cost: 300
    const baseSetsCount = Math.floor(remainingBudget / baseSetCost);

    reciept.work = baseSetsCount * baseSet.workMultiplier;
    reciept.carry = baseSetsCount * baseSet.carryMultiplier;
    reciept.move = baseSetsCount * baseSet.moveMultiplier;

    for (let i = 0; i < baseSetsCount; i++) {
      for (let j = 0; j < OUTFITS.BASE_PARTS.length; j++) {
        reciept.parts.push(OUTFITS.BASE_PARTS[j]);
      }
    }

    remainingBudget = remainingBudget - (baseSetsCount * baseSetCost);

    // double productivity first
    if (remainingBudget >= 100) {
      reciept.work = 1;
      reciept.parts.push(WORK);
      remainingBudget = remainingBudget - 100;
    }

    while(remainingBudget >= 100) {
      reciept.carry++;
      reciept.move++;

      reciept.parts.push(CARRY);
      reciept.parts.push(MOVE);

      remainingBudget = remainingBudget - 100;
    }

    if (remainingBudget >= 50) {
      reciept.move++;
      reciept.parts.push(MOVE);
      remainingBudget = remainingBudget - 50;
    }
  }

  reciept.cost = budget - remainingBudget;
  return reciept;
}

const droneService = {
  createDroneFactory: function(spawn) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];

    return function(job = 'drone', budget = 300) {
      const name = `${job}-${Game.time}-chan`;
      let reciept = {};
      if (typeof budget === 'number') reciept = buyParts(budget, job);
      else if (Array.isArray(budget)) reciept = { parts: budget };

      // reciept.parts = [MOVE];
      let status = spawn.spawnCreep(reciept.parts, name, { dryRun: true });
      console.log(reciept.cost, reciept.parts.toString(), status);

      if (status === OK) {
        status = spawn.createCreep(reciept.parts, name, { role: 'drone', job: job });
        console.log(`<b>Building Drone:</b> ${job}:${budget}`);
        console.log('Parts:', reciept.parts);
      }

      return { status: status, name: status === OK ? name : null };
    }
  },
  createDrone: function(job = 'drone', budget = 300, memory = {}) {
    const spawn = Game.spawns[true ? 'Spawn1' : 'Spawn2'];
    const name = `${job}-${Game.time}-chan`;
    const reciept = buyParts(budget, job);

    // reciept.parts = [MOVE];
    let status = spawn.spawnCreep(reciept.parts, name, { dryRun: true });
    console.log(reciept.cost, reciept.parts.toString(), status);

    if (status === OK) {
      status = spawn.createCreep(reciept.parts, name, { role: 'drone', job: job, ...memory });
      console.log(`<b>Building drone:</b> ${job}:${budget}`);
      console.log(reciept.parts);
    }
    return { status: status, name: status === OK ? name : null };
  },
};

module.exports = droneService;
