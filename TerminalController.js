const MarketController = require('MarketController');
const TaskController = require('TaskController');

const TERMINAL_TARGET_ENERGY = 10000;

/**
 * global.Syl.terminal.createTransfer('W2N54', 'GH2O', 10000)
 * global.Syl.terminal.createTransfer('W8N53', 'GH2O', 10000)
 *
 * global.Spawn3.terminal.createTransfer('W7N52', 'O', 5000);
 * global.Spawn5.terminal.createTransfer('W7N52', 'U', 30000);
 *
 */

/**
 * The terminal will control the market for a given room
 * The terminal can create buy and sell orders
 * The terminal can request resources from other rooms;
 * 
 */
class TerminalController {
	// static createOrder() - create a market order, requests resources to complete it
	get hive() {
		return global.hives[this.room.name];
	}

	get taskController() {
		return global.hives[this.room.name].taskController;
	}

	constructor(terminal) {
		if (typeof terminal === 'string') terminal = Game.getObjectById(terminal);

		this.terminal = terminal;
		this.room = this.terminal.room;
		this.storage = this.room.storage;
		this.marketController = new MarketController(this.room);

		const mem = Memory.rooms[this.room.name].terminal || {};
		if (!mem.id) mem.id = this.terminal.id
		Memory.rooms[this.room.name].terminal = mem;
	}

	get(key) {
		const mem = this.room.memory['terminal'] || {};
		return mem[key];
	}

	set(key, value) {
		this.room.memory['terminal'][key] = value;
	}

	setRequestedResources(request = {}) {
		if (!request['energy'] || request['energy'] < 10000) {
			request['energy'] = 10000;
		}
		this.set('requestedResources', request);
	}

	getUsedCapacity(resource = RESOURCE_ENERGY) {
		return this.terminal.store.getUsedCapacity();
	}

	transfering(resource) {
    const transfers = this.get('transfers') || {};
		return transfers[resource];
	}

	createTransfer(roomName, resource, amount) {
    const requestedResources = this.get('requestedResources') || {};
    const transfers = this.get('transfers') || {};

	  requestedResources[resource] = amount;
	  transfers[resource] = roomName;

	  this.set('requestedResources', requestedResources);
	  this.set('transfers', transfers);
	}

	sendResource(resource, amount, room) {
    // transfers resources in batches of 5000 or less
    const transferAmount = amount > 5000 ? 5000 : amount;
    if (this.terminal.store[resource] >= transferAmount) {
      return this.terminal.send(resource, transferAmount, room);
    } else {
    	return ERR_NOT_ENOUGH_ENERGY;
    }
	}

	getRequestAmount(resource) {
		const requests = this.get('requests') || {};
		return requests[resource] || 0;
	}

	createRequest(resource, amount) {
		const requests = this.get('requests') || {};
		requests[resource] = requests[resource] ? requests[resource] + amount : amount;
		this.set('requests', requests);
	}

	requestEnergyInjection() {
		// console.log('I NEED ENERGY PLZ');
		const myRoom = this.room.name;
		for (const roomName in global.hives) {
    	const hive = global.hives[roomName];
    	if (hive.terminalController && roomName !== myRoom) {
    		const terminal = hive.terminalController.terminal;
    		if (terminal && terminal.cooldown === OK && terminal.store['energy'] >= 10000) {
    			terminal.send('energy', 5000, myRoom);
    		}
    	}
    }
	}

	manageStore() {
		const drone = this.taskController.getFreeDrone();
  	if (!drone) {
  		this.set('nextManageStore', Game.time + 25);
  		return;
  	}

		const requestedResources = this.get('requestedResources') || { energy: 10000 };
    const resources = requestedResources && Object.keys(requestedResources);
    let tasks = [];

    // const storageHasCap
    Object.keys(this.terminal.store).forEach(resource => {
    	const diff = this.terminal.store.getUsedCapacity(resource) - (requestedResources[resource] || 0);
      if (diff >= 10000) {
      	const task = this.taskController.createTransferTask(resource, this.terminal, this.storage);
      	for (let count = 0; count < 5; count++) {
        	tasks = [...tasks, ...task];
      	}
      } else if (diff >= 1000 || !requestedResources[resource]) {
      	tasks = [...tasks, ...this.taskController.createTransferTask(resource, this.terminal, this.storage)];
      }
    });

    // allowedResources? - if allowed but not requested, keep in store but don't attempt to load.
    resources.forEach(resource => {
      if (requestedResources[resource] > this.terminal.store[resource] && this.storage.store.getUsedCapacity(resource) > 0) {
      	// moving resources from storage to terminal
        tasks = [...tasks, ...this.taskController.createTransferTask(resource, this.storage, this.terminal)];
      }
    });
		
    if (tasks.length) {
    	drone.setTaskQueue(tasks);
      // this.taskController.issueTask(tasks);
    	this.set('nextManageStore', Game.time + 52);
    } else {
    	this.set('nextManageStore', Game.time + 271);
    }
	}

  manageTerminal() {
  	try {
  		const nextManageStore = this.get('nextManageStore') || 0;
	    if (nextManageStore <= Game.time) this.manageStore();

	    this.marketController = new MarketController(this.room);
	    const terminal = this.terminal;
	    const storage = this.storage;
	    const transfers = this.get('transfers');
	    const requestedResources = this.get('requestedResources') || {};

	    // if I have a lot of my rooms resource such as K or K_bar, I should set it as a requestedResource so I can share with other rooms. 
	    // I will always get low of the item, but when does it matter?
	    // - It should only matter if I am getting low on bars, I want to keep a set amount of condensed resources available for manufacturing purposes. 


	    if (terminal.cooldown === OK) {
		    // sells resources as configured
		    if (Game.time % 33 === OK && Game.cpu.bucket > 5500) {
			    for (const resource in this.terminal.store) {
	    			const config = this.marketController.getConfig(resource);
		    		if (config) {
			    		if (config.sellOrderPrice) {
								this.marketController.createSellOrder(resource, 1000);
			    		} else if (config.minPrice) {
			    			this.marketController.sell(resource);
			    		}
		    		}
		    	}
		    }

	    	// pausing transfer code for requests; rooms have been configured to keep extra resources in the terminal
	    	// transfers = { [resource]: spawnName }
		    // transfers && Object.keys(transfers).forEach(resource => {
		    //   const room = transfers && transfers[resource];
		    //   const requestAmount = requestedResources && requestedResources[resource];

		    //   // transfers resources in batches of 5000 or less
		    //   const transferAmount = requestAmount > 5000 ? 5000 : requestAmount;
		    //   if (requestAmount && terminal.store[resource] >= transferAmount) {
		    //     const status = terminal.send(resource, terminal.store[resource], transfers[resource]);
		    //     if (status === OK) {
		    //       requestedResources[resource] = requestedResources[resource] - transferAmount;
		    //       if (requestedResources[resource] >= 0) {
		    //       	requestedResources[resource] = undefined;
			  //         transfers[resource] = undefined;

		    // 				this.set('requestedResources', requestedResources);
		    // 				this.set('transfers', transfers);
		    //       }
		    //     }
		    //   }
		    // });

	    	// handle requests for resources
	    	const terminalEnergy = this.terminal.store.getUsedCapacity('energy');
	    	const nextRequestCheck = this.get('nextRequestCheck') || 0;
		    if (nextRequestCheck <= Game.time && terminalEnergy >= 8000) {
		    	const storedEnergy = storage.store.getUsedCapacity('energy');

		    	for (const roomName in global.hives) {
			    	const hive = global.hives[roomName];
			    	const room = Game.rooms[roomName];

			    	// skips self
			    	if (hive.terminalController && room.name !== this.room.name) {
			    		const otherRoomTerminalMemory = Memory.rooms[roomName].terminal;
			    		const requests = hive.terminalController.get('requests'); // Memory.rooms[roomName].terminal.requests;

			    		requests && Object.keys(requests).forEach(resource => {
			    			if (room.resourceAmount(resource) < requests[resource]) {
			    				if (this.terminal.store[resource] > 0) {
				    				const transferAmount = this.terminal.store[resource] > 5000 ? 5000 : this.terminal.store[resource];
				    				const status = this.sendResource(resource, transferAmount, roomName);
				    				if (status === OK) this.set('nextRequestCheck', Game.time + 52);
			    				}
			    				// note: shareables could be resources that are allowed to be moved outside of their terminal storage status
			    				// ['H', 'K', 'O'] // no bars or other smaller things.. ops? power?
			    				// stopped trying to fill requests the terminal is not prepared to fill based on configuration.
				    			// 	const amount = this.storage.store.getUsedCapacity(resource) > requests[resource] ? requests[resource] : this.storage.store.getUsedCapacity(resource);
					    		// 	if (!this.transfering(resource) && amount > 0) {
					    		// 		this.createTransfer(roomName, resource, amount);
					    		// 	}
			    			}
			    		});

			    		/** energy management */
			    		// what if I set a higher threshold for certain rooms that should be more stable to share more often.
			    		// if (room.storage <= 150000 && storedEnergy >= 225000 && terminalEnergy >= 25000) {

			    		const hasHighEnergy = storedEnergy >= 200000 && terminalEnergy >= 25000;
							const adjustedRequestedEnergy = (otherRoomTerminalMemory.requestedResources || {}).energy + 10000;
							const roomEnergy = room.storage.store['energy'] + room.terminal.store['energy'];
			    		if (hasHighEnergy && room.storage.store['energy'] <= 250000 && room.terminal.store['energy'] <= adjustedRequestedEnergy) {
			    			const status = this.sendResource('energy', 15000, roomName);
			    			if (status === OK) this.set('nextRequestCheck', Game.time + 73);
			    		}
			    	}
			    }
		    }
		  }
  	} catch (e) {
  		console.log(this.room.name, 'terminal-crash', e.toString());
  		// throw (e);
  	}
  }

  init(terminal) {
  	this.terminal = terminal;
		this.room = this.terminal.room;
		this.storage = this.room.storage;
  }

	run () {
		try {
			// this.marketController.createBuyOrder('U', 10000);
		} catch (e) {
			console.log(this.room.name,'terminal-goof', e.toString());
		}
	}
}

module.exports = TerminalController;
