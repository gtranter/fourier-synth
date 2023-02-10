import { Component, Host, h, State, Prop, Element, Watch } from '@stencil/core';

export interface FourierData {
	label: string,
	value: number
}

/**
 * The Fourier Synthesizer web component is an interactive waveform and sound generator based on Fourier synthesis.
 *
 * ## Layout
 * The size of the synthesizer will by default be as large as possible within the web page. You can use CSS width and height properties and/or page layout to control the size if necessary.
 * ```html
 * <fourier-synth style="width: 800px;"></fourier-synth>
 * ```
 */
@Component({
	tag: 'fourier-synth',
	styleUrl: 'fourier-synth.scss',
	shadow: true,
})
export class FourierSynth {

	// constants
	private readonly CONTROL_RANGE: number = 100.0;
	private readonly FREQUENCY_MAX: number = 20000;
	private readonly FREQUENCY_MIN: number = 20;
	private readonly GAIN_MAX: number = 1.0;

	// color constants
	private readonly BLACK: string = 'rgb(0, 0, 0)';
	private readonly BLUE: string = 'rgb(0, 127, 255)';
	private readonly GREEN: string = 'rgb(0, 255, 0)';
	private readonly RED: string = 'rgb(255, 0, 0)';

	private _audioContext: AudioContext;
	private _canvas: HTMLCanvasElement;
	private _data: Record<string, FourierData> = {};
	private _fieldFormatter = Intl.NumberFormat(navigator.language, {minimumFractionDigits: 1, maximumFractionDigits: 1});
	private _gain: GainNode;
	private _oscillator: OscillatorNode;
	private _renderer: CanvasRenderingContext2D;
	private _gainFormatter = Intl.NumberFormat(navigator.language, {minimumFractionDigits: 2, maximumFractionDigits: 2});

	@Element() hostElement: HTMLFourierSynthElement;

	/**
	 * Toggle for turning sound on and off.
	 */
	@State() enableAudio: boolean = false;
	@Watch('enableAudio')
	handleEnableAudioChange(newValue: boolean) {
		if (newValue) {
			this._play()
		}
		else {
			this._audioContext?.suspend();
		}
	}

	/**
	 * Manually updated to trigger rendering.
	 */
	@State() updates: number = 0;

	/**
	 * Gain is the 0-1 value of the slider that will be converted to logarithmic gain and displayed in dB.
	 */
	@State() gain: number = this.GAIN_MAX;
	@Watch('gain')
	handleGainChange(newValue: number) {
		this.gain = Math.max(0, Math.min(newValue, this.GAIN_MAX));
		if (this._gain) {
			this._gain.gain.value = this.gain;
		}
		this._plot();
	}

	/**
	 * Label text for the "Enable Audio" toggle switch.
	 */
	@Prop({reflect: true}) audioLabel: string = 'Enable Audio';

	/**
	 * Color of graph background lines and dots. Use a CSS color value.
	 */
	@Prop() axesColor: string = this.BLUE;

	/**
	 * Background color of graph. Use a CSS color value.
	 */
	@Prop() backgroundColor: string = this.BLACK;

	/**
	 * Title text for the cosine controls.
	 */
	@Prop({reflect: true}) cosTitle: string = 'Cos';

	/**
	 * Color of the wave endpoint dots. Use a CSS color value.
	 */
	@Prop() endpointColor: string = this.GREEN;

	/**
	 * Text for the endpoints display control label.
	 */
	@Prop({reflect: true}) endpointsLabel: string = 'Endpoints';

	/**
	 * The fundamental frequency of the fourier wave.
	 */
	@Prop({reflect: true, mutable: true}) fundamental: number = 220;
	@Watch('fundamental')
	handleFundamentalChange(newValue: number) {
		// apply bounds
		this.fundamental = newValue = Math.max(this.FREQUENCY_MIN, Math.min(newValue, this.FREQUENCY_MAX));
		// remove harmonics over 20000Hz
		const maxHarmonics = Math.floor(this.FREQUENCY_MAX / newValue);
		if (maxHarmonics < this.harmonics) {
			this.handleHarmonicsChange(maxHarmonics, this.harmonics)
		}
		this._update();
	}

	/**
	 * Label for the fundamental control.
	 */
	@Prop({reflect: true}) fundamentalLabel: string = 'Fundamental';

	/**
	 * Text for the gain control label.
	 */
	@Prop({reflect: true}) gainLabel: string = 'Gain';

	/**
	 * Text for the graph display control label.
	 */
	@Prop({reflect: true}) graphLabel: string = 'Show Graph';

	/**
	 * Text for the grid dots display control label.
	 */
	@Prop({reflect: true}) gridDotsLabel: string = 'Grid Dots';

	/**
	 * Number of harmonics to control and produce.
	 */
	@Prop({reflect: true, mutable: true}) harmonics: number = 8;
	@Watch('harmonics')
	handleHarmonicsChange(newValue: number, oldValue: number) {
		// apply bounds based on frequency
		this.harmonics = newValue = this._checkHarmonicsBounds(newValue);

		// update data
		if (newValue < oldValue) {
			for (let harmonic = newValue + 1; harmonic <= oldValue; harmonic++) {
				delete this._data[`cos${harmonic}`];
				delete this._data[`sin${harmonic}`];
			}
		}
		else {
			for (let harmonic = oldValue + 1; harmonic <= newValue; harmonic++) {
				this._data[`cos${harmonic}`] = {
					label: `A<sub>${harmonic}</sub>`,
					value: 0
				};
				if (harmonic > 0) {
					this._data[`sin${harmonic}`] = {
						label: `B<sub>${harmonic}</sub>`,
						value: 0
					};
				}
			}
		}

		this._update();
	}

	/**
	 * Label for the harmonics control.
	 */
	@Prop({reflect: true}) harmonicsLabel: string = 'Harmonics';

	/**
	 * Don't display the wave endpoint dots.
	 */
	@Prop({mutable: true}) hideEnpoints: boolean = false;
	@Watch('hideEnpoints')
	handleHideEndpointsChange() {
		this._plot();
	}

	/**
	 * Don't display the graph.
	 */
	@Prop({mutable: true}) hideGraph: boolean = false;
	@Watch('hideGraph')
	handleHideGraphChange() {
		this._plot();
	}

	/**
	 * Don't display the graph background dots.
	 */
	@Prop({mutable: true}) hideGridDots: boolean = false;
	@Watch('hideGridDots')
	handleHideGridDotsChange() {
		this._plot();
	}

	/**
	 * Don't display the graph background lines.
	 */
	@Prop({mutable: true}) hideLines: boolean = false;
	@Watch('hideLines')
	handleHideLinesChange() {
		this._plot();
	}

	/**
	 * Text for the lines display control label.
	 */
	@Prop({reflect: true}) linesLabel: string = 'Lines';

	/**
	 * Text for the main title. Set empty to exclude the title.
	 */
	@Prop({reflect: true}) mainTitle: string = 'Fourier Synthesizer';

	/**
	 * Color of graph lines and dots. Use a CSS color value.
	 */
	@Prop() waveColor: string = this.RED;

	/**
	 * Number of wave periods to display in the graph.
	 */
	@Prop({reflect: true, mutable: true}) periods: number = 3;
	@Watch('periods')
	handlePeriodsChange(newValue: number) {
		this.periods = newValue = Math.max(1, Math.min(newValue, 10));
		this._plot();
	}

	/**
	 * Text for periods control label.
	 */
	@Prop({reflect: true}) periodsLabel: string = 'Periods';

	/**
	 * Text for the reset button.
	 */
	@Prop({reflect: true}) resetText: string = 'Reset';

	/**
	 * Title text for the sine controls.
	 */
	@Prop({reflect: true}) sinTitle: string = 'Sin';

	/**
	 * Stencil initialization.
	 */
	async componentWillLoad() {
		// initialize data by setting harmonics
		this.handleHarmonicsChange(this.harmonics, -1);

		this.handleFundamentalChange(this.fundamental);

		this.handlePeriodsChange(this.periods);
	}

	/**
	 * Stencil post-initialization.
	 * Add listeners and set up canvas context for drawing graph. Draw graph.
	 */
	async componentDidLoad() {
		// block non numeric input on fields
		const decimal = this._fieldFormatter.formatToParts(1.1).find(p => p.type === 'decimal')?.value ?? '.';
		const regexp = RegExp(`[-\\d${decimal}]`, 'g');
		this.hostElement.shadowRoot.querySelectorAll('.field').forEach(input => {
			// input[type=number] does not support `pattern` and JSX does not support `onBeforeInput`
			// se we need to manually add beforeInput listeners to restrict input characters
			input.addEventListener('beforeinput', (event: InputEvent) => {
				if (event.data != null && !event.data.match(regexp)) {
					event.preventDefault();
				}
			});
		});

		// set up canvas renderer
		this._renderer = this._canvas.getContext('2d');

		this._plot();
	}

	/**
	 * Check the harmonics value for min and max based on frequency.
	 * @param harmonics Number of harmonics
	 * @returns At least 1 and no more than would stay below 20000Hz
	 */
	private _checkHarmonicsBounds(harmonics: number): number {
		return Math.max(1, Math.min(harmonics, Math.floor(this.FREQUENCY_MAX / this.fundamental)));
	}

	/**
	 * Handle user entering frequency - only trigger update if it is within bounds
	 * so that the value isn't changed while the user is typing.
	 * The change event handler will handle update and the property watch will
	 * correct out of bounds values.
	 * @param frequency Value of the frequency under edit
	 */
	private _onFundamentalInput(frequency: number) {
		if (this.FREQUENCY_MIN <= frequency && frequency <= this.FREQUENCY_MAX) {
			this.fundamental = frequency;
		}
	}

	/**
	 * Generate audio stream from the data.
	 */
	private _play() {
		if (!this.enableAudio) {
			return;
		}
		if (!this._audioContext) {
			// first time - set up audio
			this._audioContext = new AudioContext();
			this._gain = this._audioContext.createGain();
			this._gain.gain.value = this.gain;
			this._oscillator = this._audioContext.createOscillator();
			this._oscillator.connect(this._gain).connect(this._audioContext.destination);
			this._oscillator.start();
		}

		this._oscillator.frequency.value = this.fundamental;

		// generate wave
		const cos = new Float32Array(this.harmonics + 1);
		const sin = new Float32Array(this.harmonics + 1);
		sin[0] = 0;
		Object.entries(this._data).forEach(entry => {
			const id = entry[0];
			const isCos = id.startsWith('cos');
			const harmonic = Number(id.substring(3));
			const value = entry[1].value / this.CONTROL_RANGE;
			if (isCos) {
				cos[harmonic] = value;
			}
			else if (harmonic > 0) {
				sin[harmonic] = value;
			}
		});

		const wave = this._audioContext.createPeriodicWave(cos, sin, { disableNormalization: true });
		this._oscillator.setPeriodicWave(wave);

		// play
		this._audioContext.resume();
	}

	/**
	 * Draw the waveform derived from the data.
	 */
	private _plot() {
		if (!this._canvas || this.hideGraph) {
			return;
		}

		// set the canvas size
		const maxX = this._canvas.offsetWidth;
		const maxY = this._canvas.offsetHeight;
		const halfY = maxY / 2;
		this._canvas.width = maxX;
		this._canvas.height = maxY;

		// fill background
		this._renderer.fillStyle = this.backgroundColor || this.BLACK;
		this._renderer.fillRect(0, 0, maxX, maxY);

		// the length of one waveform in pixels
		const wavelength = maxX / this.periods;

		// draw grid dots
		if (!this.hideGridDots) {
			let gridSize = wavelength / this.harmonics;
			// make grid size no smaller than 10, but aligned to wavelength
			for (let harmonic = this.harmonics - 1; gridSize < 10; harmonic--) {
				gridSize = wavelength / harmonic;
			}

			// figure out where to start vertically so that the dot grid is centered
			const startY = halfY % gridSize;

			this._renderer.fillStyle = this.axesColor || this.BLUE;
			for (let x = gridSize; x < maxX; x += gridSize) {
				for (let y = startY; y < maxY; y += gridSize) {
					this._renderer.beginPath();
					this._renderer.arc(x, y, 1, 0, Math.PI * 2, true);
					this._renderer.fill();
					this._renderer.closePath();
				}
			}
		}

		// draw axes
		this._renderer.lineWidth = 2;
		this._renderer.strokeStyle = this.axesColor || this.BLUE;
		this._renderer.beginPath();

		// horizontal
		this._renderer.beginPath();
		this._renderer.moveTo(0, halfY);
		this._renderer.lineTo(maxX, halfY);
		this._renderer.stroke();
		this._renderer.closePath();

		// vertical
		if (!this.hideLines) {
			this._renderer.beginPath();
			for (let x = wavelength; x < maxX; x += wavelength) {
				this._renderer.moveTo(x, 0);
				this._renderer.lineTo(x, maxY);
			}
			this._renderer.stroke();
			this._renderer.closePath();
		}

		// draw wave

		this._renderer.lineWidth = 3;
		this._renderer.strokeStyle = this.waveColor || this.RED;
		this._renderer.beginPath();

		const timeBase = (wavelength / 2.0) / Math.PI;

		// scale the y values so that at max gain a single harmonic wave would occupy the full height of the graph
		const scaleY = halfY / this.CONTROL_RANGE;

		// y starts at the vertical center +/- the scaled DC offset which can be +/- one full wave
		const yCenter = halfY - (scaleY * this._data.cos0.value);

		let yFirst = 0;
		let yPrev = 0;

		for (let x = 0; x < wavelength; x++) {
			// start at zero
			let y = 0;

			// add fourier series modificationss
			for (let harmonic = 1; harmonic <= this.harmonics; harmonic++) {
				// invert because the canvas is "upside down" relative to graph +/-
				y -= this._data[`cos${harmonic}`].value * Math.cos(harmonic * x / timeBase);
				y -= this._data[`sin${harmonic}`].value * Math.sin(harmonic * x / timeBase);
			}

			// adjust by scale, gain, and offset
			y = y * scaleY * this.gain + yCenter;

			if (x === 0) {
				yFirst = y;
				yPrev = y;
			}
			else {
				// x needs to be 1 pixel to the left otherwise the peaks don't align with the endpoint dots and lines
				for (let waveStart = x - 1; waveStart <= maxX; waveStart += wavelength) {
					this._renderer.moveTo(waveStart - 0.5, yPrev);
					this._renderer.lineTo(waveStart + 0.5, y);
				}
				yPrev = y;
			}
		}
		this._renderer.stroke();
		this._renderer.closePath();

		// end the waveform
		this._renderer.fillStyle = this.endpointColor || this.GREEN;
		for (let x = 0; x <= maxX; x += wavelength) {
			// finish path between last and first y
			this._renderer.beginPath();
			this._renderer.moveTo(x - 0.5, yPrev);
			this._renderer.lineTo(x + 0.5, yFirst);
			this._renderer.stroke();
			this._renderer.closePath();

			// wave endpoint dots
			if (!this.hideEnpoints) {
				this._renderer.beginPath();
				this._renderer.arc(x, yPrev, 3, -Math.PI, Math.PI, false);
				this._renderer.fill();
				this._renderer.closePath();
			}
		}
	}

	/**
	 * Reset all or one of the data controls.
	 * @param id id of individual control to reset
	 */
	private _resetData(id?: string) {
		if (id) {
			// reset single
			this._data[id].value = 0;
		}
		else {
			// reset all
			this.gain = this.GAIN_MAX;
			Object.values(this._data).forEach(data => {
				data.value = 0;
			});
		}

		this._update();
	}

	/**
	 * Update the waveform and sound stream.
	 */
	private _update() {
		// graph
		this._plot();

		// sound
		this._play();

		// trigger render
		this.updates++;
	}

	/**
	 * Update the data from user input.
	 * @param event Change or Input eVent from the input element.
	 */
	private _updateData(input: HTMLInputElement, id: string) {
		const data = this._data[id];
		let value = Number(input.value);

		// number check
		if (isNaN(value) || input.value === '') {
			input.value = data.value.toString();
			return;
		}

		// apply bounds
		value = Math.max(-this.CONTROL_RANGE, Math.min(value, this.CONTROL_RANGE));

		// update other input/slider
		data.value = value;

		this._update();
	}

	/**
	 * Stencil rendering.
	 */
	render() {
		// create the harmonic control row
		const control = (id: string) => {
			const control = this._data[id];
			return [
				<label key={`label${id}`} class="label" innerHTML={control.label}></label>,
				<input key={`slider${id}`} class="slider"
					type="range"
					min={-this.CONTROL_RANGE}
					max={this.CONTROL_RANGE}
					step={0.1}
					value={control.value}
					onInput={event => this._updateData(event.currentTarget as HTMLInputElement, id)}
				></input>,
				<input key={`field${id}`} class="field"
					type="number"
					min={-this.CONTROL_RANGE}
					max={this.CONTROL_RANGE}
					step={0.1}
					value={this._fieldFormatter.format(control.value)}
					onChange={event => this._updateData(event.currentTarget as HTMLInputElement, id)}
				></input>,
				<button key={`clear${id}`} class="clear" onClick={() => this._resetData(id)}>X</button>
			];
		};

		// create the frequencies column
		const frequencies = () => {
			return Object.keys(this._data).map(id => {
				const harmonic = Number(id.substring(3));
				if (id.startsWith('cos') && harmonic > 0) {
					return <div key={`frequency-${harmonic}`} class="frequency">{harmonic * this.fundamental}Hz</div>;
				}
			}
		)};

		return (
			<Host>
				<div class="container">
					{this.mainTitle && <h1>{this.mainTitle}</h1>}
					<div class="header">
						<span class="feature-wrap">
							<h2 class="feature">{this.fundamentalLabel}</h2>
							<input class="fundamental"
								type="number"
								min={this.FREQUENCY_MIN}
								max={Math.floor(this.FREQUENCY_MAX / this.harmonics)}
								value={this.fundamental}
								onChange={event => this.fundamental = Number((event.currentTarget as HTMLInputElement).value)}
								onInput={event => this._onFundamentalInput(Number((event.currentTarget as HTMLInputElement).value))}
							></input>
							<span class="hz">Hz</span>
						</span>
						<span class="feature-wrap">
							<h2 class="feature">{this.harmonicsLabel}</h2>
							<input class="harmonics"
								type="number"
								min={1}
								max={Math.floor(this.FREQUENCY_MAX / this.fundamental)}
								value={this.harmonics}
								onChange={event => this.harmonics = this._checkHarmonicsBounds(Number((event.currentTarget as HTMLInputElement).value))}
							></input>
						</span>
						<span class="feature-wrap">
							<h2 class="feature">{this.audioLabel}</h2>
							<input class="toggle"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.enableAudio ? 1 : 0}
								onInput={event => this.enableAudio = (event.currentTarget as HTMLInputElement).value === '1'}
							></input>
						</span>
					</div>
					<div class="controls">
						<div class="row">
							<div class="column">
								<h2>{this.cosTitle}</h2>
								<div class="grid">
									{Object.keys(this._data).map(id => id.startsWith('cos') && control(id))}
								</div>
							</div>
							<div class="column frequencies">
								{frequencies()}
							</div>
							<div class="column">
								<h2>{this.sinTitle}</h2>
								<div class="row">&nbsp;</div>{/* spacer row */}
								<div class="grid">
									{Object.keys(this._data).map(id => id.startsWith('sin') && control(id))}
								</div>
							</div>
						</div>
						<div class="row gain">
							<label class="label">{this.gainLabel}</label>
							<input class="slider"
								type="range"
								min={0}
								max={this.GAIN_MAX}
								step={0.001}
								value={this.gain}
								onInput={event => this.gain = Number((event.currentTarget as HTMLInputElement).value)}
							></input>
							<input class="field"
								readonly
								value={`${this._gainFormatter.format(20*Math.log10(this.gain))}dB`}
							></input>
							<button class="clear" onClick={() => this.gain = this.GAIN_MAX}>X</button>
						</div>
						<button class="reset" onClick={() => this._resetData()}>Reset</button>
					</div>
					<div class="header">
						<span class="feature-wrap">
							<h2 class="feature">{this.graphLabel}</h2>
							<input class="toggle" title="Show the Fourier waveform graph"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.hideGraph ? 0 : 1}
								onInput={event => this.hideGraph = (event.currentTarget as HTMLInputElement).value === '0'}
							></input>
						</span>
						<span class="feature-wrap">
							<h2 class="feature">{this.periodsLabel}</h2>
							<input class="periods" title="Number of fundamental wave periods to display"
								type="number"
								min={1}
								max={10}
								value={this.periods}
								onChange={event => this.periods = Number((event.currentTarget as HTMLInputElement).value)}
							></input>
						</span>
						<span class="feature-wrap">
							<h2 class="feature">{this.gridDotsLabel}</h2>
							<input class="toggle" title="Draw the harmonic grid dots on the graph"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.hideGridDots ? 0 : 1}
								onInput={event => this.hideGridDots = (event.currentTarget as HTMLInputElement).value === '0'}
							></input>
						</span>
						<span class="feature-wrap">
							<h2 class="feature">{this.linesLabel}</h2>
							<input class="toggle" title="Draw vertical lines betweenthe fundamental  wave periods"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.hideLines ? 0 : 1}
								onInput={event => this.hideLines = (event.currentTarget as HTMLInputElement).value === '0'}
							></input>
						</span>
						<span class="feature-wrap">
							<h2 class="feature">{this.endpointsLabel}</h2>
							<input class="toggle" title="Draw dots where the fundamental wave periods start and stop"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.hideEnpoints ? 0 : 1}
								onInput={event => this.hideEnpoints = (event.currentTarget as HTMLInputElement).value === '0'}
							></input>
						</span>
					</div>
					<div class="graph" style={this.hideGraph && {visibility: 'hidden'}}>
						<canvas ref={el => this._canvas = el}></canvas>
					</div>
				</div>
			</Host>
		);
	}
}
