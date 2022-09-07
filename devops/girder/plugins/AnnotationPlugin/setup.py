from setuptools import setup, find_packages

with open('README.rst', 'r') as fh:
    long_desc = fh.read()

setup(name='upenncontrast_annotation',
      version='0.0.0',
      description='Girder plugin that provides API and models for UPennContrast annotations, connections and properties',
      long_description=long_desc,
      author='Adrien Boucaud',
      author_email='adrien.boucaud@kitware.com',
      license='Apache Software License 2.0',
      classifiers=[
          'Development Status :: 2 - Pre-Alpha',
          'License :: OSI Approved :: Apache Software License',
          'Topic :: Scientific/Engineering',
          'Intended Audience :: Science/Research',
          'Natural Language :: English',
          'Programming Language :: Python'
      ],
      install_requires=[
          'girder_worker',
          'girder_worker_utils',
          'girder-large-image',
          'large-image[sources]',
      ],
      extras_require={
          'girder': [
          ],
          'worker': [
          ]
      },
      include_package_data=True,
      entry_points={
          'girder.plugin': [
              'upenncontrast_annotation = upenncontrast_annotation:UPennContrastAnnotationAPIPlugin'
          ]
      },
      packages=find_packages(),
      zip_safe=False)
