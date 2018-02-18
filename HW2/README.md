# CMPM163-Homework2

---

###A. Outdoor 3D scene
-A height map
    Created from a image file.
-Cube map
    Used CubeTextureLoader to load the texture. Created vertex shader and fragment shader to build the skybox.
-Water
    Used PlaneGeometry to create the water as a plane and apply the reflection shader to it.
-Move the camera
    Used OrbitControls to move the camera through the scence.
-Gui
    Used dat.gui to create the gui panel. It can change the displaceAmt value and the height of water.
-*refraction
    Edited the fragmentshader to apply the refraction to the water. Mixed the value of reflection and refraction and it seems not real...(GLSL_shader)
    Created another water by THREE.Water which is created by three.js. Switch the two water with the gui.(THREE.Water)
