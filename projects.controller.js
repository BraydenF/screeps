/**
 * manages construction, and project queing
 *
 * Could create a system for saving build plans in memory. Once a road is built, that romm knows to rebuild it.
 * Method would allow for easily creating custom builds. (Had this idea a second time independent of this. To create a build plan/parameters for a room. That is then used going forward)
 * Is this more complicated than just programatically placing elements? I would bet its not, but unsure
 *
 */

class InfrastructurePlan {
	constructor(room) {
		const iplan = Memory._iplans[roomName];
		if (iplan) {
			// this.id = iplan._id;
			this.roomName = iplan.roomName;
			this.blueprints = iplan.blueprints;
			this.active = iplan.blueprints;
		} else {
			// this.id;
			this.roomName = room.name;
			this.blueprints = [];
			this.active = true;
		}
	}

	getStructuresOfType(type) {
		// todo: way to generically handle each type of building to be managed.
	}
}

class Blueprint() {
	constructor({ name, description = '', structureType, positions = [] }) {
		// this.id
		this.name = name;
		this.description = description;
		this.structureType = structureType;
		// Room.getPositionAt(x, y);
		this.positions = [];
	}
}

const constructionController = {
    save: function(iplans) {
    	Memory._iplans = iplans;
    },
    getPlansArray: function() {
		const iplans = [];
	    for (var room_it in Game.rooms) {
	        const room = Game.rooms[room_it];
			iplans.push(new InfrastructurePlan(room));
	    }
	    return iplans;
    },
    run: function() {
    	const iplans = constructionController.getPlansArray();
    	iplans.forEach(iplan => {
    		if (iplan.active) {
    			// todo: determine if the space is occupied
    			// todo: create construction sites
    		}
    	});

    },
}

module.exports = constructionController;
