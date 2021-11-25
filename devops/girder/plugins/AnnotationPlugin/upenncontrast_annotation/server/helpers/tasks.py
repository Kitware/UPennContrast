from girder_worker.docker.tasks import docker_run

from girder.api.rest import getCurrentToken


import datetime
import json

# TODO: security: disable pickle, never pull images ?
# accept_content = ['json', 'yaml', 'girder_io']
# app.conf.update(
#   CELERY_ACCEPT_CONTENT = accept_content,
#      CELERY_TASK_SERIALIZER = 'json',
#      CELERY_RESULT_SERIALIZER = 'json',
# )


def computeProperty(property, datasetId, params):
    image = property['image']

    params = json.dumps(params)

    job = docker_run.apply_async(
        (image,),
        kwargs={
            'pull_image': False,
            'container_args': ['--datasetId', datasetId, '--apiUrl', "http://localhost:8080/api/v1", '--token', getCurrentToken()['_id'], '--parameters', params],
            'remove_container': True,
            'name': "{}_{}_{}".format(property['name'], datasetId, datetime.datetime.now().timestamp()),
            # TODO: figure out network configuration and api url discovery
            'network_mode': 'host'
        }
    ).job,

    print("RUNNING ", job)
