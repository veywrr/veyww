import test from 'node:test';import assert from 'node:assert/strict';import {waveEnergy} from '../web/audio-wave.mjs';
test('wave energy follows audio samples, remains silent at midpoint and is bounded',()=>{assert.equal(waveEnergy(new Uint8Array(128).fill(128)),0);assert.ok(waveEnergy([100,156])>waveEnergy([120,136]));assert.equal(waveEnergy([0,255]),1);assert.equal(waveEnergy(null),0);});
