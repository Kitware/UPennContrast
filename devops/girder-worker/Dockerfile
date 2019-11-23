FROM girder/girder_worker:latest-py3

USER root
RUN pip install --no-cache large_image[ometiff] large_image_tasks --find-links https://girder.github.io/large_image_wheels
# WORKDIR /src
# RUN git clone https://github.com/girder/large_image.git -b style-option
# WORKDIR /src/large_image
# RUN pip install .[ometiff] --find-links https://girder.github.io/large_image_wheels
# RUN cd girder && pip install -e .[tasks] --find-links https://girder.github.io/large_image_wheels
