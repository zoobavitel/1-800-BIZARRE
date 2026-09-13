#!/usr/bin/env node
/**
 * Generates per-section SRD markdown under public/srd/ from docs/1-(800)-BIZARRE SRD_DEV.md.
 * Run via prebuild/prestart.
 */

require("./splitSrd.js");
