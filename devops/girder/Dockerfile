FROM girder/girder:latest-py3

RUN apt-get update && \
    apt-get install --yes --no-install-recommends fuse
RUN mkdir /mnt/fuse

WORKDIR /src

RUN git clone https://github.com/girder/large_image.git
WORKDIR /src/large_image
RUN pip install .[all] ./girder[tasks] girder[mount] --find-links https://girder.github.io/large_image_wheels
RUN girder build

COPY plugins/AnnotationPlugin /src/AnnotationPlugin
RUN pip install -e /src/AnnotationPlugin

COPY ./provision.py /src/provision.py
COPY ./girder.cfg /etc/girder.cfg

ENTRYPOINT ["bash"]
