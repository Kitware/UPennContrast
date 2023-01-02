*******************************
UpennContrast Annotation Plugin
*******************************

Workers
=======

Labels are used to define properties for the worker.
The typescript interface describing the different possible labels is ``IWorkerLabels`` and can be found in ``src/store/models.ts``.

The following information may change in the future, but for now:
- Workers for property or annotation computation need to have the label ``isUPennContrastWorker`` defined (no need to give it a value).
- Defining ``isAnnotationWorker`` or ``isPropertyWorker`` defines the role of the worker (may have both roles).
- Any worker can have an ``interfaceName`` which will be used to designate the worker and an ``interfaceCategory`` which may be used to group workers together.
- Property workers should have an ``annotationShape`` label which defines which type of annotation they work on.

To build a property worker called ``Intensity Mean`` working on blobs, with category ``Intensity``, one can use this command:
``docker build . -t annotations/blob_intensity_mean_worker:latest --label isUPennContrastWorker --label isPropertyWorker --label "annotationShape=polygon" --label "interfaceName=Intensity Mean" --label "interfaceCategory=Intensity"``

If a worker is already built and you want to edit a label ``foo`` and give it the value ``bar``, one can use this command (doesn't work for label deletion):
``echo "FROM annotations/blob_intensity_mean_worker:latest" | docker build --label "foo=bar" -t "annotations/blob_intensity_mean_worker:latest"``

**TODO:** Add more documentation on Annotation Plugin
