# NimbusImage

[![Github Actions][github-actions-image]][github-actions-url]

## Documentation

See this [gitbook](https://arjun-raj-lab.gitbook.io/nimbusimage) for documentation.

## System requirements

### General notes

You can run the server yourself on most reasonably new computers (Mac, Linux, PC). The GPU workers (e.g. Cellpose, Piscis) only work on Linux and possibly Windows, but will fall back to CPU if no GPU is (properly) installed.

Tye typical install time is probably around 1-2 hours.

Software requirements:
Docker (latest version) (be sure to follow the post install instructions for Linux, and 
Node.js (latest version)

Optional (required for machine learning workers):
[CUDA for machine learning workers](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/index.html), 
[NVIDIA docker toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

### Supported browsers
Supports all major browsers, including Chrome, Firefox, and Safari. Note that the SAM ViT-B tool requires WebGPU and so is only available on Chrome.

### Hardware requirements
Will run on most Mac, Linux, and PC computers. GPU workers requires a GPU with NVIDIA 535 drivers installed, but will fall back to CPU if no properly installed GPU is detected. Strongly recommend at least 16GB of RAM. To handle very large images, we recommend servers with at least 64GB of RAM.

## Development environment

Install PNPM
```sh
npm i -g pnpm
```

Clone the repo and install node modules:

```sh
git clone https://github.com/Kitware/UPennContrast.git
cd UPennContrast
pnpm install
```

Compile C++ code to wasm with this command:

```sh
pnpm emscripten-build
```

This will run the command `pnpm emscripten-build:release`.
You can also run `pnpm emscripten-build:debug` to build with debug symbols.

The following will pull in the SAM models (from the `UPennContrast` directory):
```sh
mkdir -p public/onnx-models/sam/vit_b
cd public/onnx-models/sam/vit_b
wget "https://huggingface.co/rajlab/sam_vit_b/resolve/main/decoder.onnx" -O decoder.onnx
wget "https://huggingface.co/rajlab/sam_vit_b/resolve/main/encoder.onnx" -O encoder.onnx
```

Start docker images for the backend:

```sh
docker compose build
docker compose up -d
```

This will set up Girder (backend) running on `http://localhost:8080`

Then, to start the front end (development):

```sh
pnpm run dev
```

If you are on Linux, you may need to run the following:

```sh
cat /proc/sys/fs/inotify/max_user_watches
sudo sysctl fs.inotify.max_user_watches=1000000
sudo sysctl -p
```

You can now access NimbusImage by going to:
```sh
http://localhost:5173
```

To setup an environment for native C++ development for ITK, see [`itk/README.md`](./itk/README.md).

For technical documentation about tools, see [`TOOLS.md`](./TOOLS.md).

### To install the workers:

Go to a new directory (NOT the `UPennContrast` directory) and run
```sh
git clone https://github.com/arjunrajlab/ImageAnalysisProject
chmod +x build_machine_learning_workers.sh
chmod +x build_all_property_and_annotation_workers.sh
./build_machine_learning_workers.sh
./build_all_property_and_annotation_workers.sh
```

That will install all the workers. The machine learning workers will run on CPU on Linux if a GPU is not available, although will run much more slowly.

## Login details

IMPORTANT: by default, a admin user will be created with the name `admin` and the password `password`. You can use that user to initially log into the system. For security, it is critical to add a new admin user in Girder and then remove the original admin user. To do this, go to ```localhost:8080```, where you can sign into Girder, then go to the `Users` tab on the left.

## Demo and test data

[Quick start](https://arjun-raj-lab.gitbook.io/nimbusimage/quick-start)
[Vignettes](https://arjun-raj-lab.gitbook.io/nimbusimage/vignettes)

[Test dataset with RNA FISH images](https://www.dropbox.com/scl/fi/hyg3bou153fnq6lye3zlb/DDX58_AXL_EGFR_well2.nd2?rlkey=lf00zmmkqv4hc7c6fy9qgqvfp&dl=0)
[Test N-dimensional dataset with GFP labeled nuclei](https://www.dropbox.com/scl/fi/rakjixk7ei3b31h41nso5/normmedia_8well_col2_livecellgfp.nd2?rlkey=vjqiftvcqlihl692b8xsr79rd&dl=0)

### Girder Defaults

Girder will create an assetstore in which all the data is stored.

To change the default settings of the landing pange for unauthenticated users, create a `.env` file following this pattern:
```
VITE_GIRDER_URL=http://localhost:8080
VITE_DEFAULT_USER=User
VITE_DEFAULT_PASSWORD=Password
```

The users that already opened the app once will have the field "Girder Domain" filled with the last domain they used. Otherwise, the `VITE_GIRDER_URL` variable will be used. If the default user and password are set, the app will try to log in with these credentials.

### Compiles and minifies for production

To compile for production, run this command:

```
pnpm build
```

It will also produce a `stats.html` file at the root of the project.
This file is generated by the `rollup-plugin-visualizer`.
You can change the generated file by playing with the options of the plugin in `vite.config.ts` (see the [github page](https://github.com/btd/rollup-plugin-visualizer?tab=readme-ov-file#options) of the plugin).

If you want to preview the production build:

```
pnpm run serve
```

You can now access NimbusImage by going to:
```sh
http://localhost:4173
```

### Lints and fixes files

```
pnpm lint:fix
```

### Run typescript compiler

```
pnpm tsc
```

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).

[github-actions-image]: https://github.com/Kitware/UPennContrast/workflows/node/badge.svg
[github-actions-url]: https://github.com/Kitware/UPennContrast/actions
