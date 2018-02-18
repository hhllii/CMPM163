# CMPM163-Homework2

### A. Outdoor 3D scene
-A height map<br>
    Created from a image file.<br>
-Cube map<br>
    Used CubeTextureLoader to load the texture. Created vertex shader and fragment shader to build the skybox.<br>
-Water<br>
    Used PlaneGeometry to create the water as a plane and apply the reflection shader to it.<br>
-Move the camera<br>
    Used OrbitControls to move the camera through the scence.<br>
-Gui<br>
    Used dat.gui to create the gui panel. It can change the displaceAmt value and the height of water.<br>
-refraction<br>
    Edited the fragmentshader to apply the refraction to the water. Mixed the value of reflection and refraction and it seems not real...(GLSL_shader)<br>
    Created another water by THREE.Water which is created by three.js. Switch the two water with the gui.(THREE.Water)<br>
![THREE.Water](https://github.com/hhllii/CMPM163/blob/master/HW2/screenshot/Apic1.png)<br>
![GLSL_shader](https://github.com/hhllii/CMPM163/blob/master/HW2/screenshot/Apic2.png)<br>
link: https://hhllii.github.io/CMPM163/HW2/Homework2A.html <br>

### B. Abstract scene using particles and noise
-Particle system
    Used the GPUParticleSystem to create the particle system that mimic snowing. There is only positionRandomness in GPUParticleSystem to control the range of particle generation. So I change the GPUParticleSystem.js to generate the snow in a plane.
```java script
//positionStartAttribute.array[ i * 3 + 1 ] = position.y + ( particleSystem.random() * positionRandomness );
positionStartAttribute.array[ i * 3 + 1 ] = position.y 
```
