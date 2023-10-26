const fs = require('fs');
const { brs } = OMEGGA_UTIL;
let brsfile = fs.readFileSync(__dirname + "/trench.brs");
const brsbrick = brs.read(brsfile);
brsfile = fs.readFileSync(__dirname + "/alotofrandompoints.brs");
const points = brs.read(brsfile);
brsfile = fs.readFileSync(__dirname + "/NW ammo crate.brs");
const crate = brs.read(brsfile);

let interval;
let enabled = true;

let cloudyness = 0.75;
let snowmultiplier = 1;
let foggyness = 0.7;
let nextcloudyness = 0.75;
let nextsnowmultiplier = 1;
let nextfoggyness = 0.7;

let timeout = [];

let clr = {
red: '<color="f00">',
org: '<color="f50">',
ylw: '<color="ff0">',
grn: '<color="0f0">',
gry: '<color="aaa">',
fblu: '<color="89a">',
};

let forecastInd = {
d: ' <color="0f0">V</>',
n: ' <color="ff0">-</>',
u: ' <color="f00">^</>'
}

let la;
let contreqlist = [];
let contsellist = {};

let playersRadiating = {};
let toCenter = [0,0,0];
let furthest = [0,0,0];
let radSuitHealth = {};
let compassPos = {};
let safeZoneRadius = 9000;

let spaceunits = [1,2,3,3,16];
let distribution = [
[],
[],
[],
[],
[]
];

let inc = 0;

let crateSpawnTicks = 0;
let availablePoints = [];

let weatherlist = [];

const crateOwner = [{
	id: '00000000-0000-0000-0000-000000000017',
	name: 'Crate',
	bricks: 1
}];

class BluestersDuctTape {
	constructor(omegga, config, store) {
		this.omegga = omegga;
		this.config = config;
		this.store = store;
	}
	
	async spawncrate(pos, dist) {
		const owner = [{
			id: '00000000-0000-0000-0000-000000000017',
			name: 'Crate',
			bricks: 1
		}];
		let cratebrs = {...crate, brick_owners: owner};
		const brind = cratebrs.bricks.findIndex(b => 'BCD_Interact' in b.components);
		cratebrs.bricks[brind].components.BCD_Interact.ConsoleTag = "crt " + dist;
		this.omegga.loadSaveData(cratebrs, {quiet: true, offX: pos[0], offY: pos[1], offZ: pos[2]});
	}
	
	async tick() {
		function changeTo(from, to, step) {
			if(Math.abs(to - from) < step) {
				return to;
			}
			return from + Math.sign(to - from) * step;
		}
		function randomMax(max) {
			return Math.floor(Math.random() * max)
		}
		function dist(vec1, vec2) {
			return Math.sqrt((vec1[0]-vec2[0]) ** 2 + (vec1[1]-vec2[1]) ** 2 + (vec1[2]-vec2[2]) ** 2);
		}
		if(!enabled) {
			return;
		}
		
		try{
		
		if(inc % 5 === 4) {
			
			const players = this.omegga.players;
			for(let p in players) {
				
				const player = players[0];
				if(player == null) {
					continue;
				}
				//const isDead = await player.isDead();
				//console.log('egg');
				//if(isDead) {
					//continue;
				//}
				//console.log('e1');
				const position = await player.getPosition();
				//console.log('e2');
				const relative = [position[0] - toCenter[0], position[1] - toCenter[1], position[2] - toCenter[2]];
				const distance = Math.sqrt(relative[0] ** 2 + relative[1] ** 2);
				
				if(distance > safeZoneRadius * 10) {
					
					if(playersRadiating[player.name] == null) {
						this.omegga.whisper(player.name, clr.red + '<b>You are out of the safe zone! You will now be recieving radiation damage.</>');
					}
					
					playersRadiating[player.name] = distance / (safeZoneRadius * 10);
					
				}
				else if(playersRadiating[player.name] != null) {
					
					this.omegga.whisper(player.name, clr.ylw + '<b>You are in the safe zone.</>');
					//console.log(plar);
					delete playersRadiating[player.name];
					
				}
				
			}
			
		}
		//console.log(playersRadiating);
		const radiated = Object.keys(playersRadiating);
		
		for(let r in radiated) {
			
			const player = await this.omegga.getPlayer(radiated[r]);
			
			const radSuit = radSuitHealth[player.name];
			
			if(radSuit > 0) {
				
				radSuitHealth[player.name] -= playersRadiating[player.name] * 0.5;
				if(radSuitHealth[player.name] < 0) {
					radSuitHealth[player.name] = 0;
					this.omegga.whisper(player.name, clr.red + '<b>Your rad suit has depleted.</>');
				}
				
			}
			else {
				player.damage(playersRadiating[player.name]);
			}
			
		}
		
		}catch(e){console.log(e + '2')}
		
		try{
		
		if(crateSpawnTicks > 0 && inc % 3 === 2) {
			
			let mBrs = {...crate, bricks: [], brick_owners: crateOwner};
			
			for(var i=0;i<10;i++) {
				const random = randomMax(availablePoints.length);
				const selpoint = JSON.parse(JSON.stringify(availablePoints[random]));
				let ppos = selpoint.position;
				const selfdist = dist(toCenter, ppos);
				ppos[2] -= selpoint.size[2];
				
				let crateBrs = {...crate};
				const brind = crateBrs.bricks.findIndex(b => 'BCD_Interact' in b.components);
				crateBrs.bricks[brind].components.BCD_Interact.ConsoleTag = "crt " + Math.floor((selfdist / furthest) * 18);
				mBrs = await this.mergeBrs(mBrs, crateBrs, ppos);
				
				availablePoints.splice(random, 1);
			}
			this.omegga.loadSaveData(mBrs, {quiet: true});
			
			crateSpawnTicks--;
			
		}
		
		if(inc % (60 * 20) === 0) {
			this.omegga.writeln('Bricks.Clear 00000000-0000-0000-0000-000000000017 1');
			const bricks = points.bricks;
			const centerpoint = bricks.filter(b => b.color === 13)[0];
			toCenter = centerpoint.position;
			const bpoints = bricks.filter(b => b.color === 15);
			const sorted = bpoints.sort((a,b) => dist(toCenter, b.position) - dist(toCenter, a.position));
			furthest = dist(toCenter, sorted[0].position);
			availablePoints = bpoints;
			
			crateSpawnTicks = 20;
			/*
			let mBrs = {...crate, bricks: [], brick_owners: crateOwner};
			
			for(var i=0;i<200;i++) {
				const random = randomMax(bpoints.length);
				const selpoint = JSON.parse(JSON.stringify(bpoints[random]));
				let ppos = selpoint.position;
				const sorted = bpoints.sort((a,b) => dist(centerpoint.position, b.position) - dist(centerpoint.position, a.position));
				const furthest = dist(centerpoint.position, sorted[0].position);
				const selfdist = dist(centerpoint.position, ppos);
				ppos[2] -= selpoint.size[2];
				//setTimeout(() => this.spawncrate(ppos, Math.floor((selfdist / furthest) * 18)), 1000);
				
				let crateBrs = {...crate};
				const brind = crateBrs.bricks.findIndex(b => 'BCD_Interact' in b.components);
				crateBrs.bricks[brind].components.BCD_Interact.ConsoleTag = "crt " + Math.floor((selfdist / furthest) * 18);
				//console.log(mBrs);
				mBrs = await this.mergeBrs(mBrs, crateBrs, ppos);
			}
			//this.omegga.broadcast('<b>New set of 100 ammo crates is out!</>');
			this.omegga.loadSaveData(mBrs, {quiet: true});
			*/
		}
		
		}catch(e){console.log(e + '1');}
		//if(crateSpawnTicks <= 0) {
		
		//}
		
		if(inc % 5 == 0) {
			
			const nextweather = weatherlist[0];
			if(cloudyness === nextweather.c && snowmultiplier === nextweather.s && foggyness === nextweather.f) {
				this.pushtoforecast(true);
				return;
			}
			cloudyness = changeTo(cloudyness, nextweather.c, 0.005);
			snowmultiplier = changeTo(snowmultiplier, nextweather.s, 0.005);
			foggyness = changeTo(foggyness, nextweather.f, 0.005);
			
			if(cloudyness * snowmultiplier > 0.7) {
				
				const decreaseAmount = 0.7 / (cloudyness * snowmultiplier);
				
				safeZoneRadius = 9000 * decreaseAmount;
				
			}
			else {
				
				safeZoneRadius = 9000;
				
			}
			
			this.omegga.loadEnvironmentData({Sky:
				{
				weatherIntensity: cloudyness * snowmultiplier,
					cloudCoverage: cloudyness,
					cloudyFogDensity: foggyness
				}
			});
			
		}
		
		inc++;
	}
	
	async mergeBrs(brs1, brs2, offset) {
		try{
		let merged = JSON.parse(JSON.stringify(brs1));
		for(let b in brs2.bricks) {
			let brick = JSON.parse(JSON.stringify(brs2.bricks[b]));
			const asset = brs2.brick_assets[brick.asset_name_index];
			const assetIndex = merged.brick_assets.indexOf(asset);
			//console.log(brick.position);
			brick.position[0] += offset[0];
			brick.position[1] += offset[1];
			brick.position[2] += offset[2];
			//console.log(brick.position);
			if(assetIndex == -1) {
				merged.brick_assets.push(asset);
				brick.asset_name_index = merged.brick_assets.length - 1;
			}
			else {
				brick.asset_name_index = assetIndex;
			}
			if(isNaN(brick.color)) {
				merged.bricks.push(brick);
				continue;
			}
			const color = brs2.colors[brick.color];
			const colorIndex = merged.colors.findIndex(x => x.join('') == color.join(''));
			if(colorIndex == -1) {
				brick.color = color;
			}
			else {
				brick.color = colorIndex;
			}
			merged.bricks.push(brick);
		}
		return merged;
		}catch(e){console.log(e);}
	}
	
	async pushtoforecast(shift) {
		function randomMax(max) {
			return Math.floor(Math.random() * max)
		}
		if(weatherlist.length === 0) {
			weatherlist.push({c: 0.8, f: 0.7, s: 0.5});
			return;
		}
		let prev = JSON.parse(JSON.stringify(weatherlist[weatherlist.length - 1]));
		switch(randomMax(4)) {
			case 0:
			case 3:
				prev.c = randomMax(20) / 100 + 0.8;
				break;
			case 1:
				prev.f = randomMax(100) / 100 + 0.5;
				break;
			case 2:
				prev.s = randomMax(10) / 10;
				break;
		}
		weatherlist.push(prev);
		if(shift) {
			weatherlist.shift();
		}
	}
	
	async dumpCommands(name) {
		this.omegga.whisper(name, clr.grn + '<b>/cmds</></><b> - you are here.</>');
		this.omegga.whisper(name, clr.grn + '<b>/listammo</></><b> - lists your ammo.</>');
		this.omegga.whisper(name, clr.grn + '<b>/giveammo (amount) (ammotype 0-4) (reciever)</></><b> - gives ammo to another player.</>');
		this.omegga.whisper(name, clr.grn + '<b>/w (message)</></><b> - sends a message to players with the same frequency in 2160 stud radius.</>');
		this.omegga.whisper(name, clr.grn + '<b>/tune (1-1000)</></><b> - changes your radio frequency.</>');
		this.omegga.whisper(name, clr.grn + '<b>/tpa (player)</></><b> - sends a request to a player to teleport to them.</>');
		//this.omegga.whisper(name, clr.grn + '<b>/wwf</></><b> - announce your loss when you can\'t do it through chat. Use if you want to stop the fight.</>');
		this.omegga.whisper(name, clr.grn + '<b>/crtcon (x size) (y size) (z size) optional</></><b> - creates an ammo container. The container gets placed at your ghostbrick\'s position.</>');
		this.omegga.whisper(name, clr.grn + '<b>/rmcon</></><b> - remove a selected ammo container.</>');
		this.omegga.whisper(name, clr.grn + '<b>/dpcon (slot 0-4) (amount)</></><b> - deposits into a selected ammo container.</>');
		this.omegga.whisper(name, clr.grn + '<b>/wdcon (slot 0-4) (amount)</></><b> - withdraws from a selected ammo container.</>');
		this.omegga.whisper(name, clr.grn + '<b>/frct </></><b> - outputs forecast.</>');
		this.omegga.whisper(name, clr.grn + '<b>/time </></><b> - outputs time.</>');
		this.omegga.whisper(name, clr.grn + '<b>/rsc </></><b> - displays your rad suit total health.</>');
		this.omegga.whisper(name, clr.grn + '<b>/givers (amount) (reciever) </></><b> - gives rad suit health to other players.</>');
		this.omegga.whisper(name, clr.grn + '<b>/cmpset (x) (y) (z) optional </></><b> - sets compass direction to your current position. Optionaly you can insert custom coordinates to point to.</>');
		this.omegga.whisper(name, clr.grn + '<b>/compass </></><b> - displays direction to a position.</>');
		this.omegga.whisper(name, clr.ylw + '<b>PageUp and PageDn to scroll through chat.</>');
	}
	
	async changeContainer(pos, size, slot, amount, data) {
		let brs = brsbrick;
		brs.brick_owners = [{
			id: '00000000-0000-0000-0000-0000000fac75',
			name: 'Container',
			bricks: 1
		}];
		let brick = brs.bricks[0];
		brick.size = size;
		let tag = data;
		data[slot + 1] = Number(data[slot + 1]) + amount;
		brick.components.BCD_Interact.ConsoleTag = tag.join(' ');
		brs.bricks[0] = brick;
		await this.omegga.clearRegion({center: pos, extent: size});
		this.omegga.loadSaveData(brs, {quiet: true, offX: pos[0], offY: pos[1], offZ: pos[2] - 10});
	}
	
	async calculateStorage(data){
		let total = 0;
		const typeamounts = JSON.parse(JSON.stringify(data));
		typeamounts.shift();
		for(var t in typeamounts) {
			let tamount = Number(typeamounts[t]);
			total += spaceunits[t] * tamount;
		}
		return total;
	}
	
	async GetRotation(controller) {
		try{
		const rotRegExp = new RegExp(`${controller}\\.TransformComponent0.RelativeRotation = \\(Pitch=(?<x>[\\d\\.-]+),Yaw=(?<y>[\\d\\.-]+),Roll=(?<z>[\\d\\.-]+)\\)`);
		const [
		{
			groups: { x, y, z },
		},
		] = await this.omegga.addWatcher(rotRegExp, {
			exec: () =>
			this.omegga.writeln(
				`GetAll SceneComponent RelativeRotation Outer=${controller}`
			),
			timeoutDelay: 100
		});
		return [Number(x),Number(y),Number(z)];
		}catch(e){console.log(e)}
	}
	
	async drop(pl, num) {
		switch(num) {
			case 0:
				la.emitPlugin('changeammo', pl, 0, 30, true);
				la.emitPlugin('changeammo', pl, 1, 5, true);
				this.omegga.whisper(pl, "+30 Light ammo\n+5 Medium ammo");
				break;
			case 1:
				la.emitPlugin('changeammo', pl, 0, 10, true);
				la.emitPlugin('changeammo', pl, 1, 15, true);
				this.omegga.whisper(pl, "+10 Light ammo\n+15 Medium ammo");
				break;
			case 2:
				la.emitPlugin('changeammo', pl, 1, 20, true);
				la.emitPlugin('changeammo', pl, 3, 5, true);
				this.omegga.whisper(pl, "+20 Medium ammo\n+5 Shotgun ammo");
				break;
			case 3:
				la.emitPlugin('changeammo', pl, 1, 30, true);
				la.emitPlugin('changeammo', pl, 3, 10, true);
				this.omegga.whisper(pl, "+30 Medium ammo\n+10 Shotgun ammo");
				break;
			case 4:
				la.emitPlugin('changeammo', pl, 1, 30, true);
				la.emitPlugin('changeammo', pl, 3, 10, true);
				la.emitPlugin('changeammo', pl, 2, 3, true);
				this.omegga.whisper(pl, "+30 Medium ammo\n+10 Shotgun ammo\n+3 Heavy ammo");
				break;
			case 5:
				la.emitPlugin('changeammo', pl, 1, 35, true);
				la.emitPlugin('changeammo', pl, 3, 12, true);
				la.emitPlugin('changeammo', pl, 2, 7, true);
				this.omegga.whisper(pl, "+35 Medium ammo\n+12 Shotgun ammo\n+7 Heavy ammo");
				break;
			case 6:
				la.emitPlugin('changeammo', pl, 1, 20, true);
				la.emitPlugin('changeammo', pl, 3, 12, true);
				la.emitPlugin('changeammo', pl, 2, 10, true);
				this.omegga.whisper(pl, "+20 Medium ammo\n+12 Shotgun ammo\n+10 Heavy ammo");
				break;
			case 7:
				la.emitPlugin('changeammo', pl, 1, 30, true);
				la.emitPlugin('changeammo', pl, 2, 7, true);
				la.emitPlugin('changeammo', pl, 4, 3, true);
				this.omegga.whisper(pl, "+30 Medium ammo\n+3 explosives\n+7 Heavy ammo");
				break;
			case 8:
				la.emitPlugin('changeammo', pl, 1, 30, true);
				la.emitPlugin('changeammo', pl, 2, 7, true);
				la.emitPlugin('changeammo', pl, 4, 8, true);
				this.omegga.whisper(pl, "+30 Medium ammo\n+8 explosives\n+7 Heavy ammo");
				break;
			default:
				la.emitPlugin('changeammo', pl, 1, 35, true);
				la.emitPlugin('changeammo', pl, 2, 10, true);
				la.emitPlugin('changeammo', pl, 4, 12, true);
				this.omegga.whisper(pl, "+35 Medium ammo\n+12 explosives\n+10 Heavy ammo");
				break;
		}
		if(Math.floor(Math.random() * 7) == 6) {
			
			radSuitHealth[pl] += 100;
			this.omegga.whisper(pl, '+100 rad suit health');
			
		}
	}
	
	async showForecast(name) {
		
		let forecast = {c: [], f: [], s: []};
		
		let notes = [];
		let lowVisibility = false;
		let extremelyLowVisibility = false;
		let highSnow = false;
		
		for(var w in weatherlist) {
			const data = JSON.parse(JSON.stringify(weatherlist[w]));
			//try{
			let previousData;
			if(w == 0) {
				previousData = {c: cloudyness, f: foggyness, s: snowmultiplier};
			}
			else {
				previousData = JSON.parse(JSON.stringify(weatherlist[w - 1]));
			}
			//}catch(e){console.log(e)}
			
			let cld = Math.floor(data.c * 100) / 100 + '';
			let fog = Math.floor(data.f * 100) / 100 + '';
			let snw = Math.floor(data.c * data.s * 100) / 100 + '';
			
			if(cld.length < 2) {
				cld += '.0';
			}
			if(fog.length < 2) {
				fog += '.0';
			}
			if(snw.length < 2) {
				snw += '.0';
			}
			if(cld.length < 4) {
				cld += '0';
			}
			if(fog.length < 4) {
				fog += '0';
			}
			if(snw.length < 4) {
				snw += '0';
			}
			
			if(data.f > 1.2) {
				fog = clr.red + fog + '</>';
				lowVisibility = true;
			}
			if(data.c > 0.94) {
				cld = clr.red + cld + '</>';
				if(lowVisibility) {
					extremelyLowVisibility = true;
				}
			}
			
			if(data.c * data.s > 0.73) {
				snw = clr.red + snw + '</>';
				highSnow = true;
			}
			
			if(previousData.c < data.c) {
				cld += forecastInd.u;
			}
			else if(previousData.c > data.c) {
				cld += forecastInd.d;
			}
			else {
				cld += forecastInd.n;
			}
			
			if(previousData.f < data.f) {
				fog += forecastInd.u;
			}
			else if(previousData.f > data.f) {
				fog += forecastInd.d;
			}
			else {
				fog += forecastInd.n;
			}
			
			if(previousData.s < data.s) {
				snw += forecastInd.u;
			}
			else if(previousData.s > data.s) {
				snw += forecastInd.d;
			}
			else {
				snw += forecastInd.n;
			}
			
			forecast.c.push(cld);
			forecast.f.push(fog);
			forecast.s.push(snw);
		}
		
		if(extremelyLowVisibility) {
			notes.push("Incoming extremly low visibility");
		}
		else if(lowVisibility) {
			notes.push("Incoming mildly low visibility");
		}
		if(highSnow) {
			notes.push("Incoming decrease in safe zone");
		}
		
		this.omegga.whisper(name, '<b>CLD: | ' + forecast.c.join(' | ') + ' |<>');
		this.omegga.whisper(name, '<b>FOG: | ' + forecast.f.join(' | ') + ' |<>');
		this.omegga.whisper(name, '<b>SNW: | ' + forecast.s.join(' | ') + ' |<>');
		this.omegga.whisper(name, '<b>Notes: ' + clr.org + notes.join('</>, ' + clr.org) + '</>');
		
	}
	
	async init() {
		la = await this.omegga.getPlugin('LimitedAmmo');
		/*
		this.omegga.on('cmd:wwf', async name => {
			function randomMax(max) {
				return Math.floor(Math.random() * max)
			}
			if(timeout.includes(name)) {
				this.omegga.whisper(name, clr.red + '<b>You have to wait before you can wave the flag again.<>');
				return;
			}
			timeout.push(name);
			switch(randomMax(5)) {
				case 0:
					this.omegga.broadcast('<b>' + clr.gry + name + ' has given up. ' + name + ' is waving the </>white flag.</>');
					break;
				case 1:
					this.omegga.broadcast('<b>' + clr.gry + name + ' couldn\'t take it anymore. ' + name + ' is waving the </>white flag.</>');
					break;
				case 2:
					this.omegga.broadcast('<b>' + clr.gry + name + ' ran out of ammo. ' + name + ' is waving the </>white flag.</>');
					break;
				case 3:
					this.omegga.broadcast('<b>' + clr.gry + name + ' is waving the </>white flag.</>');
					break;
				case 4:
					this.omegga.broadcast('<b>' + clr.gry + name + ' got downed. ' + name + ' is waving the </>white flag.</>');
					break;
			}
			setTimeout(() => timeout.splice(timeout.indexOf(name), 1), 10000);
		})
		*/
		this.omegga.on('interact', async data => {
			const cdata = data.message.split(' ');
			if(cdata[0] == "crt") {
				let pos = data.position;
				pos[2] -= 26;
				const extent = [34,34,44];
				const brsc = await this.omegga.getSaveData({center: pos, extent: extent});
				if(brsc == null) {
					return;
				}
				const brick = brsc.bricks[0];
				if(brsc.brick_owners[brick.owner_index - 1].name != "Crate") {
					return;
				}
				this.omegga.writeln('Bricks.ClearRegion ' + pos.join(' ') + ' ' + extent.join(' ') + ' 00000000-0000-0000-0000-000000000017');
				this.drop(data.player.name, Number(cdata[1]));
				return;
			}
			if(cdata[0] != "BDTCon") {
				return;
			}
			let bricksize = data.brick_size;
			let brs = await this.omegga.getSaveData({center: data.position, extent: bricksize});
			if(brs == null) {
				const hold = bricksize[0];
				bricksize[0] = bricksize[1];
				bricksize[1] = hold;
				brs = await this.omegga.getSaveData({center: data.position, extent: bricksize});
				if(brs == null) {
					return;
				}
			}
			const brick = brs.bricks[0];
			if(brs.brick_owners[brick.owner_index - 1].name != "Container") {
				return;
			}
			contsellist[data.player.name] = {pos: data.position, size: bricksize, data: cdata};
			const volume = data.brick_size[0] * data.brick_size[1] * data.brick_size[2];
			const fill = await this.calculateStorage(cdata);
			const fillPercentage = Math.floor((fill / volume) * 100);
			this.omegga.middlePrint(data.player.name, "Container selected. <br>" + 'S: ' + cdata[1]  + '<br>M: ' + cdata[2] + '<br>H: ' + cdata[3] + '<br>SG: ' + cdata[4] + '<br>Exp: ' + cdata[5] + '<br>Fill: ' + fillPercentage + '%');
		})
		.on('cmd:rsc', async name => {
			
			const count = radSuitHealth[name];
			
			this.omegga.whisper(name, clr.ylw + '<b>Total rad suit health: ' + Math.floor(count) + '</>');
			
		})
		.on('cmd:time', async name => {
			
			const data = await this.omegga.getEnvironmentData();
			const time = data.data.groups.Sky.timeOfDay;
			let hours = Math.floor(time) + '';
			if(hours.length < 2) {
				hours = '0' + hours;
			}
			let minutes = Math.floor((time % 1) * 60) + '';
			if(minutes.length < 2) {
				minutes = '0' + minutes;
			}
			this.omegga.whisper(name, '<b>Current time: ' + hours + ':' + minutes + '</>');
			
		})
		.on('cmd:givers', async (name, ...args) => {
			
			const amount = Number(args[0]);
			if(isNaN(amount)) {
				this.omegga.whisper(name, clr.red + '<b>Invalid amount.</>');
				return;
			}
			args.shift();
			
			const plr = args.join(' ');
			
			const reciever = await this.omegga.findPlayerByName(plr);
			if(reciever == null) {
				this.omegga.whisper(name, clr.red + '<b>Could not find reciever.</>');
				return;
			}
			if(reciever.name == name) {
				this.omegga.whisper(name, clr.red + '<b>You can\'t give rad suits to yourself.</>');
				return;
			}
			
			const radsuit = radSuitHealth[name];
			const max = Math.max(Math.floor(radsuit), Math.floor(amount));
			
			radSuitHealth[name] -= max;
			radSuitHealth[reciever.name] += max;
			
			this.omegga.whisper(name, clr.ylw + '<b>You gave ' + reciever.name + ' ' + max + ' rad suit health.</>');
			this.omegga.whisper(reciever.name, '+' + max + ' rad suit');
			
		})
		.on('cmd:crtcon', async (name, ...args) => {
			
			// Fix rad suits disappearing.
			let brickSize = [10,10,10];
			
			const x = Number(args[0]);
			const y = Number(args[1]);
			const z = Number(args[2]);
			
			if(!(isNaN(x) || isNaN(y) || isNaN(z))) {
				
				brickSize = [x * 5,y * 5,z * 2];
				
			}
			
			let brs = brsbrick;
			brs.brick_owners = [{
				id: '00000000-0000-0000-0000-0000000fac75',
				name: 'Container',
				bricks: 1
			}];
			brs.bricks[0].components.BCD_Interact.ConsoleTag = "BDTCon 0 0 0 0 0";
			brs.bricks[0].size = brickSize;
			
			const player = await this.omegga.getPlayer(name);
			const ghostBrick = await player.getGhostBrick();
			
			if(ghostBrick == null) {
				this.omegga.middlePrint(name, "Could not find the ghost brick.");
				return;
			}
			
			this.omegga.loadSaveData(brs, {quiet: true, offX: ghostBrick.location[0], offY: ghostBrick.location[1], offZ: ghostBrick.location[2] - 10});
			this.omegga.middlePrint(name, "Container created!");
		})
		.on('cmd:rmcon', async name => {
			//try{
			const selection = contsellist[name];
			if(selection == null) {
				this.omegga.middlePrint(name, "You do not have a container selected.");
				return;
			}
			let data = selection.data;
			data.shift();
			for(var d in data) {
				const amount = data[d];
				if(amount == 0) {
					continue;
				}
				await la.emitPlugin('changeammo', name, d, amount);
			}
			this.omegga.clearRegion({center: selection.pos, extent: selection.size});
			//console.log(Object.entries(contsellist)[0]);
			const list = Object.entries(contsellist).filter(s => s[1].pos.join('') != selection.pos.join(''));
			contsellist = {};
			for(let l in list) {
				const values = list[l];
				contsellist[values[0]] = values[1];
			}
			this.omegga.middlePrint(name, 'Container removed!');
			//}catch(e){console.log(e);}
		})
		.on('cmd:dpcon', async (name, ...args) => {
			const selection = contsellist[name];
			if(selection == null) {
				this.omegga.middlePrint(name, "You do not have a container selected.");
				return;
			}
			const slot = Math.floor(Number(args[0]));
			const amount = Math.floor(Number(args[1]));
			if(isNaN(slot) || isNaN(amount)) {
				this.omegga.middlePrint(name, "Invalid args.");
				return;
			}
			if(slot < 0 || slot > 4) {
				this.omegga.middlePrint(name, "Invalid slot. ( 0 - 4 )");
				return;
			}
			if(amount < 1) {
				this.omegga.middlePrint(name, "Amount must be above 0");
				return;
			}
			const volume = selection.size[0] * selection.size[1] * selection.size[2];
			const filled = await this.calculateStorage(selection.data);
			if(filled + spaceunits[slot] * amount > volume) {
				this.omegga.middlePrint(name, "The container doesn't have enough space.");
				return;
			}
			contreqlist.push({player: name, req: "Deposit", slot: slot, amount: amount, pos: selection.pos, size: selection.size, data: selection.data});
			la.emitPlugin("getammo", name, slot, amount);
		})
		.on('cmd:wdcon', async (name, ...args) => {
			const selection = contsellist[name];
			if(selection == null) {
				this.omegga.middlePrint(name, "You do not have a container selected.");
				return;
			}
			const slot = Math.floor(Number(args[0]));
			const amount = Math.floor(Number(args[1]));
			if(isNaN(slot) || isNaN(amount)) {
				this.omegga.middlePrint(name, "Invalid args.");
				return;
			}
			if(slot < 0 || slot > 4) {
				this.omegga.middlePrint(name, "Invalid slot. ( 0 - 4 )");
				return;
			}
			if(amount < 1) {
				this.omegga.middlePrint(name, "Amount must be above 0");
				return;
			}
			const withdrawamount = Math.min(amount, selection.data[slot + 1]);
			la.emitPlugin('changeammo', name, slot, withdrawamount);
			this.changeContainer(selection.pos, selection.size, slot, -withdrawamount, selection.data);
		})
		.on('cmd:frct', async name => {
			this.showForecast(name);
		})
		.on('cmd:cmds', async name => {
			this.dumpCommands(name);
		})
		.on('join', async player => {
			
			const keys = await this.store.keys();
			if(!keys.includes(player.name)) {
				
				radSuitHealth[player.name] = 0;
				compassPos[player.name] = [0,0,0];
				this.store.set(player.name, {radSuit: 0, compass: [0,0,0]});
				
			}
			else {
				
				const data = await this.store.get(player.name);
				
				if(data == null || typeof data == "number" || data.radSuit == null || isNaN(data.radSuit) || data.compass == 0) {
					
					radSuitHealth[player.name] = 0;
					compassPos[player.name] = [0,0,0];
					return;
					
				}
				
				radSuitHealth[player.name] = data.radSuit;
				compassPos[player.name] = data.compass;
				
			}
			
			
			
		})
		.on('leave', async player => {
			
			this.store.set(player.name, {radSuit: radSuitHealth[player.name], compass: compassPos[player.name]});
			delete radSuitHealth[player.name];
			delete playersRadiating[player.name];
			delete compassPos[player.name];
			
		})
		.on('cmd:cmpset', async (name, ...data) => {
			
			const x = Number(data[0]);
			const y = Number(data[1]);
			const z = Number(data[2]);
			
			if(isNaN(x) || isNaN(y) || isNaN(z)) {
				
				const player = await this.omegga.getPlayer(name);
				const position = await player.getPosition();
				
				compassPos[name] = position;
				
			}
			else {
				
				compassPos[name] = [x, y, z];
				
			}
			
			this.omegga.whisper(name, '<b>New compass position has been set!</>');
			
		})
		.on('cmd:compass', async name => {
			try{
			const player = await this.omegga.getPlayer(name);
			const position = await player.getPosition();
			const rotation = await this.GetRotation(player.controller);
			
			const compass = compassPos[name];
			const relativePos = [compass[0] - position[0], compass[1] - position[1]];
			
			const rad2Deg = 180/Math.PI;
			let angle = Math.atan2(relativePos[1], relativePos[0]) * rad2Deg - rotation[1];
			if(angle > 180) {
				angle -= 360;
			}
			if(angle < -180) {
				angle += 360;
			}
			
			if(angle > 0) {
				this.omegga.middlePrint(name, '  ' + Math.round(angle) + ' >');
			}
			else {
				this.omegga.middlePrint(name, '< ' + Math.round(angle) + '  ');
			}
			}catch(e){console.log(e)}
		});
		
		const players = this.omegga.players;
		
		for(let p in players) {
			
			const player = players[p];
			
			const data = await this.store.get(player.name);
			
			if(data == null || typeof data == "number" || data.radSuit == null || isNaN(data.radSuit) || data.compass == 0) {
				
				radSuitHealth[player.name] = 0;
				compassPos[player.name] = [0,0,0];
				continue;
				
			}
			
			radSuitHealth[player.name] = data.radSuit;
			compassPos[player.name] = data.compass;
			
		}
		
		for(var i=0;i<10;i++) {
			this.pushtoforecast(false);
		}
		interval = setInterval(() => this.tick(), 1000);
		return { registeredCommands: ['wwf', 'r', 'freq','crtcon','dpcon','wdcon','rmcon','cmds','frct','rsc','givers','cmpset','compass','time'] };
	}
	
	async pluginEvent(event, from, ...args) {
		const ev = event.toLowerCase();
		if(ev === "ammocount") {
			let ammo = args[0];
			const req = contreqlist[0];
			contreqlist.shift();
			ammo = Math.min(ammo, req.amount);
			la.emitPlugin('changeammo', req.player, req.slot, -ammo);
			this.changeContainer(req.pos, req.size, req.slot, ammo, req.data);
		}
	}

	async stop() {
		
		const players = this.omegga.players;
		
		for(let p in players) {
			
			const player = players[p];
			
			this.store.set(player.name, {radSuit: radSuitHealth[player.name], compass: compassPos[player.name]});
			
		}
		
		clearInterval(interval);
	}
}
module.exports = BluestersDuctTape;