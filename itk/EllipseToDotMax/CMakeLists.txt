cmake_minimum_required(VERSION 3.16)
project(EllipseToDotMax)

if(EMSCRIPTEN)
    set(io_component BridgeJavaScript)
endif()

find_package(ITK REQUIRED
    COMPONENTS
    ${io_component}
    ITKCommon
    ITKIOImageBase
    ITKImageIntensity
    ITKSpatialObjects
    ITKImageIO
    )

include (${ITK_USE_FILE})

add_executable(${PROJECT_NAME} main.cxx)

target_link_libraries(${PROJECT_NAME} ${ITK_LIBRARIES})
