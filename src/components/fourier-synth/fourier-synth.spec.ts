import { newSpecPage } from '@stencil/core/testing';
import { FourierSynth } from './fourier-synth';

describe('fourier-synth', () => {
  it('renders', async () => {
    const { root } = await newSpecPage({
      components: [FourierSynth],
      html: '<fourier-synth></fourier-synth>',
    });
    expect(root).toEqualHtml(`
      <fourier-synth>
        <mock:shadow-root>
          <div>
            Hello, World! I'm
          </div>
        </mock:shadow-root>
      </fourier-synth>
    `);
  });

  it('renders with values', async () => {
    const { root } = await newSpecPage({
      components: [Fourier],
      html: `<fourier-synth first="Stencil" last="'Don't call me a framework' JS"></fourier-synth>`,
    });
    expect(root).toEqualHtml(`
      <fourier-synth first="Stencil" last="'Don't call me a framework' JS">
        <mock:shadow-root>
          <div>
            Hello, World! I'm Stencil 'Don't call me a framework' JS
          </div>
        </mock:shadow-root>
      </fourier-synth>
    `);
  });
});
