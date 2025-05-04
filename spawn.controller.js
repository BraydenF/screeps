const Drone = require('Drone.class');
const { JOBS, MODES, INITIAL_SPAWN, DRONE_LIMIT, SPAWN_MODES, MINERS_ENABLED } = require('config');
const droneService = require('drone.service');

const { INITAL_SPAWN_MODE, MAINTENANCE_MODE } = SPAWN_MODES;

/**
 * todo: the idea of predefined queue existing for certain states. 
 * Could create a 'initial' spawn queue [H,H,H,U,B...]
 * Could create defensive or offensive spawn protocols
 * push to the queue in batches to ensure proper rate of jobs
 * push 2 builder to queue when a building is found (need better trigger)
 */
const spawnQueue = {
    _save: function(queue) {
        const spawn = Game.spawns[INITIAL_SPAWN];
        return spawn.memory.queue = queue;
    },
    getQueue: function() {
        const spawn = Memory.spawns[INITIAL_SPAWN];
        return typeof spawn.queue !== 'undefined' ? spawn.queue : [];
    },
    pushJob: function(job) {
        if (typeof job.job === 'string' && typeof job.budget === 'number' && job.budget >= 300) {
            const queue = spawnQueue.getQueue();
            queue.push(job);
            spawnQueue._save(queue);
        }
    },
    report: function(spawn = INITIAL_SPAWN) {
        const queue = spawnQueue.getQueue();
        if (queue.length) {
            let message = 'Queue: ';
            queue.forEach(j => {
               message += `[${j.job}:${j.budget}],`;
            });
            console.log(message);

            const nextInLine = spawnQueue.getQueue()[0];
            console.log(`Next in Queue: [${nextInLine.job}:${nextInLine.budget}]`);
        }
    },
    run: function() {
        const room = Game.spawns[INITIAL_SPAWN].room;
        const queue = spawnQueue.getQueue();

        if (queue.length && queue[0].budget <= room.energyAvailable) {
            const { job, budget } = queue[0];
            console.log(`Queue Spawning; [${job}:${budget}]`);
            droneService.createDrone(job, budget);
            queue.shift();
        }

        spawnQueue._save();
    },
};

const spawnController = {
    createDrone: function(job = 'harvester', budget = 300) {
        const reciept = droneService.buyParts(budget, job);
        console.log(`<b>Building drone:</b> ${job}:${budget}` );
        console.log(reciept.parts);
        return spawnQueue.pushJob({ job, budget });
    },
    lowDroneCount: function() {
        // todo: update spawn function to use the spawn queue system.
        if (room.energyAvailable >= 300) {
            const res = droneService.createDrone('upgrader', 300);
            console.log(res);
        }
    },
    // todo: this should be relocated to a service.
    getDrones: function(job) {
        const drones = [];
        for(const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.role === 'drone') {
                if (job) { // only displays drones of job
                    if (creep.memory.job === job) {
                        drones.push(new Drone(creep));
                    }
                } else {
                    drones.push(new Drone(creep));
                }
            }
        }
        return drones;
    },
    manageQueue: function() {
        if (typeof spawnMode === 'undefined' || spawnMode === INITAL_SPAWN_MODE) {
            // force loads the queue for intial spawn
            spawnQueue._save([
                { job: JOBS.HARVESTER, budget: 300 },
                { job: JOBS.UPGRADER, budget: 300 },
                { job: JOBS.UPGRADER, budget: 300 },
            ]);
            spawnMode = MAINTENANCE_MODE;
        } else if (spawnMode === MAINTENANCE_MODE) {
            if (!drones.length) {
                spawnMode = INTIAL_SPAWN_MODE;
            } else {
                let newJob;
                if (spawnQueue.getQueue().length <= 0) {
                    const roomAtMaxEnergy = room.energyAvailable >= room.energyCapacityAvailable && room.energyAvailable >= 300;

                    if (room.energyAvailable >= 300 && roomAtMaxEnergy) {
                        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
                        const harvesterCount = creeps.reduce((acc, c) => c.memory.job === 'harvester' ? ++acc : acc, 0);
                        const upgraderCount = creeps.reduce((acc, c) => c.memory.job === 'upgrader' ? ++acc : acc, 0);
                        const builderCount = creeps.reduce((acc, c) => c.memory.job === 'builder' ? ++acc : acc, 0);
                        const minerCount = creeps.reduce((acc, c) => c.memory.job === 'miner' ? ++acc : acc, 0);
                        const sources = room.find(FIND_SOURCES);

                        // handle spawning of miner system units
                        if (!newJob && minerCount < sources.length && minerCouunt <= 2) {
                            newJob = { job: JOBS.MINER, budget: room.energyAvailable };
                        } else if (!newJob && harvesterCount < 1 && !minerCount) {
                            newJob = { job: JOBS.HARVESTER, budget: room.energyAvailable };   
                        } else if (!newJob && builderCount <= 1 && constructionSites.length) {
                            newJob = { job: JOBS.BUILDER, budget: room.energyAvailable };
                        } else if (!newJob && upgraderCount < 3) {
                            newJob = { job: JOBS.UPGRADER, budget: room.energyAvailable };
                        }
                    }
                }
    
                if (newJob) {
                    console.log('newJob', newJob);
                    spawnQueue.pushJob(newJob);
                }
            }
        }
        spawnQueue.run();
    },
    run: function() {
        const room = Game.spawns[INITIAL_SPAWN].room;
        const drones = spawnController.getDrones();
        let spawnMode = room.memory.spawnMode;

        // console.log(drones);

        const creeps = [];
        // Object.keys(Game.creeps).forEach(key => {
        //     console.log(key, Game.creeps);
        //     creeps.push(Game.creeps[key]);
        // });

        room.memory.spawnMode = spawnMode;
    }
};

spawnController.spawnQueue = spawnQueue;
module.exports = spawnController;
module.exports.spawnQueue = spawnQueue;
