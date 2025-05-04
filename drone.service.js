const Drone = require('Drone.class');
const config = require('config');

const OUTFITS = {
  BASE_PARTS: [WORK, CARRY, CARRY, MOVE, MOVE],
  SCOUT: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
  MINER: [MOVE, WORK, WORK],
  HAULER: [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY],
}

function buyParts(budget, job) {
    const isStandardJob = job === 'harvester' || job === 'upgrader' || job === 'builder';
    let remainingBudget = budget;
    const reciept = { work: 0, carry: 0, move: 0, parts: [], cost: 0 };

    if (job === 'scout' && remainingBudget > 500) {
        reciept.parts = OUTFITS.SCOUT;
        // reciept.cost = 500;
    }
    else if (job === 'miner' && remainingBudget >= 250) {
        /**
         * todo: Miner
         * - The miner should have no more than 5 work parts
         * - Must be able to move, one move probably
         * - Does not need a carry if going to the ground. Would need for moving to a container.
         * - 
         */
        reciept.parts = OUTFITS.MINER;
        remainingBudget = remainingBudget - 250;

        while(remainingBudget >= 100 && reciept.parts.length <= 5) {
            reciept.work++;
            reciept.parts.push(WORK);
            remainingBudget = remainingBudget - 100;
        }
    }
    else if (job === 'hauler' && remainingBudget >= 300) {
        reciept.parts = OUTFITS.HAULER;
        remainingBudget = remainingBudget - 300;

        while(remainingBudget >= 100) {
            reciept.carry++;
            reciept.move++;

            reciept.parts.push(CARRY);
            reciept.parts.push(MOVE);

            remainingBudget = remainingBudget - 100;
        }

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
        reciept.carry++;
        reciept.parts.push(CARRY);
        remainingBudget = remainingBudget - 50;
      }
    }

    reciept.cost = budget - remainingBudget;
    return reciept;
}

const droneService = {
  Drone: Drone,
  buyParts: buyParts,
  createDrone: function(job = 'harvester', budget = 300) {
    const name = `${job}-${Game.time}-chan`;
    const reciept = buyParts(budget, job);

    // reciept.parts = [MOVE, WORK, WORK, WORK, WORK, CARRY];
    let status = Game.spawns[config.INITIAL_SPAWN].spawnCreep(reciept.parts, name, { dryRun: true });
    console.log(reciept.cost, reciept.parts.toString(), status);

    if (status === 0) {
      status = Game.spawns[config.INITIAL_SPAWN].createCreep(reciept.parts, name, { role: 'drone', job: job });
      console.log(`<b>Building drone:</b> ${job}:${budget}`);
      console.log(reciept.parts);
    }
    return { status: status, name: status == 0 ? name : null };
  },
  getDrones: function(job) {
      const drones = [];
      for(const name in Game.creeps) {
        const creep = Game.creeps[name];

        if (creep.memory.role === 'drone') {
          if (job) { // only displays drones of job
            if (creep.memory.job === job) {
                drones.push(new Drone(creep));
            }
          } else { // displays all drones
            drones.push(new Drone(creep));
          }
        }
      }

      return drones;
  },
  run: function() {
    // console.log('getDrones', droneService.getDrones());
    // droneService.createDrone();
    // droneService.createDrone('upgrader');

    droneService.getDrones().forEach(drone => {
      try {
        drone.run();
      } catch (e) {
        console.log(drone.name, ':', e);
      }
    });
  }
};

module.exports = droneService;
