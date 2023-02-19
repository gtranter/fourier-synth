![Built With Stencil](https://img.shields.io/badge/-Built%20With%20Stencil-16161d.svg?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI%2BCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI%2BCgkuc3Qwe2ZpbGw6I0ZGRkZGRjt9Cjwvc3R5bGU%2BCjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik00MjQuNywzNzMuOWMwLDM3LjYtNTUuMSw2OC42LTkyLjcsNjguNkgxODAuNGMtMzcuOSwwLTkyLjctMzAuNy05Mi43LTY4LjZ2LTMuNmgzMzYuOVYzNzMuOXoiLz4KPHBhdGggY2xhc3M9InN0MCIgZD0iTTQyNC43LDI5Mi4xSDE4MC40Yy0zNy42LDAtOTIuNy0zMS05Mi43LTY4LjZ2LTMuNkgzMzJjMzcuNiwwLDkyLjcsMzEsOTIuNyw2OC42VjI5Mi4xeiIvPgo8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDI0LjcsMTQxLjdIODcuN3YtMy42YzAtMzcuNiw1NC44LTY4LjYsOTIuNy02OC42SDMzMmMzNy45LDAsOTIuNywzMC43LDkyLjcsNjguNlYxNDEuN3oiLz4KPC9zdmc%2BCg%3D%3D&colorA=16161d&style=flat-square)

# Fourier Synthesizer Web Component

This project is a standalone Web Component for generating waveforms and audio using Fourier synthesis. It is inspired from a [Java Applet](https://thole.org/manfred/fourier/en_idx.html) written by [Manfred Thole](https://thole.org/manfred/).
<br></br>

# Stencil

[Stencil](https://stenciljs.com/docs/introduction) is a compiler for building Web Components. Fourier Synthesizer is built with Stencil on the Node.js platform using TypeScript, JSX, HTML, and SASS.

For help with Stencil, see the Stencil [docs](https://stenciljs.com/docs/my-first-component).
<br></br>

# Use in another Node.js project

```bash
npm install fourier-synth
```

Visual Studio Code IntelliSense support is provided. Add the `vscode-docs.json` file included with the package under the VS Code setting for `html.customData` - for example `./node_modules/fourier-synth/vscode-docs.json`.
<br></br>

# Develop this project

## Development stack

This project is dependent on several development tools and technologies:

1. Node.js
2. NPM
3. Git
4. Stencil & Stencil SASS
5. TypeScript
6. JSX

For a full list of project dependencies see [package.json](./package.json).

## Development environment

[Visual Studio Code](https://code.visualstudio.com/) is highly recommended as editor/IDE for this project. VS Code Configuration of many code features is included with the project along with recommended extensions.

An [.editorconfig](https://editorconfig.org/) file is also provided for use with other editors but does not provide as many features as VS Code has.

## Setup

If you haven't already, you will need to install [Node.js](https://nodejs.org/) LTS v14 or newer (including NPM), and [Git](https://git-scm.com/). A terminal/shell environment is also required - Git Bash (which is included with Git for Windows) is recommended.

To start development:

Clone the project and install it:

```bash
git clone https://github.com/gtranter/fourier-synth.git
cd fourier-synth
npm install
```

Run the Stencil dev server:

```bash
npm start
```

## Build

To build the component for production:

```bash
npm run build
```

## Test

To run the unit tests for the component:

```bash
npm test
```

## Deploy

To create the deployable archives:

```bash
npm run build.deployables
```

## APIs

### Graphing

Drawing of the Fourier waveforms graph is done using the [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API).

### Audio

Sound generation is done using the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

### Browser support

`Firefox` (as of v112) and `Safari` (as of v16.3) do not support the disable normalization feature of the Web Audio API. As a result, the DC Offset control will not work properly - it is not possible to "clip" the generated wave where it exceeds the maximum level (the limits of the graph area). For best results use a different browser such as `Edge`, `Opera`, or another `Chromium` variant. For more information on browser support see the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createPeriodicWave#browser_compatibility).
<br></br>

# Contributing & Reporting Issues

If you're an experienced developer who knows TypeScript, Stencil, web components, SASS, and HTML, and would like to contribute your skills to this project, reach out via [GitHub](https://github.com/gtranter/fourier-synth).

If you've found a problem with Fourier Synthesizer, please [report it](https://github.com/gtranter/fourier-synth/issues).

Technical support for using this component is not available - please try [Stack Overflow](https://stackoverflow.com/) instead.
