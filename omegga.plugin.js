
let checkpoints = {};
let recentSet = {};

let tick;

let txtclr = '<color="bbb">';

module.exports = class Plugin {
	constructor(omegga, config, store) {
		this.omegga = omegga;
		this.config = config;
		this.store = store;
	}
	
	async runCheck() {
		try{
		const regex = new RegExp(`Ruleset.+?saving checkpoint for player (?<name>\\w+) \\((?<id>.+?)\\) . (?<x>.+?)\\s(?<y>.+?)\\s(?<z>.+)`);
		
		const [
		{
			groups: { name, id, x, y, z },
		},
		] = await this.omegga.addWatcher(regex, {
			timeoutDelay: 200,
		});
		
		const numX = Number(x);
		const numY = Number(y);
		const numZ = Number(z);
		
		checkpoints[name] = [numX, numY, numZ];
		recentSet[name] = true;
		
		}catch(e){}
	}
	
	async closed() {
		recentSet = {};
	}
	
	async checkDeathevents() {
		const deathevents = await this.omegga.getPlugin('deathevents');
		if(deathevents) {
			console.log('Deathevents detected.');
			deathevents.emitPlugin('subscribe');
		}
	}
	
	async init() {
		// Write your plugin!
		
		// Incase the plugin loads before deathevents.
		setTimeout(() => this.checkDeathevents(), 3000);
		
		this.omegga.on('cmd:clearcheckpoint', name => {
			
			delete checkpoints[name];
			
			this.omegga.whisper(name,'[CR] - '+txtclr+'Your checkpoint is nolonger stored.<>');
			
		});
		
		tick = setInterval(() => this.runCheck(), 200);
		
		const keys = await this.store.keys();
		
		for(let k in keys) {
			
			const key = keys[k];
			
			const storedPos = await this.store.get(key);
			
			checkpoints[key] = storedPos;
			
		}
		
		return { registeredCommands: ['revert'] };
	}
	
	async pluginEvent(event, from, ...args) {
		
		if(event === 'spawn') {
			const player = args[0].player;
			
			if(recentSet[player.name]) {
				return;
			}
			
			let pos = checkpoints[player.name];
			
			if(pos == null) {
				return;
			}
			
			const brs = await this.omegga.getSaveData({center: pos, extent: [20,20,2]});
			if(brs == null) {
				this.omegga.whisper(player.name, '[CR] - '+txtclr+'Checkpoint not found.<>');
				return;
			}
			
			pos[2] += 10;
			
			this.omegga.writeln("Chat.Command /TP \"" + player.name + "\" " + pos.join(" ") + " 0");
			this.omegga.whisper(player.name, '[CR] - '+txtclr+'Your checkpoint got reset! You were teleported to your last checkpoint.<>');
			
			pos[2] -= 10;
			
		}
		
	}
		
	async stop() {
		
		const entries = Object.entries(checkpoints);
		recentSet = {};
		
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
