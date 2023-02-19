# [Fourier Synthesizer](https://github.com/gtranter/fourier-synth) User Guide

## Overview

Fourier Synthesizer is a waveform and sound generator based on the principles of Fourier synthesis. Starting with a simple sine wave fundamental frequency, complex waveforms are created by adding additional harmonic frequencies with varying levels of gain and phase shift, where each harmonic is a whole number multiple of the fundamental.

## Sound Features

### Enable Audio

The audio must be enabled by the user in order to hear the generated sound.

### Fundamental

Choose the frequency of the lowest tone from 20Hz to 20000Hz. Note that changing the fundamental affects audio only and does not affect the graph in any way except for the possible number of harmonics ([see below](#harmonics)).

### Harmonics

Set how many harmonic frequencies you want to include - the number includes the fundamental. You cannot have harmonics greater than 20000Hz, so if for example your fundamental is 1000Hz, the maximum number of harmonics is 20.

### Auto-adjust

When enabled, the DC offset and gain is automatically adjusted to center and maximize the waveform without clipping (exceeding the maximum limits shown by the top and bottom graph boundaries) - thus "normalizing" the waveform. The DC and Gain controls will be disabled.

Note that Firefox and Safari internally normalize audio all the time to avoid clipping, so you may not hear any difference even though the graph will change. Edge, Opera, and other Chromium variants do not have this problem. See the [readme](./README.md#browser-support) file for more information.

## Graph Features

### Show Graph

You can toggle the visibility of the graph if you do not want to see it.

### Line Width

Adjusts the width of the waveform plot line from 1 to 5. Thin lines can help when high numbered harmonics are lost due to screen resolution.

### Periods

Adjusts the number of complete periods of the fundamental shown in the graph from 1 to 5. This can also help with waveform detail when you use high numbers of harmonics.

### Offset

Show or hide the DC offset applied to the waveform.

### Endpoints

Show or hide the fundamental waveform start/stop endpoint dots.

### Dividers

Show or hide the fundamental waveform start/stop vertical divder lines.

### Grid Dots

Show or hide the graph background grid dots.

## Operation

The fundamental and each harmonic has a slider control to adjust the amplitude (loudness). Negative settings represent absolute phase inversion. A second slider adds relative phase shift. In Fourier theory, these represent the real and imaginary parts of the function respectively. The value ranges from -100 to +100 are in percent units.

The DC offset control applies DC shift to the AC waveform.

The Gain control adjusts the overall level of the waveform and sound.

The Reset button clears all adjustments.

## Waveform Save & Load

The Save and Load icon buttons allow saving and loading your waveform and feature settings to and from JSON text files.
