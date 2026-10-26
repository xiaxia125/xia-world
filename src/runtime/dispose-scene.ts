import * as THREE from "three";

/** Disposes the unique GPU resources owned by a scene and detaches its objects. */
export function disposeThreeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  const collectTextures = (value: unknown) => {
    if (value instanceof THREE.Texture) {
      textures.add(value);
      return;
    }
    if (Array.isArray(value)) value.forEach(collectTextures);
  };

  scene.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
      skeleton?: THREE.Skeleton;
    };
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.skeleton) renderable.skeleton.dispose();

    const objectMaterials = renderable.material
      ? Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material]
      : [];
    objectMaterials.forEach((material) => materials.add(material));
  });

  materials.forEach((material) => {
    Object.values(material).forEach(collectTextures);
    const shader = material as THREE.ShaderMaterial;
    if (shader.uniforms) {
      Object.values(shader.uniforms).forEach((uniform) => collectTextures(uniform.value));
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  scene.clear();
}
