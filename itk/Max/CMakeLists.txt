cmake_minimum_required(VERSION 3.10)
project(BlobToDot)

set (sources main.cxx)

set(io_component ITKImageIO)
if(EMSCRIPTEN)
    set(io_component BridgeJavaScript)
endif()
message(${io_component})

find_package(ITK REQUIRED
    COMPONENTS
    ITKImageIO
    ${io_component}
    ITKMesh
    ITKIOMeshBase
    ITKImageIntensity
    )

include (${ITK_USE_FILE})

add_executable(Max ${sources})
target_link_libraries(Max ${ITK_LIBRARIES})
