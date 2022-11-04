#include <iostream>
#include <fstream>
#include <vector>

#include <itkImage.h>
#include <itkImageFileReader.h>
#include <itkImageFileWriter.h>
#include <itkPolylineMask2DImageFilter.h>
#include <itkMinimumMaximumImageCalculator.h>
#include "itkPolyLineParametricPath.h"
#include <itkMesh.h>
#include <itkMeshFileReader.h>
#include <itkOtsuThresholdImageFilter.h>
#include <itkContourExtractor2DImageFilter.h>

#ifdef __EMSCRIPTEN__
    #include <emscripten/bind.h>
#endif

#include <sstream>


template <typename TMesh>
typename TMesh::Pointer ReadMeshFile(const std::string filePath);

template <typename TImage>
typename TImage::Pointer ReadImageFile(const std::string filePath);

using PixelType = unsigned char;
constexpr unsigned int Dimension = 2;

using ImageType = itk::Image<PixelType, Dimension>;
using MeshType = itk::Mesh<float, 2>;

using ImageCalculatorFilterType = itk::MinimumMaximumImageCalculator<ImageType>;
using InputPolylineType = itk::PolyLineParametricPath<Dimension>;
using ThresholdFilterType = itk::OtsuThresholdImageFilter<ImageType, ImageType>;
using ContourFilterType = itk::ContourExtractor2DImageFilter<ImageType>;

int main(int argc, char **argv)
{
    if (argc < 4)
    {
        std::cerr << "Invalid number of arguments. Usage: "
                  << argv[0]
                  << " <inputImagePath> <inputPointsPath> <outputPath>"
                  << std::endl;
        return -1;
    }

    std::string inputPath(argv[1]);
    std::string pointsPath(argv[2]);
    std::string outputPath(argv[3]);
    // Create an empty output file to avoid errors if returning without an ouput
    std::ofstream emptyOutFile(outputPath);
    emptyOutFile.close();

    auto input = ReadImageFile<ImageType>(inputPath);
    auto mesh = ReadMeshFile<MeshType>(pointsPath);
    using PointsIterator = MeshType::PointsContainer::Iterator;
    PointsIterator pointIterator = mesh->GetPoints()->Begin();
    PointsIterator end = mesh->GetPoints()->End();

    // Create and initialize the polyline
    InputPolylineType::Pointer inputPolyline = InputPolylineType::New();
    using VertexType = InputPolylineType::VertexType;

    while (pointIterator != end)
    {
        VertexType v;
        MeshType::PointType p = pointIterator.Value();
        v[0] = p[0];
        v[1] = p[1];
        inputPolyline->AddVertex(v);
        ++pointIterator;
    }

    using PolylineFilterType = itk::PolylineMask2DImageFilter<ImageType, InputPolylineType, ImageType>;
    PolylineFilterType::Pointer filter = PolylineFilterType::New();
    filter->SetInput1(input);
    filter->SetInput2(inputPolyline);
    filter->Update();
    auto maskedImage = filter->GetOutput();

    // Check if the polyline mask worked
    if (!maskedImage) {
        return -1;
    }
    ImageCalculatorFilterType::Pointer imageCalculatorFilter = ImageCalculatorFilterType::New();
    imageCalculatorFilter->SetImage(maskedImage);
    imageCalculatorFilter->ComputeMaximum();
    // The masked image is all black: polyline didn't work
    if (imageCalculatorFilter->GetMaximum() == 0) {
        return -1;
    }

    ThresholdFilterType::Pointer thresholdFilter = ThresholdFilterType::New();
    thresholdFilter->SetInput(maskedImage);
    thresholdFilter->SetInsideValue(0);
    thresholdFilter->SetOutsideValue(255);
    thresholdFilter->Update();

    ContourFilterType::Pointer contourFilter = ContourFilterType::New();
    contourFilter->SetInput(thresholdFilter->GetOutput());
    contourFilter->Update();

    auto contour = contourFilter->GetOutput(0);
    ContourFilterType::VertexListType::ConstIterator vertexIterator;
    ContourFilterType::VertexListType::ConstIterator outputContourEnd = vertexIterator;
    if (contour) {
        vertexIterator = contour->GetVertexList()->Begin();
        outputContourEnd = contour->GetVertexList()->End();
    }

    std::fstream outFile;
    outFile.open(outputPath, std::fstream::out);
    outFile << "{ \"contour\": [\n";
    while(vertexIterator != outputContourEnd) {
        auto value = vertexIterator->Value();
        outFile << "{ \"x\": " << value[0] << ", \"y\": " << value[1] << ", \"z\": 0 }";
        ++ vertexIterator;
        if (vertexIterator != outputContourEnd) {
            outFile << ",\n";
        }
    }
    outFile << "\n]}" << std::endl;

    int index[2] = {0, 0};


    outFile.close();
}

template <typename TImage>
typename TImage::Pointer ReadImageFile(const std::string filePath)
{
    using FileReaderType = itk::ImageFileReader<TImage>;
    typename FileReaderType::Pointer reader = FileReaderType::New();
    reader->SetFileName(filePath);
    try
    {
        reader->Update();
    }
    catch (itk::ExceptionObject &excep)
    {
        std::cerr << "Exception caught: " << excep << std::endl;
    }
    typename TImage::Pointer inputImage = reader->GetOutput();
    return inputImage;
}

template <typename TMesh>
typename TMesh::Pointer ReadMeshFile(const std::string filePath)
{
    using FileReaderType = itk::MeshFileReader<TMesh>;
    typename FileReaderType::Pointer reader = FileReaderType::New();
    reader->SetFileName(filePath);
    try
    {
        reader->Update();
    }
    catch (itk::ExceptionObject &excep)
    {
        std::cerr << "Exception caught: " << excep << std::endl;
    }
    typename TMesh::Pointer inputMesh = reader->GetOutput();
    return inputMesh;
}
