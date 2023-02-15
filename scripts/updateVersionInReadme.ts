import * as fs from 'fs';
import * as path from 'path';
import { version } from '../package.json';

export default function main() {
	const readme = path.resolve('./readme.md');
	fs.readFile(readme, 'utf8', (err, fileString) => {
		if (err) {
			return console.log('Unable to read file', readme, err);
		}
		const updated = fileString.replace(/fourier-synth\@\d+\.\d+\.\d+/, `fourier-synth@${version}`);

		fs.writeFile(readme, updated, 'utf8', (err) => {
			if (err) {
				return console.log('Unable to write file', readme, err);
			}
			else {
				console.log('Updated version in', readme);
			}
		});
	});
}

main();
