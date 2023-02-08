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
	private readonly CONTROL_RANGE: number = 50.0;
	private readonly FREQUENCY_MAX: number = 20000;
	private readonly FREQUENCY_MIN: number = 20;
	private readonly SCALE: number = 10.0;
	private readonly VOLUME_DEFAULT: number = 5;
	// max volume is slightly less than 10 so that when converted dB it is exactly 12
	private readonly VOLUME_MAX: number = 9.98;

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
	private _volumeFormatter = Intl.NumberFormat(navigator.language, {minimumFractionDigits: 2, maximumFractionDigits: 2});

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
	 * Volume is the 0-10 value of the slider that will be converted to gain and displayed in dB.
	 */
	@State() volume: number = this.VOLUME_DEFAULT;
	@Watch('volume')
	handleVolumeChange(newValue: number) {
		this.volume = Math.max(0, Math.min(newValue, this.SCALE));
		this._update();
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
	 * The fundamental frequency of the fourier wave.
	 */
	@Prop({reflect: true, mutable: true}) fundamental: number = 220;
	@Watch('fundamental')
	handleFrequencyChange(newValue: number) {
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
	 * Label for the frequency control.
	 */
	@Prop({reflect: true}) frequencyLabel: string = 'Fundamental';

	/**
	 * Text for the gain control label.
	 */
	@Prop({reflect: true}) gainLabel: string = 'Gain';

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
	 * Don't display the graph background dots.
	 */
	@Prop() hideDots: boolean = false;

	/**
	 * Don't display the wave and vertical axis intersection dots.
	 */
	@Prop() hideIntersections: boolean = false;

	/**
	 * Don't display the graph background lines.
	 */
	@Prop() hideLines: boolean = false;

	/**
	 * Color of the wave and vertical axis intersection dots. Use a CSS color value.
	 */
	@Prop() intersectionColor: string = this.GREEN;

	/**
	 * Text for the main title. Set empty to exclude the title.
	 */
	@Prop({reflect: true}) mainTitle: string = 'Fourier Synthesizer';

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
	 * Number of waves to display in the graph.
	 */
	@Prop({reflect: true}) waveCount: number = 3;

	/**
	 * Stencil initialization.
	 */
	async componentWillLoad() {
		// initialize data by setting harmonics
		this.handleHarmonicsChange(this.harmonics, -1);
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
	 * Convert the volume setting 0-10 to logarithmic gain 0-4.
	 * @returns number
	 */
	private _getGain(): number {
		const logStrength = 9;
		const gain = 4; // equates to 12dB
		return (Math.pow(logStrength, this.volume / 10) - 1) / ((logStrength - 1) / gain);
	}

	/**
	 * Handle user entering frequency - only trigger update if it is within bounds
	 * so that the value isn't changed while the user is typing.
	 * The change event handler will handle update and the property watch will
	 * correct out of bounds values.
	 * @param frequency Value of the frequency under edit
	 */
	private _onFrequencyInput(frequency: number) {
		if (this.FREQUENCY_MIN <= frequency && frequency <= this.FREQUENCY_MAX) {
			this.fundamental = frequency;
		}
	}

	/**
	 * Generate audio stream from the data.
	 */
	private _play() {
		if (this.enableAudio) {

			if (!this._audioContext) {
				// first time - set up audio
				this._audioContext = new AudioContext();
				this._gain = this._audioContext.createGain();
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
			this._gain.gain.value = (Math.pow(this.SCALE, this.volume / this.SCALE) - 1) / ((this.SCALE - 1) / 2);
			this._audioContext.resume();
		}
	}

	/**
	 * Draw the waveform derived from the data.
	 */
	private _plot() {
		if (!this._canvas) {
			return;
		}

		// set the canvas size
		const maxX = this._canvas.offsetWidth;
		const maxY = this._canvas.offsetHeight;
		this._canvas.width = maxX;
		this._canvas.height = maxY;

		// fill background
		this._renderer.fillStyle = this.backgroundColor || this.BLACK;
		this._renderer.fillRect(0, 0, maxX, maxY);

		// the length of one waveform in pixels
		const wavelength = maxX / this.waveCount;

		// draw grid dots
		if (!this.hideDots) {
			const gridSize = wavelength / this.harmonics;

			// figure out where to start vertically so that the dot grid is centered
			const startY = (maxY / 2) % gridSize;

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
		if (!this.hideLines) {
			this._renderer.lineWidth = 1;
			this._renderer.strokeStyle = this.axesColor || this.BLUE;
			this._renderer.beginPath();

			// horizontal
			const axisY = maxY / 2;
			this._renderer.moveTo(0, axisY);
			this._renderer.lineTo(maxX, axisY);

			// vertical
			for (let x = wavelength; x < maxX; x += wavelength) {
				this._renderer.moveTo(x, 0);
				this._renderer.lineTo(x, maxY);
			}
			this._renderer.stroke();
			this._renderer.closePath();
		}

		// draw wave

		this._renderer.lineWidth = 2;
		this._renderer.strokeStyle = this.waveColor || this.RED;
		this._renderer.beginPath();

		const timeBase = wavelength / (2 * Math.PI);
		const gain = this._getGain();

		// y starts at the vertical center +/- DC offset
		const yBase = maxY / 2 - (this._data.cos0.value * 2);

		let yFirst = 0;
		let yPrev = 0;

		for (let x = 0; x < wavelength; x++) {
			// start at zero
			let y = 0;

			// add fourier series modificationss
			for (let harmonic = 1; harmonic <= this.harmonics; harmonic++) {
				y += this._data[`cos${harmonic}`].value * Math.cos(harmonic * x / timeBase);
				y += this._data[`sin${harmonic}`].value * Math.sin(harmonic * x / timeBase);
			}

			// adjust by offset and gain
			y = yBase + (gain * y);

			if (x === 0) {
				yFirst = y;
				yPrev = y;
			}
			else {
				for (let waveStart = 0; waveStart < maxX; waveStart += wavelength) {
					this._renderer.moveTo(waveStart + x - 1, yPrev);
					this._renderer.lineTo(waveStart + x + 1, y);
				}
				yPrev = y;
			}
		}
		this._renderer.stroke();
		this._renderer.closePath();

		// end the waveform
		this._renderer.fillStyle = this.intersectionColor || this.GREEN;
		for (let x = 0; x < maxX; x += wavelength) {
			// finish path between last and first y
			this._renderer.beginPath();
			this._renderer.moveTo(x - 1, yPrev);
			this._renderer.lineTo(x + 1, yFirst);
			this._renderer.stroke();
			this._renderer.closePath();

			// wave start-stop dots
			if (!this.hideIntersections) {
				this._renderer.beginPath();
				this._renderer.arc(x, yPrev, 3, -Math.PI, Math.PI, true);
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
			this.volume = this.VOLUME_DEFAULT;
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
				<label key={`label${id}`} class="label" htmlFor={id} innerHTML={control.label}></label>,
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
						<label><h2 class="feature">{this.frequencyLabel}</h2></label>
						<input class="fundamental"
							type="number"
							min={this.FREQUENCY_MIN}
							max={Math.floor(this.FREQUENCY_MAX / this.harmonics)}
							value={this.fundamental}
							onChange={event => this.fundamental = Number((event.currentTarget as HTMLInputElement).value)}
							onInput={event => this._onFrequencyInput(Number((event.currentTarget as HTMLInputElement).value))}
						></input>
						<span class="hz">Hz</span>
						<h2 class="feature">{this.harmonicsLabel}</h2>
						<input class="harmonics"
							type="number"
							min={1}
							max={Math.floor(this.FREQUENCY_MAX / this.fundamental)}
							value={this.harmonics}
							onChange={event => this.harmonics = this._checkHarmonicsBounds(Number((event.currentTarget as HTMLInputElement).value))}
						></input>
						<h2 class="feature">{this.audioLabel}</h2>
						<input class={{'toggle': true, 'toggle-on': this.enableAudio}}
							type="range"
							min={0}
							max={1}
							step={1}
							value={this.enableAudio ? 1 : 0}
							onInput={event => this.enableAudio = (event.currentTarget as HTMLInputElement).value === '1'}
						></input>
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
						<div class="row volume">
							<label class="label" htmlFor="volume">{this.gainLabel}</label>
							<input class="slider"
								type="range"
								min={0}
								max={this.VOLUME_MAX}
								step={0.01}
								value={this.volume}
								onInput={event => this.volume = Number((event.currentTarget as HTMLInputElement).value)}
							></input>
							<input class="field"
								readonly
								value={`${this._volumeFormatter.format(20*Math.log10(this._getGain()))}dB`}
							></input>
							<button class="clear" onClick={() => this.volume = this.VOLUME_DEFAULT}>X</button>
						</div>
						<button class="reset" onClick={() => this._resetData()}>Reset</button>
					</div>
					<div class="graph">
						<canvas ref={el => this._canvas = el}></canvas>
					</div>
				</div>
			</Host>
		);
	}
}
