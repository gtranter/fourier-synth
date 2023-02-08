# Fourier Synthesizer `<fourier-synth>`

<img alt="fourier-synth" src="fourier-synth.png" width="400" />


<!-- Auto Generated Below -->


## Overview

The Fourier Synthesizer web component is an interactive waveform and sound generator based on Fourier synthesis.

## Layout
The size of the synthesizer will by default be as large as possible within the web page. You can use CSS width and height properties and/or page layout to control the size if necessary.
```html
<fourier-synth style="width: 800px;"></fourier-synth>
```

## Usage

### 1. Basic

Only a `<fourier-synth>` element is required to use the component. Because JavaScript is required, a placeholder message can be placed inside the element to alert users that haven't enabled JavaScript.
```html
<fourier-synth>Please enable JavaScript to use Fourier Synthesizer</fourier-synth>
```


### 2. Advanced

Control over most features is provided through properties that are set as attributes on the `<fourier-synth>` element.
```html
<fourier-synth
	audio-label="Enable Audio"
	axes-color="rgb(0, 127, 255)"
	background-color="rgb(0, 0, 0)"
	cos-title="Cos"
	fundamental="220"
	frequency-label="Fundamental"
	gain-label="Gain"
	harmonics="10"
	harmonics-label="Harmonics"
	hide-dots
	hide-intersections
	hide-lines
	intersection-color="rgb(0, 255, 0)"
	main-title="Fourier Synthesis"
	reset-text="Reset"
	sin-title="Sin"
	wave-color="rgb(255, 0, 0)"
	wave-count="3"
>Please enable JavaScript to use Fourier Synthesizer</fourier-synth>
```



## Properties

| Property            | Attribute            | Description                                                                     | Type      | Default                  |
| ------------------- | -------------------- | ------------------------------------------------------------------------------- | --------- | ------------------------ |
| `audioLabel`        | `audio-label`        | Label text for the "Enable Audio" toggle switch.                                | `string`  | `'Enable Audio'`         |
| `axesColor`         | `axes-color`         | Color of graph background lines and dots. Use any CSS color value.              | `string`  | `this.BLUE`              |
| `backgroundColor`   | `background-color`   | Background color of graph. Use any CSS color value.                             | `string`  | `this.BLACK`             |
| `cosTitle`          | `cos-title`          | Title text for the cosine controls.                                             | `string`  | `'Cos'`                  |
| `frequencyLabel`    | `frequency-label`    | Label for the frequency control.                                                | `string`  | `'Fundamental'`          |
| `fundamental`       | `fundamental`        | The fundamental frequency of the fourier wave.                                  | `number`  | `220`                    |
| `gainLabel`         | `gain-label`         | Text for the gain control label.                                                | `string`  | `'Gain'`                 |
| `harmonics`         | `harmonics`          | Number of harmonics to control and produce.                                     | `number`  | `8`                      |
| `harmonicsLabel`    | `harmonics-label`    | Label for the harmonics control.                                                | `string`  | `'Harmonics'`            |
| `hideDots`          | `hide-dots`          | Don't display the graph background dots.                                        | `boolean` | `false`                  |
| `hideIntersections` | `hide-intersections` | Don't display the wave and vertical axis intersection dots.                     | `boolean` | `false`                  |
| `hideLines`         | `hide-lines`         | Don't display the graph background lines.                                       | `boolean` | `false`                  |
| `intersectionColor` | `intersection-color` | Color of the wave and vertical axis intersection dots. Use any CSS color value. | `string`  | `this.GREEN`             |
| `mainTitle`         | `main-title`         | Text for the main title. Set empty to exclude the title.                        | `string`  | `'Fourier Synthesizer'`  |
| `resetText`         | `reset-text`         | Text for the reset button.                                                      | `string`  | `'Reset'`                |
| `sinTitle`          | `sin-title`          | Title text for the sine controls.                                               | `string`  | `'Sin'`                  |
| `waveColor`         | `wave-color`         | Color of graph lines and dots. Use any CSS color value.                         | `string`  | `this.RED`               |
| `waveCount`         | `wave-count`         | Number of waves to display in the graph.                                        | `number`  | `3`                      |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
