/*
 * GPU Particle System
 * @author flimshaw - Charlie Hoey - http://charliehoey.com
 *
 * A simple to use, general purpose GPU system. Particles are spawn-and-forget with
 * several options available, and do not require monitoring or cleanup after spawning.
 * Because the paths of all particles are completely deterministic once spawned, the scale
 * and direction of time is also variable.
 *
 * Currently uses a static wrapping perlin noise texture for turbulence, and a small png texture for
 * particles, but adding support for a particle texture atlas or changing to a different type of turbulence
 * would be a fairly light day's work.
 *
 * Shader and javascript packing code derrived from several Stack Overflow examples.
 *
 */

THREE.GPUParticleSystem = function (options) {

	THREE.Object3D.apply(this, arguments);

	options = options || {};

	// parse options and use defaults

	this.PARTICLE_COUNT = options.maxParticles || 1000000;
	this.PARTICLE_CONTAINERS = options.containerCount || 1;

	this.PARTICLE_NOISE_TEXTURE = options.particleNoiseTex || null;
	this.PARTICLE_SPRITE_TEXTURE = options.particleSpriteTex || null;

	this.PARTICLES_PER_CONTAINER = Math.ceil(this.PARTICLE_COUNT / this.PARTICLE_CONTAINERS);
	this.PARTICLE_CURSOR = 0;
	this.time = 0;
	this.particleContainers = [];
	this.rand = [];

	// custom vertex and fragement shader

	var GPUParticleShader = {

		vertexShader: [
			'vec3 mod289(vec3 x){',

			'  return x - floor(x * (1.0 / 289.0)) * 289.0;}',

			'vec4 mod289(vec4 x){',
			'return x - floor(x * (1.0 / 289.0)) * 289.0;}',

			'vec4 permute(vec4 x){',
			'return mod289(((x * 34.0) + 1.0) * x);}',

			'vec4 taylorInvSqrt(vec4 r){',
			'return 1.79284291400159 - 0.85373472095314 * r;}',

			'vec3 fade(vec3 t) {',
			'return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);}',

			// Classic Perlin noise
			'float cnoise(vec3 P){',
			'vec3 Pi0 = floor(P);', // Integer part for indexing
			'vec3 Pi1 = Pi0 + vec3(1.0);', // Integer part + 1
			'Pi0 = mod289(Pi0);',
			'Pi1 = mod289(Pi1);',
			'vec3 Pf0 = fract(P);', // Fractional part for interpolation
			'vec3 Pf1 = Pf0 - vec3(1.0);', // Fractional part - 1.0
			'vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);',
			'vec4 iy = vec4(Pi0.yy, Pi1.yy);',
			'vec4 iz0 = Pi0.zzzz;',
			'vec4 iz1 = Pi1.zzzz;',

			'vec4 ixy = permute(permute(ix) + iy);',
			'vec4 ixy0 = permute(ixy + iz0);',
			'vec4 ixy1 = permute(ixy + iz1);',

			'vec4 gx0 = ixy0 * (1.0 / 7.0);',
			'vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;',
			'gx0 = fract(gx0);',
			'vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);',
			'vec4 sz0 = step(gz0, vec4(0.0));',
			'gx0 -= sz0 * (step(0.0, gx0) - 0.5);',
			'gy0 -= sz0 * (step(0.0, gy0) - 0.5);',

			'vec4 gx1 = ixy1 * (1.0 / 7.0);',
			'vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;',
			'gx1 = fract(gx1);',
			'vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);',
			'vec4 sz1 = step(gz1, vec4(0.0));',
			'gx1 -= sz1 * (step(0.0, gx1) - 0.5);',
			'gy1 -= sz1 * (step(0.0, gy1) - 0.5);',

			'vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);',
			'vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);',
			'vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);',
			'vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);',
			'vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);',
			'vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);',
			'vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);',
			'vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);',

			'vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));',
			'g000 *= norm0.x;',
			'g010 *= norm0.y;',
			'g100 *= norm0.z;',
			'g110 *= norm0.w;',
			'vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));',
			'g001 *= norm1.x;',
			'g011 *= norm1.y;',
			'g101 *= norm1.z;',
			'g111 *= norm1.w;',

			'float n000 = dot(g000, Pf0);',
			'float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));',
			'float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));',
			'float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));',
			'float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));',
			'float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));',
			'float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));',
			'float n111 = dot(g111, Pf1);',

			'vec3 fade_xyz = fade(Pf0);',
			'vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);',
			'vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);',
			'float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);',
			'return 2.2 * n_xyz;',
			'}',

			// Classic Perlin noise, periodic variant
			'float pnoise(vec3 P, vec3 rep){',
			'	vec3 Pi0 = mod(floor(P), rep);', // Integer part, modulo period
				'vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);', // Integer part + 1, mod period
				'Pi0 = mod289(Pi0);',
				'Pi1 = mod289(Pi1);',
				'vec3 Pf0 = fract(P);', // Fractional part for interpolation
				'vec3 Pf1 = Pf0 - vec3(1.0);', // Fractional part - 1.0
				'vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);',
				'vec4 iy = vec4(Pi0.yy, Pi1.yy);',
				'vec4 iz0 = Pi0.zzzz;',
				'vec4 iz1 = Pi1.zzzz;',

				'vec4 ixy = permute(permute(ix) + iy);',
				'vec4 ixy0 = permute(ixy + iz0);',
				'vec4 ixy1 = permute(ixy + iz1);',

				'vec4 gx0 = ixy0 * (1.0 / 7.0);',
				'vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;',
				'gx0 = fract(gx0);',
				'vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);',
				'vec4 sz0 = step(gz0, vec4(0.0));',
				'gx0 -= sz0 * (step(0.0, gx0) - 0.5);',
				'gy0 -= sz0 * (step(0.0, gy0) - 0.5);',

				'vec4 gx1 = ixy1 * (1.0 / 7.0);',
				'vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;',
				'gx1 = fract(gx1);',
				'vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);',
				'vec4 sz1 = step(gz1, vec4(0.0));',
				'gx1 -= sz1 * (step(0.0, gx1) - 0.5);',
				'gy1 -= sz1 * (step(0.0, gy1) - 0.5);',

				'vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);',
				'vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);',
				'vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);',
				'vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);',
				'vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);',
				'vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);',
				'vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);',
				'vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);',

				'vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));',
				'g000 *= norm0.x;',
				'g010 *= norm0.y;',
				'g100 *= norm0.z;',
				'g110 *= norm0.w;',
				'vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));',
				'g001 *= norm1.x;',
				'g011 *= norm1.y;',
				'g101 *= norm1.z;',
				'g111 *= norm1.w;',

				'float n000 = dot(g000, Pf0);',
				'float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));',
				'float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));',
				'float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));',
				'float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));',
				'float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));',
				'float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));',
				'float n111 = dot(g111, Pf1);',

				'vec3 fade_xyz = fade(Pf0);',
				'vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);',
				'vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);',
				'float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);',
				'return 2.2 * n_xyz;',
			'}',

			'uniform float uTime;',
			'uniform float uScale;',
			'uniform sampler2D tNoise;',
			//'attribute vec3 normal',
			'attribute vec3 positionStart;',
			'attribute float startTime;',
			'attribute vec3 velocity;',
			'attribute float turbulence;',
			'attribute vec3 color;',
			'attribute float size;',
			'attribute float lifeTime;',

			'varying vec4 vColor;',
			'varying float lifeLeft;',

			'void main() {',

			// unpack things from our attributes'

			'	vColor = vec4( color, 1.0 );',

			// convert our velocity back into a value we can use'

			'	vec3 newPosition;',
			'	vec3 v;',

			'	float timeElapsed = uTime - startTime;',

			'	lifeLeft = 1.0 - ( timeElapsed / lifeTime );',

			'	gl_PointSize = ( uScale * size ) * lifeLeft;',

			'	v.x = ( velocity.x - 0.5 ) * 3.0;',
			'	v.y = ( velocity.y - 0.5 ) * 3.0;',
			'	v.z = ( velocity.z - 0.5 ) * 3.0;',

			'	newPosition = positionStart + ( v * 10.0 ) * timeElapsed;',

			'	vec3 noise = texture2D( tNoise, vec2( newPosition.x * 0.015 + ( uTime * 0.05 ), newPosition.y * 0.02 + ( uTime * 0.015 ) ) ).rgb;',
			'	vec3 noiseVel = ( noise.rgb - 0.5 ) * 30.0;',
			'	float noiseV = pnoise( newPosition.xyz, vec3(10.0) );',

			//'	newPosition = mix( newPosition, newPosition + vec3( noiseVel * ( turbulence * 5.0 ) ), ( timeElapsed / lifeTime ) );',
			'	newPosition = mix( newPosition, newPosition + normal * noiseV * ( turbulence * 5.0 ) , ( timeElapsed / lifeTime ) );',

			'	if( v.y > 0. && v.y < .05 ) {',

			'		lifeLeft = 0.0;',

			'	}',

			'	if( v.x < - 1.45 ) {',

			'		lifeLeft = 0.0;',

			'	}',

			'	if( timeElapsed > 0.0 ) {',

			'		gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );',

			'	} else {',

			'		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
			'		lifeLeft = 0.0;',
			'		gl_PointSize = 0.;',

			'	}',

			'}'

		].join('\n'),

		fragmentShader: [

			'float scaleLinear( float value, vec2 valueDomain ) {',

			'	return ( value - valueDomain.x ) / ( valueDomain.y - valueDomain.x );',

			'}',

			'float scaleLinear( float value, vec2 valueDomain, vec2 valueRange ) {',

			'	return mix( valueRange.x, valueRange.y, scaleLinear( value, valueDomain ) );',

			'}',

			'varying vec4 vColor;',
			'varying float lifeLeft;',

			'uniform sampler2D tSprite;',

			'void main() {',

			'	float alpha = 0.;',

			'	if( lifeLeft > 0.995 ) {',

			'		alpha = scaleLinear( lifeLeft, vec2( 1.0, 0.995 ), vec2( 0.0, 1.0 ) );',

			'	} else {',

			'		alpha = lifeLeft * 0.75;',

			'	}',

			'	vec4 tex = texture2D( tSprite, gl_PointCoord );',
			'	gl_FragColor = vec4( vColor.rgb * tex.a, alpha * tex.a );',

			'}'

		].join('\n')

	};

	// preload a million random numbers

	var i;

	for (i = 1e5; i > 0; i--) {

		this.rand.push(Math.random() - 0.5);

	}

	this.random = function () {

		return ++i >= this.rand.length ? this.rand[i = 1] : this.rand[i];

	};

	var textureLoader = new THREE.TextureLoader();

	this.particleNoiseTex = this.PARTICLE_NOISE_TEXTURE || textureLoader.load('res/perlin-512.png');
	this.particleNoiseTex.wrapS = this.particleNoiseTex.wrapT = THREE.RepeatWrapping;

	this.particleSpriteTex = this.PARTICLE_SPRITE_TEXTURE || textureLoader.load('res/particle2.png');
	this.particleSpriteTex.wrapS = this.particleSpriteTex.wrapT = THREE.RepeatWrapping;

	this.particleShaderMat = new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		uniforms: {
			'uTime': {
				value: 0.0
			},
			'uScale': {
				value: 1.0
			},
			'tNoise': {
				value: this.particleNoiseTex
			},
			'tSprite': {
				value: this.particleSpriteTex
			}
		},
		blending: THREE.AdditiveBlending,
		vertexShader: GPUParticleShader.vertexShader,
		fragmentShader: GPUParticleShader.fragmentShader
	});

	// define defaults for all values

	this.particleShaderMat.defaultAttributeValues.particlePositionsStartTime = [0, 0, 0, 0];
	this.particleShaderMat.defaultAttributeValues.particleVelColSizeLife = [0, 0, 0, 0];

	this.init = function () {

		for (var i = 0; i < this.PARTICLE_CONTAINERS; i++) {

			var c = new THREE.GPUParticleContainer(this.PARTICLES_PER_CONTAINER, this);
			this.particleContainers.push(c);
			this.add(c);

		}

	};

	this.spawnParticle = function (options) {

		this.PARTICLE_CURSOR++;

		if (this.PARTICLE_CURSOR >= this.PARTICLE_COUNT) {

			this.PARTICLE_CURSOR = 1;

		}

		var currentContainer = this.particleContainers[Math.floor(this.PARTICLE_CURSOR / this.PARTICLES_PER_CONTAINER)];

		currentContainer.spawnParticle(options);

	};

	this.update = function (time) {

		for (var i = 0; i < this.PARTICLE_CONTAINERS; i++) {

			this.particleContainers[i].update(time);

		}

	};

	this.dispose = function () {

		this.particleShaderMat.dispose();
		this.particleNoiseTex.dispose();
		this.particleSpriteTex.dispose();

		for (var i = 0; i < this.PARTICLE_CONTAINERS; i++) {

			this.particleContainers[i].dispose();

		}

	};

	this.init();

};

THREE.GPUParticleSystem.prototype = Object.create(THREE.Object3D.prototype);
THREE.GPUParticleSystem.prototype.constructor = THREE.GPUParticleSystem;


// Subclass for particle containers, allows for very large arrays to be spread out

THREE.GPUParticleContainer = function (maxParticles, particleSystem) {

	THREE.Object3D.apply(this, arguments);

	this.PARTICLE_COUNT = maxParticles || 100000;
	this.PARTICLE_CURSOR = 0;
	this.time = 0;
	this.offset = 0;
	this.count = 0;
	this.DPR = window.devicePixelRatio;
	this.GPUParticleSystem = particleSystem;
	this.particleUpdate = false;

	// geometry

	this.particleShaderGeo = new THREE.BufferGeometry();

	this.particleShaderGeo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT * 3), 3).setDynamic(true));
	this.particleShaderGeo.addAttribute('positionStart', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT * 3), 3).setDynamic(true));
	this.particleShaderGeo.addAttribute('startTime', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT), 1).setDynamic(true));
	this.particleShaderGeo.addAttribute('velocity', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT * 3), 3).setDynamic(true));
	this.particleShaderGeo.addAttribute('turbulence', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT), 1).setDynamic(true));
	this.particleShaderGeo.addAttribute('color', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT * 3), 3).setDynamic(true));
	this.particleShaderGeo.addAttribute('size', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT), 1).setDynamic(true));
	this.particleShaderGeo.addAttribute('lifeTime', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT), 1).setDynamic(true));

	// material

	this.particleShaderMat = this.GPUParticleSystem.particleShaderMat;

	var position = new THREE.Vector3();
	var velocity = new THREE.Vector3();
	var color = new THREE.Color();

	this.spawnParticle = function (options) {

		var positionStartAttribute = this.particleShaderGeo.getAttribute('positionStart');
		var startTimeAttribute = this.particleShaderGeo.getAttribute('startTime');
		var velocityAttribute = this.particleShaderGeo.getAttribute('velocity');
		var turbulenceAttribute = this.particleShaderGeo.getAttribute('turbulence');
		var colorAttribute = this.particleShaderGeo.getAttribute('color');
		var sizeAttribute = this.particleShaderGeo.getAttribute('size');
		var lifeTimeAttribute = this.particleShaderGeo.getAttribute('lifeTime');

		options = options || {};

		// setup reasonable default values for all arguments

		position = options.position !== undefined ? position.copy(options.position) : position.set(0, 0, 0);
		velocity = options.velocity !== undefined ? velocity.copy(options.velocity) : velocity.set(0, 0, 0);
		color = options.color !== undefined ? color.set(options.color) : color.set(0xffffff);

		var positionRandomness = options.positionRandomness !== undefined ? options.positionRandomness : 0;
		var velocityRandomness = options.velocityRandomness !== undefined ? options.velocityRandomness : 0;
		var colorRandomness = options.colorRandomness !== undefined ? options.colorRandomness : 1;
		var turbulence = options.turbulence !== undefined ? options.turbulence : 1;
		var lifetime = options.lifetime !== undefined ? options.lifetime : 5;
		var size = options.size !== undefined ? options.size : 10;
		var sizeRandomness = options.sizeRandomness !== undefined ? options.sizeRandomness : 0;
		var smoothPosition = options.smoothPosition !== undefined ? options.smoothPosition : false;

		if (this.DPR !== undefined) size *= this.DPR;

		var i = this.PARTICLE_CURSOR;

		// position

		positionStartAttribute.array[i * 3 + 0] = position.x + (particleSystem.random() * positionRandomness);
		//positionStartAttribute.array[ i * 3 + 1 ] = position.y + ( particleSystem.random() * positionRandomness );
		positionStartAttribute.array[i * 3 + 1] = position.y
		positionStartAttribute.array[i * 3 + 2] = position.z + (particleSystem.random() * positionRandomness);

		if (smoothPosition === true) {

			positionStartAttribute.array[i * 3 + 0] += - (velocity.x * particleSystem.random());
			positionStartAttribute.array[i * 3 + 1] += - (velocity.y * particleSystem.random());
			positionStartAttribute.array[i * 3 + 2] += - (velocity.z * particleSystem.random());

		}

		// velocity

		var maxVel = 2;

		var velX = velocity.x + particleSystem.random() * velocityRandomness;
		var velY = velocity.y + particleSystem.random() * velocityRandomness;
		var velZ = velocity.z + particleSystem.random() * velocityRandomness;

		velX = THREE.Math.clamp((velX - (- maxVel)) / (maxVel - (- maxVel)), 0, 1);
		velY = THREE.Math.clamp((velY - (- maxVel)) / (maxVel - (- maxVel)), 0, 1);
		velZ = THREE.Math.clamp((velZ - (- maxVel)) / (maxVel - (- maxVel)), 0, 1);

		velocityAttribute.array[i * 3 + 0] = velX;
		velocityAttribute.array[i * 3 + 1] = velY;
		velocityAttribute.array[i * 3 + 2] = velZ;

		// color

		color.r = THREE.Math.clamp(color.r + particleSystem.random() * colorRandomness, 0, 1);
		color.g = THREE.Math.clamp(color.g + particleSystem.random() * colorRandomness, 0, 1);
		color.b = THREE.Math.clamp(color.b + particleSystem.random() * colorRandomness, 0, 1);

		colorAttribute.array[i * 3 + 0] = color.r;
		colorAttribute.array[i * 3 + 1] = color.g;
		colorAttribute.array[i * 3 + 2] = color.b;

		// turbulence, size, lifetime and starttime

		turbulenceAttribute.array[i] = turbulence;
		sizeAttribute.array[i] = size + particleSystem.random() * sizeRandomness;
		lifeTimeAttribute.array[i] = lifetime;
		startTimeAttribute.array[i] = this.time + particleSystem.random() * 2e-2;

		// offset

		if (this.offset === 0) {

			this.offset = this.PARTICLE_CURSOR;

		}

		// counter and cursor

		this.count++;
		this.PARTICLE_CURSOR++;

		if (this.PARTICLE_CURSOR >= this.PARTICLE_COUNT) {

			this.PARTICLE_CURSOR = 0;

		}

		this.particleUpdate = true;

	};

	this.init = function () {

		this.particleSystem = new THREE.Points(this.particleShaderGeo, this.particleShaderMat);
		this.particleSystem.frustumCulled = false;
		this.add(this.particleSystem);

	};

	this.update = function (time) {

		this.time = time;
		this.particleShaderMat.uniforms.uTime.value = time;

		this.geometryUpdate();

	};

	this.geometryUpdate = function () {

		if (this.particleUpdate === true) {

			this.particleUpdate = false;

			var positionStartAttribute = this.particleShaderGeo.getAttribute('positionStart');
			var startTimeAttribute = this.particleShaderGeo.getAttribute('startTime');
			var velocityAttribute = this.particleShaderGeo.getAttribute('velocity');
			var turbulenceAttribute = this.particleShaderGeo.getAttribute('turbulence');
			var colorAttribute = this.particleShaderGeo.getAttribute('color');
			var sizeAttribute = this.particleShaderGeo.getAttribute('size');
			var lifeTimeAttribute = this.particleShaderGeo.getAttribute('lifeTime');

			if (this.offset + this.count < this.PARTICLE_COUNT) {

				positionStartAttribute.updateRange.offset = this.offset * positionStartAttribute.itemSize;
				startTimeAttribute.updateRange.offset = this.offset * startTimeAttribute.itemSize;
				velocityAttribute.updateRange.offset = this.offset * velocityAttribute.itemSize;
				turbulenceAttribute.updateRange.offset = this.offset * turbulenceAttribute.itemSize;
				colorAttribute.updateRange.offset = this.offset * colorAttribute.itemSize;
				sizeAttribute.updateRange.offset = this.offset * sizeAttribute.itemSize;
				lifeTimeAttribute.updateRange.offset = this.offset * lifeTimeAttribute.itemSize;

				positionStartAttribute.updateRange.count = this.count * positionStartAttribute.itemSize;
				startTimeAttribute.updateRange.count = this.count * startTimeAttribute.itemSize;
				velocityAttribute.updateRange.count = this.count * velocityAttribute.itemSize;
				turbulenceAttribute.updateRange.count = this.count * turbulenceAttribute.itemSize;
				colorAttribute.updateRange.count = this.count * colorAttribute.itemSize;
				sizeAttribute.updateRange.count = this.count * sizeAttribute.itemSize;
				lifeTimeAttribute.updateRange.count = this.count * lifeTimeAttribute.itemSize;

			} else {

				positionStartAttribute.updateRange.offset = 0;
				startTimeAttribute.updateRange.offset = 0;
				velocityAttribute.updateRange.offset = 0;
				turbulenceAttribute.updateRange.offset = 0;
				colorAttribute.updateRange.offset = 0;
				sizeAttribute.updateRange.offset = 0;
				lifeTimeAttribute.updateRange.offset = 0;

				// Use -1 to update the entire buffer, see #11476
				positionStartAttribute.updateRange.count = - 1;
				startTimeAttribute.updateRange.count = - 1;
				velocityAttribute.updateRange.count = - 1;
				turbulenceAttribute.updateRange.count = - 1;
				colorAttribute.updateRange.count = - 1;
				sizeAttribute.updateRange.count = - 1;
				lifeTimeAttribute.updateRange.count = - 1;

			}

			positionStartAttribute.needsUpdate = true;
			startTimeAttribute.needsUpdate = true;
			velocityAttribute.needsUpdate = true;
			turbulenceAttribute.needsUpdate = true;
			colorAttribute.needsUpdate = true;
			sizeAttribute.needsUpdate = true;
			lifeTimeAttribute.needsUpdate = true;

			this.offset = 0;
			this.count = 0;

		}

	};

	this.dispose = function () {

		this.particleShaderGeo.dispose();

	};

	this.init();

};

THREE.GPUParticleContainer.prototype = Object.create(THREE.Object3D.prototype);
THREE.GPUParticleContainer.prototype.constructor = THREE.GPUParticleContainer;
