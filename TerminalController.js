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
	get taskController() {
		return this.hive.taskController;
	}

	constructor(terminal) {
		if (typeof terminal === 'string') terminal = Game.getObjectById(terminal);

		this.terminal = terminal;
		this.room = this.terminal.room;
		this.storage = this.room.storage;
		this.hive = global.hives[this.room.name];
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

	manageStore() {
		const requestedResources = this.get('requestedResources') || { energy: 10000 };
    const resources = requestedResources && Object.keys(requestedResources);

    let loadTask = [];
    let unloadTask = [];

    Object.keys(this.terminal.store).forEach(resource => {
      if (typeof requestedResources[resource] === 'undefined' || this.terminal.store.getUsedCapacity(resource) >= requestedResources[resource] + 1000) {
        unloadTask = [...unloadTask, ...this.taskController.createTransferTask(resource, this.terminal, this.storage)];
      }
    });

    resources.forEach(resource => {
      if (requestedResources[resource] > this.terminal.store[resource] && this.storage.store.getUsedCapacity(resource) > 0) {
        loadTask = [...loadTask, ...this.taskController.createTransferTask(resource, this.storage, this.terminal)];
      }
    });

    if (loadTask.length || unloadTask.length) {
      this.taskController.issueTask([...loadTask, ...unloadTask]);
    }
	}

  manageTerminal() {
  	try {
	    if (Game.time % 50 === 0) this.manageStore();

	    const terminal = this.terminal;
	    const storage = this.storage;
	    const transfers = this.get('transfers');
	    // const requests = this.get('requests');
	    const requestedResources = this.get('requestedResources') || {};

	    // leaking batteries and reductant
	    Object.keys(this.terminal.store).forEach(resource => {
		    if (this.terminal.store[resource] >= 1000) {
	  			this.marketController.createSellOrder(resource, 1000);
		    }
    	});

	    if (terminal.cooldown === OK) {
	    	// transfers = { [resource]: spawnName }
		    transfers && Object.keys(transfers).forEach(resource => {
		      const room = transfers && transfers[resource];
		      const requestAmount = requestedResources && requestedResources[resource];

		      // transfers resources in batches of 5000 or less
		      const transferAmount = requestAmount > 5000 ? 5000 : requestAmount;
		      if (requestAmount && terminal.store[resource] >= transferAmount) {
		        const status = terminal.send(resource, terminal.store[resource], transfers[resource]);
		        if (status === OK) {
		          requestedResources[resource] = requestedResources[resource] - transferAmount;
		          if (requestedResources[resource] >= 0) {
		          	requestedResources[resource] = undefined;
			          transfers[resource] = undefined;
		          }
		        }
		      }
		    });

		    // sell commodities to the npc market
		    if (Game.time % 33 === OK) ['concentrate', 'switch'].forEach(commodity => {
		    	if (this.terminal.store[commodity] >= 0) {
		    		this.marketController.sell(commodity);
		    	}
		    });

		    // sell excess resources
	    	Object.keys(this.terminal.store).forEach(resource => {
    			const config = this.marketController.getConfig(resource);
	    		if (config && config.sellPrice) {
		    		// this.marketController.sell(resource);
	    			this.marketController.createSellOrder(resource, 1000);
	    		}
	    	});

	    	// handle requests for resources
		    if (Game.time % 15 === OK) Object.keys(Memory.rooms).forEach(roomName => {
		    	const room = Game.rooms[roomName];
		    	if (room && room.terminal && room.terminal.my && Memory.rooms[roomName] && Memory.rooms[roomName].terminal && room.name !== this.room.name) {
		    		const requests = Memory.rooms[roomName].terminal.requests;
		    		requests && Object.keys(requests).forEach(resource => {
		    			if (resource === 'energy' && this.storage.store.getUsedCapacity('energy') >= 55000 && this.terminal.store.getUsedCapacity('energy') >= 10000) {
		    				// if its an energy request, just fill it.
		    				const status = this.sendResource(resource, 5000, roomName);
		    				if (status === OK) {
		    					Memory.rooms[roomName].terminal.requests[resource] = requests[resource] - 5000;
		    					if (Memory.rooms[roomName].terminal.requests[resource] <= 0) {
		    						Memory.rooms[roomName].terminal.requests[resource] = undefined;
		    					}
		    				}
		    			} else {
			    			// what about how much resource they have already??
			    			const amount = this.storage.store.getUsedCapacity(resource) > requests[resource] ? requests[resource] : this.storage.store.getUsedCapacity(resource);
			    			if (!this.transfering(resource) && amount > 0 && room.storage.store.getUsedCapacity(resource) < requests[resource]) {
			    				this.createTransfer(roomName, resource, amount);
			    				// requests are filled when possible, with no limit
			    			}
		    			}
		    		});
		    	}
		    });

		    this.set('transfers', transfers);
		    this.set('requestedResources', requestedResources);
		  }
  	} catch (e) {
  		console.log(this.room.name, 'terminal-crash', e.toString());
  		throw (e);
  	}
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
