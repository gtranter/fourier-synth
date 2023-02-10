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
	 * Gain is the 0-1 value of the slider that will be displayed in dB.
	 */
	@State() gain: number = this.GAIN_MAX;
	@Watch('gain')
	handleGainChange(newValue: number) {
		this.gain = newValue = Math.max(0, Math.min(newValue, this.GAIN_MAX));
		if (this._gain) {
			this._gain.gain.value = newValue;
		}
		this._plot();
	}

	/**
	 * Text for the enable audio control label.
	 */
	@Prop({reflect: true}) audioLabel: string = 'Enable audio';

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
	 * Text for the dividers display control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) dividersLabel: string = 'Dividers';

	/**
	 * Color of the wave endpoint dots. Use a CSS color value.
	 */
	@Prop() endpointColor: string = this.GREEN;

	/**
	 * Text for the endpoints display control label. Set the text empty to hide the control.
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
	 * Text for the fundamental control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) fundamentalLabel: string = 'Fundamental';

	/**
	 * Text for the gain control label.
	 */
	@Prop({reflect: true}) gainLabel: string = 'Gain';

	/**
	 * Text for the graph display control label.
	 */
	@Prop({reflect: true}) graphLabel: string = 'Show graph';

	/**
	 * Text for the grid dots display control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) gridDotsLabel: string = 'Grid dots';

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
	 * Text for the harmonics control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) harmonicsLabel: string = 'Harmonics';

	/**
	 * Don't display the fundamental wave divider lines.
	 */
	@Prop({mutable: true}) hideDividers: boolean = false;
	@Watch('hideDividers')
	handleHideDividersChange() {
		this._plot();
	}

	/**
	 * Don't display the fundamental wave endpoint dots.
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
	 * Text for the main title. Set the text empty to hide the title.
	 */
	@Prop({reflect: true}) mainTitle: string = 'Fourier Synthesizer';

	/**
	 * The width of the graph plot line.
	 */
	@Prop({mutable: true}) lineWidth: number = 3;
	@Watch('lineWidth')
	handleLineWidthChange(newValue: number) {
		this.lineWidth = newValue = Math.max(1, Math.min(newValue, 5));
		this._plot();
	}

	/**
	 * Text for the line width control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) lineWidthLabel: string = 'Line width';

	/**
	 * Limit of the number of harmonics. The actual highest possible number of harmonics
	 * is based on the frequency. The highest possible harmonic frequency is 20000Hz. At
	 * the lowest fundamental 20Hz there can therefore be up to 1000 harmonics. High values
	 * can crash, hang, or otherwise bring the browser to a halt. USE WITH CAUTION.
	 */
	@Prop() maxHarmonics: number = 100;
	@Watch('maxHarmonics')
	handleMaxHarmonicsChange(newValue: number) {
		this.maxHarmonics = newValue = Math.max(1, Math.min(newValue, 1000));
		if (newValue < this.harmonics) {
			this.handleHarmonicsChange(newValue, this.harmonics);
		}
	}

	/**
	 * Number of wave periods to display in the graph. From 1 to 5.
	 */
	@Prop({reflect: true, mutable: true}) periods: number = 3;
	@Watch('periods')
	handlePeriodsChange(newValue: number) {
		this.periods = newValue = Math.max(1, Math.min(newValue, 5));
		this._plot();
	}

	/**
	 * Text for the periods control label. Set the text empty to hide the control.
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
	 * Color of graph lines and dots. Use a CSS color value.
	 */
	@Prop() waveColor: string = this.RED;

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
	 * Check the harmonics value for min and max based on frequency and maxHarmonics.
	 * @param harmonics Number of harmonics
	 * @returns At least 1 and no more than would stay below 20000Hz - limited by maxHarmonics
	 */
	private _checkHarmonicsBounds(harmonics: number): number {
		return Math.max(1, Math.min(harmonics, Math.min(Math.floor(this.FREQUENCY_MAX / this.fundamental), this.maxHarmonics)));
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
					this._renderer.arc(x, y, 0.5, 0, Math.PI * 2, true);
					this._renderer.fill();
					this._renderer.closePath();
				}
			}
		}

		this._renderer.lineWidth = 2;
		this._renderer.strokeStyle = this.axesColor || this.BLUE;
		this._renderer.beginPath();

		// draw x axis
		this._renderer.beginPath();
		this._renderer.moveTo(0, halfY);
		this._renderer.lineTo(maxX, halfY);
		this._renderer.stroke();
		this._renderer.closePath();

		// draw wave divider lines
		if (!this.hideDividers) {
			this._renderer.beginPath();
			for (let x = wavelength; x < maxX; x += wavelength) {
				this._renderer.moveTo(x, 0);
				this._renderer.lineTo(x, maxY);
			}
			this._renderer.stroke();
			this._renderer.closePath();
		}

		// draw wave

		this._renderer.lineWidth = this.lineWidth;
		this._renderer.strokeStyle = this.waveColor || this.RED;
		this._renderer.beginPath();

		const timeBase = wavelength / (2.0 * Math.PI);

		// scale the y values so that at max gain a single harmonic wave would occupy the full height of the graph
		const scaleY = halfY / this.CONTROL_RANGE;

		// y starts at the vertical center +/- the scaled DC offset which can be +/- one full wave
		const yCenter = halfY - (scaleY * this._data.cos0.value);

		let yOrigin;
		for (let x = 0; x <= maxX; x++) {
			// start at zero
			let y = 0.0;
			const xCalc = (x % wavelength) / timeBase;
			// add fourier series modificationss
			for (let harmonic = 1; harmonic <= this.harmonics; harmonic++) {
				const value = harmonic * xCalc;
				// invert because the canvas is "upside down" relative to graph +/-
				y -= this._data[`cos${harmonic}`].value * Math.cos(value);
				y -= this._data[`sin${harmonic}`].value * Math.sin(value);
			}

			// adjust by scale, gain, and offset
			y = y * scaleY * this.gain + yCenter;

			if (x === 0) {
				yOrigin = y
				this._renderer.moveTo(x, y);
			}
			else {
				this._renderer.lineTo(x, y);
			}
		}
		this._renderer.stroke();
		this._renderer.closePath();

		// wave start/end-point dots
		if (!this.hideEnpoints) {
			this._renderer.fillStyle = this.endpointColor || this.GREEN;
			for (let x = 0; x <= maxX; x += wavelength) {
				this._renderer.beginPath();
				this._renderer.arc(x, yOrigin, 3, -Math.PI, Math.PI, false);
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
				<label key={`label${id}`} class="control-label" innerHTML={control.label}></label>,
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
						{this.fundamentalLabel && <span class="feature-container">
							<label class="feature-label">{this.fundamentalLabel}</label>
							<input class="fundamental"
								type="number"
								min={this.FREQUENCY_MIN}
								max={Math.floor(this.FREQUENCY_MAX / this.harmonics)}
								value={this.fundamental}
								onChange={event => this.fundamental = Number((event.currentTarget as HTMLInputElement).value)}
								onInput={event => this._onFundamentalInput(Number((event.currentTarget as HTMLInputElement).value))}
							></input>
							<span class="hz">Hz</span>
						</span>}
						{this.harmonicsLabel && <span class="feature-container">
							<label class="feature-label">{this.harmonicsLabel}</label>
							<input class="harmonics"
								type="number"
								min={1}
								max={this._checkHarmonicsBounds(this.maxHarmonics)}
								value={this.harmonics}
								onChange={event => this.harmonics = this._checkHarmonicsBounds(Number((event.currentTarget as HTMLInputElement).value))}
							></input>
						</span>}
						<span class="feature-container">
							<label class="feature-label">{this.audioLabel}</label>
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
								<label class="column-label">{this.cosTitle}</label>
								<div class="control-grid">
									{Object.keys(this._data).map(id => id.startsWith('cos') && control(id))}
								</div>
							</div>
							<div class="column frequencies">
								{frequencies()}
							</div>
							<div class="column">
								<label class="column-label">{this.sinTitle}</label>
								<div class="row">&nbsp;</div>{/* spacer row */}
								<div class="control-grid">
									{Object.keys(this._data).map(id => id.startsWith('sin') && control(id))}
								</div>
							</div>
						</div>
						<div class="row gain">
							<label class="control-label">{this.gainLabel}</label>
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
					{(this.graphLabel || this.periodsLabel || this.dividersLabel || this.endpointsLabel || this.gridDotsLabel) && <div class="header">
						{this.graphLabel && <span class="feature-container">
							<label class="feature-label">{this.graphLabel}</label>
							<input class="toggle" title="Show the Fourier waveform graph"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.hideGraph ? 0 : 1}
								onInput={event => this.hideGraph = (event.currentTarget as HTMLInputElement).value === '0'}
							></input>
						</span>}
						{this.periodsLabel && <span class="feature-container">
							<label class="feature-label">{this.periodsLabel}</label>
							<input class="number" title="Number of fundamental wave periods to display"
								type="number"
								min={1}
								max={5}
								value={this.periods}
								onChange={event => this.periods = Number((event.currentTarget as HTMLInputElement).value)}
							></input>
						</span>}
						{this.dividersLabel && <span class="feature-container">
							<label class="feature-label">{this.dividersLabel}</label>
							<input class="toggle" title="Draw vertical lines between the fundamental wave periods"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.hideDividers ? 0 : 1}
								onInput={event => this.hideDividers = (event.currentTarget as HTMLInputElement).value === '0'}
							></input>
						</span>}
						{this.endpointsLabel && <span class="feature-container">
							<label class="feature-label">{this.endpointsLabel}</label>
							<input class="toggle" title="Draw dots where the fundamental wave periods start and stop"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.hideEnpoints ? 0 : 1}
								onInput={event => this.hideEnpoints = (event.currentTarget as HTMLInputElement).value === '0'}
							></input>
						</span>}
						{this.gridDotsLabel && <span class="feature-container">
							<label class="feature-label">{this.gridDotsLabel}</label>
							<input class="toggle" title="Draw the harmonic grid dots on the graph"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.hideGridDots ? 0 : 1}
								onInput={event => this.hideGridDots = (event.currentTarget as HTMLInputElement).value === '0'}
							></input>
						</span>}
						{this.lineWidthLabel && <span class="feature-container">
							<label class="feature-label">{this.lineWidthLabel}</label>
							<input class="number" title="Width of the wave plot line"
								type="number"
								min={1}
								max={5}
								step={1}
								value={this.lineWidth}
								onInput={event => this.lineWidth = Number((event.currentTarget as HTMLInputElement).value)}
							></input>
						</span>}
					</div>}
					<div class="graph" style={this.hideGraph && {visibility: 'hidden'}}>
						<canvas ref={el => this._canvas = el}></canvas>
					</div>
				</div>
			</Host>
		);
	}
}
