FROM girder/girder:latest-py3

WORKDIR /src
RUN git clone https://github.com/girder/large_image.git --branch nd2-source
WORKDIR /src/large_image
RUN pip install -e . -rrequirements-dev.txt --find-links https://girder.github.io/large_image_wheels

RUN girder build
