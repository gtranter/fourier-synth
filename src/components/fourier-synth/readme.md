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

Control over most features is provided through properties that are set through the attributes of the `<fourier-synth>` element.

```html
<fourier-synth
	audio-label="Enable Audio"
	axes-color="rgb(0, 127, 255)"
	background-color="rgb(0, 0, 0)"
	cos-title="Cos"
	endpoint-color="rgb(0, 255, 0)"
	endpoints-label="Enpoints"
	fundamental="220"
	fundamental-label="Fundamental"
	gain-label="Gain"
	graph-label="Show Graph"
	grid-dots-label="Grid Dots"
	harmonics="8"
	harmonics-label="Harmonics"
	hide-endpoints
	hide-graph
	hide-grid-dots
	hide-lines
	lines-label="Lines"
	main-title="Fourier Synthesis"
	periods="3"
	periods-label="Periods"
	reset-text="Reset"
	sin-title="Sin"
	wave-color="rgb(255, 0, 0)"
>Please enable JavaScript to use Fourier Synthesizer</fourier-synth>
```



## Properties

| Property           | Attribute           | Description                                                      | Type      | Default                 |
| ------------------ | ------------------- | ---------------------------------------------------------------- | --------- | ----------------------- |
| `audioLabel`       | `audio-label`       | Label text for the "Enable Audio" toggle switch.                 | `string`  | `'Enable Audio'`        |
| `axesColor`        | `axes-color`        | Color of graph background lines and dots. Use a CSS color value. | `string`  | `this.BLUE`             |
| `backgroundColor`  | `background-color`  | Background color of graph. Use a CSS color value.                | `string`  | `this.BLACK`            |
| `cosTitle`         | `cos-title`         | Title text for the cosine controls.                              | `string`  | `'Cos'`                 |
| `endpointColor`    | `endpoint-color`    | Color of the wave endpoint dots. Use a CSS color value.          | `string`  | `this.GREEN`            |
| `endpointsLabel`   | `endpoints-label`   | Text for the endpoints display control label.                    | `string`  | `'Endpoints'`           |
| `fundamental`      | `fundamental`       | The fundamental frequency of the fourier wave.                   | `number`  | `220`                   |
| `fundamentalLabel` | `fundamental-label` | Label for the fundamental control.                               | `string`  | `'Fundamental'`         |
| `gainLabel`        | `gain-label`        | Text for the gain control label.                                 | `string`  | `'Gain'`                |
| `graphLabel`       | `graph-label`       | Text for the graph display control label.                        | `string`  | `'Show Graph'`          |
| `gridDotsLabel`    | `grid-dots-label`   | Text for the grid dots display control label.                    | `string`  | `'Grid Dots'`           |
| `harmonics`        | `harmonics`         | Number of harmonics to control and produce.                      | `number`  | `8`                     |
| `harmonicsLabel`   | `harmonics-label`   | Label for the harmonics control.                                 | `string`  | `'Harmonics'`           |
| `hideEnpoints`     | `hide-enpoints`     | Don't display the wave endpoint dots.                            | `boolean` | `false`                 |
| `hideGraph`        | `hide-graph`        | Don't display the graph.                                         | `boolean` | `false`                 |
| `hideGridDots`     | `hide-grid-dots`    | Don't display the graph background dots.                         | `boolean` | `false`                 |
| `hideLines`        | `hide-lines`        | Don't display the graph background lines.                        | `boolean` | `false`                 |
| `linesLabel`       | `lines-label`       | Text for the lines display control label.                        | `string`  | `'Lines'`               |
| `mainTitle`        | `main-title`        | Text for the main title. Set empty to exclude the title.         | `string`  | `'Fourier Synthesizer'` |
| `periods`          | `periods`           | Number of wave periods to display in the graph.                  | `number`  | `3`                     |
| `periodsLabel`     | `periods-label`     | Text for periods control label.                                  | `string`  | `'Periods'`             |
| `resetText`        | `reset-text`        | Text for the reset button.                                       | `string`  | `'Reset'`               |
| `sinTitle`         | `sin-title`         | Title text for the sine controls.                                | `string`  | `'Sin'`                 |
| `waveColor`        | `wave-color`        | Color of graph lines and dots. Use a CSS color value.            | `string`  | `this.RED`              |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
