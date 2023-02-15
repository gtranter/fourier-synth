#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

const TARGET_FILE = "package.json";
const DIST = "dist/fourier-synth";

export async function prependVersion(packageJsonName, distDirName) {

    const packageJson = path.join('./', packageJsonName).normalize();
    const distDir = path.join('./', distDirName).normalize();

    if (!fs.existsSync(packageJson)) {
        console.error(`${packageJson} not found! Exiting`);
        return;
    }

    if (!fs.existsSync(distDir)) {
        console.error(`${distDir} not found! Exiting`);
        return;
    }

    const packageJsonContents = JSON.parse(fs.readFileSync(packageJson).toString());

    if (!packageJsonContents) {
        console.error('Could not read package.json');
        return;
    }

    const version = packageJsonContents.version;

    // update these items with the version
    const itemLoc = path.join(distDir, 'fourier-synth.esm.js').normalize();

    if (!fs.existsSync(itemLoc)) {
        console.error(`${itemLoc} not found! Exiting`);
        return
    }

    let fileContents = fs.readFileSync(itemLoc).toString();
    const versionRegex = /^\/\* v[0-9]+\.[0-9]+\.[0-9]+ \*\/\n/;
    // delete the version number comment if there was one already existing
    // need this because "npm version" will do a build first, but with the wrong
    // version number.
    if (fileContents.toString().match(versionRegex)){
        fileContents = fileContents.toString().replace(versionRegex, '');
    }
    fs.writeFileSync(itemLoc, `/* v${version} */\n` + fileContents);
    console.log(`updated version number for ${itemLoc}`);
}

async function main() {
    prependVersion(TARGET_FILE, DIST);
}

export default function() {
    main();
}

// Running main() is important as this script is used in the bin
// Nothing happens if you don't run main().
// You can comment it out when runing test though,
// if you get annoyed at the weird error outputs
main();
