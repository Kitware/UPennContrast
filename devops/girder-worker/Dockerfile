FROM girder/girder_worker:latest-py3

USER root
# RUN pip install --no-cache large_image[ometiff] large_image_tasks[worker] --find-links https://girder.github.io/large_image_wheels
WORKDIR /src
RUN apt-get update && apt-get install -y git
RUN git clone https://github.com/girder/large_image.git -b style-option
WORKDIR /src/large_image
RUN pip install -e . --find-links https://girder.github.io/large_image_wheels
RUN cd tasks && pip install -e .[worker] --find-links https://girder.github.io/large_image_wheels
RUN cd sources/tiff && pip install -e . --find-links https://girder.github.io/large_image_wheels
RUN cd sources/ometiff && pip install -e . --find-links https://girder.github.io/large_image_wheels
USER worker