cmake_minimum_required(VERSION 3.10)
project(ThresholdInRegion)

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
    ITKThresholding
    )

include (${ITK_USE_FILE})

add_executable(Threshold ${sources})
target_link_libraries(Threshold ${ITK_LIBRARIES})
