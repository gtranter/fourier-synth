import { newE2EPage } from '@stencil/core/testing';

describe('fourier-synth', () => {
	it('renders', async () => {
		const page = await newE2EPage();

		await page.setContent('<fourier-synth></fourier-synth>');
		const element = await page.find('fourier-synth');
		expect(element).toHaveClass('hydrated');
	});

	it('renders changes to the name data', async () => {
		const page = await newE2EPage();

		await page.setContent('<fourier-synth></fourier-synth>');
		const component = await page.find('fourier-synth');
		const element = await page.find('fourier-synth >>> .column :first-child');
		expect(element.textContent).toEqual(`Cosinus`);

		component.setProperty('cosName', 'COS');
		await page.waitForChanges();
		expect(element.textContent).toEqual(`COS`);
	});
});
