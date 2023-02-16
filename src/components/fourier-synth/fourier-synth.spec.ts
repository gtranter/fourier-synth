import { newSpecPage } from '@stencil/core/testing';
import { FourierSynth } from './fourier-synth';

describe('fourier-synth', () => {
	it('renders', async () => {
		const { root } = await newSpecPage({
			components: [FourierSynth],
			html: '<fourier-synth></fourier-synth>',
		});
		expect(root).toBeDefined();
	});
});
