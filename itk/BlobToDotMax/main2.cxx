#include <itkBinaryImageToLabelMapFilter.h>
#include <itkConnectedComponentImageFilter.h>
#include <itkImage.h>
#include <itkImageRegionIterator.h>
#include <itkLabelMap.h>
#include <itkLabelStatisticsImageFilter.h>

#include <itkImageFileReader.h>

#include <sstream>

const int imageDimension = 3;
using BinaryImageType = itk::Image<unsigned char, imageDimension>;
using MedicalImageType = itk::Image<int, imageDimension>;
using LabelImageType = itk::Image<unsigned short, imageDimension>;

template<typename TImage>
typename TImage::Pointer ReadFile(const std::string filePath);

template <typename TValue>
std::string ToJSONValue(const std::string& name, TValue value, const std::string& postfix=",\n");

int main (int argc, char* argv[])
{
    if(argc != 4)
    {
        std::cout << "Usage: " << argv[0] << " <ScalarVolumePath> <MaskVolumePath> <OutputFilePath>" << std::endl;
        return EXIT_FAILURE;
    }
    const std::string filePathMedicalImage = argv[1];
    const std::string filePathBinaryImage = argv[2];
    const std::string outputFilePath = argv[3];
    const bool fullConnection = false;

    // ------------------------------------------------------------------------
    // Read data
    // ------------------------------------------------------------------------
    BinaryImageType::Pointer binaryImage =
        ReadFile<BinaryImageType>(filePathBinaryImage);
    MedicalImageType::Pointer medicalImage =
        ReadFile<MedicalImageType>(filePathMedicalImage);

    // ------------------------------------------------------------------------
    // Extract connected region from binary image
    // ------------------------------------------------------------------------

    using ConnectedComponentImageFilter =
        itk::ConnectedComponentImageFilter<BinaryImageType, LabelImageType>;
    ConnectedComponentImageFilter::Pointer labelExtractor =
        ConnectedComponentImageFilter::New();

    labelExtractor->SetInput(binaryImage);
    labelExtractor->SetFullyConnected(fullConnection);
    labelExtractor->Update();
    LabelImageType::Pointer outputFilter = labelExtractor->GetOutput();

    //-------------------------------------------------------------------------
    // Get statistics from extracted regions
    //-------------------------------------------------------------------------
    {
        itk::Vector<double, 3> spacing = medicalImage->GetSpacing();
        double pixelSize = spacing[0] * spacing[1] * spacing[2];

        using StatisticsImageFilters =
            itk::LabelStatisticsImageFilter<MedicalImageType, LabelImageType>;
        StatisticsImageFilters::Pointer statisticsFilter = StatisticsImageFilters::New();
        statisticsFilter->SetLabelInput(labelExtractor->GetOutput());
        statisticsFilter->SetInput(medicalImage);
        statisticsFilter->Update();

        std::ofstream os (outputFilePath);
        if(!os.is_open()) {
            std::cerr << "Could not open output file: " << outputFilePath << std::endl;
            return EXIT_FAILURE;
        }

        os << "{ \"volumes\": [" << std::endl;
        auto endIt = statisticsFilter->GetValidLabelValues().end();
        for (auto vIt = statisticsFilter->GetValidLabelValues().begin();
            vIt != endIt;
            ++vIt)
        {
            if (statisticsFilter->HasLabel(*vIt))
            {

                LabelImageType::PixelType labelValue = *vIt;
                os << '{' << std::endl;
                os << ToJSONValue("min", statisticsFilter->GetMinimum(labelValue));
                os << ToJSONValue("max", statisticsFilter->GetMaximum(labelValue));
                os << ToJSONValue("median", statisticsFilter->GetMedian(labelValue));
                os << ToJSONValue("mean", statisticsFilter->GetMean(labelValue));
                os << ToJSONValue("sigma", statisticsFilter->GetSigma(labelValue));
                os << ToJSONValue("variance", statisticsFilter->GetVariance(labelValue));
                os << ToJSONValue("sum", statisticsFilter->GetSum(labelValue));
                os << ToJSONValue("count", statisticsFilter->GetCount(labelValue));

                auto region = statisticsFilter->GetRegion(labelValue);
                os << ToJSONValue("regionDimension",  region.ImageDimension);
                os << ToJSONValue("regionIndex",  region.GetIndex());
                os << ToJSONValue("regionSize",  region.GetSize());

                os << ToJSONValue("volumeValue",  statisticsFilter->GetCount(labelValue) * pixelSize);
                os << ToJSONValue("volumeUnit",  "\"mm^3\"", "\n");

                if(endIt  - vIt > 1) {
                    os << "},\n";
                } else {
                    os << "}\n";
                }
            }
        }
        os << "]}" << std::endl;
        os.close();
    }
    return EXIT_SUCCESS;
}

template <typename TValue>
std::string ToJSONValue(const std::string& name, TValue value, const std::string& postfix) {
    std::stringstream ss;
    ss << '"' << name << "\": " << value << postfix;
    return ss.str();
}

template<typename TImage>
typename TImage::Pointer ReadFile(const std::string filePath) {
    using FileReaderType = itk::ImageFileReader<TImage>;
    typename FileReaderType::Pointer reader = FileReaderType::New();
    reader->SetFileName(filePath);
    try
    {
        reader->Update();
    }
    catch (itk::ExceptionObject & excep)
    {
        std::cerr << excep << std::endl;
    }
    typename TImage::Pointer inputImage = reader->GetOutput();
    return inputImage;
}
