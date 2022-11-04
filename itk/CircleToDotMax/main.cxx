#include <iostream>
#include <fstream>
#include <vector>
#include <iterator>

#include <itkImage.h>
#include <itkImageFileReader.h>
#include <itkEllipseSpatialObject.h>
#include <itkSpatialObjectToImageFilter.h>
#include <itkMaskImageFilter.h>
#include <itkMinimumMaximumImageCalculator.h>

#ifdef __EMSCRIPTEN__
    #include <emscripten/bind.h>
#endif


template <typename TImage>
typename TImage::Pointer ReadImageFile(const std::string filePath);

template <typename T>
std::vector<T> ReadVectorFile(const std::string filePath);

using PixelType = unsigned char;
constexpr unsigned int Dimension = 2;

using ImageType = itk::Image<PixelType, Dimension>;

using EllipseType = itk::EllipseSpatialObject<Dimension>;
using EllipseToImageFilterType = itk::SpatialObjectToImageFilter<EllipseType, ImageType>;

using MaskImageFilterType = itk::MaskImageFilter<ImageType, ImageType, ImageType>;

using ImageCalculatorFilterType = itk::MinimumMaximumImageCalculator<ImageType>;

int main(int argc, char** argv)
{
    if (argc < 4)
    {
        std::cerr << "Invalid number of arguments. Usage: "
            << argv[0]
            << " <inputImagePath> <circlePath> <outputPath>"
            << std::endl;
        return EXIT_FAILURE;
    }

    std::string inputPath(argv[1]);
    std::string circlePath(argv[2]);
    std::string outputPath(argv[3]);
    // Create an empty output file to avoid errors if returning without an ouput
    std::ofstream emptyOutFile(outputPath);
    emptyOutFile.close();

    typename ImageType::Pointer input = ReadImageFile<ImageType>(inputPath);
    const auto& size = input->GetLargestPossibleRegion().GetSize();
    const auto& spacing = input->GetSpacing();

    // Read the cricle file
    std::vector<float> circleVector = ReadVectorFile<float>(circlePath);
    const int xcenter = circleVector[0] * spacing[0];
    const int ycenter = circleVector[1] * spacing[1];
    const int xradius = circleVector[2] * spacing[0];
    const int yradius = circleVector[2] * spacing[1];

    // Configure the ellipse filter
    auto ellipseToImageFilter = EllipseToImageFilterType::New();
    ellipseToImageFilter->SetSize(size);
    ellipseToImageFilter->SetSpacing(spacing);

    // Create and setup an ellipse object
    auto ellipse = EllipseType::New();

    ellipse->SetDefaultInsideValue(255);
    ellipse->SetDefaultOutsideValue(0);

    EllipseType::ArrayType radiusArray{};
    radiusArray[0] = xradius;
    radiusArray[1] = yradius;
    ellipse->SetRadiusInObjectSpace(radiusArray);
    
    auto transform = EllipseType::TransformType::New();
    transform->SetIdentity();
    EllipseType::TransformType::OutputVectorType translation{};
    translation[0] = xcenter;
    translation[1] = ycenter;
    transform->Translate(translation);
    ellipse->SetObjectToParentTransform(transform);

    // Set the ellipse as input to the ellipse to image filter
    ellipseToImageFilter->SetInput(ellipse);
    ellipseToImageFilter->SetUseObjectValue(true);
    ellipseToImageFilter->SetOutsideValue(0);

    // Get the ellipse image
    ellipseToImageFilter->Update();
    typename ImageType::Pointer ellipseImage = ellipseToImageFilter->GetOutput();
    if (!ellipseImage) {
        return EXIT_FAILURE;
    }

    // Mask the input image with the ellipse image
    MaskImageFilterType::Pointer maskFilter = MaskImageFilterType::New();
    maskFilter->SetInput(input);
    maskFilter->SetMaskImage(ellipseImage);
    maskFilter->Update();
    ImageType::Pointer maskedImage = maskFilter->GetOutput();
    if (!maskedImage) {
        return EXIT_FAILURE;
    }

    // Check that the masked image is not full black
    ImageCalculatorFilterType::Pointer imageCalculatorFilter = ImageCalculatorFilterType::New();
    imageCalculatorFilter->SetImage(maskedImage);
    imageCalculatorFilter->ComputeMaximum();
    if (imageCalculatorFilter->GetMaximum() == 0) {
        return EXIT_FAILURE;
    }

    // Get the maximum intensity pixel
    const auto &index = imageCalculatorFilter->GetIndexOfMaximum();

    std::fstream outFile(outputPath);
    outFile << "{ \"point\": { \"x\": " << index[0] << ", \"y\": " << index[1] << ", \"z\": 0} }" << std::endl;
    outFile.close();

    return EXIT_SUCCESS;
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
    catch (itk::ExceptionObject& excep)
    {
        std::cerr << "Exception caught: " << excep << std::endl;
    }
    typename TImage::Pointer inputImage = reader->GetOutput();
    return inputImage;
}

template <typename T>
std::vector<T> ReadVectorFile(const std::string filePath)
{
    std::ifstream fileStream(filePath);
    std::istream_iterator<T> start(fileStream), end;
    std::vector<T> output(start, end);
    return output; 
}
