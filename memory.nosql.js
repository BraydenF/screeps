/**
 * MemoryNoSQL
 * Creating a system for interacting with Memory.
 *
 * todos:
 *	- outline super baseline functions needed
 *	- decide on a neat name for the Document
 * 
 */

// class Table {
// 	constructor(name) {
// 		this.name: ,
// 		this.data: Memory[name],
// 	}
// }

// class Document {
// 	constructor() {
// 		this._id = 
// 	}
// }

const MemoryNoSQL = {
	_memory: {}, // todo: decide if this is really needed. Dont think it will get used.
	find: function(startNode, filter) {
		// bet I can use filter here
		// var harvesters = _.filter(Game.creeps, {
		//     memory: {role: 'harvester'}
		// });
		return [];
	},
	findOne: function(...params) {
		const res = memoryNoSQL.find(...params);
		return res.length ? res[0] : null;
	},
	create: function(node) {

	},
	update: function(node) {

	},
}
