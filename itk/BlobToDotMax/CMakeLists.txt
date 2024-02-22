cmake_minimum_required(VERSION 3.16)
project(BlobToDotMax)

set(CMAKE_CXX_STANDARD 17)

set(itk_components
    WebAssemblyInterface
    ITKCommon
    ITKIOImageBase
    ITKIOMeshBase
    ITKImageIntensity
    ITKMesh
    ITKPath
    ITKImageIO
    ITKMeshIO
    )

find_package(ITK REQUIRED
    COMPONENTS ${itk_components}
    )
include(${ITK_USE_FILE})

add_executable(${PROJECT_NAME} main.cxx )
target_link_libraries(${PROJECT_NAME} PUBLIC ${ITK_LIBRARIES})
