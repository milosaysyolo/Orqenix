// SPDX-License-Identifier: Apache-2.0
// Vitest setup: mock native modules that can't be compiled for the local Node version.
// Uses Node built-in zlib as a drop-in for zstd, since both are general-purpose
// compression. Not byte-identical but functionally equivalent for tests.

import { vi } from 'vitest';

// Mock @mongodb-js/zstd with Node zlib (deflate/inflate)
vi.mock('@mongodb-js/zstd', () => {
  const { promisify } = require('util');
  const { deflate, inflate } = require('node:zlib');
  return {
    compress: promisify(deflate),
    decompress: promisify(inflate),
  };
});
