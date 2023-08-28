FROM girder/girder:latest-py3

RUN apt-get update && \
    apt-get install --yes --no-install-recommends \
    fuse \
    iptables \
    dnsutils \
    && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
RUN mkdir /mnt/fuse

WORKDIR /src

RUN git clone https://github.com/girder/large_image.git
WORKDIR /src/large_image
RUN pip install -e .[all] -r requirements-test.txt --find-links https://girder.github.io/large_image_wheels
RUN pip install girder[mount]
# RUN pip install .[all] ./girder[tasks] girder[mount] --find-links https://girder.github.io/large_image_wheels
RUN girder build

COPY plugins/AnnotationPlugin /src/AnnotationPlugin
RUN pip install -e /src/AnnotationPlugin

COPY ./provision.py /src/provision.py
COPY ./girder.cfg /etc/girder.cfg
COPY ./test_env.sh /src/test_env.sh

WORKDIR /src/AnnotationPlugin

ENTRYPOINT ["bash"]
