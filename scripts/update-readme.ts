#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { version } from '../package.json';

export default function main() {
	const readme = path.resolve('./readme.md').normalize();
	fs.readFile(readme, 'utf8', (error, fileString) => {
		if (error) {
			return console.error(`Unable to read file '${readme}' - ${error.message}.`);
		}

		const updated = fileString.replace(/fourier-synth@\d+\.\d+\.\d+(\-[0-9a-zA-Z-]+\.\d+)?/g, `fourier-synth@${version}`);

		fs.writeFile(readme, updated, 'utf8', (error) => {
			if (error) {
				return console.error(`Unable to write file '${readme}' - ${error.message}.`);
			}
			else {
				console.log(`Updated version in '${readme}'.`);
			}
		});
	});
}

main();
