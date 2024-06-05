FROM girder/tox-and-node:latest

RUN virtualenv /venv --python=3.11
ENV PATH=/venv/bin:$PATH

RUN mkdir /mnt/fuse

RUN mkdir /src
WORKDIR /src

RUN git clone https://github.com/girder/large_image.git
WORKDIR /src/large_image
RUN pip install -e .[all] -r requirements-test.txt --find-links https://girder.github.io/large_image_wheels
RUN pip install girder[mount] girder girder-user-quota
# RUN pip install .[all] ./girder[tasks] girder[mount] --find-links https://girder.github.io/large_image_wheels

COPY ./provision.py /src/provision.py
COPY ./girder.cfg /etc/girder.cfg

RUN pip install fastjsonschema
COPY plugins/AnnotationPlugin /src/AnnotationPlugin
RUN pip install -e /src/AnnotationPlugin

RUN girder build

ENTRYPOINT ["bash"]
