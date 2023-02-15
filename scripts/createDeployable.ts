import * as fs from 'fs';
import * as path from 'path';
import { gzip, tar, zip } from 'compressing';

/**
 * Create deploy files in tar, tgz, and zip format.
 *
 * Backs up existing files if any first.
 *
 */
export default function main() {
	const file = './dist/fourier-synth';
	const distDir = path.resolve(file);
	const time = Date.now();
	const tarName = `${file}.tar`;
	const tarFile = path.resolve(tarName);
	const tarTempName = `${file}.tar.${time}`;
	const tarTempFile = path.resolve(tarTempName);
	const tgzName = `${file}.tgz`;
	const tgzFile = path.resolve(tgzName);
	const tgzTempName = `${file}.tgz.${time}`;
	const tgzTempFile = path.resolve(tgzTempName);
	const zipName = `${file}.zip`;
	const zipFile = path.resolve(zipName);
	const zipTempName = `${file}.zip.${time}`;
	const zipTempFile = path.resolve(zipTempName);

	if (fs.existsSync(distDir)) {
		// backup
		if (fs.existsSync(tarFile)) {
			fs.renameSync(tarFile, tarTempFile);
		}
		if (fs.existsSync(tgzFile)) {
			fs.renameSync(tgzFile, tgzTempFile);
		}
		if (fs.existsSync(zipFile)) {
			fs.renameSync(zipFile, zipTempFile);
		}

		// create
		Promise.all([
			tar.compressDir(distDir, tarName).then(() => gzip.compressFile(tarFile, tgzName)),
			zip.compressDir(distDir, zipName)
		]).then((_resolved) => {
				// clean up
				fs.rm(tarTempFile, () => {});
				fs.rm(tgzTempFile, () => {});
				fs.rm(zipTempFile, () => {});
				console.log('Created deploy files:', tarName, tgzName, zipName);
			}, (_rejected) => {
				// restore
				fs.rename(tarTempFile, tarFile, () => {});
				fs.rename(tgzTempFile, tgzFile, () => {});
				fs.rename(zipTempFile, zipFile, () => {});
				console.error('Deploy file creation failed!');
			}
		).catch(() => {
			console.error('Deploy file creation failed!');
		});
	}
}

main();
