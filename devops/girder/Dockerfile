FROM girder/girder:latest-py3

WORKDIR /src
RUN git clone https://github.com/girder/large_image.git
WORKDIR /src/large_image
RUN pip install -e . -e girder/. -e girder_annotation/. -e tasks/.[girder] -e sources/tiff -e sources/ometiff -e sources/pil -e sources/openslide -e sources/openjpeg --find-links https://girder.github.io/large_image_wheels

RUN girder build
