# NimbusImage

[![Github Actions][github-actions-image]][github-actions-url]

## Documentation

This [this git book](https://arjun-raj-lab.gitbook.io/nimbusimage) for documentation.

## Project setup

```
npm install
```

## Development environment

Clone the repo and install node modules:
```sh
git clone https://github.com/Kitware/UPennContrast.git
cd UPennContrast
npm install
```

Compile C++ code to wasm with this command:
```sh
npm run emscripten-build
```

This will run the command `npm run emscripten-build:release`.
You can also run `npm run emscripten-build:debug` to build with debug symbols.

Start docker images and run the server:
```sh
docker-compose up -d
npm run dev
```

To setup an environment for native C++ development for ITK, see [`itk/README.md`](./itk/README.md).

For technical documentation about tools, see [`TOOLS.md`](./TOOLS.md).


### Girder Defaults

By default, a admin user will be created with the name `admin` and the password `password`.  To use a different admin user, register a new user, log in as the `admin` user and make the new user an admin, then delete the original `admin` user.

A default assetstore is also created.

### Compiles and minifies for production

To compile for production, run this command:
```
npm run build
```

It will also produce a `stats.html` file at the root of the project.
This file is generated by the `rollup-plugin-visualizer`.
You can change the generated file by playing with the options of the plugin in `vite.config.ts` (see the [github page](https://github.com/btd/rollup-plugin-visualizer?tab=readme-ov-file#options) of the plugin).

If you want to preview the production build:

```
npm run serve
```

### Lints and fixes files

```
npm run lint:fix
```

### Run typescript compiler

```
npm run tsc
```

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).

[github-actions-image]: https://github.com/Kitware/UPennContrast/workflows/node/badge.svg
[github-actions-url]: https://github.com/Kitware/UPennContrast/actions
