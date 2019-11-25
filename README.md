# UPenn Contrast

[![Github Actions][github-actions-image]][github-actions-url]

## Project setup

```
npm install
```

## Development environment

```sh
git clone https://github.com/Kitware/UPennContrast.git
cd UPennContrast
npm install
docker-compose up -d
npm run serve
```

### Setup Girder

1. go to http://localhost:8080
1. create a new account
1. go to the Admin console and create a File System Asset Store at `/store`
1. go to the Admin console -> settings -> advanced -> `CORS Allowed Origins` -> `*`
1. go to the Admin console -> plugins -> worker: enter the urls `amqp://guest:guest@rabbitmq/` for both broker and backend and `http://girder:8080/api/v1` for the api url

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
