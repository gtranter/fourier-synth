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
	audio-label="Enable audio"
	autoAdjust
	autoAdjustLabel="Auto adjust"
	axes-color="rgb(0, 127, 255)"
	background-color="rgb(0, 0, 0)"
	cos-title="Cos"
	dividers-label="Dividers"
	endpoints-label="Endpoints"
	fundamental="220"
	fundamental-label="Fundamental"
	gain-label="Gain"
	graph-label="Show graph"
	grid-dots-label="Grid dots"
	harmonics="8"
	harmonics-label="Harmonics"
	hide-dividers
	hide-endpoints
	hide-graph
	hide-grid-dots
	hide-offset
	line-color="rgb(255, 0, 0)"
	line-width="3"
	line-width-label="Line width"
	main-title="Fourier Synthesis"
	max-harmonics="100"
	offset-color="rgb(0, 255, 0)"
	offset-label="Offset"
	periods="3"
	periods-label="Periods"
	reset-text="Reset"
	sin-title="Sin"
>Please enable JavaScript to use Fourier Synthesizer</fourier-synth>
```



## Properties

| Property           | Attribute           | Description                                                                                                                                                                                                                                                                                                                           | Type      | Default                 |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------- |
| `audioLabel`       | `audio-label`       | Text for the enable audio control label.                                                                                                                                                                                                                                                                                              | `string`  | `'Enable audio'`        |
| `autoAdjust`       | `auto-adjust`       | Automatically adjust the gain and DC offset (cos0) to match the wave.                                                                                                                                                                                                                                                                                      | `boolean` | `false`                 |
| `autoAdjustLabel`  | `auto-adjust-label` | Text for the auto adjust control label.                                                                                                                                                                                                                                                                                               | `string`  | `'Auto adjust'`         |
| `axesColor`        | `axes-color`        | Color of graph background lines and dots. Use a CSS color value.                                                                                                                                                                                                                                                                      | `string`  | `this.BLUE`             |
| `backgroundColor`  | `background-color`  | Background color of graph. Use a CSS color value.                                                                                                                                                                                                                                                                                     | `string`  | `this.BLACK`            |
| `cosTitle`         | `cos-title`         | Title text for the cosine controls.                                                                                                                                                                                                                                                                                                   | `string`  | `'Cos'`                 |
| `dividersLabel`    | `dividers-label`    | Text for the dividers display control label. Set the text empty to hide the control.                                                                                                                                                                                                                                                  | `string`  | `'Dividers'`            |
| `endpointsLabel`   | `endpoints-label`   | Text for the endpoints display control label. Set the text empty to hide the control.                                                                                                                                                                                                                                                 | `string`  | `'Endpoints'`           |
| `fundamental`      | `fundamental`       | The fundamental frequency of the fourier wave.                                                                                                                                                                                                                                                                                        | `number`  | `220`                   |
| `fundamentalLabel` | `fundamental-label` | Text for the fundamental control label. Set the text empty to hide the control.                                                                                                                                                                                                                                                       | `string`  | `'Fundamental'`         |
| `gainLabel`        | `gain-label`        | Text for the gain control label.                                                                                                                                                                                                                                                                                                      | `string`  | `'Gain'`                |
| `graphLabel`       | `graph-label`       | Text for the graph display control label.                                                                                                                                                                                                                                                                                             | `string`  | `'Show graph'`          |
| `gridDotsLabel`    | `grid-dots-label`   | Text for the grid dots display control label. Set the text empty to hide the control.                                                                                                                                                                                                                                                 | `string`  | `'Grid dots'`           |
| `harmonics`        | `harmonics`         | Number of harmonics to control and produce.                                                                                                                                                                                                                                                                                           | `number`  | `8`                     |
| `harmonicsLabel`   | `harmonics-label`   | Text for the harmonics control label. Set the text empty to hide the control.                                                                                                                                                                                                                                                         | `string`  | `'Harmonics'`           |
| `hideDividers`     | `hide-dividers`     | Don't display the fundamental wave divider lines.                                                                                                                                                                                                                                                                                     | `boolean` | `false`                 |
| `hideEnpoints`     | `hide-enpoints`     | Don't display the fundamental wave endpoint dots.                                                                                                                                                                                                                                                                                     | `boolean` | `false`                 |
| `hideGraph`        | `hide-graph`        | Don't display the graph.                                                                                                                                                                                                                                                                                                              | `boolean` | `false`                 |
| `hideGridDots`     | `hide-grid-dots`    | Don't display the graph background dots.                                                                                                                                                                                                                                                                                              | `boolean` | `false`                 |
| `hideOffset`       | `hide-offset`       | Don't display the graph DC offset line.                                                                                                                                                                                                                                                                                               | `boolean` | `false`                 |
| `lineColor`        | `line-color`        | Color of the waveform line. Use a CSS color value.                                                                                                                                                                                                                                                                                    | `string`  | `this.RED`              |
| `lineWidth`        | `line-width`        | The width of the wave plot line.                                                                                                                                                                                                                                                                                                      | `number`  | `3`                     |
| `lineWidthLabel`   | `line-width-label`  | Text for the line width control label. Set the text empty to hide the control.                                                                                                                                                                                                                                                        | `string`  | `'Line width'`          |
| `mainTitle`        | `main-title`        | Text for the main title. Set the text empty to hide the title.                                                                                                                                                                                                                                                                        | `string`  | `'Fourier Synthesizer'` |
| `maxHarmonics`     | `max-harmonics`     | Limit of the number of harmonics. The actual highest possible number of harmonics is based on the frequency. The highest possible harmonic frequency is 20000Hz. At the lowest fundamental 20Hz there can therefore be up to 1000 harmonics. High values can crash, hang, or otherwise bring the browser to a halt. USE WITH CAUTION. | `number`  | `100`                   |
| `offsetColor`      | `offset-color`      | Color of the graph DC offset line and wave endpoint dots. Use a CSS color value.                                                                                                                                                                                                                                                      | `string`  | `this.GREEN`            |
| `offsetLabel`      | `offset-label`      | Text for the offset display control label. Set the text empty to hide the control.                                                                                                                                                                                                                                                    | `string`  | `'Offset'`              |
| `periods`          | `periods`           | Number of wave periods to display in the graph. From 1 to 5.                                                                                                                                                                                                                                                                          | `number`  | `3`                     |
| `periodsLabel`     | `periods-label`     | Text for the periods control label. Set the text empty to hide the control.                                                                                                                                                                                                                                                           | `string`  | `'Periods'`             |
| `resetText`        | `reset-text`        | Text for the reset button.                                                                                                                                                                                                                                                                                                            | `string`  | `'Reset'`               |
| `sinTitle`         | `sin-title`         | Title text for the sine controls.                                                                                                                                                                                                                                                                                                     | `string`  | `'Sin'`                 |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
