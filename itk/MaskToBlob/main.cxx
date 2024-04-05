#include <iostream>
#include <fstream>
#include <vector>

#include <itkImage.h>
#include <itkImageLinearConstIteratorWithIndex.h>
#include <itkMinimumMaximumImageCalculator.h>
#include <itkConnectedThresholdImageFilter.h>

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
using ConstLineIteratorType = itk::ImageLinearConstIteratorWithIndex<ImageType>;

struct ImageLineOrientation {
    unsigned int direction;
    bool isForwardPositive;
};

// Rotate the orientation by 90 degrees
// Turn left <=> positive rotation <=> counter-clockwise rotation
// Turn right <=> negative rotation <=> clockwise rotation
static void rotateImageLineOrientation(ImageLineOrientation &baseOrientation, bool rotateLeft)
{
    unsigned int newDirection = baseOrientation.direction == 0 ? 1 : 0;
    bool isNewForward = (baseOrientation.direction == 0) == baseOrientation.isForwardPositive == rotateLeft;
    baseOrientation = { newDirection, isNewForward };
}

// Move the iterator forward or backward by applying the orientation
static void moveIteratorUsingOrientation(ConstLineIteratorType &lineIt, const ImageLineOrientation &orientation, bool moveForward)
{
    lineIt.SetDirection(orientation.direction);
    if (orientation.isForwardPositive == moveForward)
    {
        ++lineIt;
    }
    else
    {
        --lineIt;
    }
}

static bool isIteratorOutsideAnnotation(const ConstLineIteratorType& lineIt, PixelType annotationValue)
{
    return lineIt.IsAtEndOfLine() || lineIt.IsAtReverseEndOfLine() || lineIt.Value() != annotationValue;
}

static void moveIteratorAndOrientationToNextAnnotationPoint(ConstLineIteratorType& lineIt, ImageLineOrientation& orientation, PixelType annotationValue)
{
    // Rotate left and go forward
    rotateImageLineOrientation(orientation, true);
    moveIteratorUsingOrientation(lineIt, orientation, true);

    // Check if out of annotation
    if (isIteratorOutsideAnnotation(lineIt, annotationValue))
    {
        // Go backward
        moveIteratorUsingOrientation(lineIt, orientation, false);
        return;
    }

    // Rotate right and go forward
    rotateImageLineOrientation(orientation, false);
    moveIteratorUsingOrientation(lineIt, orientation, true);

    // Check if out of annotation
    if (isIteratorOutsideAnnotation(lineIt, annotationValue))
    {
        // Go backward
        moveIteratorUsingOrientation(lineIt, orientation, false);
        return;
    }

    // Rotate right
    rotateImageLineOrientation(orientation, false);
}

// Outputs the point that is to the forward left of the frame defined by lineIt and orientation
static ImageType::IndexType getOutputPointFromIteratorAndOrientation(const ConstLineIteratorType& lineIt, const ImageLineOrientation &orientation)
{
    const auto& idx = lineIt.GetIndex();
    const auto& isPositive = orientation.isForwardPositive;
    const auto& isXAxis = orientation.direction == 0;
    return { idx[0] + (isPositive == isXAxis ? 1 : 0), idx[1] + (isPositive ? 1 : 0) };
}

int main(int argc, char* argv[])
{
    if (argc < 5)
    {
        std::cerr << "Invalid number of arguments. Usage: "
            << argv[0]
            << " <inputImagePath> <inputImageWidth> <inputImageHeight> <outputPath>"
            << std::endl;
        return EXIT_FAILURE;
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
        return EXIT_FAILURE;
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
        return EXIT_FAILURE;
    }

    const ImageType::IndexType maxIndex = imageCalculatorFilter->GetIndexOfMaximum();

    // extract only one ROI by thresholding around the maximum of confidence
    const PixelType annotationValue = maxValue + 1;
    ConnectedFilterType::Pointer connectedThresholdFilter = ConnectedFilterType::New();
    connectedThresholdFilter->SetLower(thresholdValue);
    connectedThresholdFilter->SetUpper(maxValue);
    connectedThresholdFilter->SetReplaceValue(annotationValue);
    connectedThresholdFilter->SetSeed(maxIndex);
    connectedThresholdFilter->SetInput(inputImage);
    connectedThresholdFilter->Update();

    // Find the last edge of the annotation
    auto singleAnnotationImage = connectedThresholdFilter->GetOutput();
    ConstLineIteratorType lineIt(singleAnnotationImage, singleAnnotationImage->GetRequestedRegion());
    lineIt.SetIndex(maxIndex);
    lineIt.SetDirection(0);
    ImageType::IndexType lastAnnotationIndex = maxIndex;
    while(!lineIt.IsAtEndOfLine())
    {
        if (lineIt.Value() == annotationValue)
        {
            lastAnnotationIndex = lineIt.GetIndex();
        }
        ++lineIt;
    }

    std::fstream outFile;
    outFile.open(outputPath, std::fstream::out);
    outFile << "[";

    // Collect the contour by using the iterator as a robot that can move forward, backward, turn left or turn right
    // Loop invariants:
    // - iterator is at a position where an annotation lies
    // - moving the iterator forward using "orientation" put it out of the image or out of the annotation
    lineIt.SetIndex(lastAnnotationIndex);
    ImageLineOrientation orientation{ 0, true };
    const auto firstPoint = getOutputPointFromIteratorAndOrientation(lineIt, orientation);
    while (true)
    {
        moveIteratorAndOrientationToNextAnnotationPoint(lineIt, orientation, annotationValue);
        const auto currentPoint = getOutputPointFromIteratorAndOrientation(lineIt, orientation);
        outFile << "{\"x\":" << currentPoint[0] << ",\"y\":" << currentPoint[1] << "}";

        if (currentPoint == firstPoint)
        {
            outFile << "]" << std::endl;
            return EXIT_SUCCESS;
        }
        outFile << ",";
    }
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
