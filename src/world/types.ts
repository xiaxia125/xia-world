import type * as THREE from "three";

export type WeatherType = "clear" | "rain" | "snow" | "fog";

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
}

export interface Interactable {
  id: string;
  object: THREE.Object3D;
  label: string;
  maxDistance?: number;
}

export interface ShelterZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  roofY: number;
}

export type Quality = "high" | "low";
