#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { gzip, tar, zip } from 'compressing';
import { name as PackageName, version as PackageVersion } from '../package.json';

/**
 * Create deploy files in tar, tgz, and zip format.
 *
 * Backs up existing files if any first.
 *
 */
export default function main() {
	const distDir = path.resolve(`./dist/${PackageName}`).normalize();

	if (!fs.existsSync(distDir)) {
		return console.error(`Cannot create deploy files - directory '${distDir}' does not exist.`);
	}

	if (fs.readdirSync(distDir).length === 0) {
		return console.error(`Cannot create deploy files - directory '${distDir}' is empty.`);
	}


	// create
	const deployDir = './deploy/';
	const deployPath = path.resolve(deployDir).normalize();

	if (!fs.existsSync(deployPath)) {
		fs.mkdirSync(deployPath);
	}

	const fileName = `${deployDir}${PackageName}`;
	const tarName = `${fileName}@${PackageVersion}.tar`;
	const tarFile = path.resolve(tarName).normalize();
	const tgzName = `${fileName}@${PackageVersion}.tgz`;
	const zipName = `${fileName}@${PackageVersion}.zip`;

	Promise.all([
		tar.compressDir(distDir, tarName).then(() => gzip.compressFile(tarFile, tgzName)).then(() => fs.rmSync(tarFile)),
		zip.compressDir(distDir, zipName)
	]).then(() => {
		console.log(`Created deploy files: '${tgzName}', '${zipName}'.`);

		// delete old versions
		const regexp = new RegExp(`^${PackageName}@${PackageVersion}\\.(tgz|zip)$`);
		fs.readdirSync(deployPath).forEach(deployFile => {
			if (!deployFile.match(regexp)) {
				fs.rmSync(path.resolve('./deploy', deployFile).normalize());
				console.log(`Deleted old deploy file '${deployFile}'.`);
			}
		});
	}, (error) => {
		return console.error('Deploy file creation failed!', error);
	}).catch((error) => {
		return console.error('Deploy file creation failed!', error);
	});

}

main();
