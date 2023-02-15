# Fourier Synthesizer Web Component

This project is a standalone Web Component for generating waveforms and audio using Fourier synthesis.

<img alt="fourier-synth" src="src/components/fourier-synth/fourier-synth.png" width="400" />

---

## Develop

For information about development using this project see [develop.md](./develop.md).

---

## Use on the web

To use the Fourier Synthesizer web component on your web site, you need to import the component and add the custom element tag to your page(s).

### Script import

Add a script tag to the `<head>` section of your page. Replace `https://my.domain/server-path/` shown below with the path where the component folder is stored on your server or elsewhere.
```html
<script type="module" src="https://my.domain/server-path/fourier-synth/fourier-synth.esm.js"></script>
```

#### Hosting

Download one of the deploy files [fourier-synth.tar](./fourier-synth.tar), [fourier-synth.tgz](./fourier-synth.tgz), [fourier-synth.zip](./fourier-synth.zip), and extract the contents. The extracted `fourier-synth` folder should be copied to your server including all contents. The name of the folder is not important, but it must match the `src` value of your page's script tag.

#### Serving from unpkg.com !!! COMING SOON !!!
If you don't need guaranteed availability, you can use the component from unpkg.com.
```html
<script type="module" src="https://unpkg.com/fourier-synth@0.0.1/dist/fourier-synth/fourier-synth.esm.js"></script>
```

### Element tag

Add the element somewhere on your web page. Remember to use style or layout to control the size of the component.
```html
<fourier-synth>Please enable JavaScript to use Fourier Synthesizer</fourier-synth>
```

---

## Customization

To customize the features of the componet or translate to another language, see the [readme file](./src/components/fourier-synth/readme.md) for the web component.
