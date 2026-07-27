// SPDX-License-Identifier: Apache-2.0

import { store } from './memory';

// ---- READS -----------------------------------------------------------------

export function getSettings() { return store().settings; }
