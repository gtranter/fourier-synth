import { newE2EPage } from '@stencil/core/testing';

describe('fourier-synth', () => {
	it('renders', async () => {
		const page = await newE2EPage();

		await page.setContent('<fourier-synth></fourier-synth>');
		const element = await page.find('fourier-synth');
		expect(element).toHaveClass('hydrated');
	});
});
