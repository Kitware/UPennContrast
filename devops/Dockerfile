FROM girder/girder:latest-py3

WORKDIR /src
RUN git clone https://github.com/girder/large_image.git -b style-option
WORKDIR /src/large_image
RUN pip install .[ometiff] --find-links https://girder.github.io/large_image_wheels
RUN cd girder && pip install -e . --find-links https://girder.github.io/large_image_wheels
RUN cd girder_annotation && pip install -e . --find-links https://girder.github.io/large_image_wheels

RUN girder build