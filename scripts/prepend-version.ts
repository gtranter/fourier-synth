#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { version } from '../package.json';

export default function main() {
	const distDir = path.resolve('./dist/fourier-synth').normalize();

	if (!fs.existsSync(distDir)) {
		return console.error(`Cannot prepend version - '${distDir}' not found.`);
	}

	// locate the file
	const file = path.join(distDir, 'fourier-synth.esm.js').normalize();
	if (!fs.existsSync(file)) {
		return console.error(`Cannot prepend version to '${file}' - file not found.`);
	}

	// delete the version number comment if there was one already existing
	// need this because "npm version" will do a build first, but with the wrong
	// version number.
	let fileContents = fs.readFileSync(file).toString();
	const versionRegex = /^\/\* v[0-9]+\.[0-9]+\.[0-9]+ \*\/\n/;
	if (fileContents.toString().match(versionRegex)){
		fileContents = fileContents.toString().replace(versionRegex, '');
	}

	// write the file with new version number
	fs.writeFileSync(file, `/* v${version} */\n${fileContents}`);

	console.log(`Updated version number 'v${version}' in '${file}'.`);
}

main();
