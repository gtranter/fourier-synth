import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';
import { name as PackageName } from './package.json';

export const config: Config = {
	namespace: PackageName,
	plugins: [
		sass()
	],
	outputTargets: [
		{
			type: 'dist',
			esmLoaderPath: '../loader',
		},
		{
			type: 'docs-vscode',
			file: 'vscode-docs.json',
		},
		{
			type: 'www',
			serviceWorker: null, // disable service workers
		}
	],
};
