#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { name as PackageName, version as PackageVersion } from '../package.json';

export default function main() {
	const regexp = RegExp(`${PackageName}@\\d+\\.\\d+\\.\\d+(\\-[0-9a-zA-Z-]+\\.\\d+)?`, 'g');

	const readme = path.resolve('./readme.md').normalize();
	fs.readFile(readme, 'utf8', (error, fileString) => {
		if (error) {
			return console.error(`Unable to read file '${readme}' - ${error.message}.`);
		}

		const updated = fileString.replace(regexp, `${PackageName}@${PackageVersion}`);

		fs.writeFile(readme, updated, 'utf8', (error) => {
			if (error) {
				return console.error(`Unable to write file '${readme}' - ${error.message}.`);
			}
			else {
				console.log(`Updated version in '${readme}'.`);
			}
		});
	});

	const demo = path.resolve(`./${PackageName}.html`).normalize();
	fs.readFile(demo, 'utf8', (error, fileString) => {
		if (error) {
			return console.error(`Unable to read file '${demo}' - ${error.message}.`);
		}

		const updated = fileString
			.replace(regexp, `${PackageName}@${PackageVersion}`)
			.replace(/\/v\d+\.\d+\.\d+(\-[0-9a-zA-Z-]+\.\d+)?\//g, `/v${PackageVersion}/`);

		fs.writeFile(demo, updated, 'utf8', (error) => {
			if (error) {
				return console.error(`Unable to write file '${demo}' - ${error.message}.`);
			}
			else {
				console.log(`Updated version in '${demo}'.`);
			}
		});
	});
}

main();
