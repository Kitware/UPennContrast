cmake_minimum_required(VERSION 3.16)
project(ThresholdInRegion)

set(CMAKE_CXX_STANDARD 17)

set (sources main.cxx)

set(io_component ITKImageIO)
if(EMSCRIPTEN)
    set(io_component WebAssemblyInterface)
endif()
message(${io_component})

set(itk_components
  ${io_component}
  ITKMesh
  ITKIOMeshBase
  ITKImageIntensity
  )

find_package(ITK REQUIRED
    COMPONENTS
    ${itk_components}
    )

include (${ITK_USE_FILE})

add_executable(Threshold ${sources})
target_link_libraries(Threshold PUBLIC ${ITK_LIBRARIES})
