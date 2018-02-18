# CMPM163-Homework2

### A. Outdoor 3D scene
* A height map<br>
    Created from a image file that change the vertex of the plane to create terrain.<br>
* Cube map<br>
    Used CubeTextureLoader to load the texture. Created vertex shader and fragment shader to build the skybox.<br>
* Water<br>
    Used PlaneGeometry to create the water as a plane and apply the reflection shader to it.<br>
* Move the camera<br>
    Used OrbitControls to move the camera through the scence.<br>
* Gui<br>
    Used dat.gui to create the gui panel. It can change the displaceAmt value and the height of water.<br>
* refraction<br>
    Edited the fragmentshader to apply the refraction to the water. Mixed the value of reflection and refraction and it seems not real...(GLSL_shader)<br>
    Created another water by THREE.Water which is created by three.js. Switch the two water with the gui.(THREE.Water)<br>
![THREE.Water](https://github.com/hhllii/CMPM163/blob/master/HW2/screenshot/Apic1.png)<br>
![GLSL_shader](https://github.com/hhllii/CMPM163/blob/master/HW2/screenshot/Apic2.png)<br>
link: https://hhllii.github.io/CMPM163/HW2/Homework2A.html <br>

### B. Abstract scene using particles and noise
* Particle system <br>
    Used the GPUParticleSystem to create the particle system that mimic snowing. There is only positionRandomness in GPUParticleSystem to control the range of particle generation. So I change the GPUParticleSystem.js to generate the snow in a plane. <br>
```java script
//positionStartAttribute.array[ i * 3 + 1 ] = position.y + ( particleSystem.random() * positionRandomness );
positionStartAttribute.array[ i * 3 + 1 ] = position.y 
```
* Noise function<br>
    The GPUParticleSystem uses the noise texture to caculate the noise. Input the noise texture to particleNoiseTex. But that does not use the noise fuction...Then I try to add the WebGL-noise function into the particle system. It seems that no way to pass the shader to GPUParticleSystem. So I directly modified the shader in GPUParticleSystem.js. I choosed the classicnoise3D.glsl as noise function then put it into the GPUParticleShader. And I change the codes that caculate the noise to apply my noise function.<br>
```glsl
'	float noiseV = pnoise( newPosition.xyz, vec3(10.0) );',
//'	newPosition = mix( newPosition, newPosition + vec3( noiseVel * ( turbulence * 5.0 ) ), ( timeElapsed / lifeTime ) );',
'	newPosition = mix( newPosition, newPosition + normal * noiseV * ( turbulence * 5.0 ) , ( timeElapsed / lifeTime ) );',
```
The particle will move the position along the normal by this function<br>
However, it's hard to see the difference after applying noise function with the snow generator...<br>
* Gui<br>
    dat.gui can control some parameters of the particle system.<br>
* Textured point sprites<br>
    Used a snowflake png file as the texture of point sprites.<br>
![particle system](https://github.com/hhllii/CMPM163/blob/master/HW2/screenshot/Bpic1.png)<br>
link: https://hhllii.github.io/CMPM163/HW2/Homework2B.html <br>
