// Manual mock for @mongodb-js/zstd native module.
// Uses Node zlib deflate/inflate as a JS-only substitute.
// Not byte-identical to zstd but functionally equivalent for tests.
'use strict';
const { promisify } = require('util');
const { deflate, inflate } = require('node:zlib');
module.exports = { compress: promisify(deflate), decompress: promisify(inflate) };
