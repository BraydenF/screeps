/**
  * Market notes
  *  
  * Game.market.deal('68e7fe77ca40275ec3be8a78', 50, 'W8N53')
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
  *
  *	Buy Orders
  *	Game.market.createOrder();
  * UO - { type: ORDER_BUY, resourceType: 'UO', price: 5, totalAmount: 10000, roomName: 'W7N52' }
  * LO - { type: ORDER_BUY, resourceType: 'LO', price: 85, totalAmount: 10000, roomName: 'W7N52' }
  * U - { type: ORDER_BUY, resourceType: 'U', price: 23.500, totalAmount: 10000, roomName: 'W7N52' }
  * GO - { type: ORDER_BUY, resourceType: 'GO', price: 55, totalAmount: 10000, roomName: 'W2N54' }
  * 
  * O - { type: ORDER_BUY, resourceType: 'O', price: 16.5, totalAmount: 10000, roomName: 'E7N51' }
  * oxidant - { type: ORDER_BUY, resourceType: 'oxidant', price: 99.13, totalAmount: 10000, roomName: 'E7N51' }
  * Z - { type: ORDER_BUY, resourceType: 'Z', price: 2.625, totalAmount: 10000, roomName: 'W8N53' }
  * UL - { type: ORDER_BUY, resourceType: 'UL', price: 85, totalAmount: 10000, roomName: 'W8N53' }
  * G - { type: ORDER_BUY, resourceType: 'G', price: 200, totalAmount: 10000, roomName: 'W2N54' }
  * 
  * 
  * Game.market.createOrder({ type: ORDER_SELL, resourceType: 'resource', price: price, totalAmount: amount, roomName: 'room' })
  *    
  */
 
 // Sell wire when we have enough and global power level is 0
 // - will stop selling once we can continue to manufacture further.
const marketConfig = {
  concentrate: { minPrice: 300000 },
  switch: { minPrice: 100000 },
  battery: { minPrice: 155.009, maxPrice: 200, minStock: 100000, sellOrderPrice: 181.275 }, // 154
  utrium_bar: { minStock: 100000, sellOrderPrice: 390.553 },
  lemergium_bar: { minStock: 65000, sellOrderPrice: 889.553 },
 	// U: { minPrice: 5, maxPrice: 28.625 },
 	// keanium_bar: { minPrice: 180, maxPrice: 250 },
 	// wire: { minPrice: 7000, maxPrice: 10000 },
  // condensate: { minPrice: 25000, maxPrice: 27000 },
  reductant: { minPrice: 450.250, maxPrice: 460, minStock: 100000, sellOrderPrice: 455.735 },
}

class MarketController {
  static createSellOrder(roomName, resource, amount, price) {
  	// - stores sell order data in memory
  	// - creates a transfer order for the terminal
  	// - creates sell order once complete
  	// - clears memory
    const room = Game.rooms[roomName];
    if (room && room.terminal.my) {
      room.storage
      if (terminal.store < amount) {
        // this.createTransfer - instantiate an instance of TerminalController and use it to create the transfer
        // create a note in memory to finish the creation of the order
        // pendingOrder = { }
      }

      return Game.market.createOrder({
        type: ORDER_SELL,
        resourceType: resource,
        price: price,
        totalAmount: amount,
        roomName: roomName   
      });
    }

    return -1;
  }

	static scan() {
		const buying = false;
  		if (Game.time % 10 === 0 && buying) {
	    // energy sell orders
	    // Game.market.getAllOrders({ type: ORDER_SELL, resourceType: RESOURCE_ENERGY}).forEach(order => {
	    //   const maxPrice = 2.5; // lookup price
	    //   if (order.roomName.includes('N') && order.price < maxPrice) {
	    //     // check the distance or that it is in the same region somehow.
	    //     if (order.price < 2.5) {
	    //       const maxBudget = 5000;
	    //       const ceil = 2500;
	    //       // (order.remainingAmount * price)
	    //       const amount = Math.floor(maxBudget / order.price);
	    //       // Game.market.deal(order.id, amount, 'W7N52');
	    //       console.log('Order Complete', order.id, amount, order.resourceType, order.price);
	    //     }
	    //   }
	    // });

	    // Game.market.getAllOrders({ type: ORDER_SELL, resourceType: 'GO'}).forEach(order => {
	    //   const maxPrice = 1; // lookup price
	    //   if (order.price < maxPrice) {
	    //     // check the distance or that it is in the same region somehow.
	    //     if (order.price < 1) {
	    //       const status = Game.market.deal(order.id, order.remainingAmount, 'W7N52');
	    //       if (status === OK) console.log('Order Complete', order.id, order.remainingAmount, order.resourceType, order.price);
	    //     }
	    //   }
	    // });

	    // Game.market.getAllOrders({ type: ORDER_SELL, resourceType: 'ZH'}).forEach(order => {
	    //   const maxPrice = 1; // lookup price
	    //   if (order.price < maxPrice) {
	    //     // check the distance or that it is in the same region somehow.
	    //     if (order.price < 1) {
	    //       const status = Game.market.deal(order.id, order.remainingAmount, 'W7N52');
	    //       if (status === OK) console.log('Order Complete', order.id, order.remainingAmount, order.resourceType, order.price);
	    //     }
	    //   }
	    // });

	    // console.log('northernEnergyOrders', localEnergyOrders.length);
	    // 
	    // Game.market.getAllOrders({ type: ORDER_BUY, resourceType: 'H'}).forEach(order => {
	    //   if (order.price >= 137) {
	    //     // console.log('Hydrogen Order');
	    //     // Game.market.deal(order.id, amount, 'W7N52');
	    //   }
	    // });
	    // Game.market.getAllOrders({ type: ORDER_BUY, resourceType: 'H'}).forEach(order => {
	    //   if (order.price >= 137) {
	    //     // console.log('Hydrogen Order');
	    //     // Game.market.deal(order.id, amount, 'W7N52');
	    //   }
	    // });
    }
  }

  constructor(room) {
  	this.room = room;
    this.storage = this.room.storage;
		this.terminal = this.room.terminal;
  }

  get(key) {
    const mem = this.room.memory['terminal'] || {};
    return mem[key];
  }

  set(key, value) {
    this.room.memory['terminal'][key] = value;
  }

  getConfig(resource) {
  	return marketConfig[resource];
  }

  getRequestedAmount(resource) {
    return this.get('requestedResources')[resource];
  }

  requestMet(resource) {
    return this.terminal.store.getUsedCapacity(resource) >= this.getRequestedAmount(resource);
  }

  calcNewPrice(price) {
    const minDiscount = 0.12;
    const maxDiscount = 0.65;
    const discount = minDiscount + Math.random() * (maxDiscount - minDiscount);
    const newPriceFloor = price * (1 - discount);
    return Math.max(newPriceFloor, 0); // Ensure price doesn't go negative
  }

  createBuyOrder(resource, amount) {
  	// marketConfig[resource].
  	const orders = Game.market.getBuyOrders({ type: ORDER_SELL, resourceType: resource });
  	console.log('orders', orders);
  }

  createSellOrder(resource, amount) {
    const config = this.getConfig(resource);
    if (config && config.sellOrderPrice) {
      const hasStock = !config.minStock || this.storage.store.getUsedCapacity(resource) >= config.minStock;

      if (this.requestMet(resource) && hasStock && config.sellOrderPrice) {
        const order = Object.values(Game.market.orders).reduce((acc, order) => {
          return order.type === ORDER_SELL && order.resourceType === resource && order.remainingAmount > 0 ? order : acc;
        }, {});

        if (!order.id) {
          return Game.market.createOrder({
            type: ORDER_SELL,
            resourceType: resource,
            price: config.sellOrderPrice,
            totalAmount: amount,
            roomName: this.room.name   
          });
        }
      }
    }
  }

  isSellable(resource, amount) {
    const config = this.getConfig(resource);
    if (config) {
      return true;
    } else {
      return config;
    }
  }

  sell(resource) {
    const config = this.getConfig(resource);
    const requestedAmount = 100;

    if (config) {
      const order = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: resource })
        .filter(order => order.price > config.minPrice && order.roomName.includes('N')).onFirst(o => o);

      if (order) {
        const amount = order.remainingAmount < this.terminal.store[resource] ? order.remainingAmount : this.terminal.store[resource];
        Game.market.deal(order.id, amount, this.room.name);
      }
    }
  }

  preview(orderId, amount) {
    const order = Game.market.getOrderById(orderId);

    if (order) {
      const energyCost = Game.market.calcTransactionCost(amount, this.room.name, order.roomName);
      console.log('ID:', orderId, 'room', order.roomName);
      console.log('Energy:', new Intl.NumberFormat().format(energyCost));
      console.log('Credits:', new Intl.NumberFormat().format(amount * order.price));
    }
  }

  deal(orderId, amount) {
    console.log(orderId, amount, this.room.name);
    return Game.market.deal(orderId, amount, this.room.name);
  }

  scan() {
  	// is it better to have some market data on hand?
  }
}

module.exports = MarketController;
