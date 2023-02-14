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
	private readonly GAIN_DEFAULT: number = Math.pow(10, -6 / 20); // -6dB ~= 0.501

	// color constants
	private readonly BLACK: string = 'rgb(0, 0, 0)';
	private readonly BLUE: string = 'rgb(0, 127, 255)';
	private readonly GREEN: string = 'rgb(0, 255, 0)';
	private readonly RED: string = 'rgb(255, 0, 0)';

	private _audioContext: AudioContext;
	private _backgroundCanvas: HTMLCanvasElement;
	private _backgroundRenderer: CanvasRenderingContext2D;
	private _data: Record<string, FourierData> = {};
	private _fieldFormatter = Intl.NumberFormat(navigator.language, {minimumFractionDigits: 1, maximumFractionDigits: 1});
	private _gainNode: GainNode;
	private _gainFormatter = Intl.NumberFormat(navigator.language, {minimumFractionDigits: 2, maximumFractionDigits: 2});
	private _isAutoAdjusting: boolean = false;
	private _oscillator: OscillatorNode;
	private _resizeTimeout: number;
	private _waveformCanvas: HTMLCanvasElement;
	private _waveformRenderer: CanvasRenderingContext2D;

	@Element() hostElement: HTMLFourierSynthElement;

	/**
	 * Toggle for turning sound on and off.
	 */
	@State() enableAudio: boolean = false;
	@Watch('enableAudio')
	enableAudioChange(newValue: boolean) {
		if (newValue) {
			this._play()
		}
		else {
			this._audioContext?.suspend();
		}
	}

	/**
	 * Gain is the 0-1 value of the slider that will be displayed in dB.
	 */
	@State() gain: number = this.GAIN_DEFAULT;
	@Watch('gain')
	gainChange(newValue: number) {
		this.gain = newValue = Math.max(0.0, Math.min(newValue, 1.0));
		if (this._gainNode) {
			this._gainNode.gain.value = newValue;
		}
		this._drawWaveform();
	}

	/**
	 * Manually updated to trigger rendering.
	 */
	@State() updateCount: number = 0;

	/**
	 * Text for the enable audio control label.
	 */
	@Prop({reflect: true}) audioLabel: string = 'Enable audio';

	/**
	 * Automatically adjust the gain and DC offset (cos0) to match the wave.
	 * This doubles computational effort and therefore impacts performance by ~50%.
	 */
	@Prop({mutable: true}) autoAdjust: boolean = false;
	@Watch('autoAdjust')
	autoAdjustChange(newValue: boolean) {
		if (newValue) {
			this._drawWaveform();
		}
	}

	/**
	 * Text for the auto adjust control label.
	 */
	@Prop({reflect: true}) autoAdjustLabel: string = 'Auto-adjust';

	/**
	 * Color of graph background lines and dots. Use a CSS color value.
	 */
	@Prop() axesColor: string = this.BLUE;
	@Watch('axesColor')
	axesColorChange() {
		this._drawBackground();
	}

	/**
	 * Background color of graph. Use a CSS color value.
	 */
	@Prop() backgroundColor: string = this.BLACK;
	@Watch('backgroundColor')
	backgroundColorChange() {
		this._drawBackground();
	}

	/**
	 * Title text for the cosine controls.  Set text empty to hide the title.
	 */
	@Prop({reflect: true}) cosTitle: string = 'Cos';

	/**
	 * Text for the dividers display control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) dividersLabel: string = 'Dividers';

	/**
	 * Text for the endpoints display control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) endpointsLabel: string = 'Endpoints';

	/**
	 * The fundamental frequency of the fourier wave.
	 */
	@Prop({reflect: true, mutable: true}) fundamental: number = 220;
	@Watch('fundamental')
	fundamentalChange(newValue: number) {
		// apply bounds
		this.fundamental = newValue = Math.max(this.FREQUENCY_MIN, Math.min(newValue, this.FREQUENCY_MAX));
		// remove harmonics over 20000Hz
		const maxHarmonics = Math.floor(this.FREQUENCY_MAX / newValue);
		if (maxHarmonics < this.harmonics) {
			this.harmonicsChange(maxHarmonics, this.harmonics)
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
	harmonicsChange(newValue: number, oldValue: number) {
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
				if (harmonic === 0) {
					this._data.cos0 = {
						label: 'Offset',
						value: 0
					};
				}
				else {
					this._data[`cos${harmonic}`] = {
						label: `A<sub>${harmonic}</sub>`,
						value: 0
					};
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
	hideDividersChange() {
		this._drawBackground();
	}

	/**
	 * Don't display the fundamental wave endpoint dots.
	 */
	@Prop({mutable: true}) hideEndpoints: boolean = false;
	@Watch('hideEndpoints')
	hideEndpointsChange() {
		this._drawWaveform();
	}

	/**
	 * Don't display the graph.
	 */
	@Prop({mutable: true}) hideGraph: boolean = false;
	@Watch('hideGraph')
	hideGraphChange() {
		this._drawBackground();
		this._drawWaveform();
	}

	/**
	 * Don't display the graph background dots.
	 */
	@Prop({mutable: true}) hideGridDots: boolean = false;
	@Watch('hideGridDots')
	hideGridDotsChange() {
		this._drawBackground();
	}

	/**
	 * Don't display the graph DC offset line.
	 */
	@Prop({mutable: true}) hideOffset: boolean = false;
	@Watch('hideOffset')
	hideOffsetChange() {
		this._drawWaveform();
	}

	/**
	 * Color of the waveform plot line. Use a CSS color value.
	 */
	@Prop() lineColor: string = this.RED;
	@Watch('lineColor')
	lineColorChange() {
		this._drawWaveform();
	}

	/**
	 * The width of the waveform plot line.
	 */
	@Prop({mutable: true}) lineWidth: number = 3;
	@Watch('lineWidth')
	lineWidthChange(newValue: number) {
		this.lineWidth = newValue = Math.max(1, Math.min(newValue, 5));
		this._drawWaveform();
	}

	/**
	 * Text for the line width control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) lineWidthLabel: string = 'Line width';

	/**
	 * Text for the main title. Set the text empty to hide the title.
	 */
	@Prop({reflect: true}) mainTitle: string = 'Fourier Synthesizer';

	/**
	 * Limit of the number of harmonics. The actual highest possible number of harmonics
	 * is based on the frequency. The highest possible harmonic frequency is 20000Hz. At
	 * the lowest fundamental 20Hz there can therefore be up to 1000 harmonics. High values
	 * can crash, hang, or otherwise bring the browser to a halt. USE WITH CAUTION.
	 */
	@Prop() maxHarmonics: number = 100;
	@Watch('maxHarmonics')
	maxHarmonicsChange(newValue: number) {
		this.maxHarmonics = newValue = Math.max(1, Math.min(newValue, 1000));
		if (newValue < this.harmonics) {
			this.harmonicsChange(newValue, this.harmonics);
		}
	}

	/**
	 * Color of the graph DC offset line and waveform endpoint dots. Use a CSS color value.
	 */
	@Prop() offsetColor: string = this.GREEN;
	@Watch('offsetColor')
	offsetColorChange() {
		this._drawWaveform();
	}

	/**
	 * Text for the offset display control label. Set the text empty to hide the control.
	 */
	@Prop({reflect: true}) offsetLabel: string = 'Offset';

	/**
	 * Number of fundamental wave periods to display in the graph. From 1 to 5.
	 */
	@Prop({mutable: true}) periods: number = 3;
	@Watch('periods')
	periodsChange(newValue: number) {
		this.periods = newValue = Math.max(1, Math.min(newValue, 5));
		this._drawBackground();
		this._drawWaveform();
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
	 * Title text for the sine controls. Set text empty to hide the title.
	 */
	@Prop({reflect: true}) sinTitle: string = 'Sin';

	/**
	 * Stencil initialization.
	 */
	async componentWillLoad() {
		// initialize data by setting harmonics
		this.harmonicsChange(this.harmonics, -1);

		this.fundamentalChange(this.fundamental);

		this.periodsChange(this.periods);
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

		// set up canvas renderers
		this._backgroundRenderer = this._backgroundCanvas.getContext('2d');
		this._waveformRenderer = this._waveformCanvas.getContext('2d');
		this._backgroundCanvas.style.backgroundColor = this.BLACK;

		// draw graph first time
		this._drawBackground();
		this._drawWaveform();

		// trigger repaint after window resize
		window.addEventListener('resize', () => {
			clearTimeout(this._resizeTimeout);
			this._resizeTimeout = window.setTimeout(() => {
				this._drawBackground();
				this._drawWaveform();
			}, 100);
		});
	}

	/**
	 * Check the harmonics value for min and max based on frequency and maxHarmonics.
	 * @param harmonics Number of harmonics
	 * @returns At least 1 and no more than would stay below 20000Hz - limited by maxHarmonics
	 */
	private _checkHarmonicsBounds(harmonics: number): number {
		return Math.max(1, Math.min(harmonics, Math.min(Math.floor(this.FREQUENCY_MAX / this.fundamental), this.maxHarmonics)));
	}

	private _drawBackground() {
		if (this.hideGraph || !this._backgroundCanvas || !this._backgroundRenderer) {
			return;
		}

		// get the canvas size
		const width = this._backgroundCanvas.offsetWidth;
		const height = this._backgroundCanvas.offsetHeight;
		const halfY = height / 2;
		this._backgroundCanvas.width = width;
		this._backgroundCanvas.height = height;

		// set rendering properties
		this._backgroundRenderer.fillStyle = this.axesColor || this.BLUE;
		this._backgroundRenderer.lineWidth = 2;
		this._backgroundRenderer.strokeStyle = this.axesColor || this.BLUE;

		// erase
		this._backgroundRenderer.clearRect(0, 0, width, height);

		// the length of one waveform in pixels
		const wavelength = width / this.periods;

		// draw grid dots
		if (!this.hideGridDots) {
			let gridSize = wavelength / this.harmonics;
			// make grid size no smaller than 10, but aligned to wavelength
			for (let harmonic = this.harmonics - 1; gridSize < 10; harmonic--) {
				gridSize = wavelength / harmonic;
			}

			// figure out where to start vertically so that the dot grid is centered
			const startY = halfY % gridSize;

			for (let x = gridSize; x < width; x += gridSize) {
				for (let y = startY; y < height; y += gridSize) {
					this._backgroundRenderer.beginPath();
					this._backgroundRenderer.arc(x, y, 1, 0, Math.PI * 2, true);
					this._backgroundRenderer.fill();
					this._backgroundRenderer.closePath();
				}
			}
		}

		// draw x axis
		this._backgroundRenderer.beginPath();
		this._backgroundRenderer.moveTo(0, halfY);
		this._backgroundRenderer.lineTo(width, halfY);
		this._backgroundRenderer.stroke();
		this._backgroundRenderer.closePath();

		// draw wave divider lines
		if (!this.hideDividers) {
			this._backgroundRenderer.beginPath();
			for (let x = wavelength; x < width; x += wavelength) {
				this._backgroundRenderer.moveTo(x, 0);
				this._backgroundRenderer.lineTo(x, height);
			}
			this._backgroundRenderer.stroke();
			this._backgroundRenderer.closePath();
		}
	}

	/**
	 * Draw the waveform derived from the data.
	 */
	private _drawWaveform() {
		if (this.hideGraph || !this._waveformCanvas || !this._waveformRenderer) {
			return;
		}

		// get the canvas size
		const width = this._waveformCanvas.offsetWidth;
		const height = this._waveformCanvas.offsetHeight;
		const halfY = height / 2;

		// set rendering properties
		this._waveformCanvas.width = width;
		this._waveformCanvas.height = height;
		this._waveformRenderer.fillStyle = this.offsetColor || this.GREEN;

		// erase
		this._waveformRenderer.clearRect(0, 0, width, height);

		// draw DC offset
		if (!this.hideOffset && this._data.cos0.value !== 0) {
			this._waveformRenderer.lineWidth = 1;
			this._waveformRenderer.strokeStyle = this.offsetColor || this.GREEN;
			this._waveformRenderer.beginPath();
			const y = -this._data.cos0.value / 100 * halfY + halfY;
			this._waveformRenderer.moveTo(0, y);
			this._waveformRenderer.lineTo(width, y);
			this._waveformRenderer.stroke();
			this._waveformRenderer.closePath();
		}

		this._waveformRenderer.lineWidth = this.lineWidth;
		this._waveformRenderer.strokeStyle = this.lineColor || this.RED;

		// the length of one waveform in pixels
		const wavelength = width / this.periods;

		// time constant
		const timeBase = wavelength / (2.0 * Math.PI);

		// scale the y values so that at max gain a single harmonic wave would occupy the full height of the graph
		const scaleY = this.gain * (halfY / this.CONTROL_RANGE);

		// y starts at the vertical center +/- the DC offset which can be +/- one full wave
		let yCenter = halfY - (scaleY * this._data.cos0.value / this.gain);

		// keeping track of y values for auto adjust
		let yPeakPos = 0;
		let yPeakNeg = 0;

		// keep track of vertical origin for endpoints
		let originY: number;

		// draw waveform
		this._waveformRenderer.beginPath();
		for (let x = 0; x <= width; x++) {
			// start at zero
			let y = 0.0;


			// add fourier series modificationss
			const xTime = (x % wavelength) / timeBase;
			for (let harmonic = 1; harmonic <= this.harmonics; harmonic++) {
				const xHarmonic = harmonic * xTime;
				// invert because the canvas is "upside down" relative to graph +/-
				y -= this._data[`cos${harmonic}`].value * Math.cos(xHarmonic);
				y -= this._data[`sin${harmonic}`].value * Math.sin(xHarmonic);
			}

			yPeakPos = Math.max(yPeakPos, y);
			yPeakNeg = Math.min(yPeakNeg, y);

			// adjust by scale & gain, and offset
			y = yCenter + (scaleY * y);

			if (x === 0) {
				originY = y;
				this._waveformRenderer.moveTo(x, y);
			}
			else {
				this._waveformRenderer.lineTo(x, y);
			}
		}
		this._waveformRenderer.stroke();
		this._waveformRenderer.closePath();

		// wave start/end-point dots
		if (!this.hideEndpoints) {
			this._waveformRenderer.beginPath();
			for (let x = 0; x <= width; x += wavelength) {
				this._waveformRenderer.arc(x, originY, 3, -Math.PI, Math.PI, false);
				this._waveformRenderer.fill();
			}
			this._waveformRenderer.closePath();
		}

		if (this.autoAdjust && !this._isAutoAdjusting) {
			const asymmetry = scaleY * (yPeakPos + yPeakNeg);
			const peakToPeak = scaleY * (yPeakPos - yPeakNeg);
			this._optimizeGainAndOffset(peakToPeak, asymmetry, height);
		}
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
	 * Calculate and apply the ideal gain and DC offset for a waveform so that it does not extend outside the graph area.
	 * This forces a second iteration to render the waveform, so performance in the browser is reduced by 50%.
	 * @param peakToPeak - rendered size of waveform
	 * @param asymmetry - difference between positive and negative peaks
	 * @param height - height of the graph area
	 */
	private _optimizeGainAndOffset(peakToPeak: number, asymmetry: number, height: number) {
		if (height === 0) {
			return;
		}

		if (peakToPeak === 0) {
			// reset offset and gain
			this._data.cos0.value = 0.0;
			this.gain = this.GAIN_DEFAULT;
		}
		else {
			// determine gain
			let gain: number;
			if (peakToPeak !== height) {
				gain = Math.min(this.gain * height / peakToPeak, 1.0);
				if (gain === this.gain) {
					gain = undefined;
				}
			}
			console.log('gain', gain, this.gain);

			// determine DC offset
			let offset = this.CONTROL_RANGE * (asymmetry / height);
			if (gain != null) {
				offset *= (gain / this.gain);
			}
			// 1 digit precision
			offset = Number(offset.toFixed(1));
			// fix javascript number weirdness
			if (offset === -0.0) {
				offset = 0.0;
			}
			this._data.cos0.value = offset;

			// render
			this._isAutoAdjusting = true;
			if (gain != null && gain !== this.gain) {
				this.gain = gain;
			}
			else {
				this._drawWaveform();
				this.updateCount++;
			}
			this._isAutoAdjusting = false;
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
			this._gainNode = this._audioContext.createGain();
			this._gainNode.gain.value = this.gain;
			this._oscillator = this._audioContext.createOscillator();
			this._oscillator.connect(this._gainNode).connect(this._audioContext.destination);
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
	 * Reset all or one of the harmonic's data.
	 * @param id id of individual harmonic to reset
	 */
	private _resetData(id?: string) {
		if (id) {
			// reset single
			this._data[id].value = 0;
		}
		else {
			// reset all
			Object.values(this._data).forEach(data => {
				data.value = 0;
			});
			this.gain = this.GAIN_DEFAULT;
		}

		this._update();
	}

	/**
	 * Update the waveform and sound stream.
	 */
	private _update() {
		// graph
		this._drawWaveform();

		// sound
		this._play();

		// trigger render
		this.updateCount++;
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
			const offset = 'cos0' === id;
			const control = this._data[id];
			return [
				<label key={`label-${id}`} class="control-label" innerHTML={control.label}></label>,
				<input key={`slider-${id}`} class={{'slider': true, 'offset': offset}}
					disabled={this.autoAdjust && offset}
					type="range"
					min={-this.CONTROL_RANGE}
					max={this.CONTROL_RANGE}
					step={0.1}
					value={control.value}
					onInput={event => this._updateData(event.currentTarget as HTMLInputElement, id)}
				></input>,
				<input key={`field-${id}`} class="field"
					readonly={this.autoAdjust && offset}
					type="number"
					min={-this.CONTROL_RANGE}
					max={this.CONTROL_RANGE}
					step={0.1}
					value={this._fieldFormatter.format(control.value)}
					onChange={event => this._updateData(event.currentTarget as HTMLInputElement, id)}
				></input>,
				<button key={`clear-${id}`} class="clear" disabled={this.autoAdjust && offset} onClick={() => this._resetData(id)}>X</button>
			];
		};

		const controls = () => {
			return [
				this.cosTitle && this.sinTitle && <label class="column-label cos">{this.cosTitle}</label>,
				this.cosTitle && this.sinTitle && <label class="column-label sin">{this.sinTitle}</label>,
				Object.keys(this._data).map(id => {
					if (id.startsWith('sin')) {
						const harmonic = Number(id.substring(3));
						return [
							control(`cos${harmonic}`),
							<div key={`frequency-${harmonic}`} class="frequency">{harmonic * this.fundamental}Hz</div>,
							control(`sin${harmonic}`)
						];
					}
				})
			];
		}

		return (
			<Host>
				<div class="container">
					{this.mainTitle && <h1>{this.mainTitle}</h1>}
					{/* controls header */}
					<div class="header">
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
					</div>
					{/* controls */}
					<div class="controls">
						<div class="row control-grid">
							{controls()}
						</div>
						<div class="row offset">
							{control('cos0')}
						</div>
						<div class="row gain">
							<label class="control-label">{this.gainLabel}</label>
							<input class="slider"
								disabled={this.autoAdjust}
								type="range"
								min={0}
								max={1.0}
								step={0.001}
								value={this.gain}
								onInput={event => this.gain = Number((event.currentTarget as HTMLInputElement).value)}
							></input>
							<input class="field"
								readonly
								value={`${this._gainFormatter.format(20 * Math.log10(this.gain))}dB`}
							></input>
							<button class="clear" disabled={this.autoAdjust} onClick={() => this.gain = this.GAIN_DEFAULT}>X</button>
						</div>
						<button class="reset" onClick={() => this._resetData()}>Reset</button>
					</div>
					{/* graph header */}
					{(this.graphLabel || this.autoAdjustLabel) &&
						<div class="header">
							{this.graphLabel && <span class="feature-container">
								<label class="feature-label">{this.graphLabel}</label>
								<input class="toggle"
									type="range"
									min={0}
									max={1}
									step={1}
									value={this.hideGraph ? 0 : 1}
									onInput={event => this.hideGraph = (event.currentTarget as HTMLInputElement).value === '0'}
								></input>
							</span>}
							{!this.hideGraph && this.autoAdjustLabel && <span class="feature-container">
									<label class="feature-label">{this.autoAdjustLabel}</label>
									<input class="toggle"
										type="range"
										min={0}
										max={1}
										step={1}
										value={this.autoAdjust ? 1 : 0}
										onInput={event => this.autoAdjust = (event.currentTarget as HTMLInputElement).value === '1'}
									></input>
								</span>
							}
						</div>
					}
					{/* graph controls */}
					{(this.lineWidthLabel || this.periodsLabel || this.dividersLabel || this.endpointsLabel || this.gridDotsLabel) &&
						<div class="header" style={this.hideGraph && {'display': 'none'}}>
							<div class="row" style={{'margin-right': '16px'}}>
								{this.lineWidthLabel && <span class="feature-container">
									<label class="feature-label small">{this.lineWidthLabel}</label>
									<input class="number"
										type="number"
										min={1}
										max={5}
										step={1}
										value={this.lineWidth}
										onInput={event => this.lineWidth = Number((event.currentTarget as HTMLInputElement).value)}
									></input>
								</span>}
								{this.periodsLabel && <span class="feature-container">
									<label class="feature-label small">{this.periodsLabel}</label>
									<input class="number"
										type="number"
										min={1}
										max={5}
										value={this.periods}
										onChange={event => this.periods = Number((event.currentTarget as HTMLInputElement).value)}
									></input>
								</span>}
							</div>
							<div class="row">
								{this.offsetLabel && <span class="feature-container">
									<label class="feature-label small">{this.offsetLabel}</label>
									<input class="toggle"
										type="range"
										min={0}
										max={1}
										step={1}
										value={this.hideOffset ? 0 : 1}
										onInput={event => this.hideOffset = (event.currentTarget as HTMLInputElement).value === '0'}
									></input>
								</span>}
								{this.endpointsLabel && <span class="feature-container">
									<label class="feature-label small">{this.endpointsLabel}</label>
									<input class="toggle"
										type="range"
										min={0}
										max={1}
										step={1}
										value={this.hideEndpoints ? 0 : 1}
										onInput={event => this.hideEndpoints = (event.currentTarget as HTMLInputElement).value === '0'}
									></input>
								</span>}
								{this.dividersLabel && <span class="feature-container">
									<label class="feature-label small">{this.dividersLabel}</label>
									<input class="toggle"
										type="range"
										min={0}
										max={1}
										step={1}
										value={this.hideDividers ? 0 : 1}
										onInput={event => this.hideDividers = (event.currentTarget as HTMLInputElement).value === '0'}
									></input>
								</span>}
								{this.gridDotsLabel && <span class="feature-container">
									<label class="feature-label small">{this.gridDotsLabel}</label>
									<input class="toggle"
										type="range"
										min={0}
										max={1}
										step={1}
										value={this.hideGridDots ? 0 : 1}
										onInput={event => this.hideGridDots = (event.currentTarget as HTMLInputElement).value === '0'}
									></input>
								</span>}
							</div>
						</div>
					}
					{/* graph */}
					<div class="graph" style={this.hideGraph && {visibility: 'hidden'}}>
						<canvas ref={el => this._backgroundCanvas = el}></canvas>
						<canvas id="waveform" ref={el => this._waveformCanvas = el}></canvas>
					</div>
				</div>
			</Host>
		);
	}
}
