
FROM node:latest as web-builder

WORKDIR /app

# Install dependencies
COPY client/package.json client/yarn.lock /app/
RUN yarn --frozen-lockfile

# Build client
COPY client/ /app/
RUN yarn build

FROM girder/girder:latest-py3 as runtime

# Delcare Environment Variables
ENV GIRDER_MONGO_URI mongodb://mongo:27017/girder
ENV GIRDER_ADMIN_USER admin
ENV GIRDER_ADMIN_PASSWORD upenn
ENV CELERY_BROKER_URL amqp://guest:guest@rabbit/
ENV BROKER_CONNECTION_TIMEOUT 2

# TODO: explain why this is necessary
# Install Large Image from source instead of pip because ?
WORKDIR /src
RUN git clone https://github.com/girder/large_image.git
WORKDIR /src/large_image
RUN pip install -e . -r requirements-dev.txt --find-links https://girder.github.io/large_image_wheels

# install tini init system -- this hasn't been included in upstream girder (yet)
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini

# Install Contrast Plugin
WORKDIR /home/girder
COPY devops/provision /home/provision
COPY server/setup.py /home/girder/
## install dependencies (build cache optimization)
RUN pip3 install --no-cache-dir .

## install code (build cache optimization)
COPY server/ /home/girder/
RUN pip3 install --no-deps .

# Build Girder Client
RUN girder build

# Include built frontend artifacts to girder's static dir
COPY --from=web-builder /app/dist/ /usr/share/girder/static/contrast/

ENTRYPOINT [ "/home/provision/girder_entrypoint.sh" ]
