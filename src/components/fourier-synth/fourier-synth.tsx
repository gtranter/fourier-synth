import { Component, Host, Fragment, h, State, Prop, Element, Watch } from '@stencil/core';
import { name as PackageName, version as PackageVersion } from '../../../package.json';

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
	private _fileElement: HTMLInputElement;
	private _gainNode: GainNode;
	private _gainFormatter = Intl.NumberFormat(navigator.language, {minimumFractionDigits: 2, maximumFractionDigits: 2});
	private _isAutoAdjusting: boolean = false;
	private _lastFilename: string;
	private _oscillator: OscillatorNode;
	private _offsetNode: ConstantSourceNode;
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
			this._audioContext.resume();
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
		this._play();
	}

	/**
	 * Manually updated to trigger rendering.
	 */
	@State() updateCount: number = 0;

	/**
	 * Text for the enable audio control label.
	 */
	@Prop({ reflect: true }) audioLabel: string = 'Enable audio';

	/**
	 * Automatically adjust the gain and DC offset (cos0) to match the wave.
	 * This doubles computational effort and therefore impacts performance by ~50%.
	 */
	@Prop({ mutable: true}) autoAdjust: boolean = false;
	@Watch('autoAdjust')
	autoAdjustChange(newValue: boolean) {
		if (newValue) {
			this._drawWaveform();
		}
		this._play();
	}

	/**
	 * Text for the auto adjust control label.
	 */
	@Prop({ reflect: true }) autoAdjustLabel: string = 'Auto-adjust';

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
	 * Text for the cosine control prefix.
	 */
	@Prop({ reflect: true }) cosPrefix: string = 'A';

	/**
	 * Title text for the cosine controls.  Set text empty to hide the title.
	 */
	@Prop({ reflect: true }) cosTitle: string = 'Cos';

	/**
	 * Text for the DC (cos0) control label. HTML can be used e.g. `A<sub>0</sub>`.
	 */
	@Prop({ reflect: true }) dcLabel: string = 'DC';
	@Watch('dcLabel')
	dcLabelChange(newValue: string) {
		this._data.cos0.label = newValue;
	}

	/**
	 * Text for the dividers display control label. Set the text empty to hide the control.
	 */
	@Prop({ reflect: true }) dividersLabel: string = 'Dividers';

	/**
	 * Text for the endpoints display control label. Set the text empty to hide the control.
	 */
	@Prop({ reflect: true }) endpointsLabel: string = 'Endpoints';

	/**
	 * The fundamental frequency of the fourier wave.
	 */
	@Prop({ reflect: true, mutable: true}) fundamental: number = 220;
	@Watch('fundamental')
	fundamentalChange(newValue: number) {
		// apply bounds
		this.fundamental = newValue = Math.max(this.FREQUENCY_MIN, Math.min(newValue, this.FREQUENCY_MAX));
		// remove harmonics over 20000Hz
		const maxHarmonics = Math.floor(this.FREQUENCY_MAX / newValue);
		if (maxHarmonics < this.harmonics) {
			this.harmonicsChange(maxHarmonics, this.harmonics)
		}
		this._play();
	}

	/**
	 * Text for the fundamental control label. Set the text empty to hide the control.
	 */
	@Prop({ reflect: true }) fundamentalLabel: string = 'Fundamental';

	/**
	 * Text for the gain control label.
	 */
	@Prop({ reflect: true }) gainLabel: string = 'Gain';

	/**
	 * Text for the graph display control label.
	 */
	@Prop({ reflect: true }) graphLabel: string = 'Show graph';

	/**
	 * Text for the grid dots display control label. Set the text empty to hide the control.
	 */
	@Prop({ reflect: true }) gridDotsLabel: string = 'Grid dots';

	/**
	 * Number of harmonics to control and produce.
	 */
	@Prop({ reflect: true, mutable: true}) harmonics: number = 8;
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

			this._drawBackground();
			this._drawWaveform();
			this._play();
		}
		else {
			this._addHarmonics(oldValue + 1, newValue);
			this._drawBackground();
		}
	}

	/**
	 * Text for the harmonics control label. Set the text empty to hide the control.
	 */
	@Prop({ reflect: true }) harmonicsLabel: string = 'Harmonics';

	/**
	 * Don't display the fundamental wave divider lines.
	 */
	@Prop({ mutable: true}) hideDividers: boolean = false;
	@Watch('hideDividers')
	hideDividersChange() {
		this._drawBackground();
	}

	/**
	 * Don't display the fundamental wave endpoint dots.
	 */
	@Prop({ mutable: true}) hideEndpoints: boolean = false;
	@Watch('hideEndpoints')
	hideEndpointsChange() {
		this._drawWaveform();
	}

	/**
	 * Don't display the graph.
	 */
	@Prop({ mutable: true}) hideGraph: boolean = false;
	@Watch('hideGraph')
	hideGraphChange() {
		this._drawBackground();
		this._drawWaveform();
	}

	/**
	 * Don't display the graph background dots.
	 */
	@Prop({ mutable: true}) hideGridDots: boolean = false;
	@Watch('hideGridDots')
	hideGridDotsChange() {
		this._drawBackground();
	}

	/**
	 * Don't display the graph DC offset line.
	 */
	@Prop({ mutable: true}) hideOffset: boolean = false;
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
	@Prop({ mutable: true}) lineWidth: number = 3;
	@Watch('lineWidth')
	lineWidthChange(newValue: number) {
		this.lineWidth = newValue = Math.max(1, Math.min(newValue, 5));
		this._drawWaveform();
	}

	/**
	 * Text for the line width control label. Set the text empty to hide the control.
	 */
	@Prop({ reflect: true }) lineWidthLabel: string = 'Line width';

	/**
	 * Text for the main title. Set the text empty to hide the title.
	 */
	@Prop({ reflect: true }) mainTitle: string = 'Fourier Synthesizer';

	/**
	 * Limit of the number of harmonics. The actual highest possible number of harmonics
	 * is based on the frequency. The highest possible harmonic frequency is 20000Hz. At
	 * the lowest fundamental 20Hz there can therefore be up to 1000 harmonics. High values
	 * can crash, hang, or otherwise bring the browser to a halt. USE WITH CAUTION.
	 */
	@Prop({ mutable: true}) maxHarmonics: number = 100;
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
	@Prop({ reflect: true }) offsetLabel: string = 'Offset';

	/**
	 * Number of fundamental wave periods to display in the graph. From 1 to 5.
	 */
	@Prop({ mutable: true}) periods: number = 3;
	@Watch('periods')
	periodsChange(newValue: number) {
		this.periods = newValue = Math.max(1, Math.min(newValue, 5));
		this._drawBackground();
		this._drawWaveform();
	}

	/**
	 * Text for the periods control label. Set the text empty to hide the control.
	 */
	@Prop({ reflect: true }) periodsLabel: string = 'Periods';

	/**
	 * Text for the reset button.
	 */
	@Prop({ reflect: true }) resetText: string = 'Reset';

	/**
	 * Text for the sine control prefix.
	 */
	@Prop({ reflect: true }) sinPrefix: string = 'B';

	/**
	 * Title text for the sine controls. Set text empty to hide the title.
	 */
	@Prop({ reflect: true }) sinTitle: string = 'Sin';

	/**
	 * Stencil initialization.
	 */
	async componentWillLoad() {
		// apply bounds to fundamental
		this.fundamental = Math.max(this.FREQUENCY_MIN, Math.min(this.fundamental, this.FREQUENCY_MAX));

		// initialize harmonics
		this.harmonics = this._checkHarmonicsBounds(this.harmonics);

		// initialize data
		this._addHarmonics(0, this.harmonics);

		// check line width bounds
		this.lineWidth = Math.max(1, Math.min(this.lineWidth, 5));

		// check periods bounds
		this.periods = Math.max(1, Math.min(this.periods, 5));
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

		// draw graph first time - avoid auto-adjust
		this._drawBackground();
		this._isAutoAdjusting = true;
		this._drawWaveform();
		this._isAutoAdjusting = false;

		// trigger repaint on window resize
		window.addEventListener('resize', () => {
			clearTimeout(this._resizeTimeout);
			this._resizeTimeout = window.setTimeout(() => {
				this._drawBackground();
				this._drawWaveform();
			}, 100);
		});
	}

	/**
	 * Add/create data for harmonics.
	 * @param first On initialization this will be 0, otherwise the first new harmonic.
	 * @param last Total number of harmonics including already existing ones.
	 */
	private _addHarmonics(first: number, last: number) {
		for (let harmonic = first; harmonic <= last; harmonic++) {
			if (harmonic === 0) {
				this._data.cos0 = {
					label: this.dcLabel,
					value: 0
				};
			}
			else {
				this._data[`cos${harmonic}`] = {
					label: `${this.cosPrefix}<sub>${harmonic}</sub>`,
					value: 0
				};
				this._data[`sin${harmonic}`] = {
					label: `${this.sinPrefix}<sub>${harmonic}</sub>`,
					value: 0
				};
			}
		}
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
			// make grid size no smaller than 10, but aligned to wavelength
			let gridSize = wavelength / this.harmonics;
			for (let harmonic = Math.min(this.harmonics, Math.floor(wavelength / 10)); gridSize < 10; harmonic--) {
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

			// keep plot line inside graph
			const stroke = this.lineWidth / 2;

			// "clip" wave at max levels
			y = Math.max(stroke, Math.min(y, height - stroke));

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
	 * Convert the fourier data and user options to JSON.
	 * @returns JOSN formatted string
	 */
	private _exportJson(): string {
		const data: FourierSynthJson = {
			source: PackageName,
			version: PackageVersion,
			config: {
				autoAdjust: this.autoAdjust,
				fundamental: this.fundamental,
				gain: this.gain,
				harmonics: this.harmonics,
				hideDividers: this.hideDividers,
				hideEndpoints: this.hideEndpoints,
				hideGraph: this.hideGraph,
				hideGridDots: this.hideGridDots,
				hideOffset: this.hideOffset,
				lineWidth: this.lineWidth,
				periods: this.periods
			},
			fourierData: {}
		};

		Object.entries(this._data).forEach(entry => {
			data.fourierData[entry[0]] = entry[1].value / this.CONTROL_RANGE;
		});

		return JSON.stringify(data, null, 4);
	}

	/**
	 * Load the fourier data and user options from a JSON string.
	 * @param json
	 */
	private _importJson(json: string) {
		const data = JSON.parse(json);

		// don't do anything if this is not a fourier-synth data file with data
		if (data.source === PackageName && data.fourierData && Object.keys(data.fourierData).length > 0) {
			// data
			Object.entries(data.fourierData).forEach(entry => {
				const key = entry[0];
				if (key.match(/^(cos|sin)\d+$/)) {
					const suffix = `<sub>${key.substring(3)}</sub>`;
					const value = (entry[1] as number) * this.CONTROL_RANGE;
					if (key === 'cos0') {
						this._data.cos0.value = value;
					}
					else {
						// new object in case new harmonics are more than existing
						this._data[key] = {
							label: `${key.startsWith('cos') ? this.cosPrefix : this.sinPrefix}${suffix}`,
							value: value
						}
					}
				}
			});

			this._drawWaveform();
			this._play();
			this.updateCount++;

			// config
			if (data.config && Object.keys(data.config).length > 0) {
				this.autoAdjust = data.config.autoAdjust ?? this.autoAdjust;
				this.fundamental = data.config.fundamental ?? this.fundamental;
				this.gain = data.config.gain ?? this.gain;
				this.harmonics = data.config.harmonics ?? this.harmonics;
				this.hideDividers = data.config.hideDividers ?? this.hideDividers;
				this.hideEndpoints = data.config.hideEndpoints ?? this.hideEndpoints;
				this.hideGraph = data.config.hideGraph ?? this.hideGraph;
				this.hideGridDots = data.config.hideGridDots ?? this.hideGridDots;
				this.hideOffset = data.config.hideOffset ?? this.hideOffset;
				this.lineWidth = data.config.lineWidth ?? this.lineWidth;
				this.periods = data.config.periods ?? this.periods;
			}
		}
	}

	/**
	 * Check if the key pressed is Enter or space, and trap the event if true.
	 */
	private _isToggleKey(event: KeyboardEvent): boolean {
		if (event.key.match(/(^Enter| )$/)) {
			event.preventDefault();
			return true;
		}

		return false;
	}

	/**
	 * Get the contents of the file that the user has opened.
	 */
	private _loadFile() {
		if (this._fileElement.files.length > 0) {
			const file = this._fileElement.files[0];
			this._lastFilename = file.name;
			file.text().then(json => this._importJson(json))
				// clear the value so that opening the same file again will work (Edge)
				.then(() => this._fileElement.value = '');
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
	 * Async because this doesn't need to happen at a precise instant.
	 */
	private async _play() {
		if (!this.enableAudio) {
			return;
		}

		if (!this._audioContext) {
			// first time - set up audio
			this._audioContext = new AudioContext();
			this._gainNode = new GainNode(this._audioContext);
			this._gainNode.connect(this._audioContext.destination);
			this._offsetNode = new ConstantSourceNode(this._audioContext);
			this._offsetNode.connect(this._audioContext.destination);
			this._offsetNode.start();
			this._oscillator = new OscillatorNode(this._audioContext);
			this._oscillator.connect(this._gainNode);
			this._oscillator.start();
		}

		this._gainNode.gain.value = this.gain;
		this._offsetNode.offset.value = this._data.cos0.value / this.CONTROL_RANGE;
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
	}

	/**
	 * Reset all or one of the harmonic's data.
	 * @param id id of individual harmonic to reset
	 */
	private _resetData(id?: string) {
		if (id) {
			// reset single
			this._data[id].value = 0;
			this._update();
		}
		else {
			// reset all
			Object.values(this._data).forEach(data => {
				data.value = 0;
			});
			if (this.gain === this.GAIN_DEFAULT) {
				this._update();
			}
			else {
				this.gain = this.GAIN_DEFAULT;
				this._play();
			}
		}
	}

	/**
	 * Open the file save dialog to let the user save the synth data and config.
	 */
	private _saveFile() {
		const data = this._exportJson();
		const file = new Blob([data], { type: 'application/json' });
		const a = document.createElement('a');
		const	url = URL.createObjectURL(file);
		a.href = url;
		a.download = this._lastFilename ?? `${PackageName}.json`;
		document.body.appendChild(a);
		a.click();
		window.setTimeout(function () {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		}, 0);
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
			return <Fragment>
				<label class="control-label" innerHTML={control.label}></label>
				<input class={{'slider': true, 'offset': offset}}
					disabled={this.autoAdjust && offset}
					type="range"
					min={-this.CONTROL_RANGE}
					max={this.CONTROL_RANGE}
					step={0.1}
					value={control.value}
					onInput={event => this._updateData(event.currentTarget as HTMLInputElement, id)}
				></input>
				<input class="field"
					type="number"
					readonly={this.autoAdjust && offset}
					min={-this.CONTROL_RANGE}
					max={this.CONTROL_RANGE}
					step={0.1}
					value={this._fieldFormatter.format(control.value)}
					onBlur={event => this._updateData(event.currentTarget as HTMLInputElement, id)}
					onChange={event => this._updateData(event.currentTarget as HTMLInputElement, id)}
				></input>
				<button class="clear" disabled={this.autoAdjust && offset} onClick={() => this._resetData(id)}>X</button>
			</Fragment>;
		};

		const controls = () => {
			return <Fragment>
				{this.cosTitle && this.sinTitle && <label class="column-label cos">{this.cosTitle}</label>}
				{this.cosTitle && this.sinTitle && <label class="column-label sin">{this.sinTitle}</label>}
				{Object.keys(this._data).map(id => {
					if (id.startsWith('sin')) {
						const harmonic = Number(id.substring(3));
						return <Fragment>
							{control(`cos${harmonic}`)}
							<div class="frequency">{harmonic * this.fundamental}Hz</div>
							{control(`sin${harmonic}`)}
						</Fragment>;
					}
				})}
			</Fragment>;
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
								onKeyPress={(event) => this._isToggleKey(event) && (this.enableAudio = !this.enableAudio)}
							></input>
						</span>
						{this.fundamentalLabel && <span class="feature-container">
							<label class="feature-label">{this.fundamentalLabel}</label>
							<input class="fundamental"
								type="number"
								min={this.FREQUENCY_MIN}
								max={Math.floor(this.FREQUENCY_MAX / this.harmonics)}
								value={this.fundamental}
								onBlur={event => this.fundamental = Number((event.currentTarget as HTMLInputElement).value)}
								onChange={event => this.fundamental = Number((event.currentTarget as HTMLInputElement).value)}
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
								onBlur={event => this.harmonics = this._checkHarmonicsBounds(Number((event.currentTarget as HTMLInputElement).value))}
								onChange={event => this.harmonics = this._checkHarmonicsBounds(Number((event.currentTarget as HTMLInputElement).value))}
							></input>
						</span>}
						<span class="feature-container icons">
							<span class="button" onClick={() => this._fileElement.click()}>
								<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" class="bi bi-file-earmark-arrow-up" viewBox="0 0 16 16">
									<path d="M8.5 11.5a.5.5 0 0 1-1 0V7.707L6.354 8.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 7.707V11.5z" />
									<path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z" />
								</svg>
							</span>
							<span class="button" onClick={() => this._saveFile()}>
								<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" class="bi bi-file-earmark-arrow-down" viewBox="0 0 16 16">
									<path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z" />
									<path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z" />
								</svg>
							</span>
							<input id="file"
								hidden
								type="file"
								accept=".json"
								onChange={() => this._loadFile()}
								ref={el => this._fileElement = el}
							></input>
						</span>
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
							<input class="db"
								readonly
								value={`${this._gainFormatter.format(20 * Math.log10(this.gain))}dB`}
								tabindex={-1}
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
									onKeyPress={(event) => this._isToggleKey(event) && (this.hideGraph = !this.hideGraph)}
								></input>
							</span>}
							{this.autoAdjustLabel && <span class="feature-container">
									<label class="feature-label">{this.autoAdjustLabel}</label>
									<input class="toggle"
										type="range"
										min={0}
										max={1}
										step={1}
										value={this.autoAdjust ? 1 : 0}
										onInput={event => this.autoAdjust = (event.currentTarget as HTMLInputElement).value === '1'}
										onKeyPress={(event) => this._isToggleKey(event) && (this.autoAdjust = !this.autoAdjust)}
									></input>
								</span>
							}
						</div>
					}
					{/* graph controls */}
					{(this.lineWidthLabel || this.periodsLabel || this.dividersLabel || this.endpointsLabel || this.gridDotsLabel) &&
						<div class="header" style={this.hideGraph && {'display': 'none'}}>
							<div class="row">
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
										onInput={event => this.periods = Number((event.currentTarget as HTMLInputElement).value)}
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
										onKeyPress={(event) => this._isToggleKey(event) && (this.hideOffset = !this.hideOffset)}
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
										onKeyPress={(event) => this._isToggleKey(event) && (this.hideEndpoints = !this.hideEndpoints)}
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
										onKeyPress={(event) => this._isToggleKey(event) && (this.hideDividers = !this.hideDividers)}
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
										onKeyPress={(event) => this._isToggleKey(event) && (this.hideGridDots = !this.hideGridDots)}
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

export type FourierSynthJson = {
	config: {
		autoAdjust: boolean,
		fundamental: number,
		gain: number,
		harmonics: number,
		hideDividers: boolean,
		hideEndpoints: boolean,
		hideGraph: boolean,
		hideGridDots: boolean,
		hideOffset: boolean,
		lineWidth: number,
		periods: number
	},
	fourierData: Record<string, number>,
	source: string,
	version: string
}
