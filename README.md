# UPenn Contrast

[![Github Actions][github-actions-image]][github-actions-url]

## Running with Docker

```sh
git clone https://github.com/Kitware/UPennContrast.git
cd UPennContrast/devops
docker-compose up -d
```

Server will be running on `http://localhost:8080`

## Development

Install https://github.com/Kitware/ldc

```bash
# bring the stack up
ldc up

# To work on the backend...
# replace a pre-built image with the development version
# for example, here's how to work on the girder server code
ldc dev girder

# To work on the frontend...
cd client/
yarn
yarn serve

# stop all containers and remove their volumes
ldc clean
```
