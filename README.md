# NimbusImage

[![Github Actions][github-actions-image]][github-actions-url]

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

Depending on your operating system, run one of the following to compile C++ to wasm:
```sh
npm run build-workers-unix
npm run build-workers-windows
```

Start docker images and run the server:
```sh
docker-compose up -d
npm run serve
```

To setup an environment for native C++ development for ITK, see `itk/README.md`.

### Girder Defaults

By default, a admin user will be created with the name `admin` and the password `password`.  To use a different admin user, register a new user, log in as the `admin` user and make the new user an admin, then delete the original `admin` user.

A default assetstore is also created.

### Compiles and minifies for production

```
npm run build
```

### Lints and fixes files

```
npm run lint
```

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).

[github-actions-image]: https://github.com/Kitware/UPennContrast/workflows/node/badge.svg
[github-actions-url]: https://github.com/Kitware/UPennContrast/actions
