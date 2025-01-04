
let checkpoints = {};
let recentSet = {};
let tick;
let txtclr = '<color="bbb">';
let last = 0;
let hasDeathevents = false;
let joined = {};

module.exports = class Plugin {
	constructor(omegga, config, store) {
		this.omegga = omegga;
		this.config = config;
		this.store = store;
	}
	
	async closed() {
		recentSet = {};
		//serverRestart = true;
	}
	
	async init() {
		// Write your plugin!
		
		// Incase the plugin loads before deathevents.
		const deathevents = await this.omegga.getPlugin('deathevents');
		if(deathevents) {
			console.log('Deathevents detected.');
			deathevents.emitPlugin('subscribe');
		}
		else {
			console.log('Players will not be teleported back to the checkpoint on death.');
		}
		
		this.omegga.on('cmd:clearcheckpoint', name => {
			
			delete checkpoints[name];
			//console.log(checkpoints);
			this.store.delete(name);
			this.omegga.whisper(name,'[RC] - '+txtclr+'Your checkpoint is nolonger stored.<>');
			
		})
		.on('join', async player => {
			
			joined[player.name] = true;
			this.teleportToCheckpoint(player);
			
		})
		.on('checkpointClicked', async data => {
			
			const numX = Number(data.x);
			const numY = Number(data.y);
			const numZ = Number(data.z);
			
			checkpoints[data.name] = [numX, numY, numZ];
			recentSet[data.name] = true;
			
			this.omegga.whisper(data.name, '[RC] - '+txtclr+'Your checkpoint is stored!<>');
			
		});
		
		function pattern(line, omegga) {
			
			const regex = /\[(?<counter>\d+)\]LogBrickadia: Ruleset.+?saving checkpoint for player (?<name>\w+) \((?<id>.+?)\) . (?<x>.+?)\s(?<y>.+?)\s(?<z>.+)/;
			const match = line.match(regex);
			if(match == null) {
				return;
			}
			
			const groups = match.groups
			if(groups.counter == last) {
				return;
			}
			last = groups.counter;
			
			omegga.emit('checkpointClicked', groups);
			
		}
		
		//tick = setInterval(() => this.runCheck(), 200);
		this.omegga.addMatcher((line) => pattern(line, this.omegga), () => {});
		
		const keys = await this.store.keys();
		
		for(let k in keys) {
			
			const key = keys[k];
			const storedPos = await this.store.get(key);
			checkpoints[key] = storedPos;
			
		}
		
		return { registeredCommands: ['revert'] };
	}
	
	async teleportToCheckpoint(player) {
		
		if(recentSet[player.name]) {
			return;
		}
		
		if(!(player.name in checkpoints)) {
			return;
		}
		
		let pos = checkpoints[player.name];
		
		const brs = await this.omegga.getSaveData({center: pos, extent: [20,20,20]});
		if(brs == null || !brs.brick_assets.includes("B_CheckPoint")) {
			this.omegga.whisper(player.name, '[RC] - '+txtclr+'Checkpoint not found.<>');
			return;
		}
		
		pos[2] += 10;
		
		this.omegga.writeln("Chat.Command /TP \"" + player.name + "\" " + pos.join(" ") + " 0");
		this.omegga.whisper(player.name, '[RC] - '+txtclr+'Your checkpoint got reset! You were teleported to your last checkpoint.<>');
		
		pos[2] -= 10;
		
	}
	
	async pluginEvent(event, from, ...args) {
		
		if(event === 'spawn') {
			//console.log('playerspawn');
			const player = args[0].player;
			if(player.name in joined) {
				delete joined[player.name];
				return;
			}
			
			this.teleportToCheckpoint(player);
			
		}
		
	}
		
	async stop() {
		
		const entries = Object.entries(checkpoints);
		recentSet = {};
		
		await this.store.wipe();
		
		for(let e in entries) {
			
			const entry = entries[e];
			
			this.store.set(entry[0], entry[1]);
			
		}
		
		const deathevents = await this.omegga.getPlugin('deathevents');
		if(deathevents) {
			console.log('Unsubbing...');
			deathevents.emitPlugin('unsubscribe');
		}
		clearInterval(tick);
	}
}
