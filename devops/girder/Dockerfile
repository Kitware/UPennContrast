FROM girder/girder:latest-py3

RUN apt-get update && \
    apt-get install --yes --no-install-recommends fuse
RUN mkdir /mnt/fuse

WORKDIR /src
RUN git clone https://github.com/girder/large_image.git
WORKDIR /src/large_image
RUN pip install -e . -rrequirements-dev.txt girder[mount] --find-links https://girder.github.io/large_image_wheels

RUN girder build
