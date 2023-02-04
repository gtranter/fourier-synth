import { Component, Host, h, State, Prop, Element, Watch } from '@stencil/core';

export interface FourierData {
	formattedValue: string,
	label: string,
	value: number
}

@Component({
	tag: 'fourier-synth',
	styleUrl: 'fourier-synth.scss',
	shadow: true,
})
export class FourierSynth {

	private _canvas: HTMLCanvasElement;
	private _data: Record<string, FourierData>;
	private _formatter = Intl.NumberFormat(navigator.language, {minimumFractionDigits: 1});
	private _renderer: CanvasRenderingContext2D;
	private _sound = Array<number>(40);

	private readonly AMPLITUDE: number = 100;

	private readonly FUNDAMENTAL: number = 400;

	private readonly MULTIPLIER: number = 10.0;

	private readonly TIME_BASE: number = 40.0/Math.PI;

	@Element() hostElement: HTMLFourierSynthElement;

	@State() enableAudio: boolean = true;

	@State() updates: number = 0;

	/**
	 * Label text for the "Enable Audio" toggle switch.
	 */
	@Prop({reflect: true}) audioLabel: string = 'Enable Audio';

	/**
	 * Text prefix for the number label on cosine controls.
	 */
	@Prop({reflect: true}) cosLabel: string = 'A';

	/**
	 * Title text for the cosine controls.
	 */
	@Prop({reflect: true}) cosTitle: string = 'Cosinus';

	/**
	 * Number of harmonics to control and produce.
	 */
	@Prop({mutable: true, reflect: true}) harmonics: number = 8;
	@Watch('harmonics')
	handleHarmonicsChange(newValue: number, oldValue: number) {
		if (newValue < oldValue) {
			for (let harmonic = newValue + 1; harmonic <= oldValue; harmonic++) {
				delete this._data[`cos${harmonic}`];
				delete this._data[`sin${harmonic}`];
			}
		}
		else {
			for (let harmonic = oldValue + 1; harmonic <= newValue; harmonic++) {
				this._data[`cos${harmonic}`] = {
					formattedValue: '0.0',
					label: `${this.cosLabel}<sub>${harmonic}</sub>`,
					value: 0
				};
				this._data[`sin${harmonic}`] = {
					formattedValue: '0.0',
					label: `${this.sinLabel}<sub>${harmonic}</sub>`,
					value: 0
				};
			}
		}
		this._update();
	}

	@Prop({reflect: true}) mainTitle: string = 'Fourier Synthesis';

	/**
	 * Text prefix for the number label on sine controls.
	 */
	@Prop({reflect: true}) sinLabel: string = 'B';

	/**
	 * Title text for the sine controls.
	 */
	@Prop({reflect: true}) sinTitle: string = 'Sinus';

	async componentWillLoad() {
		// initialize data
		this._data = {};
		for (let harmonic = 0; harmonic <= this.harmonics; harmonic++) {
			this._data[`cos${harmonic}`] = {
				formattedValue: '0.0',
				label: `${this.cosLabel}<sub>${harmonic}</sub>`,
				value: 0
			};
			if (harmonic > 0) {
				this._data[`sin${harmonic}`] = {
					formattedValue: '0.0',
					label: `${this.sinLabel}<sub>${harmonic}</sub>`,
					value: 0
				};
			}
		};
	}

	async componentDidLoad() {
		// block non numeric input on fields
		const decimal = this._formatter.formatToParts(1.1).find(p => p.type === 'decimal')?.value ?? '.';
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
	 * Generate audio stream from the data.
	 */
	private _play() {
		if (this.enableAudio) {

			for (let i = 0; i < 80; i++) {
				let y = this._data.cos0.value / (2.0 * this.MULTIPLIER);
				for (let anz = 1; anz <= this.harmonics; anz++) {
					y += this._data[`cos${anz}`].value / this.MULTIPLIER * Math.cos(anz * i / this.TIME_BASE);
					y += this._data[`sin${anz}`].value / this.MULTIPLIER * Math.sin(anz * i / this.TIME_BASE);
				}

				if (this.enableAudio && (i % 2 === 0)) {
					console.log(Math.round(y * 100));
					this._sound[i/2] = this._µlaw(Math.round(y * 100));
				}
			}
			console.log(this._sound.toString());

			// soundStream = new ContinuousAudioDataStream(new AudioData(this._sound));
			// AudioPlayer.player.start(soundStream);
		}
	}

	/**
	 * Draw the waveform derived from the data.
	 */
	private _plot() {
		// set the canvas size
		const maxX = this._canvas.offsetWidth;
		const maxY = this._canvas.offsetHeight;
		this._canvas.width = maxX;
		this._canvas.height = maxY;

		// fill background
		this._renderer.fillStyle = 'rgb(0, 0, 0)';
		this._renderer.fillRect(0, 0, maxX, maxY);

		// draw grid dots
		const size = maxX / 5 / this.harmonics;
		// figure out where to start vertically so that the grid is centered
		const startY = (maxY / 2) % size;
		this._renderer.fillStyle = 'rgb(0, 127, 255)';
		for (let x = size; x < maxX; x += size) {
			for (let y = startY; y < maxY; y += size) {
				this._renderer.beginPath();
				this._renderer.arc(x, y, 1, 0, Math.PI * 2, true);
				this._renderer.fill();
			}
		}

		// draw axes
		this._renderer.lineWidth = 1;
		this._renderer.strokeStyle = 'rgb(0, 127, 255)';
		this._renderer.beginPath();
		const axisY = maxY / 2;
		// horizontal
		this._renderer.moveTo(0, axisY);
		this._renderer.lineTo(maxX, axisY);
		// vertical
		for (let x = 0.2; x < 1.0; x += 0.2) {
			const axisX = x * maxX;
			this._renderer.moveTo(axisX, 0);
			this._renderer.lineTo(axisX, maxY);
		}
		this._renderer.stroke();

		// draw wave

		this._renderer.lineWidth = 2;
		this._renderer.strokeStyle = 'rgb(127, 255, 0)';
		this._renderer.beginPath();

		let ya = 0;
		let yf = 0;

		// One period, TIM_MULT dependent! This needs clean up...

		// scale the original 400-wide graph to variable width graph
		const scale = maxX / this.FUNDAMENTAL;
		const muliplier = this.MULTIPLIER * scale;
		const timeBase = this.TIME_BASE * scale;

		for (let i = 0; i < 80 * scale; i++) {
			let y = this._data.cos0.value / muliplier;
			for (let harmonics = 1; harmonics <= this.harmonics; harmonics++) {
				y += this._data[`cos${harmonics}`].value / muliplier * Math.cos(harmonics * i / timeBase);
				y += this._data[`sin${harmonics}`].value / muliplier * Math.sin(harmonics * i / timeBase);
			}

			let iy = (y * (10 * scale) + (100 * scale));

			if (i === 0) {
				yf = iy;
				ya = iy;
			}
			else {
				for (let j = 0; j < maxX; j += 80 * scale) {
					this._renderer.moveTo(i - 1 + j, ya);
					this._renderer.lineTo(i + 1 + j, iy);
				}
				ya = iy;
			}
		}
		this._renderer.stroke();

		this._renderer.fillStyle = 'rgb(255, 0, 127)';
		for (let j = 0; j <= maxX; j += 80 * scale) {
			this._renderer.beginPath();
			this._renderer.moveTo(j - 1, ya);
			this._renderer.lineTo(j, yf);
			this._renderer.stroke();
			// wave start-stop ticks
			this._renderer.arc(j, ya, 3, 0, Math.PI * 2, true);
			this._renderer.fill();
		}
	}

	// _drawWave() {
	// 		// draw wave

	// 		let ya = 0;
	// 		let yf = 0;

	// 		// if (  AUDIO && soundOn  )
	// 		// 	AudioPlayer.player.stop(soundStream);

	// 		// One period, TIM_MULT dependent! This needs clean up...

	// 		for (let i = 0; i < 80; i++) {
	// 			let y = this._data.cos0.value/(2.0*this.INT_MULT);
	// 			for (let sinIndex = 1; sinIndex <= 6; sinIndex++) {
	// 				y += this._data[`cos${sinIndex}`].value/this.INT_MULT*Math.cos(sinIndex*i/this.TIM_MULT);
	// 				y += this._data[`sin${sinIndex}`].value/this.INT_MULT*Math.sin(sinIndex*i/this.TIM_MULT);
	// 			}

	// 			let iy = (y*10+100);

	// 			// if ( AUDIO && ( i % 2 != 0 ) )
	// 			// sound[i/2] = this.µlaw((y*100));

	// 			if ( i === 0 ) {
	// 				yf = iy;
	// 				ya = iy;
	// 			}
	// 			else {
	// 				this._renderer.beginPath();
	// 				for (let j = 0; j < 400; j += 80) {
	// 					// dbg.drawLine(i-1+j, ya, i+j, iy);
	// 					this._renderer.moveTo(i-1+j, ya);
	// 					this._renderer.lineTo(i+j, iy);
	// 				}
	// 				ya = iy;
	// 				this._renderer.closePath();
	// 				this._renderer.strokeStyle = '#3f3fff';
	// 				this._renderer.stroke();
	// 			}
	// 		}

	// 		// if ( AUDIO && soundOn )
	// 		// 	AudioPlayer.player.start(soundStream);

	// 		this._renderer.beginPath();
	// 		for (let j = 80; j < 400; j+=80) {
	// 			// dbg.drawLine(j-1, ya, j, yf);
	// 			this._renderer.moveTo(j-1, ya);
	// 			this._renderer.lineTo(j, yf);
	// 		}
	// 		this._renderer.closePath();
	// 		this._renderer.strokeStyle = '#3f3fff';
	// 		this._renderer.stroke();
	// }

	/**
	 * Reset all or one of the data controls.
	 * @param id id of individual control to reset
	 */
	private _resetData(id?: string) {
		if (id) {
			// reset single
			this._data[id].formattedValue = '0.0';
			this._data[id].value = 0;
		}
		else {
			// reset all
			Object.keys(this._data).forEach(id => {
				this._data[id].formattedValue = '0.0';
				this._data[id].value = 0;
			});
		}

		this._update();
	}

	/**
	 * Update the waveform and sound stream
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
	private _updateData(event: Event) {
		const input = event.target as HTMLInputElement;
		const data = this._data[input.name];
		let value = Number(input.value);

		// number check
		if (isNaN(value) || input.value === '') {
			input.value = data.value.toString();
			return;
		}

		// apply bounds
		value = Math.max(-this.AMPLITUDE, Math.min(value, this.AMPLITUDE));

		// update other input/slider
		data.value = value;
		data.formattedValue = this._formatter.format(value);

		this._update();
	}

	/**
	 * Generate byte data for audio stream.
	 * @param ch
	 * @returns
	 */
	private _µlaw(ch) {

		let mask;

		if (ch < 0) {
			ch = -ch;
			mask = 0x7f;
		}
		else {
			mask = 0xff;
		}

		if (ch < 32) {
			ch = 0xF0 | 15 - (ch/2);
		}
		else if (ch < 96) {
			ch = 0xE0 | 15 - (ch-32)/4;
		}
		else if (ch < 224) {
			ch = 0xD0 | 15 - (ch-96)/8;
		}
		else if (ch < 480) {
			ch = 0xC0 | 15 - (ch-224)/16;
		}
		else if (ch < 992 ) {
			ch = 0xB0 | 15 - (ch-480)/32;
		}
		else if (ch < 2016) {
			ch = 0xA0 | 15 - (ch-992)/64;
		}
		else if (ch < 4064) {
			ch = 0x90 | 15 - (ch-2016)/128;
		}
		else if (ch < 8160) {
			ch = 0x80 | 15 - (ch-4064)/256;
		}
		else {
			ch = 0x80;
		}

		return (mask & ch) ? 1 : 0;
	}

	render() {
		const row = (id: string) => {
			const control = this._data[id];
			return (
				<div class="row" key={id}>
					<label class="label" htmlFor={id} innerHTML={control.label}></label>
					<input class="slider"
						id={id}
						name={id}
						type="range"
						min={-this.AMPLITUDE}
						max={this.AMPLITUDE}
						step={0.1}
						value={control.value}
						onInput={event => this._updateData(event)}
					></input>
					<input class="field"
						name={id}
						type="number"
						min={-this.AMPLITUDE}
						max={this.AMPLITUDE}
						step={0.1}
						value={control.formattedValue}
						onChange={event => this._updateData(event)}
					></input>
					<button class="clear" onClick={() => this._resetData(id)}>X</button>
				</div>
			);
		};

		return (
			<Host>
				<div class="container">
					{this.mainTitle && <h1>{this.mainTitle}</h1>}
					<div class="header">
						<div class="row">
							<input class={{'toggle': true, 'toggle-on': this.enableAudio}}
								id="enableAudio"
								type="range"
								min={0}
								max={1}
								step={1}
								value={this.enableAudio ? 1 : 0}
								onInput={event => this.enableAudio = (event.currentTarget as HTMLInputElement).value === '1' }
							></input>
							<h2 class="feature">{this.audioLabel}</h2>
							<input class="harmonics"
								type="number"
								min={1}
								max={Math.floor(10000 / this.FUNDAMENTAL)}
								step={1}
								value={this.harmonics}
								onChange={event => this.harmonics = Number((event.currentTarget as HTMLInputElement).value)}
							></input>
							<h2 class="feature">Harmonics</h2>
						</div>
					</div>
					<div class="controls">
						<div class="row">
							<div class="column first-column">
								<h2>{this.cosTitle}</h2>
								{Object.keys(this._data).map(id => id.startsWith('cos') && row(id))}
							</div>
							<div class="column">
								<h2>{this.sinTitle}</h2>
								<div class="row">&nbsp;</div>{/* spacer row */}
								{Object.keys(this._data).map(id => id.startsWith('sin') && row(id))}
							</div>
						</div>
						<button class="reset" onClick={() => this._resetData()}>Reset</button>
					</div>
					<div class="graph">
						<canvas ref={el => this._canvas = el}>Fourier graph appears here when JavaScript is enabled</canvas>
					</div>
				</div>
			</Host>
		);
	}
}
