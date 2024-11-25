import os

from girder.models.setting import Setting
from girder.utility.server import configureServer

if __name__ == "__main__":
    configureServer()
    # Set various settings through env variables.
    # If the associated env variable does not exist. Use Girder's default
    Setting().set("worker.api_url", os.environ.get(
        "GIRDER_WORKER_API_URL", "http://girder:8080/api/v1"))
    Setting().set("worker.broker", os.environ.get(
        "GIRDER_WORKER_BROKER", "amqp://guest:guest@localhost/"))
    Setting().set("worker.backend", os.environ.get(
        "GIRDER_WORKER_BACKEND", "rpc://guest:guest@localhost/"))
    Setting().set("core.email_from_address", os.environ.get(
        "GIRDER_EMAIL_FROM", "Girder <no-reply@girder.org>"))
    Setting().set("core.smtp.encryption", os.environ.get(
        "GIRDER_SMTP_ENCRYPTION", "none"))
    Setting().set("core.smtp_host", os.environ.get(
        "GIRDER_SMTP_HOST", "localhost"))
    Setting().set("core.smtp.password", os.environ.get(
        "GIRDER_SMTP_PASSWORD", ""))
    Setting().set("core.smtp.port", os.environ.get(
        "GIRDER_SMTP_PORT", "25"))
    Setting().set("core.smtp.username", os.environ.get(
        "GIRDER_SMTP_USERNAME", ""))
