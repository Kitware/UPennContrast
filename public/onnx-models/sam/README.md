# Segment Anything Tool

The segment anything tool is uses the [Segment Anything Model](https://github.com/facebookresearch/segment-anything) (SAM).
This folder contains the ONNX files that represent the SAM and are used by the browsers to compute segmentations.

## Get model checkpoint

The SAM is [provided by Facebook](https://github.com/facebookresearch/segment-anything#model-checkpoints) in the form of a pytorch model: a `.pth` file.
There are three types of model. They are, from the biggest to the smallest, `vit_h`, `vit_l` and `vit_b`.
It is advised to use `vit_b` as it is smaller and faster, at the cost of a lower quality segmentation.

## Convert to ONNX

Facebook provides a script to convert the decoder to ONNX but not the encoder. The maintainers refuse to merge PRs adding this feature.
You can use the script given in one of these PRs, but the chosen solution is to use the [samexporter](https://github.com/vietanhdev/samexporter).

- Create a folder that will contain the conversion script and the original `checkpoint.pth` model downloaded in the previous step.
```sh
mkdir temp
cd temp
```
- Clone the samexporter repo and the segment anything repo
```sh
git clone git@github.com:vietanhdev/samexporter.git
git clone git@github.com:facebookresearch/segment-anything.git
```
- Install both segment anything using pip and the dependencies of the samexporter (tested with a virtual environnment with python 3.11.5)
```sh
pip install -e ./segment-anything
pip install torchvision==0.16.1 onnx==1.15.0 onnxruntime==1.15.1 timm==0.9.12
```
- Go in the samexporter folder and run the commands to export the encoder and the decoder (do not use quantization)
```sh
cd samexporter
python -m samexporter.export_encoder --checkpoint ../checkpoint.pth --output ../encoder.onnx --model-type vit_b
python -m samexporter.export_decoder --checkpoint ../checkpoint.pth --output ../decoder.onnx --model-type vit_b --return-single-mask
```
- Copy the encoder and decoder at the right location
```sh
cd ..
cp encoder.onnx $PATH_TO_THIS_FOLDER/$MODEL_NAME
cp decoder.onnx $PATH_TO_THIS_FOLDER/$MODEL_NAME
```
