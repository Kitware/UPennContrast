#!/usr/bin/env python
# -*- coding: utf-8 -*-

from setuptools import find_packages, setup

requirements = [
    "cheroot>=8.4.5",  # https://github.com/cherrypy/cheroot/issues/312
    "girder_jobs==3.0.3",
    "girder_worker==0.8.0",
    # botocore requirement conflict
    "urllib3<1.26",
]

setup(
    author_email="kitware@kitware.com",
    classifiers=[
        "License :: OSI Approved :: Apache Software License",
        "Natural Language :: English",
        "Programming Language :: Python :: 3.7",
    ],
    description="UPenn Contrast",
    install_requires=requirements,
    python_requires=">=3.7",
    license="Apache Software License 2.0",
    include_package_data=True,
    name="upenn_contrast",
    packages=find_packages(exclude=["test", "test.*"]),
    url="https://github.com/Kitware/UPennContrast",
    version="0.1.0",
    zip_safe=False,
    entry_points={
        "girder.plugin": ["upenn_contrast = girder_plugin:GirderPlugin"],
    },
)
