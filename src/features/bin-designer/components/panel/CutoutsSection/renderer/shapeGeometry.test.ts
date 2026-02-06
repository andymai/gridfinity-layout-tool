import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  sdfVertexShader,
  sdfFragmentShader,
  createSDFMaterial,
  cssColorToVec4,
} from './shapeGeometry';

describe('shapeGeometry', () => {
  describe('sdfVertexShader', () => {
    it('exports a non-empty shader string', () => {
      expect(typeof sdfVertexShader).toBe('string');
      expect(sdfVertexShader.length).toBeGreaterThan(0);
      expect(sdfVertexShader).toContain('varying vec2 vUv');
    });
  });

  describe('sdfFragmentShader', () => {
    it('exports a non-empty shader string', () => {
      expect(typeof sdfFragmentShader).toBe('string');
      expect(sdfFragmentShader.length).toBeGreaterThan(0);
      expect(sdfFragmentShader).toContain('uniform vec2 u_size');
    });
  });

  describe('createSDFMaterial', () => {
    it('returns a ShaderMaterial', () => {
      const material = createSDFMaterial({
        width: 10,
        depth: 10,
        cornerRadius: 1,
        shapeType: 0,
        fillColor: new THREE.Vector4(1, 0, 0, 0.5),
        strokeColor: new THREE.Vector4(0, 0, 1, 1),
        strokeWidth: 0.5,
      });

      expect(material).toBeInstanceOf(THREE.ShaderMaterial);
      expect(material.uniforms).toBeDefined();
      expect(material.uniforms.u_size).toBeDefined();
      expect(material.uniforms.u_cornerRadius).toBeDefined();
      expect(material.uniforms.u_fillColor).toBeDefined();
      expect(material.uniforms.u_strokeColor).toBeDefined();
      expect(material.uniforms.u_strokeWidth).toBeDefined();
      expect(material.uniforms.u_shapeType).toBeDefined();
    });
  });

  describe('cssColorToVec4', () => {
    it('converts CSS color to Vector4 with opacity', () => {
      const vec = cssColorToVec4('#ff0000', 0.5);

      expect(vec).toBeInstanceOf(THREE.Vector4);
      expect(vec.x).toBeCloseTo(1, 5); // Red
      expect(vec.y).toBeCloseTo(0, 5); // Green
      expect(vec.z).toBeCloseTo(0, 5); // Blue
      expect(vec.w).toBe(0.5); // Alpha
    });

    it('handles named colors', () => {
      const vec = cssColorToVec4('blue', 1.0);

      expect(vec.x).toBeCloseTo(0, 5);
      expect(vec.y).toBeCloseTo(0, 5);
      expect(vec.z).toBeCloseTo(1, 5);
      expect(vec.w).toBe(1.0);
    });
  });
});
