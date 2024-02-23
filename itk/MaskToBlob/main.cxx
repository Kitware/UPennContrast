#include <iostream>
#include <fstream>
#include <vector>

#include <itkImage.h>
#include <itkImageFileReader.h>
#include <itkImageFileWriter.h>
#include <itkMinimumMaximumImageCalculator.h>
#include <itkConnectedThresholdImageFilter.h>
#include <itkContourExtractor2DImageFilter.h>
#include "itkPolyLineParametricPath.h"

#ifdef __EMSCRIPTEN__
    #include <emscripten/bind.h>
#endif

template <typename TImage>
typename TImage::Pointer ReadImageFile(const std::string filePath, const typename TImage::SizeType& size);

constexpr unsigned int Dimension = 2;
using PixelType = float;
using ImageType = itk::Image<PixelType, Dimension>;

using ImageCalculatorFilterType = itk::MinimumMaximumImageCalculator<ImageType>;
using ConnectedFilterType = itk::ConnectedThresholdImageFilter<ImageType, ImageType>;
using ContourFilterType = itk::ContourExtractor2DImageFilter<ImageType>;
using ContourPolylineType = itk::PolyLineParametricPath<Dimension>;

int main(int argc, char* argv[])
{
    if (argc < 5)
    {
        std::cerr << "Invalid number of arguments. Usage: "
            << argv[0]
            << " <inputImagePath> <inputImageWidth> <inputImageHeight> <outputPath>"
            << std::endl;
        return -1;
    }

    const std::string inputPath(argv[1]);
    const std::string widthArg(argv[2]);
    const std::string heightArg(argv[3]);
    const std::string outputPath(argv[4]);

    // Create an empty output file to avoid errors if returning without an ouput
    std::ofstream emptyOutFile(outputPath);
    emptyOutFile.close();

    const auto width = std::stoul(widthArg);
    const auto height = std::stoul(heightArg);
    ImageType::SizeType size{{ width, height }};
    ImageType::Pointer inputImage = ReadImageFile<ImageType>(inputPath, size);


    if (!inputImage) {
        std::cerr << "Could not read the image" << std::endl;
        return -1;
    }

    // find the maximum value and its location
    ImageCalculatorFilterType::Pointer imageCalculatorFilter = ImageCalculatorFilterType::New();
    imageCalculatorFilter->SetImage(inputImage);
    imageCalculatorFilter->ComputeMaximum();

    constexpr float thresholdValue = 0.0;

    PixelType maxValue = imageCalculatorFilter->GetMaximum();
    if (maxValue < thresholdValue)
    {
        std::cerr << "No contour found, maximum value of " << maxValue << " is below the threshold value of " << thresholdValue << std::endl;
        return -1;
    }

    ImageType::IndexType maxIndex = imageCalculatorFilter->GetIndexOfMaximum();

    // extract only one ROI by thresholding around the maximum of confidence
    ConnectedFilterType::Pointer connectedThresholdFilter = ConnectedFilterType::New();
    connectedThresholdFilter->SetLower(thresholdValue);
    connectedThresholdFilter->SetUpper(maxValue);
    connectedThresholdFilter->SetReplaceValue(1.0);
    connectedThresholdFilter->SetSeed(maxIndex);
    connectedThresholdFilter->SetInput(inputImage);
    connectedThresholdFilter->Update();

    // compute the contour of the ROI
    ContourFilterType::Pointer contourFilter = ContourFilterType::New();
    contourFilter->SetInput(connectedThresholdFilter->GetOutput());
    contourFilter->Update();

    auto contour = contourFilter->GetOutput(0);

    if (!contour)
    {
        std::cerr << "Could not generate contour" << std::endl;
        return -1;
    }

    // export to json
    auto vertexIterator = contour->GetVertexList()->Begin();
    auto outputContourEnd = contour->GetVertexList()->End();

    std::fstream outFile;
    outFile.open(outputPath, std::fstream::out);
    outFile << "{ \"contour\": [\n";
    while (vertexIterator != outputContourEnd) {
        auto value = vertexIterator->Value();
        outFile << "{ \"x\": " << value[0] << ", \"y\": " << value[1] << ", \"z\": 0 }";
        ++vertexIterator;
        if (vertexIterator != outputContourEnd) {
            outFile << ",\n";
        }
    }
    outFile << "\n]}" << std::endl;

    return 0;
}

template <typename TImage>
typename TImage::Pointer ReadImageFile(const std::string filePath, const typename TImage::SizeType& size)
{
    auto image = TImage::New();
    image->SetRegions(size);
    image->Allocate();

    auto* imageContainer = image->GetPixelContainer();
    constexpr auto pixelSize = sizeof(typename TImage::PixelType);

    std::ifstream fin(filePath, std::ios::binary);
    fin.read(reinterpret_cast<char*>(imageContainer->GetBufferPointer()), pixelSize * imageContainer->Size());

    imageContainer->Modified();

    return image;
}
