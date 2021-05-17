FROM girder/girder:latest-py3

RUN apt-get update && \
    apt-get install --yes --no-install-recommends fuse
RUN mkdir /mnt/fuse

WORKDIR /src
RUN git clone https://github.com/girder/large_image.git -b tiled-regions
WORKDIR /src/large_image
RUN pip install -e . -rrequirements-dev.txt girder[mount] --find-links https://girder.github.io/large_image_wheels

RUN girder build

COPY ./provision.py /src/provision.py
COPY ./girder.cfg /etc/girder.cfg

ENTRYPOINT ["bash"]
