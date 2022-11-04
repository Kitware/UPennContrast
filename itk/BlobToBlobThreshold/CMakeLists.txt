cmake_minimum_required(VERSION 3.16)
project(BlobToBlobThreshold)

if(EMSCRIPTEN)
    set(io_component BridgeJavaScript)
endif()

find_package(ITK REQUIRED
    COMPONENTS
    ${io_component}
    ITKCommon
    ITKIOImageBase
    ITKIOMeshBase
    ITKImageIntensity
    ITKMesh
    ITKPath
    ITKThresholding
    ITKImageIO
    ITKMeshIO
    )

include (${ITK_USE_FILE})

add_executable(${PROJECT_NAME} main.cxx)

target_link_libraries(${PROJECT_NAME} ${ITK_LIBRARIES})
