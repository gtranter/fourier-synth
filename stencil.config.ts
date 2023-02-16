import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';

export const config: Config = {
	namespace: 'fourier-synth',
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
